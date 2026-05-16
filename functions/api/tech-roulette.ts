const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, index) => index);
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ALLOWED_CHIPS = new Set([1_000_000, 10_000_000, 100_000_000, 1_000_000_000]);
const BET_LIMITS = { min: 1_000_000, max: 10_000_000_000 };

type RouletteBetType = "straight" | "red" | "black" | "odd" | "even" | "column" | "dozen";

type RouletteBet = {
  type: RouletteBetType;
  amount: number;
  value?: number | string;
};

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureRouletteTables(context);
    await ensureWallet(context, auth.user.id);
    const wallet = await getWallet(context, auth.user.id);
    const recent = await context.env.DB
      .prepare(`SELECT id, bet_type, bet_value, bet_amount, winning_number, winning_color, payout_amount, profit_amount, status, created_at FROM tech_roulette_logs WHERE user_id = ? ORDER BY id DESC LIMIT 12`)
      .bind(auth.user.id)
      .all();

    return Response.json({ ok: true, ekatechwallet: wallet.balance, wallet, recent: recent?.results || [] });
  } catch (error) {
    return Response.json({ error: "Tech Roulette SQL durumu yüklenemedi.", detail: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await ensureRouletteTables(context);
    await ensureWallet(context, auth.user.id);

    const bet = parseBet(body);
    const beforeWallet = await getWallet(context, auth.user.id);
    const debit = await context.env.DB
      .prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`)
      .bind(bet.amount, auth.user.id, bet.amount)
      .run();

    if ((debit.meta?.changes || 0) < 1) {
      return Response.json({ error: "Yetersiz ekatechwallet bakiyesi.", ekatechwallet: beforeWallet.balance, wallet: beforeWallet }, { status: 402 });
    }

    await context.env.DB
      .prepare(`INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`)
      .bind(auth.user.id, -bet.amount, `Tech Roulette bahis: ${describeBet(bet)}`)
      .run();

    const winningNumber = secureRouletteNumber();
    const outcome = buildOutcome(winningNumber);
    const settlement = settleBet(bet, winningNumber);

    if (settlement.payoutAmount > 0) {
      await creditWallet(context, auth.user.id, settlement.payoutAmount, `Tech Roulette kazanç: ${winningNumber}`);
    }

    const afterWallet = await getWallet(context, auth.user.id);
    const logResult = await context.env.DB
      .prepare(`
        INSERT INTO tech_roulette_logs (
          user_id, bet_type, bet_value, bet_amount, winning_number, winning_color, winning_parity,
          payout_multiplier, payout_amount, profit_amount, wallet_before, wallet_after, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        auth.user.id,
        bet.type,
        bet.value == null ? null : String(bet.value),
        bet.amount,
        winningNumber,
        outcome.color,
        outcome.parity,
        settlement.oddsMultiplier,
        settlement.payoutAmount,
        settlement.profitAmount,
        beforeWallet.balance,
        afterWallet.balance,
        settlement.won ? "won" : "lost",
      )
      .run();

    return Response.json({
      ok: true,
      roundId: logResult.meta?.last_row_id || null,
      winningNumber,
      color: outcome.color,
      parity: outcome.parity,
      won: settlement.won,
      payoutMultiplier: settlement.oddsMultiplier,
      payoutAmount: settlement.payoutAmount,
      profitAmount: settlement.profitAmount,
      bet,
      ekatechwallet: afterWallet.balance,
      wallet: afterWallet,
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 400 });
  }
}

function parseBet(body: any): RouletteBet {
  const rawType = String(body?.type || body?.betType || "").toLowerCase();
  const type = rawType as RouletteBetType;
  if (!["straight", "red", "black", "odd", "even", "column", "dozen"].includes(type)) throw new Error("Geçersiz rulet bahis türü.");

  const chipAmount = Math.floor(Number(body?.chipAmount || body?.chip || 0));
  const chipCount = Math.max(1, Math.min(10, Math.floor(Number(body?.chipCount || 1))));
  const directAmount = Math.floor(Number(body?.amount || 0));
  const amount = directAmount > 0 ? directAmount : chipAmount * chipCount;

  if (chipAmount > 0 && !ALLOWED_CHIPS.has(chipAmount)) throw new Error("Geçersiz çip değeri. 1M, 10M, 100M veya 1B kullanın.");
  if (!Number.isFinite(amount) || amount < BET_LIMITS.min || amount > BET_LIMITS.max) throw new Error("Bahis 1M ile 10B Tech Coin arasında olmalı.");

  const bet: RouletteBet = { type, amount };

  if (type === "straight") {
    const value = Math.floor(Number(body?.value ?? body?.number));
    if (!Number.isFinite(value) || value < 0 || value > 36) throw new Error("Tek sayı bahsi 0 ile 36 arasında olmalı.");
    bet.value = value;
  }

  if (type === "column") {
    const value = Math.floor(Number(body?.value ?? body?.column));
    if (!Number.isFinite(value) || value < 1 || value > 3) throw new Error("Sütun bahsi 1, 2 veya 3 olmalı.");
    bet.value = value;
  }

  if (type === "dozen") {
    const value = Math.floor(Number(body?.value ?? body?.dozen));
    if (!Number.isFinite(value) || value < 1 || value > 3) throw new Error("Deste bahsi 1, 2 veya 3 olmalı.");
    bet.value = value;
  }

  return bet;
}

function settleBet(bet: RouletteBet, winningNumber: number) {
  const oddsMultiplier = getOddsMultiplier(bet.type);
  const won = isWinningBet(bet, winningNumber);
  const payoutAmount = won ? bet.amount * (oddsMultiplier + 1) : 0;
  return {
    won,
    oddsMultiplier,
    payoutAmount,
    profitAmount: payoutAmount - bet.amount,
  };
}

function isWinningBet(bet: RouletteBet, winningNumber: number) {
  if (bet.type === "straight") return Number(bet.value) === winningNumber;
  if (winningNumber === 0) return false;
  if (bet.type === "red") return RED_NUMBERS.has(winningNumber);
  if (bet.type === "black") return !RED_NUMBERS.has(winningNumber);
  if (bet.type === "odd") return winningNumber % 2 === 1;
  if (bet.type === "even") return winningNumber % 2 === 0;
  if (bet.type === "column") return ((winningNumber - 1) % 3) + 1 === Number(bet.value);
  if (bet.type === "dozen") return Math.ceil(winningNumber / 12) === Number(bet.value);
  return false;
}

function getOddsMultiplier(type: RouletteBetType) {
  if (type === "straight") return 35;
  if (type === "column" || type === "dozen") return 2;
  return 1;
}

function buildOutcome(winningNumber: number) {
  const color = winningNumber === 0 ? "green" : RED_NUMBERS.has(winningNumber) ? "red" : "black";
  const parity = winningNumber === 0 ? "none" : winningNumber % 2 === 0 ? "even" : "odd";
  return { color, parity };
}

function secureRouletteNumber() {
  const maxValid = Math.floor(256 / ROULETTE_NUMBERS.length) * ROULETTE_NUMBERS.length;
  const bytes = new Uint8Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= maxValid);
  return bytes[0] % ROULETTE_NUMBERS.length;
}

