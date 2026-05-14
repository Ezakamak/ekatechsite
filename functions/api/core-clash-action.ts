import { buildState, ensureTurnIfReady, getLobby, getPlayers, requireUser, startNextTurn } from "./core-clash";

type CardType = "attack" | "defense" | "utility" | "trap" | "overload" | "pass";
type Card = { id: string; name: string; type: CardType; cost: number; tags?: string[] };
type PlayerState = { id: number; user_id: number; side: "creator" | "opponent"; hp: number; energy: number; heat: number; deck_json: string; hand_json: string; discard_json: string; energy_delta_next?: number; draw_block_next?: number };

const MAX_HAND = 6;
const MAX_ENERGY = 8;
const MAX_TURNS = 30;
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
  const deadline = Date.parse(String(turn.deadline_at || "").replace(" ", "T") + "Z");
  if (Number.isFinite(deadline) && Date.now() >= deadline) await resolveTurn(context, lobbyId, turn);
}

async function resolveIfReady(context: any, lobbyId: number) {
  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (turn && turn.creator_card_id && turn.opponent_card_id) await resolveTurn(context, lobbyId, turn);
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
    await context.env.DB.prepare("UPDATE core_clash_lobbies SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ?").bind(winner, lobbyId).run();
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

  if (card.id === "glitch_strike") damage = 8;
  if (card.id === "packet_burst") damage = enemyCard.type === "defense" ? 6 : 11;
  if (card.id === "pierce_injection") damage = 9;
  if (card.id === "double_ping") damage = 10;
  if (card.id === "core_spike") { damage = 15; self.heat += 1; }
  if (card.id === "core_overload") { damage = 18; self.heat += 2; }
  if (card.id === "blackout") { enemy.draw_block_next = 1; enemy.energy_delta_next -= 1; self.heat += 1; log.push(`${label} Blackout oynadı.`); }
  if (card.id === "full_restore") { heal = 20; self.heat += 2; }
  if (card.id === "emergency_patch") heal = 7;
  if (card.id === "battery_backup") self.energy_delta_next += 2;
  if (card.id === "data_drain") enemy.energy_delta_next -= 2;
  if (card.id === "system_scan") self.draw_block_next = -1;
  if (card.id === "hand_jam" && enemyCard.type === "utility") { enemy.draw_block_next = 1; enemy.energy_delta_next -= 1; log.push(`${label} Hand Jam ile utility bozdu.`); }
  else if (card.id === "hand_jam") damage = Math.max(damage, 4);

  if (boosted && card.type === "attack") { damage += 2; self.heat += 1; }
  if (boosted && card.type === "utility") self.draw_block_next = -1;

  if (enemyCard.id === "core_shield" && damage > 0 && card.id !== "pierce_injection") blocked = true;
  if (enemyCard.id === "firewall" && damage > 0 && card.id !== "pierce_injection") damage = Math.ceil(damage / 2);
  if (enemyCard.id === "false_firewall" && card.id === "pierce_injection") blocked = true;
  if (enemyCard.id === "mirror_bug" && (card.type === "attack" || card.type === "overload")) reflect += Math.ceil(damage / 2);
  if (enemyCard.id === "packet_trap" && card.cost >= 4) reflect += enemyCard.type === mapBoost ? 10 : 8;
  if (enemyCard.id === "static_field" && card.id === "double_ping") reflect += 6;
  if (card.id === "decoy_packet" && enemyCard.type === "trap") { reflect = 0; log.push(`${label} Decoy Packet ile trap boşa çıkardı.`); }

  if (blocked) damage = 0;
  if (boosted && card.type === "defense") heal += 2;
  if (boosted && card.type === "trap" && reflect > 0) reflect += 2;
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
function mapType(key: string): CardType { if (key === "glitch_ruins") return "trap"; if (key === "overclock_core") return "attack"; if (key === "data_archive") return "utility"; return "defense"; }
function safeJson(text: string) { try { const v = JSON.parse(text || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
