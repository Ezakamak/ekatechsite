const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const GRID_SIZE = 25;
const HOUSE_EDGE = 0.01;
const RTP = 1 - HOUSE_EDGE;

type JsonResponseInit = ResponseInit & { status?: number };

type ActiveRound = {
  id: number;
  user_id: number;
  bet_amount: number;
  mine_count: number;
  mine_ids: string;
  revealed_ids: string;
  current_multiplier: number;
  status: string;
};

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureMinesTables(context);
    await ensureWallet(context, auth.user.id);
    return json(await buildState(context, auth.user.id));
  } catch (error) {
    return json({ error: "TechMines verisi alınamadı.", detail: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureMinesTables(context);
    await ensureWallet(context, auth.user.id);

    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "start") {
      return json(await startRound(context, auth.user.id, body));
    }

    if (action === "reveal") {
      return json(await revealTile(context, auth.user.id, body));
    }

    if (action === "cashout") {
      return json(await cashoutRound(context, auth.user.id));
    }

    return json({ error: "Geçersiz TechMines işlemi." }, { status: 400 });
  } catch (error) {
    return json({ error: readableError(error) }, { status: 400 });
  }
}

async function startRound(context: any, userId: number, body: any) {
  const existing = await getActiveRound(context, userId);
  if (existing) return { ...(await buildState(context, userId, existing)), message: "active_round" };

  const betAmount = Math.floor(Number(body?.betAmount || 0));
  const mineCount = Math.floor(Number(body?.mineCount || 0));

  if (!Number.isFinite(betAmount) || betAmount < 1) throw new Error("Bahis en az 1 Tech Coin olmalı.");
  if (!Number.isFinite(mineCount) || mineCount < 1 || mineCount > 24) throw new Error("Mayın sayısı 1 ile 24 arasında olmalı.");

  const debit = await context.env.DB
    .prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND COALESCE(balance, 0) >= ?`)
    .bind(betAmount, userId, betAmount)
    .run();

  if (!debit?.success || Number(debit.meta?.changes || 0) < 1) throw new Error("Yeterli Tech Coin yok.");

  await context.env.DB
    .prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`)
    .bind(userId, -betAmount, "TechMines bet")
    .run();

  await context.env.DB
    .prepare(`
      INSERT INTO techcoin_mines_rounds (user_id, bet_amount, mine_count, mine_ids, revealed_ids, current_multiplier, status, started_at, updated_at)
      VALUES (?, ?, ?, ?, '[]', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(userId, betAmount, mineCount, JSON.stringify(buildMineIds(mineCount)))
    .run();

  return { ...(await buildState(context, userId)), message: "round_started" };
}

async function revealTile(context: any, userId: number, body: any) {
  const round = await getActiveRound(context, userId);
  if (!round) throw new Error("Aktif TechMines turu bulunamadı.");

  const tileId = Math.floor(Number(body?.tileId));
  if (!Number.isFinite(tileId) || tileId < 0 || tileId >= GRID_SIZE) throw new Error("Geçersiz karo.");

  const mineIds = parseNumberArray(round.mine_ids);
  const revealedIds = parseNumberArray(round.revealed_ids);
  if (revealedIds.includes(tileId)) return { ...(await buildState(context, userId, round)), message: "already_revealed" };

  if (mineIds.includes(tileId)) {
    const finalRevealed = Array.from(new Set([...revealedIds, tileId, ...mineIds])).sort((a, b) => a - b);
    await context.env.DB
      .prepare(`UPDATE techcoin_mines_rounds SET revealed_ids = ?, status = 'lost', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(JSON.stringify(finalRevealed), round.id)
      .run();
    return { ...(await buildState(context, userId, { ...round, revealed_ids: JSON.stringify(finalRevealed), status: "lost" })), message: "mine_hit" };
  }

  const nextRevealed = Array.from(new Set([...revealedIds, tileId])).sort((a, b) => a - b);
  const multiplier = calculateMultiplier(Number(round.mine_count), nextRevealed.length);
  const safeTiles = GRID_SIZE - Number(round.mine_count);

  if (nextRevealed.length >= safeTiles) {
    const payout = Math.max(0, Math.floor(Number(round.bet_amount) * multiplier));
    await creditWallet(context, userId, payout, "TechMines perfect cashout");
    await context.env.DB
      .prepare(`UPDATE techcoin_mines_rounds SET revealed_ids = ?, current_multiplier = ?, status = 'perfect', payout_amount = ?, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(JSON.stringify(nextRevealed), multiplier, payout, round.id)
      .run();
    return { ...(await buildState(context, userId, { ...round, revealed_ids: JSON.stringify(nextRevealed), current_multiplier: multiplier, status: "perfect" })), message: "perfect", payout };
  }

  await context.env.DB
    .prepare(`UPDATE techcoin_mines_rounds SET revealed_ids = ?, current_multiplier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(JSON.stringify(nextRevealed), multiplier, round.id)
    .run();

  return { ...(await buildState(context, userId, { ...round, revealed_ids: JSON.stringify(nextRevealed), current_multiplier: multiplier })), message: "diamond" };
}

async function cashoutRound(context: any, userId: number) {
  const round = await getActiveRound(context, userId);
  if (!round) throw new Error("Aktif TechMines turu bulunamadı.");

  const payout = Math.max(0, Math.floor(Number(round.bet_amount) * Number(round.current_multiplier || 1)));
  await creditWallet(context, userId, payout, "TechMines cashout");
  await context.env.DB
    .prepare(`UPDATE techcoin_mines_rounds SET status = 'cashed', payout_amount = ?, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(payout, round.id)
    .run();

  return { ...(await buildState(context, userId, { ...round, status: "cashed" })), message: "cashed", payout };
}

async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  if (amount <= 0) return;
  await context.env.DB
    .prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .bind(amount, amount, userId)
    .run();
  await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, amount, reason).run();
}

async function buildState(context: any, userId: number, roundOverride?: ActiveRound | null) {
  const wallet = await context.env.DB.prepare(`SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
  const activeRound = roundOverride || await getActiveRound(context, userId);
  return {
    wallet: {
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      updated_at: wallet?.updated_at || null,
    },
    round: activeRound ? serializeRound(activeRound) : null,
  };
}

function serializeRound(round: ActiveRound) {
  const mineIds = parseNumberArray(round.mine_ids);
  const revealedIds = parseNumberArray(round.revealed_ids);
  const canShowMines = round.status !== "active";
  return {
    id: Number(round.id),
    betAmount: Number(round.bet_amount),
    mineCount: Number(round.mine_count),
    currentMultiplier: Number(round.current_multiplier || 1),
    revealedDiamondsCount: revealedIds.filter((id) => !mineIds.includes(id)).length,
    isRoundActive: round.status === "active",
    status: round.status,
    grid: Array.from({ length: GRID_SIZE }, (_, id) => ({
      id,
      isMine: canShowMines && mineIds.includes(id),
      isRevealed: revealedIds.includes(id),
    })),
  };
}

async function getActiveRound(context: any, userId: number): Promise<ActiveRound | null> {
  return await context.env.DB
    .prepare(`SELECT * FROM techcoin_mines_rounds WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .bind(userId)
    .first();
}

async function ensureMinesTables(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS techcoin_mines_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bet_amount INTEGER NOT NULL,
      mine_count INTEGER NOT NULL,
      mine_ids TEXT NOT NULL,
      revealed_ids TEXT NOT NULL DEFAULT '[]',
      current_multiplier REAL NOT NULL DEFAULT 1,
      payout_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await addColumnIfMissing(context, "coin_wallets", "balance", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(context, "coin_wallets", "lifetime_earned", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(context, "coin_wallets", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfMissing(context, "coin_transactions", "amount", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(context, "coin_transactions", "reason", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing(context, "coin_transactions", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_techcoin_mines_rounds_active_user ON techcoin_mines_rounds(user_id, status)`).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 0, 0, CURRENT_TIMESTAMP)`).bind(userId).run();
  await context.env.DB.prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0), lifetime_earned = COALESCE(lifetime_earned, 0), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE user_id = ?`).bind(userId).run();
}

