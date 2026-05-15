import { buildState, CARDS, ensureTurnIfReady, getLobby, getPlayers, requireUser, startNextTurn } from "./core-clash-v2";

type CardType = "attack" | "defense" | "utility" | "trap" | "overload" | "pass";
type Card = { id: string; name: string; type: CardType; cost: number; tags?: string[] };
type PlayerState = { id: number; user_id: number; side: "creator" | "opponent"; hp: number; energy: number; heat: number; deck_json: string; hand_json: string; discard_json: string; energy_delta_next?: number; draw_block_next?: number };

type Step = {
  actor: "creator" | "opponent";
  card: string;
  text: string;
  target?: "creator" | "opponent";
  damage?: number;
  heal?: number;
};

const MAX_HAND = 6;
const MAX_ENERGY = 8;
const MAX_TURNS = 30;
const MAX_HP = 60;
const BOT_EMAIL_MARKER = ".bot@ekatech.local";
const PASS_CARD: Card = { id: "pass", name: "Skip", type: "pass", cost: 0 };

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    const url = new URL(context.request.url);
    const lobbyId = Number(url.searchParams.get("lobby_id"));
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });
    await markEntered(context, lobbyId, auth.user.id);
    await ensureTurnIfReady(context, lobbyId);
    await maybePlayBotCard(context, lobbyId);
    await resolveIfReady(context, lobbyId);
    await resolveExpiredTurn(context, lobbyId);
    return Response.json(await buildState(context, lobbyId, auth.user.id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Core Clash maçı alınamadı." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await context.request.json().catch(() => null);
    const lobbyId = Number(body?.lobby_id);
    const action = String(body?.action || "play");
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    await markEntered(context, lobbyId, auth.user.id);
    await ensureTurnIfReady(context, lobbyId);
    await maybePlayBotCard(context, lobbyId);
    await resolveIfReady(context, lobbyId);
    await resolveExpiredTurn(context, lobbyId);

    if (action === "next") {
      await advanceAfterResolved(context, lobbyId, auth.user.id);
      await maybePlayBotCard(context, lobbyId);
      await resolveIfReady(context, lobbyId);
      return Response.json(await buildState(context, lobbyId, auth.user.id));
    }

    const cardId = action === "skip" ? "pass" : String(body?.card_id || "").trim();
    if (!cardId) return Response.json({ error: "Kart seçilmedi." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby || lobby.status !== "in_progress") return Response.json({ error: "Maç aktif değil." }, { status: 409 });
    const players = await getPlayers(context, lobbyId);
    const player = players.find((p: any) => Number(p.user_id) === Number(auth.user.id));
    if (!player) return Response.json({ error: "Bu maçta değilsin." }, { status: 403 });

    const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
    if (!turn) return Response.json({ error: "Aktif tur yok. Rakibin maça girmesi bekleniyor." }, { status: 409 });
    const column = player.side === "creator" ? "creator_card_id" : "opponent_card_id";
    if (turn[column]) return Response.json({ error: "Bu tur zaten seçim yaptın." }, { status: 409 });

    if (cardId !== "pass") {
      const card = CARDS[cardId];
      if (!card) return Response.json({ error: "Kart bulunamadı." }, { status: 400 });
      if (Number(player.energy || 0) < card.cost) return Response.json({ error: "Enerjin yetmiyor." }, { status: 400 });
      const hand = safeJson(player.hand_json);
      const handIndex = hand.indexOf(cardId);
      if (handIndex === -1) return Response.json({ error: "Bu kart elinde yok." }, { status: 400 });
      hand.splice(handIndex, 1);
      const discard = safeJson(player.discard_json);
      discard.push(cardId);
      await context.env.DB.prepare("UPDATE core_clash_players SET energy = energy - ?, hand_json = ?, discard_json = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(card.cost, JSON.stringify(hand.slice(0, MAX_HAND)), JSON.stringify(discard), player.id)
        .run();
    }

    await context.env.DB.prepare(`UPDATE core_clash_turns SET ${column} = ? WHERE id = ? AND ${column} IS NULL`).bind(cardId, turn.id).run();
    await maybePlayBotCard(context, lobbyId);
    await resolveIfReady(context, lobbyId);
    return Response.json(await buildState(context, lobbyId, auth.user.id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kart seçilemedi." }, { status: 500 });
  }
}

async function markEntered(context: any, lobbyId: number, userId: number) {
  await context.env.DB.prepare("UPDATE core_clash_players SET entered_at = COALESCE(entered_at, datetime('now')), updated_at = datetime('now') WHERE lobby_id = ? AND user_id = ?").bind(lobbyId, userId).run();
}

async function resolveExpiredTurn(context: any, lobbyId: number) {
  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (!turn) return;
  const deadline = parseDateMs(turn.deadline_at);
  if (!Number.isFinite(deadline) || Date.now() < deadline) return;

  const creator = turn.creator_card_id || "pass";
  const opponent = turn.opponent_card_id || "pass";
  await context.env.DB.prepare("UPDATE core_clash_turns SET creator_card_id = ?, opponent_card_id = ? WHERE id = ?").bind(creator, opponent, turn.id).run();
  await resolveTurn(context, lobbyId, { ...turn, creator_card_id: creator, opponent_card_id: opponent });
}

async function resolveIfReady(context: any, lobbyId: number) {
  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (turn && turn.creator_card_id && turn.opponent_card_id) await resolveTurn(context, lobbyId, turn);
}

async function maybePlayBotCard(context: any, lobbyId: number) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress") return;
  const botId = getBotUserIdFromLobby(lobby);
  if (!botId) return;

  await context.env.DB.prepare("UPDATE core_clash_players SET entered_at = COALESCE(entered_at, datetime('now')), updated_at = datetime('now') WHERE lobby_id = ? AND user_id = ?").bind(lobbyId, botId).run();

  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (!turn) return;
  const botSide = Number(lobby.creator_user_id) === Number(botId) ? "creator" : "opponent";
  const column = botSide === "creator" ? "creator_card_id" : "opponent_card_id";
  if (turn[column]) return;

  const deadline = parseDateMs(turn.deadline_at);
  const turnStart = Number.isFinite(deadline) ? deadline - 20000 : Date.now();
  const botName = String(lobby.opponent_name || lobby.creator_name || "").toLowerCase();
  const skillDelay = botName.includes("glitch") ? 900 : botName.includes("echo") ? 3600 : 1900;
  const delay = skillDelay + (hashNumber(`${lobbyId}:${turn.turn_number}:bot-delay`) % 2600);
  if (Date.now() < turnStart + delay && (!Number.isFinite(deadline) || Date.now() < deadline - 2500)) return;

  const players = await getPlayers(context, lobbyId);
  const botPlayer = players.find((p: any) => Number(p.user_id) === Number(botId));
  if (!botPlayer) return;
  const cardId = chooseBotCard(botPlayer, lobby.map_key, botName);
  if (!cardId) return;
  await playBotCard(context, botPlayer, turn, cardId, column);
}

function chooseBotCard(player: any, mapKey: string, name: string) {
  const hand = safeJson(player.hand_json);
  const energy = Number(player.energy || 0);
  const playable = hand.map((id: string) => CARDS[id]).filter((card: Card | undefined) => card && card.cost <= energy) as Card[];
  if (!playable.length) return "pass";
  const skill = name.includes("glitch") ? "hard" : name.includes("echo") ? "easy" : "normal";
  const boostedType = mapType(mapKey);
  const hp = Number(player.hp || 0);
  const heat = Number(player.heat || 0);
  const scored = playable.map((card) => {
    let score = 10 - card.cost;
    if (card.type === boostedType) score += skill === "easy" ? 1 : 4;
    if (hp <= 24 && card.type === "defense") score += 7;
    if (card.type === "attack") score += skill === "hard" ? 5 : 3;
    if (card.type === "overload" && heat >= 2) score -= 6;
    if (card.type === "utility" && skill !== "easy") score += 2;
    if (card.tags?.includes("heal") && hp <= 30) score += 4;
    if (card.tags?.includes("energy") && energy <= 4) score += 3;
    score += hashUnit(`${player.id}:${card.id}:${skill}`) * (skill === "hard" ? 2 : 7);
    return { id: card.id, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.id || playable[0].id;
}

async function playBotCard(context: any, player: any, turn: any, cardId: string, column: string) {
  const card = cardId === "pass" ? PASS_CARD : CARDS[cardId];
  if (!card) return;
  if (cardId !== "pass") {
    const hand = safeJson(player.hand_json);
    const handIndex = hand.indexOf(cardId);
    if (handIndex === -1 || Number(player.energy || 0) < card.cost) return;
    hand.splice(handIndex, 1);
    const discard = safeJson(player.discard_json);
    discard.push(cardId);
    await context.env.DB.prepare("UPDATE core_clash_players SET energy = energy - ?, hand_json = ?, discard_json = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(card.cost, JSON.stringify(hand.slice(0, MAX_HAND)), JSON.stringify(discard), player.id)
      .run();
  }
  await context.env.DB.prepare(`UPDATE core_clash_turns SET ${column} = ? WHERE id = ? AND ${column} IS NULL`).bind(cardId, turn.id).run();
}

async function resolveTurn(context: any, lobbyId: number, turn: any) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress") return;
  const players = await getPlayers(context, lobbyId) as PlayerState[];
  const creator = players.find((p) => p.side === "creator");
  const opponent = players.find((p) => p.side === "opponent");
  if (!creator || !opponent) return;

  const creatorCard = CARDS[turn.creator_card_id] || PASS_CARD;
  const opponentCard = CARDS[turn.opponent_card_id] || PASS_CARD;
  const result = calculateResolution(lobby.map_key, creator, opponent, creatorCard, opponentCard);

  await updatePlayer(context, creator.id, result.creator);
  await updatePlayer(context, opponent.id, result.opponent);

  const creatorHp = Math.max(0, result.creator.hp);
  const opponentHp = Math.max(0, result.opponent.hp);
  let winner: number | null = null;
  if (creatorHp <= 0 && opponentHp <= 0) winner = result.creator.hp >= result.opponent.hp ? Number(creator.user_id) : Number(opponent.user_id);
  else if (creatorHp <= 0) winner = Number(opponent.user_id);
  else if (opponentHp <= 0) winner = Number(creator.user_id);
  else if (Number(turn.turn_number || 0) >= MAX_TURNS) winner = creatorHp >= opponentHp ? Number(creator.user_id) : Number(opponent.user_id);

  const payload = JSON.stringify({ text: result.text, steps: result.steps });
  await context.env.DB.prepare("UPDATE core_clash_turns SET status = 'resolved', resolution = ?, resolved_at = datetime('now') WHERE id = ? AND status = 'active'").bind(payload, turn.id).run();

  if (winner) {
    await context.env.DB.prepare("UPDATE core_clash_lobbies SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ?").bind(winner, lobbyId).run();
  }
}

async function advanceAfterResolved(context: any, lobbyId: number, userId: number) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress") return;
  const player = (await getPlayers(context, lobbyId)).find((p: any) => Number(p.user_id) === Number(userId));
  if (!player) return;
  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (!turn || turn.status !== "resolved") return;
  await startNextTurn(context, lobbyId, Number(turn.turn_number || 0) + 1);
}

function calculateResolution(mapKey: string, creator: PlayerState, opponent: PlayerState, creatorCard: Card, opponentCard: Card) {
  const c = mutable(creator);
  const o = mutable(opponent);
  const steps: Step[] = [];
  const mapBoost = mapType(mapKey);
  applyCard(mapBoost, c, o, creatorCard, opponentCard, steps, "creator");
  applyCard(mapBoost, o, c, opponentCard, creatorCard, steps, "opponent");
  if (c.heat >= 3) { c.energy_delta_next -= 1; steps.push({ actor: "creator", card: "Overheat", text: "Creator overheat oldu: gelecek tur -1 enerji." }); }
  if (o.heat >= 3) { o.energy_delta_next -= 1; steps.push({ actor: "opponent", card: "Overheat", text: "Opponent overheat oldu: gelecek tur -1 enerji." }); }
  const text = steps.map((step) => step.text).join(" ") || "İki taraf da skip geçti.";
  return { creator: c, opponent: o, steps, text };
}

function applyCard(mapBoost: CardType, self: any, enemy: any, card: Card, enemyCard: Card, steps: Step[], actor: "creator" | "opponent") {
  const boosted = card.type === mapBoost;
  const target = actor === "creator" ? "opponent" : "creator";
  let damage = 0;
  let heal = 0;
  let reflect = 0;
  let blocked = false;
  let reduction = 0;

  if (card.id === "pass") steps.push({ actor, card: card.name, text: `${actorName(actor)} skip geçti.` });

  if (card.id === "ping_snipe") damage = 4;
  if (card.id === "glitch_strike") damage = 7;
  if (card.id === "packet_burst") damage = enemyCard.type === "defense" ? 6 : 10;
  if (card.id === "buffer_barrage") damage = enemyCard.type === "trap" ? 6 : 9;
  if (card.id === "pierce_injection") damage = 8;
  if (card.id === "double_ping") damage = 8;
  if (card.id === "cache_bomb") { damage = 9; enemy.energy_delta_next -= 1; }
  if (card.id === "exploit_chain") damage = enemyCard.type === "utility" || enemyCard.type === "trap" ? 12 : 7;
  if (card.id === "core_spike") { damage = 12; self.heat += 1; }
  if (card.id === "kernel_lance") { damage = 11; self.heat += 1; }
  if (card.id === "core_overload") { damage = 15; self.heat += 2; }
  if (card.id === "meltdown") { damage = 18; self.heat += 3; self.hp -= 4; }

  if (card.id === "blackout") { enemy.draw_block_next = 1; enemy.energy_delta_next -= 1; self.heat += 1; steps.push({ actor, card: card.name, text: `${actorName(actor)} Blackout oynadı.` }); }
  if (card.id === "singularity_push") { damage = 8; enemy.energy_delta_next -= 2; enemy.draw_block_next = 1; self.heat += 2; }
  if (card.id === "admin_override") { blocked = enemyCard.type === "attack" || enemyCard.type === "overload"; heal = 6; self.heat += 2; }

  if (card.id === "emergency_patch") heal = 6;
  if (card.id === "repair_drone") { heal = 8; self.energy_delta_next += 1; }
  if (card.id === "reboot_protocol") { heal = 14; self.heat = Math.max(0, self.heat - 2); self.energy_delta_next -= 1; }
  if (card.id === "full_restore") { heal = 15; self.heat += 2; }
  if (card.id === "shield_bash") { heal = 3; if (enemyCard.type === "attack" || enemyCard.type === "overload") damage = 5; }
  if (card.id === "quarantine_wall") { heal = 3; if (enemyCard.type === "utility" || enemyCard.type === "trap") enemy.draw_block_next = 1; }

  if (card.id === "battery_backup") self.energy_delta_next += 2;
  if (card.id === "energy_surge") self.energy_delta_next += 3;
  if (card.id === "packet_duplication") { self.draw_block_next = -1; self.energy_delta_next += 1; }
  if (card.id === "quick_compile") self.draw_block_next = -1;
  if (card.id === "signal_boost") { self.draw_block_next = -1; self.energy_delta_next += 1; }
  if (card.id === "cooldown_flush") { self.heat = Math.max(0, self.heat - 3); heal = Math.max(heal, 2); }
  if (card.id === "data_drain") enemy.energy_delta_next -= 2;
  if (card.id === "system_scan") self.draw_block_next = -1;
  if (card.id === "hand_jam" && enemyCard.type === "utility") { enemy.draw_block_next = 1; enemy.energy_delta_next -= 1; steps.push({ actor, card: card.name, text: `${actorName(actor)} Hand Jam ile utility bozdu.` }); }
  else if (card.id === "hand_jam") damage = Math.max(damage, 3);

  if (boosted && card.type === "attack") { damage += 1; if (card.cost >= 5) self.heat += 1; }
  if (boosted && card.type === "utility") self.draw_block_next = -1;

  const pierces = card.id === "pierce_injection" || card.id === "kernel_lance";
  if (enemyCard.id === "core_shield" && damage > 0 && !pierces) blocked = true;
  if (enemyCard.id === "admin_override" && damage > 0 && !pierces) blocked = true;
  if (enemyCard.id === "firewall" && damage > 0 && !pierces) damage = Math.ceil(damage / 2);
  if (enemyCard.id === "nano_barrier" && damage > 0 && !pierces) reduction += 4;
  if (enemyCard.id === "quarantine_wall" && (card.type === "utility" || card.type === "trap")) { enemy.energy_delta_next += 1; damage = Math.max(0, damage - 2); }
  if (enemyCard.id === "false_firewall" && pierces) blocked = true;
  if (enemyCard.id === "mirror_bug" && (card.type === "attack" || card.type === "overload")) reflect += Math.ceil(damage / 2);
  if (enemyCard.id === "redirect_loop" && card.type === "attack") reflect += Math.ceil(damage * 0.45);
  if (enemyCard.id === "packet_trap" && card.cost >= 4) reflect += enemyCard.type === mapBoost ? 8 : 6;
  if (enemyCard.id === "logic_bomb" && card.cost >= 5) reflect += 10;
  if (enemyCard.id === "honeypot" && card.type === "utility") { reflect += 4; self.energy_delta_next -= 1; }
  if (enemyCard.id === "checksum_snare" && card.cost <= 2 && card.id !== "pass") { reflect += 3; enemy.energy_delta_next += 1; }
  if (enemyCard.id === "static_field" && (card.id === "double_ping" || card.id === "buffer_barrage")) reflect += 5;
  if (card.id === "decoy_packet" && enemyCard.type === "trap") { reflect = 0; steps.push({ actor, card: card.name, text: `${actorName(actor)} Decoy Packet ile trap boşa çıkardı.` }); }

  if (blocked) damage = 0;
  if (reduction > 0) damage = Math.max(0, damage - reduction);
  if (boosted && card.type === "defense") heal += 1;
  if (boosted && card.type === "trap" && reflect > 0) reflect += 1;

  self.hp = Math.min(MAX_HP, self.hp + heal);
  enemy.hp = Math.max(0, enemy.hp - damage);
  self.hp = Math.max(0, self.hp - reflect);

  if (blocked) steps.push({ actor, card: card.name, text: `${actorName(actor)} saldırısı bloklandı.` });
  if (reduction > 0 && damage > 0) steps.push({ actor: target, card: enemyCard.name, text: `${actorName(actor)} hasarı ${reduction} azaltıldı.` });
  if (damage > 0) steps.push({ actor, card: card.name, text: `${actorName(actor)} ${card.name} ile ${damage} hasar verdi.`, target, damage });
  if (heal > 0) steps.push({ actor, card: card.name, text: `${actorName(actor)} ${heal} HP yeniledi.`, target: actor, heal });
  if (reflect > 0) steps.push({ actor: target, card: enemyCard.name, text: `${actorName(actor)} ${reflect} yansıma hasarı aldı.`, target: actor, damage: reflect });
}

function actorName(actor: "creator" | "opponent") {
  return actor === "creator" ? "Creator" : "Opponent";
}
function mutable(p: PlayerState) {
  return { hp: Number(p.hp || 0), energy: Number(p.energy || 0), heat: Number(p.heat || 0), energy_delta_next: Number(p.energy_delta_next || 0), draw_block_next: Number(p.draw_block_next || 0) };
}
async function updatePlayer(context: any, id: number, p: any) {
  await context.env.DB.prepare("UPDATE core_clash_players SET hp = ?, energy = ?, heat = ?, energy_delta_next = ?, draw_block_next = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(Math.max(0, p.hp), Math.max(0, Math.min(MAX_ENERGY, p.energy)), Math.max(0, p.heat), p.energy_delta_next, p.draw_block_next, id)
    .run();
}
function isBotIdentity(name?: string | null, email?: string | null) {
  return String(email || "").toLowerCase().includes(BOT_EMAIL_MARKER) || String(name || "").toUpperCase().includes("BOT");
}
function getBotUserIdFromLobby(lobby: any) {
  if (isBotIdentity(lobby.creator_name, lobby.creator_email)) return Number(lobby.creator_user_id || 0);
  if (isBotIdentity(lobby.opponent_name, lobby.opponent_email)) return Number(lobby.opponent_user_id || 0);
  return 0;
}
function parseDateMs(value?: string | null) {
  if (!value) return 0;
  const text = String(value);
  return Date.parse(text.includes("T") ? text : text.replace(" ", "T") + "Z");
}
function mapType(key: string): CardType { if (key === "glitch_ruins") return "trap"; if (key === "overclock_core") return "attack"; if (key === "data_archive") return "utility"; return "defense"; }
function safeJson(text: string) { try { const v = JSON.parse(text || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function hashUnit(value: string) { return (Math.abs(hashNumber(value)) % 10000) / 10000; }
function hashNumber(input: string) { let h = 2166136261; for (let i = 0; i < input.length; i += 1) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }