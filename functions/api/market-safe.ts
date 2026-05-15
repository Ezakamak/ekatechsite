const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const MARKET_TICK_MS = 300_000;

type Risk = "low" | "medium" | "high";

const FALLBACK_STOCKS = [
  { symbol: "EKA", name: "EKA Yazılım", sector: "Teknoloji", description_tr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.", description_en: "A fictional cloud software and automation company.", price: 124, previous_price: 124, volatility: 0.055, risk: "medium" as Risk },
  { symbol: "MGROS", name: "Migros", sector: "Perakende", description_tr: "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.", description_en: "OFF simulation asset; not real company/stock data.", price: 82, previous_price: 82, volatility: 0.04, risk: "low" as Risk },
  { symbol: "THY", name: "Türk Hava Yolları", sector: "Ulaşım", description_tr: "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.", description_en: "OFF simulation asset; not real company/stock data.", price: 142, previous_price: 142, volatility: 0.068, risk: "high" as Risk },
  { symbol: "ASELS", name: "Aselsan", sector: "Savunma", description_tr: "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.", description_en: "OFF simulation asset; not real company/stock data.", price: 96, previous_price: 96, volatility: 0.062, risk: "medium" as Risk },
  { symbol: "AKSEN", name: "Aksa Enerji", sector: "Enerji", description_tr: "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.", description_en: "OFF simulation asset; not real company/stock data.", price: 54, previous_price: 54, volatility: 0.057, risk: "medium" as Risk },
];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureCoreTables(context);
    await seedFallbackIfEmpty(context);
    await tickMarketIfNeeded(context);
    await ensureWallet(context, auth.user.id);
    await ensureBaseline(context, auth.user.id);
    return json(await getMarketState(context, auth.user.id));
  } catch (error) {
    return json({ error: "Market verisi alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureCoreTables(context);
    await seedFallbackIfEmpty(context);
    await tickMarketIfNeeded(context);
    await ensureWallet(context, auth.user.id);
    await ensureBaseline(context, auth.user.id);

    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "buy" || action === "sell") {
      const symbol = String(body?.symbol || "").toUpperCase().trim();
      const quantity = Math.floor(Number(body?.quantity || 0));
      if (!symbol || quantity < 1) return json({ error: "Geçersiz işlem adedi." }, 400);
      await executeTrade(context, auth.user.id, symbol, quantity, action);
      return json(await getMarketState(context, auth.user.id));
    }

    if (action === "reset") {
      await liquidatePortfolio(context, auth.user.id);
      return json(await getMarketState(context, auth.user.id));
    }

    return json({ error: "Bilinmeyen market işlemi." }, 400);
  } catch (error) {
    return json({ error: readableError(error) }, 400);
  }
}

