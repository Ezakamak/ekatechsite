import { awardGameExp, expForGame } from "../_levels";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const TARGET_MIN = 2;
const TARGET_MAX = 98;
const AMOUNT_LIMITS = { min: 1, max: 10_000 };
const RTP = 0.96;

type DiceMode = "over" | "under";

type JsonResponseInit = ResponseInit & { status?: number };

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureDiceTables(context);
    await ensureWallet(context, auth.user.id);
    return json(await buildState(context, auth.user.id));
  } catch (error) {
    return json(
      { error: "Tech Dice verisi alınamadı.", detail: readableError(error) },
      { status: 500 },
    );
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureDiceTables(context);
    await ensureWallet(context, auth.user.id);

    const body = await context.request.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount || 0));
    const target = clampTarget(Number(body?.target ?? 50));
    const mode = parseMode(body?.mode);

    if (!Number.isFinite(amount) || amount < AMOUNT_LIMITS.min)
      throw new Error("Tech Coin amount must be at least 1.");
    if (amount > AMOUNT_LIMITS.max)
      throw new Error(`Tech Coin amount must be ${AMOUNT_LIMITS.max} or less.`);

    const math = diceMath(mode, target);
    const potentialReward = rewardForAmount(amount, math.multiplier);
    const beforeWallet = await getWallet(context, auth.user.id);

    const debit = await context.env.DB.prepare(
      `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
    )
      .bind(amount, auth.user.id, amount)
      .run();

    if ((debit.meta?.changes || 0) < 1) {
      return json(
        {
          error: "Not enough Tech Coin.",
          wallet: beforeWallet,
          limits: AMOUNT_LIMITS,
        },
        { status: 402 },
      );
    }

    await context.env.DB.prepare(
      `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
    )
      .bind(auth.user.id, -amount, `Tech Dice play: ${mode} ${target}`)
      .run();

    const rolledNumber = Number((Math.random() * 100).toFixed(2));
    const won = mode === "over" ? rolledNumber > target : rolledNumber < target;
    const net = won ? potentialReward - amount : -amount;

    if (won) await creditWallet(context, auth.user.id, potentialReward, "Tech Dice reward");

    await context.env.DB.prepare(
      `
        INSERT INTO tech_dice_rolls
          (user_id, mode, target_number, rolled_number, amount, multiplier, win_chance, reward_amount, net_amount, result, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
    )
      .bind(
        auth.user.id,
        mode,
        target,
        rolledNumber,
        amount,
        math.multiplier,
        math.winChance,
        won ? potentialReward : 0,
        net,
        won ? "win" : "loss",
      )
      .run();

    await awardGameExp(
      context,
      auth.user.id,
      expForGame(math.winChance <= 0.2 ? "hard" : math.winChance <= 0.5 ? "medium" : "easy", 8),
      `Tech Dice ${won ? "win" : "roll"}`,
      mode,
    );

    return json({
      ...(await buildState(context, auth.user.id)),
      result: {
        mode,
        target,
        rolledNumber,
        won,
        amount,
        multiplier: math.multiplier,
        winChance: math.winChance,
        rewardAmount: won ? potentialReward : 0,
        lossAmount: won ? 0 : amount,
        net,
        message: won
          ? "Success — Roll landed in the green zone."
          : "Missed — Roll landed in the red zone.",
      },
    });
  } catch (error) {
    return json({ error: readableError(error) }, { status: 400 });
  }
}

async function buildState(context: any, userId: number) {
  const wallet = await getWallet(context, userId);
  const recent = await context.env.DB.prepare(
    `
      SELECT mode, target_number, rolled_number, amount, multiplier, win_chance, reward_amount, net_amount, result, created_at
      FROM tech_dice_rolls
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 20
    `,
  )
    .bind(userId)
    .all();

  return {
    ok: true,
    wallet,
    limits: AMOUNT_LIMITS,
    targetRange: { min: TARGET_MIN, max: TARGET_MAX },
    recent: recent?.results || [],
  };
}

function diceMath(mode: DiceMode, target: number) {
  const winChance = mode === "over" ? (100 - target) / 100 : target / 100;
  const multiplier = Number((RTP / winChance).toFixed(2));
  return { winChance: Number(winChance.toFixed(4)), multiplier };
}

function rewardForAmount(amount: number, multiplier: number) {
  return Math.max(1, Math.floor(amount * multiplier));
}

function clampTarget(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Number(Math.min(TARGET_MAX, Math.max(TARGET_MIN, value)).toFixed(2));
}

function parseMode(value: any): DiceMode {
  return String(value || "over").toLowerCase() === "under" ? "under" : "over";
}

async function ensureDiceTables(context: any) {
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS coin_wallets (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 100,
      lifetime_earned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_dice_rolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      target_number REAL NOT NULL,
      rolled_number REAL NOT NULL,
      amount INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      win_chance REAL NOT NULL,
      reward_amount INTEGER DEFAULT 0,
      net_amount INTEGER DEFAULT 0,
      result TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`,
  )
    .bind(userId)
    .run();
}

async function getWallet(context: any, userId: number) {
  const wallet = await context.env.DB.prepare(
    `SELECT COALESCE(balance, 0) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Number(wallet?.balance || 0),
    lifetime_earned: Number(wallet?.lifetime_earned || 0),
    updated_at: wallet?.updated_at || null,
  };
}

async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`,
  )
    .bind(amount, amount, userId)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
    .bind(userId, amount, reason)
    .run();
}

async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Sign in required." };

  const user = await context.env.DB.prepare(
    `
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `,
  )
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Session expired." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Account blocked." };
  if (!["off", "admin", "owner"].includes(String(user.role)))
    return { ok: false, status: 403, error: "OFF Hub access required." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function json(payload: any, init?: JsonResponseInit) {
  return Response.json(payload, init);
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Tech Dice error.";
}
