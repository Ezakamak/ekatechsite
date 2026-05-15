const ABSENCE_GRACE_SECONDS = 4;
const FORFEIT_SECONDS = 30;
const BOT_EMAIL_MARKER = ".bot@ekatech.local";

const TABLES = new Set(["duel_lobbies", "cipher_lobbies", "core_clash_lobbies"]);

type PresenceResult = {
  game: string;
  lobby_id: number;
  paused: boolean;
  missing_user_id: number | null;
  winner_user_id?: number | null;
  deadline_at: string | null;
  seconds_left: number;
  reason?: string;
};

export async function syncGamePresence(context: any, game: string, lobbyTable: string, lobbyId: number, userId: number): Promise<PresenceResult> {
  if (!TABLES.has(lobbyTable)) throw new Error("Invalid lobby table");
  await ensurePresenceTable(context);

  const lobby = await getLobby(context, lobbyTable, lobbyId);
  const empty = baseResult(game, lobbyId);
  if (!lobby || lobby.status !== "in_progress" || !isParticipant(lobby, userId)) return empty;

  await resumeIfReturning(context, game, lobbyId, userId);
  await markActive(context, game, lobbyId, userId);
  await markBotParticipantsActive(context, game, lobby);
  await clearBotAbsences(context, game, lobby);
  await markStaleOpponentAbsent(context, game, lobby);
  await completeExpiredAbsence(context, game, lobbyTable, lobby);

  const latestLobby = await getLobby(context, lobbyTable, lobbyId);
  if (!latestLobby || latestLobby.status !== "in_progress") {
    return { ...empty, winner_user_id: latestLobby?.winner_user_id ?? null };
  }

  return await getPauseState(context, game, latestLobby, userId);
}

export async function markGameLeft(context: any, game: string, lobbyTable: string, lobbyId: number, userId: number): Promise<PresenceResult> {
  if (!TABLES.has(lobbyTable)) throw new Error("Invalid lobby table");
  await ensurePresenceTable(context);

  const lobby = await getLobby(context, lobbyTable, lobbyId);
  const empty = baseResult(game, lobbyId);
  if (!lobby || lobby.status !== "in_progress" || !isParticipant(lobby, userId)) return empty;

  if (await isBotUserId(context, userId)) {
    await markActive(context, game, lobbyId, userId);
    return await getPauseState(context, game, lobby, getOpponentId(lobby, userId) || userId);
  }

  const deadline = new Date(Date.now() + FORFEIT_SECONDS * 1000).toISOString();
  await context.env.DB.prepare(`
    INSERT INTO game_presence (game, lobby_id, user_id, state, leave_deadline_at, updated_at)
    VALUES (?, ?, ?, 'absent', ?, datetime('now'))
    ON CONFLICT(game, lobby_id, user_id) DO UPDATE SET
      state = 'absent',
      leave_deadline_at = excluded.leave_deadline_at,
      updated_at = datetime('now')
  `).bind(game, lobbyId, userId, deadline).run();

  return await getPauseState(context, game, lobby, getOpponentId(lobby, userId) || userId);
}

export async function peekGamePresence(context: any, game: string, lobbyTable: string, lobbyId: number, userId: number): Promise<PresenceResult> {
  if (!TABLES.has(lobbyTable)) throw new Error("Invalid lobby table");
  await ensurePresenceTable(context);

  const lobby = await getLobby(context, lobbyTable, lobbyId);
  const empty = baseResult(game, lobbyId);
  if (!lobby || !isParticipant(lobby, userId)) return empty;

  await markBotParticipantsActive(context, game, lobby);
  await clearBotAbsences(context, game, lobby);
  await completeExpiredAbsence(context, game, lobbyTable, lobby);
  const latestLobby = await getLobby(context, lobbyTable, lobbyId);
  if (!latestLobby || latestLobby.status !== "in_progress") return { ...empty, winner_user_id: latestLobby?.winner_user_id ?? null };
  return await getPauseState(context, game, latestLobby, userId);
}