async function ensureCoreTables(context: any) {
  const db = context.env.DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_stocks (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, price REAL NOT NULL, previous_price REAL NOT NULL, volatility REAL NOT NULL, risk TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_holdings (user_id INTEGER NOT NULL, symbol TEXT NOT NULL, shares INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, symbol))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, symbol TEXT NOT NULL, side TEXT NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL, total REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, price REAL NOT NULL, day INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_news (id INTEGER PRIMARY KEY AUTOINCREMENT, day INTEGER NOT NULL, symbol TEXT NOT NULL, impact REAL NOT NULL, tone TEXT NOT NULL, title_tr TEXT NOT NULL, title_en TEXT NOT NULL, lesson_tr TEXT NOT NULL, lesson_en TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_portfolio_baselines (user_id INTEGER PRIMARY KEY, starting_value REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`INSERT OR IGNORE INTO market_meta (key, value) VALUES ('day', '1')`).run();
  await db.prepare(`INSERT OR IGNORE INTO market_meta (key, value) VALUES ('last_tick_safe', '0')`).run();
}

async function seedFallbackIfEmpty(context: any) {
  const db = context.env.DB;
  const count: any = await db.prepare(`SELECT COUNT(*) AS count FROM market_stocks`).first();
  if (Number(count?.count || 0) > 0) return;

  for (const stock of FALLBACK_STOCKS) {
    await db.prepare(`INSERT OR IGNORE INTO market_stocks (symbol, name, sector, description_tr, description_en, price, previous_price, volatility, risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(stock.symbol, stock.name, stock.sector, stock.description_tr, stock.description_en, stock.price, stock.previous_price, stock.volatility, stock.risk).run();
    await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, 1)`).bind(stock.symbol, stock.price).run();
  }
}

async function tickMarketIfNeeded(context: any) {
  const db = context.env.DB;
  const lastTick = Number((await getMeta(context, "last_tick_safe")) || 0);
  const now = Date.now();
  if (now - lastTick < MARKET_TICK_MS) return;

  const currentDay = Number((await getMeta(context, "day")) || 1);
  const nextDay = currentDay + 1;
  const stocks = (await db.prepare(`SELECT symbol, name, sector, price, volatility, risk FROM market_stocks ORDER BY symbol`).all())?.results || [];
  if (!stocks.length) return;

  const targetStock: any = stocks[Math.floor(Math.random() * stocks.length)];
  const news = buildNews(targetStock);
  const marketMood = (Math.random() - 0.5) * 0.012;

  for (const stock of stocks as any[]) {
    const oldPrice = Number(stock.price || 1);
    const volatility = Math.min(0.09, Math.max(0.015, Number(stock.volatility || 0.04)));
    const baseMove = (Math.random() - 0.5) * volatility;
    const directImpact = stock.symbol === news.target ? news.impact : 0;
    const sectorImpact = stock.sector === targetStock.sector && stock.symbol !== news.target ? news.impact * 0.12 : 0;
    const nextPrice = Math.max(5, Number((oldPrice * (1 + marketMood + baseMove + directImpact + sectorImpact)).toFixed(2)));
    await db.prepare(`UPDATE market_stocks SET previous_price = price, price = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?`).bind(nextPrice, stock.symbol).run();
    await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, ?)`).bind(stock.symbol, nextPrice, nextDay).run();
  }

  await db.prepare(`INSERT INTO market_news (day, symbol, impact, tone, title_tr, title_en, lesson_tr, lesson_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(nextDay, news.target, news.impact, news.tone, news.titleTr, news.titleEn, news.lessonTr, news.lessonEn).run();
  await setMeta(context, "day", String(nextDay));
  await setMeta(context, "last_tick_safe", String(now));
  await trimHistory(context);
}

function buildNews(stock: any) {
  const positive = Math.random() >= 0.5;
  const impact = Number(((positive ? 1 : -1) * (0.012 + Math.random() * 0.025)).toFixed(4));
  const name = String(stock.name || stock.symbol);
  return {
    target: stock.symbol,
    impact,
    tone: positive ? "positive" : "negative",
    titleTr: positive ? `${name} için olumlu beklenti oluştu.` : `${name} için baskı yaratan gelişme görüldü.`,
    titleEn: positive ? `${name} gained positive expectations.` : `${name} faced a pressure-building event.`,
    lessonTr: positive ? "Olumlu haber fiyatı destekleyebilir." : "Olumsuz haber düşüş yaratabilir.",
    lessonEn: positive ? "Positive news can support price." : "Negative news can create downside.",
  };
}

async function trimHistory(context: any) {
  try {
    const db = context.env.DB;
    const rows = (await db.prepare(`SELECT symbol, COUNT(*) AS count, MIN(id) AS min_id FROM market_price_history GROUP BY symbol HAVING count > 500`).all())?.results || [];
    for (const row of rows as any[]) {
      const overflow = Number(row.count || 0) - 500;
      if (overflow <= 0) continue;
      await db.prepare(`DELETE FROM market_price_history WHERE id IN (SELECT id FROM market_price_history WHERE symbol = ? ORDER BY id ASC LIMIT ?)`).bind(row.symbol, overflow).run();
    }
  } catch {}
}

async function executeTrade(context: any, userId: number, symbol: string, quantity: number, side: "buy" | "sell") {
  const db = context.env.DB;
  const stock: any = await db.prepare(`SELECT symbol, price FROM market_stocks WHERE symbol = ?`).bind(symbol).first();
  if (!stock) throw new Error("Bu hisse bulunamadı.");
  const price = Number(stock.price || 0);
  const total = Math.max(1, Math.round(price * quantity));

  if (side === "buy") {
    const balance = await getWalletBalance(context, userId);
    if (balance < total) throw new Error("Yeterli Tech Coin yok.");
    await db.prepare(`UPDATE coin_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, -total, `Eka InvestSim buy ${symbol}`).run();
    await db.prepare(`INSERT OR IGNORE INTO market_holdings (user_id, symbol, shares) VALUES (?, ?, 0)`).bind(userId, symbol).run();
    await db.prepare(`UPDATE market_holdings SET shares = shares + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(quantity, userId, symbol).run();
  } else {
    const holding: any = await db.prepare(`SELECT shares FROM market_holdings WHERE user_id = ? AND symbol = ?`).bind(userId, symbol).first();
    const shares = Number(holding?.shares || 0);
    if (shares < quantity) throw new Error("Bu kadar adet sende yok.");
    await db.prepare(`UPDATE market_holdings SET shares = shares - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(quantity, userId, symbol).run();
    await db.prepare(`UPDATE coin_wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, total, `Eka InvestSim sell ${symbol}`).run();
  }

  await db.prepare(`INSERT INTO market_transactions (user_id, symbol, side, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`).bind(userId, symbol, side, quantity, price, total).run();
}

async function liquidatePortfolio(context: any, userId: number) {
  const db = context.env.DB;
  const holdings = (await db.prepare(`SELECT symbol, shares FROM market_holdings WHERE user_id = ? AND shares > 0`).bind(userId).all())?.results || [];
  if (!holdings.length) return;
  const stocks = (await db.prepare(`SELECT symbol, price FROM market_stocks`).all())?.results || [];
  const prices = Object.fromEntries((stocks as any[]).map((stock) => [stock.symbol, Number(stock.price || 0)]));
  const total = Math.round((holdings as any[]).reduce((sum, holding) => sum + Number(holding.shares || 0) * Number(prices[holding.symbol] || 0), 0));
  if (total > 0) {
    await db.prepare(`UPDATE coin_wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, total, "Eka InvestSim portfolio liquidation").run();
  }
  await db.prepare(`DELETE FROM market_holdings WHERE user_id = ?`).bind(userId).run();
}

async function getMarketState(context: any, userId: number) {
  const db = context.env.DB;
  const portfolio = await calculatePortfolio(context, userId);
  const baseline = await ensureBaseline(context, userId);
  const wallet: any = await db.prepare(`SELECT balance, lifetime_earned FROM coin_wallets WHERE user_id = ?`).bind(userId).first();

  const stocks = ((await db.prepare(`SELECT symbol, name, sector, description_tr AS descriptionTr, description_en AS descriptionEn, price, previous_price AS previousPrice, volatility, risk FROM market_stocks ORDER BY sector, symbol`).all())?.results || []).map((stock: any) => {
    const price = Number(stock.price || 0);
    const previous = Number(stock.previousPrice || price || 1);
    return { ...stock, price, previousPrice: previous, volatility: Number(stock.volatility || 0), change: previous > 0 ? ((price - previous) / previous) * 100 : 0 };
  });

  const historyRows = (await db.prepare(`SELECT symbol, price FROM market_price_history ORDER BY id DESC LIMIT 1600`).all())?.results || [];
  const history: Record<string, number[]> = {};
  for (const stock of stocks as any[]) history[stock.symbol] = [];
  for (const row of [...(historyRows as any[])].reverse()) {
    if (!history[row.symbol]) continue;
    if (history[row.symbol].length < 70) history[row.symbol].push(Number(row.price || 0));
  }
  for (const stock of stocks as any[]) if (!history[stock.symbol]?.length) history[stock.symbol] = [Number(stock.price || 0)];

  const news = ((await db.prepare(`SELECT day, symbol AS target, impact, tone, title_tr AS titleTr, title_en AS titleEn, lesson_tr AS lessonTr, lesson_en AS lessonEn, created_at AS createdAt FROM market_news ORDER BY id DESC LIMIT 8`).all())?.results || []).map((item: any) => ({ ...item, day: Number(item.day || 1), impact: Number(item.impact || 0) }));

  return {
    mode: "safe-tech-coin-wallet",
    day: Number((await getMeta(context, "day")) || 1),
    cash: portfolio.walletBalance,
    startingValue: baseline,
    holdings: portfolio.holdings,
    stocks,
    history,
    news,
    rewards: [],
    techCoin: { balance: Number(wallet?.balance || 0), lifetime_earned: Number(wallet?.lifetime_earned || 0) },
  };
}

async function calculatePortfolio(context: any, userId: number) {
  const db = context.env.DB;
  const walletBalance = await getWalletBalance(context, userId);
  const stocks = (await db.prepare(`SELECT symbol, price FROM market_stocks`).all())?.results || [];
  const prices = Object.fromEntries((stocks as any[]).map((stock) => [stock.symbol, Number(stock.price || 0)]));
  const rows = (await db.prepare(`SELECT symbol, shares FROM market_holdings WHERE user_id = ? AND shares > 0`).bind(userId).all())?.results || [];
  const holdings: Record<string, number> = {};
  let invested = 0;
  for (const row of rows as any[]) {
    const shares = Number(row.shares || 0);
    const price = Number(prices[row.symbol] || 0);
    if (shares <= 0 || price <= 0) continue;
    holdings[row.symbol] = shares;
    invested += shares * price;
  }
  return { walletBalance, holdings, invested, total: walletBalance + invested };
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned) VALUES (?, 0, 0)`).bind(userId).run();
}

async function getWalletBalance(context: any, userId: number) {
  await ensureWallet(context, userId);
  const wallet: any = await context.env.DB.prepare(`SELECT balance FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
  return Number(wallet?.balance || 0);
}

async function ensureBaseline(context: any, userId: number) {
  const row: any = await context.env.DB.prepare(`SELECT starting_value FROM market_portfolio_baselines WHERE user_id = ?`).bind(userId).first();
  if (row) return Number(row.starting_value || 0);
  const portfolio = await calculatePortfolio(context, userId);
  await context.env.DB.prepare(`INSERT OR IGNORE INTO market_portfolio_baselines (user_id, starting_value) VALUES (?, ?)`).bind(userId, portfolio.total).run();
  return portfolio.total;
}

async function getMeta(context: any, key: string) {
  const row: any = await context.env.DB.prepare(`SELECT value FROM market_meta WHERE key = ?`).bind(key).first();
  return row?.value || null;
}

async function setMeta(context: any, key: string, value: string) {
  await context.env.DB.prepare(`INSERT OR REPLACE INTO market_meta (key, value) VALUES (?, ?)`).bind(key, value).run();
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
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
