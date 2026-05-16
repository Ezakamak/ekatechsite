import { awardGameExp, expForGame } from "../_levels";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const LEVELS = 9;
const TILES_PER_ROW = 4;
const HOUSE_RTP = 0.99;

const DIFFICULTIES = {
  easy: { key: "easy", safeTiles: 3, traps: 1 },
  medium: { key: "medium", safeTiles: 2, traps: 2 },
  hard: { key: "hard", safeTiles: 1, traps: 3 },
} as const;

type DifficultyKey = keyof typeof DIFFICULTIES;
type TileKind = "safe" | "trap";
type JsonResponseInit = ResponseInit & { status?: number };

type ActiveRound = {
  id: number;
  user_id: number;
  bet_amount: number;
  difficulty_key: DifficultyKey;
  matrix_json: string;
  revealed_json: string;
  current_level: number;
  current_multiplier: number;
  payout_amount: number;
  status: string;
};

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureTowersTables(context);
    await ensureWallet(context, auth.user.id);
    return json(await buildState(context, auth.user.id));
  } catch (error) {
    return json(
      { error: "Eka Towers verisi alınamadı.", detail: readableError(error) },
      { status: 500 },
    );
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureTowersTables(context);
    await ensureWallet(context, auth.user.id);

    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "start")
      return json(await startRound(context, auth.user.id, body));
    if (action === "reveal")
      return json(await revealTile(context, auth.user.id, body));
    if (action === "cashout")
      return json(await cashoutRound(context, auth.user.id));

    return json({ error: "Geçersiz Eka Towers işlemi." }, { status: 400 });
  } catch (error) {
    return json({ error: readableError(error) }, { status: 400 });
  }
}

async function startRound(context: any, userId: number, body: any) {
  const existing = await getActiveRound(context, userId);
  if (existing)
    return {
      ...(await buildState(context, userId, existing)),
      message: "active_round",
    };

  const betAmount = Math.floor(Number(body?.betAmount || 0));
  const requestedDifficulty = String(
    body?.difficultyKey || "medium",
  ).toLowerCase();
  const difficultyKey: DifficultyKey = isDifficultyKey(requestedDifficulty)
    ? requestedDifficulty
    : "medium";

  if (!Number.isFinite(betAmount) || betAmount < 1)
    throw new Error("Bahis en az 1 Tech Coin olmalı.");

  const debit = await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
  )
    .bind(betAmount, userId, betAmount)
    .run();

  if (!debit?.success || Number(debit.meta?.changes || 0) < 1)
    throw new Error("Yeterli Tech Coin yok.");

  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`,
  )
    .bind(userId, -betAmount, "Eka Towers bet")
    .run();
  await awardGameExp(
    context,
    userId,
    expForGame(difficultyKey, 14),
    "Eka Towers oyun EXP",
    difficultyKey,
  );

  await context.env.DB.prepare(
    `
      INSERT INTO techcoin_towers_rounds (user_id, bet_amount, difficulty_key, matrix_json, revealed_json, current_level, current_multiplier, status, started_at, updated_at)
      VALUES (?, ?, ?, ?, '[]', 0, 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  )
    .bind(
      userId,
      betAmount,
      difficultyKey,
      JSON.stringify(createMatrix(difficultyKey)),
    )
    .run();

  return { ...(await buildState(context, userId)), message: "round_started" };
}

