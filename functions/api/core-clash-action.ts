import { recordOffMatchHistory, getGameLabel } from '../_offMatchHistory';
import { buildState, ensureTurnIfReady, getLobby, getPlayers, requireUser, startNextTurn } from "./core-clash";

type CardType = "attack" | "defense" | "utility" | "trap" | "overload" | "pass";
type Card = { id: string; name: string; type: CardType; cost: number; tags?: string[] };
type PlayerState = { id: number; user_id: number; side: "creator" | "opponent"; hp: number; energy: number; heat: number; deck_json: string; hand_json: string; discard_json: string; energy_delta_next?: number; draw_block_next?: number };

const MAX_HAND = 6;
const MAX_ENERGY = 8;
const MAX_TURNS = 30;
const BOT_EMAIL_MARKER = ".bot@ekatech.local";
const PASS_CARD: Card = { id: "pass", name: "Pass", type: "pass", cost: 0 };
const CARDS: Record<string, Card> = {
  glitch_strike: { id: "glitch_strike", name: "Glitch Strike", type: "attack", cost: 2 },
  packet_burst: { id: "packet_burst", name: "Packet Burst", type: "attack", cost: 3 },
  pierce_injection: { id: "pierce_injection", name: "Pierce Injection", type: "attack", cost: 4, tags: ["pierce"] },
  double_ping: { id: "double_ping", name: "Double Ping", type: "attack", cost: 3, tags: ["multi"] },
  core_spike: { id: "core_spike", name: "Core Spike", type: "attack", cost: 5, tags: ["heavy", "heat"] },
  firewall: { id: "firewall", name: "Firewall", type: "defense", cost: 3 },
  core_shield: { id: "core_shield", name: "Core Shield", type: "defense", cost: 4, tags: ["block"] },
  emergency_patch: { id: "emergency_patch", name: "Emergency Patch", type: "defense", cost: 2, tags: ["heal"] },
  static_field: { id: "static_field", name: "Static Field", type: "defense", cost: 3, tags: ["multi-counter"] },
  system_scan: { id: "system_scan", name: "System Scan", type: "utility", cost: 1 },
  data_drain: { id: "data_drain", name: "Data Drain", type: "utility", cost: 3 },
  battery_backup: { id: "battery_backup", name: "Battery Backup", type: "utility", cost: 2 },
  hand_jam: { id: "hand_jam", name: "Hand Jam", type: "utility", cost: 3 },
  mirror_bug: { id: "mirror_bug", name: "Mirror Bug", type: "trap", cost: 3 },
  packet_trap: { id: "packet_trap", name: "Packet Trap", type: "trap", cost: 2 },
  false_firewall: { id: "false_firewall", name: "False Firewall", type: "trap", cost: 2 },
  decoy_packet: { id: "decoy_packet", name: "Decoy Packet", type: "utility", cost: 1, tags: ["anti-trap"] },
  core_overload: { id: "core_overload", name: "Core Overload", type: "overload", cost: 7, tags: ["heavy", "heat"] },
  blackout: { id: "blackout", name: "Blackout", type: "overload", cost: 6, tags: ["control", "heat"] },
  full_restore: { id: "full_restore", name: "Full Restore", type: "overload", cost: 7, tags: ["heal", "heat"] },
};

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
    const cardId = String(body?.card_id || "").trim();
    if (!lobbyId || !cardId) return Response.json({ error: "Lobby veya kart seçilmedi." }, { status: 400 });

    await markEntered(context, lobbyId, auth.user.id);
    await ensureTurnIfReady(context, lobbyId);
    await maybePlayBotCard(context, lobbyId);
    await resolveIfReady(context, lobbyId);
    await resolveExpiredTurn(context, lobbyId);

    const lobby = await getLobby(context, lobbyId);
    if (!lobby || lobby.status !== "in_progress") return Response.json({ error: "Maç aktif değil." }, { status: 409 });
    const players = await getPlayers(context, lobbyId);
    const player = players.find((p: any) => Number(p.user_id) === Number(auth.user.id));
    if (!player) return Response.json({ error: "Bu maçta değilsin." }, { status: 403 });

    const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
    if (!turn) return Response.json({ error: "Aktif tur yok. Rakibin maça girmesi bekleniyor." }, { status: 409 });
    const column = player.side === "creator" ? "creator_card_id" : "opponent_card_id";
    if (turn[column]) return Response.json({ error: "Bu tur zaten kart seçtin." }, { status: 409 });

    const card = CARDS[cardId];
    if (!card) return Response.json({ error: "Kart bulunamadı." }, { status: 400 });
    if (Number(player.energy || 0) < card.cost) return Response.json({ error: "Enerjin yetmiyor." }, { status: 400 });
    const hand = safeJson(player.hand_json);
    const handIndex = hand.indexOf(cardId);
    if (handIndex === -1) return Response.json({ error: "Bu kart elinde yok." }, { status: 400 });
    hand.splice(handIndex, 1);
    const discard = safeJson(player.discard_json);
    discard.push(cardId);
    await context.env.DB.prepare(`UPDATE core_clash_players SET energy = energy - ?, hand_json = ?, discard_json = ?, updated_at = datetime('now') WHERE id = ?`).bind(card.cost, JSON.stringify(hand.slice(0, MAX_HAND)), JSON.stringify(discard), player.id).run();
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
  if (Number.isFinite(deadline) && Date.now() >= deadline) await resolveTurn(context, lobbyId, turn);
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

  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (!turn) return;
  const botSide = Number(lobby.creator_user_id) === Number(botId) ? "creator" : "opponent";
  const column = botSide === "creator" ? "creator_card_id" : "opponent_card_id";
  if (turn[column]) return;

  const deadline = parseDateMs(turn.deadline_at);
  const turnStart = Number.isFinite(deadline) ? deadline - 15000 : Date.now();
  const delay = 1100 + (hashNumber(`${lobbyId}:${turn.turn_number}:bot-delay`) % 4500);
  if (Date.now() < turnStart + delay && (!Number.isFinite(deadline) || Date.now() < deadline - 2200)) return;

  const players = await getPlayers(context, lobbyId);
  const botPlayer = players.find((p: any) => Number(p.user_id) === Number(botId));
  if (!botPlayer) return;
  const cardId = chooseBotCard(botPlayer, lobby.map_key, String(lobby.opponent_name || lobby.creator_name || ""));
  if (!cardId) return;
  await playBotCard(context, botPlayer, turn, cardId, column);
}

