const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const MAP_OPTIONS = ["firewall_city", "glitch_ruins", "overclock_core", "data_archive"];
const STARTING_HP = 60;
const STARTING_ENERGY = 3;
const MAX_ENERGY = 8;
const STARTING_HAND = 3;
const MAX_HAND = 6;
const INACTIVE_MATCH_TIMEOUT_MINUTES = 5;
export const TURN_SECONDS = 20;
const RESOLVED_TURN_FAILSAFE_SECONDS = 3;

type CardType = "attack" | "defense" | "utility" | "trap" | "overload";
type Card = { id: string; name: string; type: CardType; cost: number; tags?: string[]; description?: string; text?: string };
type PlayerState = { id: number; user_id: number; side: "creator" | "opponent"; hp: number; energy: number; heat: number; deck_json: string; hand_json: string; discard_json: string; energy_delta_next?: number; draw_block_next?: number; entered_at?: string | null };

const CARD_DESCRIPTIONS: Record<string, string> = {
  glitch_strike: "7 hasar verir.",
  packet_burst: "10 hasar verir. Rakip defense oynarsa hasarı 6'ya düşer.",
  pierce_injection: "8 delici hasar verir. Core Shield, Firewall, Nano Barrier ve Admin Override savunmalarını deler; False Firewall tarafından durdurulur.",
  double_ping: "8 hasar verir. Static Field oynayan rakibe karşı yansıma riski taşır.",
  core_spike: "12 hasar verir ve 1 Heat kazandırır.",
  ping_snipe: "4 hasar verir. Düşük maliyetli hızlı saldırıdır.",
  buffer_barrage: "9 hasar verir. Rakip trap oynarsa hasarı 6'ya düşer; Static Field'a yakalanabilir.",
  cache_bomb: "9 hasar verir ve rakibin gelecek tur enerjisini 1 azaltır.",
  kernel_lance: "11 delici hasar verir ve 1 Heat kazandırır. Core Shield, Firewall, Nano Barrier ve Admin Override savunmalarını deler; False Firewall tarafından durdurulur.",
  exploit_chain: "Rakip utility veya trap oynarsa 12 hasar, aksi halde 7 hasar verir.",

  firewall: "Gelen delici olmayan hasarı yarıya indirir.",
  core_shield: "Gelen delici olmayan hasarı tamamen bloklar.",
  emergency_patch: "6 HP yeniler.",
  static_field: "Rakip Double Ping veya Buffer Barrage oynarsa 5 yansıma hasarı verir.",
  nano_barrier: "Gelen delici olmayan hasarı 4 azaltır.",
  repair_drone: "8 HP yeniler ve gelecek tur +1 enerji sağlar.",
  shield_bash: "3 HP yeniler. Rakip attack veya overload oynarsa ayrıca 5 hasar verir.",
  quarantine_wall: "3 HP yeniler. Rakip utility veya trap oynarsa rakibin sonraki kart çekimini engeller.",
  reboot_protocol: "14 HP yeniler, Heat değerini 2 azaltır fakat gelecek tur enerjiyi 1 düşürür.",

  system_scan: "Gelecek tur ekstra kart çekmeni sağlar.",
  data_drain: "Rakibin gelecek tur enerjisini 2 azaltır.",
  battery_backup: "Gelecek tur +2 enerji sağlar.",
  hand_jam: "Rakip utility oynarsa kart çekimini engeller ve gelecek tur enerjisini 1 azaltır; aksi halde 3 hasar verir.",
  decoy_packet: "Rakip trap oynarsa yansıma etkisini sıfırlar.",
  quick_compile: "Gelecek tur ekstra kart çekmeni sağlar.",
  energy_surge: "Gelecek tur +3 enerji sağlar.",
  packet_duplication: "Gelecek tur ekstra kart çekmeni ve +1 enerji kazanmanı sağlar.",
  cooldown_flush: "Heat değerini 3 azaltır ve en az 2 HP yeniler.",
  signal_boost: "Gelecek tur ekstra kart çekmeni ve +1 enerji kazanmanı sağlar.",

  mirror_bug: "Rakip attack veya overload oynarsa gelen hasarın yarısını rakibe yansıtır.",
  packet_trap: "Rakip maliyeti 4 veya daha yüksek kart oynarsa yansıma hasarı verir; trap haritasında güçlenir.",
  false_firewall: "Delici saldırıları tamamen bloklar.",
  logic_bomb: "Rakip maliyeti 5 veya daha yüksek kart oynarsa 10 yansıma hasarı verir.",
  redirect_loop: "Rakip attack oynarsa gelen hasarın yaklaşık %45'ini rakibe yansıtır.",
  honeypot: "Rakip utility oynarsa 4 yansıma hasarı verir ve rakibin gelecek tur enerjisini 1 azaltır.",
  checksum_snare: "Rakip maliyeti 2 veya daha düşük kart oynarsa 3 yansıma hasarı verir ve sana gelecek tur +1 enerji sağlar.",

  core_overload: "15 hasar verir ve 2 Heat kazandırır.",
  blackout: "Rakibin gelecek tur kart çekimini engeller, enerjisini 1 azaltır ve sana 1 Heat kazandırır.",
  full_restore: "15 HP yeniler ve 2 Heat kazandırır.",
  meltdown: "18 hasar verir, 3 Heat kazandırır ve sana 4 geri tepme hasarı verir.",
  singularity_push: "8 hasar verir, rakibin gelecek tur enerjisini 2 azaltır, kart çekimini engeller ve 2 Heat kazandırır.",
  admin_override: "Rakip attack veya overload oynarsa saldırıyı bloklar, 6 HP yeniler ve 2 Heat kazandırır."
};