async function revealTile(context: any, userId: number, body: any) {
  const round = await getActiveRound(context, userId);
  if (!round) throw new Error("Aktif Eka Towers turu bulunamadı.");

  const tileIndex = Math.floor(Number(body?.tileIndex));
  if (
    !Number.isFinite(tileIndex) ||
    tileIndex < 0 ||
    tileIndex >= TILES_PER_ROW
  )
    throw new Error("Geçersiz kutucuk.");

  const level = Number(round.current_level || 0);
  const matrix = parseMatrix(round.matrix_json);
  const revealed = parseRevealed(round.revealed_json);
  if (level < 0 || level >= LEVELS) throw new Error("Geçersiz kule seviyesi.");
  if (
    revealed.some(
      (item) => item.level === level && item.tileIndex === tileIndex,
    )
  )
    return {
      ...(await buildState(context, userId, round)),
      message: "already_revealed",
    };

  const tile = matrix[level]?.[tileIndex];
  const nextRevealed = [...revealed, { level, tileIndex }];

  if (tile === "trap") {
    await context.env.DB.prepare(
      `UPDATE techcoin_towers_rounds SET revealed_json = ?, status = 'lost', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(JSON.stringify(nextRevealed), round.id)
      .run();
    return {
      ...(await buildState(context, userId, {
        ...round,
        revealed_json: JSON.stringify(nextRevealed),
        status: "lost",
      })),
      message: "trap_hit",
    };
  }

  const nextLevel = level + 1;
  const multiplier = multiplierForLevel(nextLevel, round.difficulty_key);

  if (nextLevel >= LEVELS) {
    const payout = payoutForLevel(
      Number(round.bet_amount),
      LEVELS,
      round.difficulty_key,
    );
    await creditWallet(context, userId, payout, "Eka Towers perfect cashout");
    await context.env.DB.prepare(
      `UPDATE techcoin_towers_rounds SET revealed_json = ?, current_level = ?, current_multiplier = ?, payout_amount = ?, status = 'won', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(JSON.stringify(nextRevealed), LEVELS, multiplier, payout, round.id)
      .run();
    return {
      ...(await buildState(context, userId, {
        ...round,
        revealed_json: JSON.stringify(nextRevealed),
        current_level: LEVELS,
        current_multiplier: multiplier,
        payout_amount: payout,
        status: "won",
      })),
      message: "tower_cleared",
      payout,
    };
  }

  await context.env.DB.prepare(
    `UPDATE techcoin_towers_rounds SET revealed_json = ?, current_level = ?, current_multiplier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  )
    .bind(JSON.stringify(nextRevealed), nextLevel, multiplier, round.id)
    .run();

  return {
    ...(await buildState(context, userId, {
      ...round,
      revealed_json: JSON.stringify(nextRevealed),
      current_level: nextLevel,
      current_multiplier: multiplier,
    })),
    message: "safe",
  };
}

async function cashoutRound(context: any, userId: number) {
  const round = await getActiveRound(context, userId);
  if (!round) throw new Error("Aktif Eka Towers turu bulunamadı.");

  const clearedLevels = Number(round.current_level || 0);
  if (clearedLevels <= 0)
    throw new Error("Cashout için önce en az 1 seviyeyi geçmelisin.");

  const payout = payoutForLevel(
    Number(round.bet_amount),
    clearedLevels,
    round.difficulty_key,
  );
  await creditWallet(context, userId, payout, "Eka Towers cashout");
  await context.env.DB.prepare(
    `UPDATE techcoin_towers_rounds SET payout_amount = ?, status = 'cashed', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  )
    .bind(payout, round.id)
    .run();

  return {
    ...(await buildState(context, userId, {
      ...round,
      payout_amount: payout,
      status: "cashed",
    })),
    message: "cashed",
    payout,
  };
}

async function buildState(
  context: any,
  userId: number,
  roundOverride?: ActiveRound | null,
) {
  const wallet = await context.env.DB.prepare(
    `SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  const round = roundOverride || (await getActiveRound(context, userId));
  return {
    wallet: {
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      updated_at: wallet?.updated_at || null,
    },
    round: round ? serializeRound(round) : null,
  };
}

function serializeRound(round: ActiveRound) {
  const matrix = parseMatrix(round.matrix_json);
  const revealed = parseRevealed(round.revealed_json);
  const showAll = round.status !== "active";
  const currentLevel = Number(round.current_level || 0);
  const difficultyKey = isDifficultyKey(String(round.difficulty_key))
    ? round.difficulty_key
    : "medium";

  return {
    id: Number(round.id),
    betAmount: Number(round.bet_amount),
    difficultyKey,
    currentLevel,
    clearedLevels: Math.min(currentLevel, LEVELS),
    currentMultiplier: Number(round.current_multiplier || 1),
    status: round.status,
    isRoundActive: round.status === "active",
    payoutAmount: Number(round.payout_amount || 0),
    matrix: matrix.map((row, level) =>
      row.map((kind, tileIndex) => ({
        id: `${round.id}-${level}-${tileIndex}`,
        kind:
          showAll ||
          revealed.some(
            (item) => item.level === level && item.tileIndex === tileIndex,
          )
            ? kind
            : null,
        revealed:
          showAll ||
          revealed.some(
            (item) => item.level === level && item.tileIndex === tileIndex,
          ),
      })),
    ),
  };
}

async function creditWallet(
  context: any,
  userId: number,
  amount: number,
  reason: string,
) {
  if (amount <= 0) return;
  await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
  )
    .bind(amount, amount, userId)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`,
  )
    .bind(userId, amount, reason)
    .run();
}

function createMatrix(difficultyKey: DifficultyKey) {
  const difficulty = DIFFICULTIES[difficultyKey];
  return Array.from({ length: LEVELS }, () => {
    const row: TileKind[] = [
      ...Array.from({ length: difficulty.safeTiles }, () => "safe" as const),
      ...Array.from({ length: difficulty.traps }, () => "trap" as const),
    ];
    return shuffle(row);
  });
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
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

function multiplierForLevel(level: number, difficultyKey: DifficultyKey) {
  if (level <= 0) return 1;
  const difficulty = DIFFICULTIES[difficultyKey];
  const rowWinChance = difficulty.safeTiles / TILES_PER_ROW;
  return HOUSE_RTP / Math.pow(rowWinChance, level);
}

function payoutForLevel(
  betAmount: number,
  level: number,
  difficultyKey: DifficultyKey,
) {
  return Math.max(
    0,
    Math.floor(
      Number(betAmount || 0) * multiplierForLevel(level, difficultyKey),
    ),
  );
}

function parseMatrix(value: string): TileKind[][] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return createMatrix("medium");
    return Array.from({ length: LEVELS }, (_, level) => {
      const row = Array.isArray(parsed[level]) ? parsed[level] : [];
      return Array.from({ length: TILES_PER_ROW }, (_, tileIndex) =>
        row[tileIndex] === "trap" ? "trap" : "safe",
      );
    });
  } catch {
    return createMatrix("medium");
  }
}