function chooseBotCard(player: any, mapKey: string, name: string) {
  const hand = safeJson(player.hand_json);
  const energy = Number(player.energy || 0);
  const playable = hand.map((id: string) => CARDS[id]).filter((card: Card | undefined) => card && card.cost <= energy) as Card[];
  if (!playable.length) return null;
  const skill = name.toLowerCase().includes("glitch") ? "hard" : name.toLowerCase().includes("echo") ? "easy" : "normal";
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
    score += hashUnit(`${player.id}:${card.id}:${skill}`) * (skill === "hard" ? 2 : 7);
    return { id: card.id, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.id || playable[0].id;
}

async function playBotCard(context: any, player: any, turn: any, cardId: string, column: string) {
  const card = CARDS[cardId];
  if (!card) return;
  const hand = safeJson(player.hand_json);
  const handIndex = hand.indexOf(cardId);
  if (handIndex === -1 || Number(player.energy || 0) < card.cost) return;
  hand.splice(handIndex, 1);
  const discard = safeJson(player.discard_json);
  discard.push(cardId);
  await context.env.DB.prepare("UPDATE core_clash_players SET energy = energy - ?, hand_json = ?, discard_json = ?, updated_at = datetime('now') WHERE id = ?").bind(card.cost, JSON.stringify(hand.slice(0, MAX_HAND)), JSON.stringify(discard), player.id).run();
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

  await context.env.DB.prepare("UPDATE core_clash_turns SET status = 'resolved', resolution = ?, resolved_at = datetime('now') WHERE id = ?").bind(result.text, turn.id).run();

  if (winner) {
    await context.env.DB.prepare("UPDATE core_clash_lobbies SET status = 'completed', winner_user_id = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(winner, lobbyId).run();
    await recordOffMatchHistory(context,{gameKey:'core_clash',gameLabel:getGameLabel('core_clash'),lobbyTable:'core_clash_lobbies',lobbyId:Number(lobbyId),hostUserId:Number(lobby.creator_user_id),opponentUserId:Number(lobby.opponent_user_id),winnerUserId:Number(winner),loserUserId:Number(winner)===Number(lobby.creator_user_id)?Number(lobby.opponent_user_id):Number(lobby.creator_user_id),status:'completed',resultJson:{map_key:lobby.map_key,winner_user_id:winner,turn_count:turn.turn_number,final_hp:{creator:creator.hp,opponent:opponent.hp}},startedAt:lobby.created_at,completedAt:new Date().toISOString()});
  } else {
    await startNextTurn(context, lobbyId, Number(turn.turn_number || 0) + 1);
  }
}

function calculateResolution(mapKey: string, creator: PlayerState, opponent: PlayerState, creatorCard: Card, opponentCard: Card) {
  const c = mutable(creator);
  const o = mutable(opponent);
  const log: string[] = [];
  const mapBoost = mapType(mapKey);
  applyCard(mapBoost, c, o, creatorCard, opponentCard, log, "Creator");
  applyCard(mapBoost, o, c, opponentCard, creatorCard, log, "Opponent");
  if (c.heat >= 3) { c.energy_delta_next -= 1; log.push("Creator overheat oldu: gelecek tur -1 enerji."); }
  if (o.heat >= 3) { o.energy_delta_next -= 1; log.push("Opponent overheat oldu: gelecek tur -1 enerji."); }
  return { creator: c, opponent: o, text: log.join(" ") || "İki taraf da pas geçti." };
}

function applyCard(mapBoost: CardType, self: any, enemy: any, card: Card, enemyCard: Card, log: string[], label: string) {
  const boosted = card.type === mapBoost;
  let damage = 0;
  let heal = 0;
  let reflect = 0;
  let blocked = false;

  if (card.id === "glitch_strike") damage = 7;
  if (card.id === "packet_burst") damage = enemyCard.type === "defense" ? 6 : 10;
  if (card.id === "pierce_injection") damage = 8;
  if (card.id === "double_ping") damage = 8;
  if (card.id === "core_spike") { damage = 13; self.heat += 1; }
  if (card.id === "core_overload") { damage = 16; self.heat += 2; }
  if (card.id === "blackout") { enemy.draw_block_next = 1; enemy.energy_delta_next -= 1; self.heat += 1; log.push(`${label} Blackout oynadı.`); }
  if (card.id === "full_restore") { heal = 16; self.heat += 2; }
  if (card.id === "emergency_patch") heal = 6;
  if (card.id === "battery_backup") self.energy_delta_next += 2;
  if (card.id === "data_drain") enemy.energy_delta_next -= 2;
  if (card.id === "system_scan") self.draw_block_next = -1;
  if (card.id === "hand_jam" && enemyCard.type === "utility") { enemy.draw_block_next = 1; enemy.energy_delta_next -= 1; log.push(`${label} Hand Jam ile utility bozdu.`); }
  else if (card.id === "hand_jam") damage = Math.max(damage, 3);

  if (boosted && card.type === "attack") { damage += 1; if (card.cost >= 5) self.heat += 1; }
  if (boosted && card.type === "utility") self.draw_block_next = -1;

  if (enemyCard.id === "core_shield" && damage > 0 && card.id !== "pierce_injection") blocked = true;
  if (enemyCard.id === "firewall" && damage > 0 && card.id !== "pierce_injection") damage = Math.ceil(damage / 2);
  if (enemyCard.id === "false_firewall" && card.id === "pierce_injection") blocked = true;
  if (enemyCard.id === "mirror_bug" && (card.type === "attack" || card.type === "overload")) reflect += Math.ceil(damage / 2);
  if (enemyCard.id === "packet_trap" && card.cost >= 4) reflect += enemyCard.type === mapBoost ? 8 : 6;
  if (enemyCard.id === "static_field" && card.id === "double_ping") reflect += 5;
  if (card.id === "decoy_packet" && enemyCard.type === "trap") { reflect = 0; log.push(`${label} Decoy Packet ile trap boşa çıkardı.`); }

  if (blocked) damage = 0;
  if (boosted && card.type === "defense") heal += 1;
  if (boosted && card.type === "trap" && reflect > 0) reflect += 1;
  self.hp = Math.min(60, self.hp + heal);
  enemy.hp = Math.max(0, enemy.hp - damage);
  self.hp = Math.max(0, self.hp - reflect);
  if (damage > 0) log.push(`${label} ${card.name} ile ${damage} hasar verdi.`);
  if (heal > 0) log.push(`${label} ${heal} HP yeniledi.`);
  if (reflect > 0) log.push(`${label} ${reflect} yansıma hasarı aldı.`);
  if (blocked) log.push(`${label} saldırısı bloklandı.`);
}

function mutable(p: PlayerState) {
  return { hp: Number(p.hp || 0), energy: Number(p.energy || 0), heat: Number(p.heat || 0), energy_delta_next: Number(p.energy_delta_next || 0), draw_block_next: Number(p.draw_block_next || 0) };
}
async function updatePlayer(context: any, id: number, p: any) {
  await context.env.DB.prepare("UPDATE core_clash_players SET hp = ?, energy = ?, heat = ?, energy_delta_next = ?, draw_block_next = ?, updated_at = datetime('now') WHERE id = ?").bind(Math.max(0, p.hp), Math.max(0, Math.min(MAX_ENERGY, p.energy)), Math.max(0, p.heat), p.energy_delta_next, p.draw_block_next, id).run();
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
