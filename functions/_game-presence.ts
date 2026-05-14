const ABSENCE_GRACE_SECONDS = 4;
const FORFEIT_SECONDS = 30;

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

  await markActive(context, game, lobbyId, userId);
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

async function markStaleOpponentAbsent(context: any, game: string, lobby: any) {
  const ids = [Number(lobby.creator_user_id), Number(lobby.opponent_user_id)].filter(Boolean);
  const staleBeforeMs = Date.now() - ABSENCE_GRACE_SECONDS * 1000;

  for (const id of ids) {
    const row = await context.env.DB.prepare("SELECT * FROM game_presence WHERE game = ? AND lobby_id = ? AND user_id = ?")
      .bind(game, lobby.id, id).first();

    if (row?.state === "absent") continue;

    const updatedAt = row?.updated_at ? Date.parse(String(row.updated_at).includes("T") ? row.updated_at : String(row.updated_at).replace(" ", "T") + "Z") : 0;
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
  const rows = await context.env.DB.prepare("SELECT * FROM game_presence WHERE game = ? AND lobby_id = ? AND state = 'absent' ORDER BY updated_at ASC LIMIT 1")
    .bind(game, lobby.id).all();
  const absent = rows?.results?.[0];
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