function withDescriptions<T extends Record<string, Card>>(cards: T): T {
  return Object.fromEntries(Object.entries(cards).map(([id, card]) => [id, { ...card, description: CARD_DESCRIPTIONS[id], text: CARD_DESCRIPTIONS[id] }])) as T;
}

export const CARDS: Record<string, Card> = withDescriptions({
  glitch_strike: { id: "glitch_strike", name: "Glitch Strike", type: "attack", cost: 2 },
  packet_burst: { id: "packet_burst", name: "Packet Burst", type: "attack", cost: 3 },
  pierce_injection: { id: "pierce_injection", name: "Pierce Injection", type: "attack", cost: 4, tags: ["pierce"] },
  double_ping: { id: "double_ping", name: "Double Ping", type: "attack", cost: 3, tags: ["multi"] },
  core_spike: { id: "core_spike", name: "Core Spike", type: "attack", cost: 5, tags: ["heavy", "heat"] },
  ping_snipe: { id: "ping_snipe", name: "Ping Snipe", type: "attack", cost: 1, tags: ["cheap"] },
  buffer_barrage: { id: "buffer_barrage", name: "Buffer Barrage", type: "attack", cost: 3, tags: ["multi"] },
  cache_bomb: { id: "cache_bomb", name: "Cache Bomb", type: "attack", cost: 4, tags: ["delayed"] },
  kernel_lance: { id: "kernel_lance", name: "Kernel Lance", type: "attack", cost: 5, tags: ["pierce", "heavy"] },
  exploit_chain: { id: "exploit_chain", name: "Exploit Chain", type: "attack", cost: 4, tags: ["combo"] },

  firewall: { id: "firewall", name: "Firewall", type: "defense", cost: 3 },
  core_shield: { id: "core_shield", name: "Core Shield", type: "defense", cost: 4, tags: ["block"] },
  emergency_patch: { id: "emergency_patch", name: "Emergency Patch", type: "defense", cost: 2, tags: ["heal"] },
  static_field: { id: "static_field", name: "Static Field", type: "defense", cost: 3, tags: ["multi-counter"] },
  nano_barrier: { id: "nano_barrier", name: "Nano Barrier", type: "defense", cost: 2, tags: ["reduce"] },
  repair_drone: { id: "repair_drone", name: "Repair Drone", type: "defense", cost: 3, tags: ["heal"] },
  shield_bash: { id: "shield_bash", name: "Shield Bash", type: "defense", cost: 3, tags: ["counter"] },
  quarantine_wall: { id: "quarantine_wall", name: "Quarantine Wall", type: "defense", cost: 4, tags: ["control"] },
  reboot_protocol: { id: "reboot_protocol", name: "Reboot Protocol", type: "defense", cost: 5, tags: ["heal", "heat"] },

  system_scan: { id: "system_scan", name: "System Scan", type: "utility", cost: 1 },
  data_drain: { id: "data_drain", name: "Data Drain", type: "utility", cost: 3 },
  battery_backup: { id: "battery_backup", name: "Battery Backup", type: "utility", cost: 2 },
  hand_jam: { id: "hand_jam", name: "Hand Jam", type: "utility", cost: 3 },
  decoy_packet: { id: "decoy_packet", name: "Decoy Packet", type: "utility", cost: 1, tags: ["anti-trap"] },
  quick_compile: { id: "quick_compile", name: "Quick Compile", type: "utility", cost: 1, tags: ["draw"] },
  energy_surge: { id: "energy_surge", name: "Energy Surge", type: "utility", cost: 2, tags: ["energy"] },
  packet_duplication: { id: "packet_duplication", name: "Packet Duplication", type: "utility", cost: 3, tags: ["draw", "energy"] },
  cooldown_flush: { id: "cooldown_flush", name: "Cooldown Flush", type: "utility", cost: 2, tags: ["heat"] },
  signal_boost: { id: "signal_boost", name: "Signal Boost", type: "utility", cost: 2, tags: ["tempo"] },

  mirror_bug: { id: "mirror_bug", name: "Mirror Bug", type: "trap", cost: 3 },
  packet_trap: { id: "packet_trap", name: "Packet Trap", type: "trap", cost: 2 },
  false_firewall: { id: "false_firewall", name: "False Firewall", type: "trap", cost: 2 },
  logic_bomb: { id: "logic_bomb", name: "Logic Bomb", type: "trap", cost: 3, tags: ["heavy-counter"] },
  redirect_loop: { id: "redirect_loop", name: "Redirect Loop", type: "trap", cost: 3, tags: ["reflect"] },
  honeypot: { id: "honeypot", name: "Honeypot", type: "trap", cost: 2, tags: ["anti-utility"] },
  checksum_snare: { id: "checksum_snare", name: "Checksum Snare", type: "trap", cost: 2, tags: ["anti-cheap"] },

  core_overload: { id: "core_overload", name: "Core Overload", type: "overload", cost: 7, tags: ["heavy", "heat"] },
  blackout: { id: "blackout", name: "Blackout", type: "overload", cost: 6, tags: ["control", "heat"] },
  full_restore: { id: "full_restore", name: "Full Restore", type: "overload", cost: 7, tags: ["heal", "heat"] },
  meltdown: { id: "meltdown", name: "Meltdown", type: "overload", cost: 8, tags: ["heavy", "heat"] },
  singularity_push: { id: "singularity_push", name: "Singularity Push", type: "overload", cost: 7, tags: ["control", "heat"] },
  admin_override: { id: "admin_override", name: "Admin Override", type: "overload", cost: 8, tags: ["block", "heat"] },
});
const BASE_DECK = [
  "ping_snipe", "glitch_strike", "glitch_strike", "packet_burst", "packet_burst", "double_ping", "buffer_barrage", "pierce_injection", "cache_bomb", "exploit_chain", "core_spike", "kernel_lance",
  "nano_barrier", "firewall", "firewall", "core_shield", "emergency_patch", "repair_drone", "static_field", "shield_bash", "quarantine_wall", "reboot_protocol",
  "system_scan", "system_scan", "quick_compile", "battery_backup", "energy_surge", "data_drain", "hand_jam", "decoy_packet", "packet_duplication", "cooldown_flush", "signal_boost",
  "packet_trap", "false_firewall", "mirror_bug", "logic_bomb", "redirect_loop", "honeypot", "checksum_snare",
  "core_overload", "blackout", "full_restore", "meltdown", "singularity_push", "admin_override"
];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    await cleanup(context);
    const open = await context.env.DB.prepare(`
      SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url,
        opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url,
        winner.name AS winner_name
      FROM core_clash_lobbies l
      JOIN users creator ON l.creator_user_id = creator.id
      LEFT JOIN users opponent ON l.opponent_user_id = opponent.id
      LEFT JOIN users winner ON l.winner_user_id = winner.id
      WHERE l.status IN ('open','in_progress')
      ORDER BY l.id DESC LIMIT 30
    `).all();
    const mine = await context.env.DB.prepare(`
      SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url,
        opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url,
        winner.name AS winner_name
      FROM core_clash_lobbies l
      JOIN users creator ON l.creator_user_id = creator.id
      LEFT JOIN users opponent ON l.opponent_user_id = opponent.id
      LEFT JOIN users winner ON l.winner_user_id = winner.id
      WHERE l.creator_user_id = ? OR l.opponent_user_id = ?
      ORDER BY l.id DESC LIMIT 20
    `).bind(auth.user.id, auth.user.id).all();
    return Response.json({ user: auth.user, open: open?.results || [], mine: mine?.results || [], turn_seconds: TURN_SECONDS });
  } catch {
    return Response.json({ error: "Core Clash verileri alınamadı. d1-core-clash.sql migration'ını çalıştır." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await context.request.json().catch(() => null);
    const requestedMap = String(body?.map_key || "");
    const mapKey = MAP_OPTIONS.includes(requestedMap) ? requestedMap : randomMapKey(auth.user.id);
    const existing = await context.env.DB.prepare("SELECT id FROM core_clash_lobbies WHERE creator_user_id = ? AND status = 'open' LIMIT 1").bind(auth.user.id).first();
    if (existing) return Response.json({ error: "Zaten açık bir Core Clash lobby'n var." }, { status: 409 });
    const result = await context.env.DB.prepare("INSERT INTO core_clash_lobbies (creator_user_id, map_key, status) VALUES (?, ?, 'open')").bind(auth.user.id, mapKey).run();
    const lobbyId = Number(result?.meta?.last_row_id);
    await createPlayer(context, lobbyId, auth.user.id, "creator");
    return Response.json({ success: true, message: "Core Clash lobisi rastgele harita ile oluşturuldu.", lobby_id: lobbyId, map_key: mapKey });
  } catch {
    return Response.json({ error: "Core Clash lobisi oluşturulamadı. d1-core-clash.sql migration'ını çalıştır." }, { status: 500 });
  }
}

export async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "Core Clash için OFF, admin veya owner rolü gerekiyor." };
  return { ok: true, user };
}