async function ensurePresenceTable(context: any) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS game_presence (
      game TEXT NOT NULL,
      lobby_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'active',
      leave_deadline_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (game, lobby_id, user_id)
    )
  `).run();
}

async function resumeIfReturning(context: any, game: string, lobbyId: number, userId: number) {
  const row = await context.env.DB.prepare("SELECT * FROM game_presence WHERE game = ? AND lobby_id = ? AND user_id = ? AND state = 'absent'")
    .bind(game, lobbyId, userId)
    .first();

  if (!row) return;
  const leftAtMs = parseTime(row.updated_at);
  const deltaMs = leftAtMs ? Math.max(0, Math.min(FORFEIT_SECONDS * 1000, Date.now() - leftAtMs)) : 0;
  if (deltaMs > 0) await extendGameClocks(context, game, lobbyId, deltaMs);
}

async function extendGameClocks(context: any, game: string, lobbyId: number, deltaMs: number) {
  const seconds = Math.max(1, Math.ceil(deltaMs / 1000));
  if (game === "core_clash") {
    await context.env.DB.prepare("UPDATE core_clash_turns SET deadline_at = datetime(deadline_at, ?) WHERE lobby_id = ? AND status = 'active'")
      .bind(`+${seconds} seconds`, lobbyId).run();
    await context.env.DB.prepare("UPDATE core_clash_lobbies SET deadline_at = datetime(deadline_at, ?), updated_at = datetime('now') WHERE id = ? AND status = 'in_progress' AND deadline_at IS NOT NULL")
      .bind(`+${seconds} seconds`, lobbyId).run();
    return;
  }

  if (game === "tech_duel") {
    await context.env.DB.prepare("UPDATE duel_rounds SET signal_at = datetime(signal_at, ?) WHERE lobby_id = ? AND status IN ('active','waiting_hold')")
      .bind(`+${seconds} seconds`, lobbyId).run();
    return;
  }

  if (game === "cipher") {
    await context.env.DB.prepare("UPDATE cipher_rounds SET started_at = datetime(started_at, ?) WHERE lobby_id = ? AND status = 'active'")
      .bind(`+${seconds} seconds`, lobbyId).run();
  }
}

async function markActive(context: any, game: string, lobbyId: number, userId: number) {
  await context.env.DB.prepare(`
    INSERT INTO game_presence (game, lobby_id, user_id, state, leave_deadline_at, updated_at)
    VALUES (?, ?, ?, 'active', NULL, datetime('now'))
    ON CONFLICT(game, lobby_id, user_id) DO UPDATE SET
      state = 'active',
      leave_deadline_at = NULL,
      updated_at = datetime('now')
  `).bind(game, lobbyId, userId).run();
}

async function markBotParticipantsActive(context: any, game: string, lobby: any) {
  const ids = [Number(lobby.creator_user_id), Number(lobby.opponent_user_id)].filter(Boolean);
  for (const id of ids) {
    if (await isBotUserId(context, id)) {
      await markActive(context, game, Number(lobby.id), id);
    }
  }
}

async function clearBotAbsences(context: any, game: string, lobby: any) {
  const ids = [Number(lobby.creator_user_id), Number(lobby.opponent_user_id)].filter(Boolean);
  for (const id of ids) {
    if (await isBotUserId(context, id)) {
      await context.env.DB.prepare("DELETE FROM game_presence WHERE game = ? AND lobby_id = ? AND user_id = ? AND state = 'absent'")
        .bind(game, lobby.id, id).run();
    }
  }
}

async function markStaleOpponentAbsent(context: any, game: string, lobby: any) {
  const ids = [Number(lobby.creator_user_id), Number(lobby.opponent_user_id)].filter(Boolean);
  const staleBeforeMs = Date.now() - ABSENCE_GRACE_SECONDS * 1000;

  for (const id of ids) {
    if (await isBotUserId(context, id)) {
      await markActive(context, game, Number(lobby.id), id);
      continue;
    }

    const row = await context.env.DB.prepare("SELECT * FROM game_presence WHERE game = ? AND lobby_id = ? AND user_id = ?")
      .bind(game, lobby.id, id).first();

    if (row?.state === "absent") continue;

    const updatedAt = row?.updated_at ? parseTime(row.updated_at) : 0;
    if (!row || !Number.isFinite(updatedAt) || updatedAt < staleBeforeMs) {
      const deadline = new Date(Date.now() + FORFEIT_SECONDS * 1000).toISOString();
      await context.env.DB.prepare(`
        INSERT INTO game_presence (game, lobby_id, user_id, state, leave_deadline_at, updated_at)
        VALUES (?, ?, ?, 'absent', ?, datetime('now'))
        ON CONFLICT(game, lobby_id, user_id) DO UPDATE SET
          state = 'absent',
          leave_deadline_at = COALESCE(game_presence.leave_deadline_at, excluded.leave_deadline_at),
          updated_at = datetime('now')
      `).bind(game, lobby.id, id, deadline).run();
    }
  }
}

async function completeExpiredAbsence(context: any, game: string, lobbyTable: string, lobby: any) {
  const rows = await context.env.DB.prepare("SELECT * FROM game_presence WHERE game = ? AND lobby_id = ? AND state = 'absent'")
    .bind(game, lobby.id).all();

  for (const row of rows?.results || []) {
    if (await isBotUserId(context, Number(row.user_id))) {
      await context.env.DB.prepare("DELETE FROM game_presence WHERE game = ? AND lobby_id = ? AND user_id = ?")
        .bind(game, lobby.id, row.user_id).run();
      continue;
    }

    const deadlineMs = parseTime(row.leave_deadline_at);
    if (!deadlineMs || Date.now() < deadlineMs) continue;

    const winner = getOpponentId(lobby, Number(row.user_id));
    if (!winner) continue;

    const update = await context.env.DB.prepare(`UPDATE ${lobbyTable} SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'`)
      .bind(winner, lobby.id).run();

    if (Number(update?.meta?.changes || 0) > 0) {
      await awardCoins(context, game, winner, Number(lobby.reward_amount || 0), Number(lobby.id));
    }
    break;
  }
}