function buildMineIds(mineCount: number) {
  const mineIds = new Set<number>();
  while (mineIds.size < mineCount) mineIds.add(randomIndex(GRID_SIZE));
  return Array.from(mineIds).sort((a, b) => a - b);
}

function randomIndex(maxExclusive: number) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const array = new Uint32Array(1);
    cryptoApi.getRandomValues(array);
    return array[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function combinations(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  const steps = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= steps; i += 1) result = (result * (n - steps + i)) / i;
  return result;
}

function calculateMultiplier(mineCount: number, diamondsOpened: number) {
  if (diamondsOpened <= 0) return 1;
  const safeTiles = GRID_SIZE - mineCount;
  if (diamondsOpened > safeTiles) return 0;
  const safePathProbability = combinations(safeTiles, diamondsOpened) / combinations(GRID_SIZE, diamondsOpened);
  return (1 / safePathProbability) * RTP;
}

function parseNumberArray(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item < GRID_SIZE) : [];
  } catch {
    return [];
  }
}

async function addColumnIfMissing(context: any, table: string, column: string, definition: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  const exists = (rows?.results || []).some((row: any) => String(row.name || "") === column);
  if (!exists) await context.env.DB.prepare(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`).run();
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!["off", "admin", "owner"].includes(String(user.role || ""))) return { ok: false, status: 403, error: "OFF alanına erişim yetkin yok." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Bilinmeyen hata";
}

function json(payload: unknown, init: JsonResponseInit = {}) {
  return Response.json(payload, init);
}