export async function createPlayer(context: any, lobbyId: number, userId: number, side: "creator" | "opponent") {
  const deck = shuffle(BASE_DECK, `${lobbyId}:${userId}:${side}`);
  const hand = deck.splice(0, STARTING_HAND);
  await context.env.DB.prepare(`
    INSERT OR IGNORE INTO core_clash_players (lobby_id, user_id, side, hp, energy, heat, deck_json, hand_json, discard_json)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, '[]')
  `).bind(lobbyId, userId, side, STARTING_HP, STARTING_ENERGY, JSON.stringify(deck), JSON.stringify(hand)).run();
}

export async function ensureTurnIfReady(context: any, lobbyId: number) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress" || !lobby.opponent_user_id) return;
  if (await finalizeIfHpDepleted(context, lobbyId)) return;

  const players = await getPlayers(context, lobbyId);
  if (players.length < 2 || players.some((p: any) => !p.entered_at)) return;
  const activeTurn = await context.env.DB.prepare("SELECT id FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' LIMIT 1").bind(lobbyId).first();
  const latest = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (activeTurn) return;
  if (latest?.status === "resolved") {
    await advanceStaleResolvedTurn(context, lobbyId, "ensureTurnIfReady");
    return;
  }
  if (Number(lobby.turn_number || 0) === 0) await startNextTurn(context, lobbyId, 1);
}

