const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

type LeaderboardRow = {
  rank: number;
  userId: number;
  name: string;
  avatar_url?: string | null;
  totalValue: number;
  walletBalance: number;
  investedValue: number;
  holdingsCount: number;
  tradesCount: number;
  marketProfit: number;
  profitPercent: number;
  buyVolume: number;
  sellVolume: number;
  currentPositionValue: number;
};

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureTables(context);
    const rows = await buildLeaderboard(context);
    return json({ leaderboard: rows });
  } catch (error) {
    return json({ error: "Leaderboard alınamadı.", detail: readableError(error) }, 500);
  }
}

async function ensureTables(context: any) {
  const db = context.env.DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_stocks (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, price REAL NOT NULL, previous_price REAL NOT NULL, volatility REAL NOT NULL, risk TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_holdings (user_id INTEGER NOT NULL, symbol TEXT NOT NULL, shares INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, symbol))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, symbol TEXT NOT NULL, side TEXT NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL, total REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

async function buildLeaderboard(context: any): Promise<LeaderboardRow[]> {
  const db = context.env.DB;
  const users = (await db.prepare(`
    SELECT DISTINCT users.id, users.name, users.avatar_url
    FROM users
    INNER JOIN market_transactions ON market_transactions.user_id = users.id
    LIMIT 50
  `).all())?.results || [];

  const stocks = (await db.prepare(`SELECT symbol, price FROM market_stocks`).all())?.results || [];
  const prices = Object.fromEntries((stocks as any[]).map((stock) => [stock.symbol, Number(stock.price || 0)]));
  const rows: Omit<LeaderboardRow, "rank">[] = [];

  for (const user of users as any[]) {
    const wallet: any = await db.prepare(`SELECT balance FROM coin_wallets WHERE user_id = ?`).bind(user.id).first();
    const holdings = (await db.prepare(`SELECT symbol, shares FROM market_holdings WHERE user_id = ? AND shares > 0`).bind(user.id).all())?.results || [];
    const trades = (await db.prepare(`SELECT side, total FROM market_transactions WHERE user_id = ?`).bind(user.id).all())?.results || [];
    const liquidation: any = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM coin_transactions WHERE user_id = ? AND amount > 0 AND reason = 'EkaTrade portfolio liquidation'`).bind(user.id).first();

    const currentPositionValue = (holdings as any[]).reduce((sum, holding) => {
      return sum + Number(holding.shares || 0) * Number(prices[holding.symbol] || 0);
    }, 0);

    const buyVolume = (trades as any[])
      .filter((trade) => String(trade.side).toLowerCase() === "buy")
      .reduce((sum, trade) => sum + Number(trade.total || 0), 0);

    const regularSellVolume = (trades as any[])
      .filter((trade) => String(trade.side).toLowerCase() === "sell")
      .reduce((sum, trade) => sum + Number(trade.total || 0), 0);

    const liquidationSellVolume = Number(liquidation?.total || 0);
    const sellVolume = regularSellVolume + liquidationSellVolume;

    const rawProfit = buyVolume > 0 ? currentPositionValue + sellVolume - buyVolume : 0;
    const marketProfit = Math.round(rawProfit);
    const profitPercent = buyVolume > 0 ? (rawProfit / buyVolume) * 100 : 0;
    const walletBalance = Number(wallet?.balance || 0);

    rows.push({
      userId: Number(user.id),
      name: String(user.name || "OFF Player"),
      avatar_url: user.avatar_url || null,
      totalValue: marketProfit,
      walletBalance: Math.round(walletBalance),
      investedValue: Math.round(currentPositionValue),
      holdingsCount: (holdings as any[]).length,
      tradesCount: (trades as any[]).length,
      marketProfit,
      profitPercent: Number(profitPercent.toFixed(2)),
      buyVolume: Math.round(buyVolume),
      sellVolume: Math.round(sellVolume),
      currentPositionValue: Math.round(currentPositionValue),
    });
  }

  return rows
    .sort((a, b) => b.marketProfit - a.marketProfit || b.profitPercent - a.profitPercent || b.tradesCount - a.tradesCount)
    .slice(0, 10)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  const user = await context.env.DB.prepare(`SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')`).bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