function parseRevealed(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        level: Number(item?.level),
        tileIndex: Number(item?.tileIndex),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.level) &&
          item.level >= 0 &&
          item.level < LEVELS &&
          Number.isInteger(item.tileIndex) &&
          item.tileIndex >= 0 &&
          item.tileIndex < TILES_PER_ROW,
      );
  } catch {
    return [];
  }
}

async function getActiveRound(
  context: any,
  userId: number,
): Promise<ActiveRound | null> {
  return await context.env.DB.prepare(
    `SELECT * FROM techcoin_towers_rounds WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
  )
    .bind(userId)
    .first();
}

async function ensureTowersTables(context: any) {
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS techcoin_towers_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bet_amount INTEGER NOT NULL,
      difficulty_key TEXT NOT NULL,
      matrix_json TEXT NOT NULL,
      revealed_json TEXT NOT NULL DEFAULT '[]',
      current_level INTEGER NOT NULL DEFAULT 0,
      current_multiplier REAL NOT NULL DEFAULT 1,
      payout_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
  await addColumnIfMissing(
    context,
    "coin_wallets",
    "balance",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    context,
    "coin_wallets",
    "lifetime_earned",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    context,
    "coin_wallets",
    "updated_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP",
  );
  await addColumnIfMissing(
    context,
    "coin_transactions",
    "amount",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    context,
    "coin_transactions",
    "reason",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    context,
    "coin_transactions",
    "created_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP",
  );
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_techcoin_towers_rounds_active_user ON techcoin_towers_rounds(user_id, status)`,
  ).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 0, 0, CURRENT_TIMESTAMP)`,
  )
    .bind(userId)
    .run();
  await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0), lifetime_earned = COALESCE(lifetime_earned, 0), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE user_id = ?`,
  )
    .bind(userId)
    .run();
}

async function addColumnIfMissing(
  context: any,
  table: string,
  column: string,
  definition: string,
) {
  const rows = await context.env.DB.prepare(
    `PRAGMA table_info(${quoteIdent(table)})`,
  ).all();
  const exists = (rows?.results || []).some(
    (row: any) => String(row.name || "") === column,
  );
  if (!exists)
    await context.env.DB.prepare(
      `ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`,
    ).run();
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function isDifficultyKey(value: string): value is DifficultyKey {
  return value === "easy" || value === "medium" || value === "hard";
}

async function requireOffUser(context: any) {
  const token = getCookie(
    context.request.headers.get("Cookie") || "",
    "session",
  );
  if (!token)
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(
    `
      SELECT users.id, users.name, users.email,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `,
  )
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked")
    return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!["off", "admin", "owner"].includes(String(user.role || "")))
    return { ok: false, status: 403, error: "OFF alanına erişim yetkin yok." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Bilinmeyen hata";
}

function json(payload: unknown, init: JsonResponseInit = {}) {
  return Response.json(payload, init);
}