export async function startNextTurn(context: any, lobbyId: number, turnNumber: number) {
  if (await finalizeIfHpDepleted(context, lobbyId)) return false;
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress") return false;

  const players = await getPlayers(context, lobbyId);
  if (players.length < 2) return false;

  const existingActive = await context.env.DB.prepare("SELECT id FROM core_clash_turns WHERE lobby_id = ? AND status = 'active' LIMIT 1").bind(lobbyId).first();
  if (existingActive) return false;

  const deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
  const inserted = await context.env.DB.prepare("INSERT OR IGNORE INTO core_clash_turns (lobby_id, turn_number, deadline_at, status) VALUES (?, ?, ?, 'active')").bind(lobbyId, turnNumber, deadline).run();
  if (Number(inserted?.meta?.changes || 0) <= 0) {
    console.log("[CoreClash][round-flow] duplicate next round ignored", { lobbyId, round: turnNumber, phase: "roundTransition" });
    return false;
  }

  for (const p of players) await refreshPlayerForTurn(context, p, turnNumber);

  if (await finalizeIfHpDepleted(context, lobbyId)) return true;

  await context.env.DB.prepare("UPDATE core_clash_lobbies SET turn_number = ?, deadline_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'").bind(turnNumber, deadline, lobbyId).run();
  console.log("[CoreClash][round-flow] phase changed to playing", { lobbyId, round: turnNumber, phase: "playing" });
  return true;
}