async function ensureRouletteTables(context: any) {
  await ensureCoinTables(context);
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS tech_roulette_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bet_type TEXT NOT NULL,
      bet_value TEXT,
      bet_amount INTEGER NOT NULL,
      winning_number INTEGER NOT NULL,
      winning_color TEXT NOT NULL,
      winning_parity TEXT NOT NULL,
      payout_multiplier INTEGER NOT NULL DEFAULT 0,
      payout_amount INTEGER NOT NULL DEFAULT 0,
      profit_amount INTEGER NOT NULL DEFAULT 0,
      wallet_before REAL NOT NULL DEFAULT 0,
      wallet_after REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_roulette_logs_user_created ON tech_roulette_logs(user_id, created_at DESC)`).run();
}

async function ensureCoinTables(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance REAL DEFAULT 100, lifetime_earned REAL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`).bind(userId).run();
}

async function getWallet(context: any, userId: number) {
  const wallet = await context.env.DB.prepare(`SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Number(wallet?.balance || 0),
    lifetime_earned: Number(wallet?.lifetime_earned || 0),
    updated_at: wallet?.updated_at || null,
  };
}

async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`).bind(amount, Math.max(0, amount), userId).run();
  await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(userId, amount, reason).run();
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!["off", "admin", "owner"].includes(user.role)) return { ok: false, status: 403, error: "OFF erişimi gerekli." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function describeBet(bet: RouletteBet) {
  return `${bet.type}${bet.value == null ? "" : `:${bet.value}`} (${bet.amount})`;
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Tech Roulette işlemi tamamlanamadı.";
}