async function getPauseState(context: any, game: string, lobby: any, viewerUserId: number): Promise<PresenceResult> {
  const rows = await context.env.DB.prepare("SELECT * FROM game_presence WHERE game = ? AND lobby_id = ? AND state = 'absent' ORDER BY updated_at ASC")
    .bind(game, lobby.id).all();

  let absent: any = null;
  for (const row of rows?.results || []) {
    if (await isBotUserId(context, Number(row.user_id))) {
      await context.env.DB.prepare("DELETE FROM game_presence WHERE game = ? AND lobby_id = ? AND user_id = ?")
        .bind(game, lobby.id, row.user_id).run();
      continue;
    }
    absent = row;
    break;
  }

  if (!absent) return baseResult(game, Number(lobby.id));

  const deadlineMs = parseTime(absent.leave_deadline_at);
  const secondsLeft = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)) : 0;
  const missing = Number(absent.user_id);
  return {
    game,
    lobby_id: Number(lobby.id),
    paused: true,
    missing_user_id: missing,
    deadline_at: absent.leave_deadline_at || null,
    seconds_left: secondsLeft,
    reason: missing === Number(viewerUserId) ? "you_left" : "opponent_left",
  };
}

function baseResult(game: string, lobbyId: number): PresenceResult {
  return { game, lobby_id: lobbyId, paused: false, missing_user_id: null, deadline_at: null, seconds_left: 0 };
}

async function getLobby(context: any, table: string, lobbyId: number) {
  return await context.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(lobbyId).first();
}

function isParticipant(lobby: any, userId: number) {
  return Number(lobby.creator_user_id) === Number(userId) || Number(lobby.opponent_user_id) === Number(userId);
}

function getOpponentId(lobby: any, userId: number) {
  if (Number(lobby.creator_user_id) === Number(userId)) return Number(lobby.opponent_user_id || 0) || null;
  if (Number(lobby.opponent_user_id) === Number(userId)) return Number(lobby.creator_user_id || 0) || null;
  return null;
}

async function isBotUserId(context: any, userId: number) {
  if (!userId) return false;
  try {
    const user = await context.env.DB.prepare("SELECT name, email FROM users WHERE id = ?").bind(userId).first();
    return String(user?.email || "").toLowerCase().includes(BOT_EMAIL_MARKER) || String(user?.name || "").toUpperCase().includes("BOT");
  } catch {
    return false;
  }
}

function parseTime(value?: string | null) {
  if (!value) return 0;
  const text = String(value);
  return Date.parse(text.includes("T") ? text : text.replace(" ", "T") + "Z");
}

async function awardCoins(context: any, game: string, userId: number, amount: number, lobbyId: number) {
  if (!amount || amount < 1) return;
  try {
    const reason = `forfeit:${game}:${lobbyId}`;
    const existing = await context.env.DB.prepare("SELECT id FROM coin_transactions WHERE reason = ? LIMIT 1").bind(reason).first();
    if (existing) return;
    await context.env.DB.prepare(`
      INSERT INTO coin_wallets (user_id, balance, lifetime_earned, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        lifetime_earned = lifetime_earned + excluded.lifetime_earned,
        updated_at = datetime('now')
    `).bind(userId, amount, amount).run();
    await context.env.DB.prepare("INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)").bind(userId, amount, reason).run();
  } catch {}
}