export async function advanceStaleResolvedTurn(context: any, lobbyId: number, reason = "failsafe") {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress") return false;
  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  if (!turn || turn.status !== "resolved") return false;
  const resolvedAt = parseDateMs(turn.resolved_at);
  if (Number.isFinite(resolvedAt) && resolvedAt > 0 && Date.now() - resolvedAt < RESOLVED_TURN_FAILSAFE_SECONDS * 1000) return false;
  console.log("[CoreClash][round-flow] resolved turn failsafe advancing", {
    lobbyId,
    round: Number(turn.turn_number || 0),
    phase: "roundTransition",
    playerActionResolved: Boolean(turn.creator_card_id),
    opponentActionResolved: Boolean(turn.opponent_card_id),
    isTransitioning: false,
    reason,
  });
  return await startNextTurn(context, lobbyId, Number(turn.turn_number || 0) + 1);
}

export async function refreshPlayerForTurn(context: any, player: PlayerState, turnNumber: number) {
  let deck = safeJson(player.deck_json);
  let hand = safeJson(player.hand_json);
  let discard = safeJson(player.discard_json);
  const drawFlag = Number(player.draw_block_next || 0);
  const drawCount = turnNumber > 1 && drawFlag < 0 ? 2 : 1;
  if (turnNumber > 1 && drawFlag <= 0 && hand.length < MAX_HAND) {
    for (let draw = 0; draw < drawCount && hand.length < MAX_HAND; draw += 1) {
      if (deck.length === 0 && discard.length > 0) { deck = shuffle(discard, `${player.user_id}:${turnNumber}:reshuffle:${draw}`); discard = []; }
      const drawn = deck.shift();
      if (drawn) hand.push(drawn);
    }
  }
  const baseEnergy = Number(player.energy ?? STARTING_ENERGY) + 1;
  const nextEnergy = Math.max(0, Math.min(MAX_ENERGY, baseEnergy + Number(player.energy_delta_next || 0)));
  const nextHeat = Number(player.heat || 0) >= 3 ? Math.max(0, Number(player.heat || 0) - 2) : Number(player.heat || 0);
  await context.env.DB.prepare("UPDATE core_clash_players SET energy = ?, heat = ?, deck_json = ?, hand_json = ?, discard_json = ?, energy_delta_next = 0, draw_block_next = 0, updated_at = datetime('now') WHERE id = ?").bind(nextEnergy, nextHeat, JSON.stringify(deck), JSON.stringify(hand.slice(0, MAX_HAND)), JSON.stringify(discard), player.id).run();
}

export async function buildState(context: any, lobbyId: number, userId: number) {
  await finalizeIfHpDepleted(context, lobbyId);
  await ensureTurnIfReady(context, lobbyId);

  const lobby = await getLobby(context, lobbyId);
  const players = await getPlayers(context, lobbyId);
  const myPlayer = players.find((p: any) => Number(p.user_id) === Number(userId));
  if (!lobby || !myPlayer) throw new Error("Maç bulunamadı.");

  await context.env.DB.prepare("UPDATE core_clash_players SET entered_at = COALESCE(entered_at, datetime('now')), updated_at = datetime('now') WHERE lobby_id = ? AND user_id = ?").bind(lobbyId, userId).run();
  await finalizeIfHpDepleted(context, lobbyId);
  await ensureTurnIfReady(context, lobbyId);

  const latestLobby = await getLobby(context, lobbyId);
  const latestPlayers = await getPlayers(context, lobbyId);
  const turn = await context.env.DB.prepare("SELECT * FROM core_clash_turns WHERE lobby_id = ? ORDER BY turn_number DESC LIMIT 1").bind(lobbyId).first();
  const me = myPlayer.side;
  const opponent = me === "creator" ? "opponent" : "creator";
  const sideRows: any = Object.fromEntries(latestPlayers.map((p: any) => [p.side, p]));
  const parsed = parseResolution(turn?.resolution || "");

  return {
    user_id: userId,
    lobby: latestLobby,
    me,
    opponent,
    players: {
      creator: { id: latestLobby.creator_user_id, name: latestLobby.creator_name, email: latestLobby.creator_email, avatar_url: latestLobby.creator_avatar_url },
      opponent: { id: latestLobby.opponent_user_id, name: latestLobby.opponent_name, email: latestLobby.opponent_email, avatar_url: latestLobby.opponent_avatar_url },
    },
    hp: { creator: Number(sideRows.creator?.hp || 0), opponent: Number(sideRows.opponent?.hp || 0) },
    energy: { creator: Number(sideRows.creator?.energy || 0), opponent: Number(sideRows.opponent?.energy || 0) },
    heat: { creator: Number(sideRows.creator?.heat || 0), opponent: Number(sideRows.opponent?.heat || 0) },
    hand: safeJson(sideRows[me]?.hand_json).map((id: string) => CARDS[id]).filter(Boolean),
    selected: { creator: turn?.creator_card_id ? "selected" : null, opponent: turn?.opponent_card_id ? "selected" : null },
    turn_number: Number(latestLobby.turn_number || 0),
    deadline_at: latestLobby.deadline_at,
    turn_status: latestLobby.status === "completed" ? "completed" : turn?.status || "waiting",
    resolution_id: turn?.status === "resolved" ? `${latestLobby.id}:${turn.turn_number}:${turn.resolved_at || "done"}` : null,
    resolution_steps: parsed.steps,
    last_resolution: parsed.text || turn?.resolution || null,
    map: mapData(latestLobby.map_key),
    turn_seconds: TURN_SECONDS,
  };
}

export async function finalizeIfHpDepleted(context: any, lobbyId: number) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby || lobby.status !== "in_progress") return false;

  const players = await getPlayers(context, lobbyId);
  const creator = players.find((p: any) => p.side === "creator");
  const opponent = players.find((p: any) => p.side === "opponent");
  if (!creator || !opponent) return false;

  const creatorHp = Number(creator.hp || 0);
  const opponentHp = Number(opponent.hp || 0);
  if (creatorHp > 0 && opponentHp > 0) return false;

  let winner: number | null = null;
  if (creatorHp <= 0 && opponentHp <= 0) winner = creatorHp >= opponentHp ? Number(creator.user_id) : Number(opponent.user_id);
  else if (creatorHp <= 0) winner = Number(opponent.user_id);
  else if (opponentHp <= 0) winner = Number(creator.user_id);

  await context.env.DB.prepare("UPDATE core_clash_turns SET status = CASE WHEN status = 'active' THEN 'resolved' ELSE status END, resolved_at = COALESCE(resolved_at, datetime('now')) WHERE lobby_id = ?").bind(lobbyId).run();
  await context.env.DB.prepare("UPDATE core_clash_lobbies SET status = 'completed', winner_user_id = ?, deadline_at = NULL, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'").bind(winner, lobbyId).run();
  return true;
}

export async function getLobby(context: any, lobbyId: number) {
  await cleanup(context);
  return await context.env.DB.prepare(`
    SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url,
      opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url,
      winner.name AS winner_name
    FROM core_clash_lobbies l
    JOIN users creator ON l.creator_user_id = creator.id
    LEFT JOIN users opponent ON l.opponent_user_id = opponent.id
    LEFT JOIN users winner ON l.winner_user_id = winner.id
    WHERE l.id = ?
  `).bind(lobbyId).first();
}

export async function getPlayers(context: any, lobbyId: number) {
  const rows = await context.env.DB.prepare("SELECT * FROM core_clash_players WHERE lobby_id = ? ORDER BY side ASC").bind(lobbyId).all();
  return rows?.results || [];
}

async function cleanup(context: any) {
  await context.env.DB.prepare("UPDATE core_clash_lobbies SET status = 'expired', updated_at = datetime('now') WHERE status = 'open' AND created_at < datetime('now', '-2 hours')").run();

  await context.env.DB.prepare(`
    UPDATE core_clash_lobbies
    SET status = 'cancelled', winner_user_id = NULL, deadline_at = NULL, updated_at = datetime('now')
    WHERE status = 'in_progress'
      AND updated_at < datetime('now', ?)
  `).bind(`-${INACTIVE_MATCH_TIMEOUT_MINUTES} minutes`).run();

  await context.env.DB.prepare(`
    UPDATE core_clash_turns
    SET status = 'cancelled', resolved_at = datetime('now')
    WHERE status = 'active'
      AND lobby_id IN (
        SELECT id FROM core_clash_lobbies WHERE status = 'cancelled'
      )
  `).run();
}

function mapData(key: string) {
  if (key === "glitch_ruins") return { key, name: "Glitch Ruins", boostType: "trap", boostText: "Trap kartları yansıma/kontrol etkilerinde +1 güç kazanır." };
  if (key === "overclock_core") return { key, name: "Overclock Core", boostType: "attack", boostText: "Attack kartları +1 hasar verir; ağır saldırılar ekstra Heat riski taşır." };
  if (key === "data_archive") return { key, name: "Data Archive", boostType: "utility", boostText: "Utility kartları tempo avantajı verir ve ekstra çekim etkileri güçlenir." };
  return { key: "firewall_city", name: "Firewall City", boostType: "defense", boostText: "Defense kartları +1 iyileştirme/koruma kazanır." };
}
function randomMapKey(userId: number) {
  const index = hashNumber(`${userId}:${Date.now()}:${Math.random()}`) % MAP_OPTIONS.length;
  return MAP_OPTIONS[index];
}
function parseResolution(text: string) { try { const data = JSON.parse(text || "{}"); return { text: data.text || "", steps: Array.isArray(data.steps) ? data.steps : [] }; } catch { return { text, steps: [] }; } }
function safeJson(text: string) { try { const v = JSON.parse(text || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function shuffle(items: string[], seed: string) { const arr = [...items]; let s = hashNumber(seed); for (let i = arr.length - 1; i > 0; i -= 1) { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; const j = s % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function hashNumber(input: string) { let h = 2166136261; for (let i = 0; i < input.length; i += 1) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function getCookie(cookieHeader: string, name: string) { return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1]; }