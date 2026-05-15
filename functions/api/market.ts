const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const STARTING_CASH = 100000;
const MARKET_TICK_MS = 90_000;

type StockSeed = {
  symbol: string;
  name: string;
  sector: string;
  descriptionTr: string;
  descriptionEn: string;
  price: number;
  volatility: number;
  risk: "low" | "medium" | "high";
};

type NewsSeed = {
  target: string;
  impact: number;
  tone: "positive" | "negative";
  titleTr: string;
  titleEn: string;
  lessonTr: string;
  lessonEn: string;
};

const STOCKS: StockSeed[] = [
  { symbol: "EKA", name: "EKA Yazılım", sector: "Teknoloji", descriptionTr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.", descriptionEn: "A fictional cloud software and automation company.", price: 124, volatility: 0.055, risk: "medium" },
  { symbol: "NOVA", name: "NOVA Enerji", sector: "Enerji", descriptionTr: "Yenilenebilir enerji projelerine odaklanan kurgu şirket.", descriptionEn: "A fictional company focused on renewable energy projects.", price: 88, volatility: 0.07, risk: "high" },
  { symbol: "MARM", name: "Marmara Gıda", sector: "Gıda", descriptionTr: "Temel tüketim ürünleri satan savunmacı kurgu şirket.", descriptionEn: "A fictional defensive consumer staples company.", price: 52, volatility: 0.032, risk: "low" },
  { symbol: "PIXEL", name: "Pixel Teknoloji", sector: "Teknoloji", descriptionTr: "Oyun motoru ve grafik yazılımları geliştiren kurgu şirket.", descriptionEn: "A fictional game engine and graphics software company.", price: 41, volatility: 0.085, risk: "high" },
  { symbol: "TURK", name: "TURK Savunma", sector: "Sanayi", descriptionTr: "Endüstriyel güvenlik sistemleri geliştiren kurgu şirket.", descriptionEn: "A fictional industrial security systems company.", price: 96, volatility: 0.052, risk: "medium" },
  { symbol: "LUNA", name: "Luna Lojistik", sector: "Lojistik", descriptionTr: "Depo, kargo ve tedarik zinciri ağı işleten kurgu şirket.", descriptionEn: "A fictional warehousing, cargo and supply chain company.", price: 67, volatility: 0.044, risk: "medium" },
];

const NEWS_POOL: NewsSeed[] = [
  { target: "EKA", impact: 0.09, tone: "positive", titleTr: "EKA Yazılım yeni kurumsal otomasyon anlaşması duyurdu.", titleEn: "EKA Software announced a new enterprise automation deal.", lessonTr: "Pozitif haber fiyatı yükseltebilir; yine de fiyat her zaman haber kadar yükselmek zorunda değildir.", lessonEn: "Positive news can lift price, but price does not have to rise exactly as much as the news sounds." },
  { target: "PIXEL", impact: -0.1, tone: "negative", titleTr: "Pixel Teknoloji ürün gecikmesi açıkladı.", titleEn: "Pixel Technology announced a product delay.", lessonTr: "Gecikme haberleri beklentiyi bozar. Kısa vadede oynaklık artabilir.", lessonEn: "Delay news weakens expectations. Short-term volatility can increase." },
  { target: "NOVA", impact: 0.11, tone: "positive", titleTr: "NOVA Enerji yeni güneş paneli sahası için izin aldı.", titleEn: "NOVA Energy received approval for a new solar panel site.", lessonTr: "Büyüme haberi güçlüdür ama yüksek oynak hisselerde risk de büyür.", lessonEn: "Growth news is powerful, but risk also rises in volatile stocks." },
  { target: "MARM", impact: 0.035, tone: "positive", titleTr: "Marmara Gıda istikrarlı satış raporu yayımladı.", titleEn: "Marmara Food published a stable sales report.", lessonTr: "Savunmacı şirketlerde hareket daha yavaş olabilir; amaç bazen istikrarı korumaktır.", lessonEn: "Defensive companies may move slower; sometimes the goal is stability." },
  { target: "TURK", impact: -0.065, tone: "negative", titleTr: "TURK Savunma maliyet baskısı bildirdi.", titleEn: "TURK Defense reported cost pressure.", lessonTr: "Maliyet artışı kâr beklentisini düşürebilir. Sadece ciroya değil marja da bakılır.", lessonEn: "Rising costs can reduce profit expectations. Investors watch margins, not just revenue." },
  { target: "LUNA", impact: 0.07, tone: "positive", titleTr: "Luna Lojistik yeni dağıtım merkezi açtı.", titleEn: "Luna Logistics opened a new distribution center.", lessonTr: "Kapasite artışı büyüme sinyalidir; fakat yatırımın geri dönüş süresi önemlidir.", lessonEn: "Capacity growth is a growth signal, but payback time matters." },
  { target: "EKA", impact: -0.055, tone: "negative", titleTr: "Teknoloji sektöründe kâr realizasyonu görüldü.", titleEn: "Profit-taking appeared in the technology sector.", lessonTr: "İyi şirket bile düşebilir. Fiyat, haber, beklenti ve duygu birlikte hareket eder.", lessonEn: "Even a good company can fall. Price, news, expectations and sentiment move together." },
];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureMarket(context);
    await tickMarketIfNeeded(context);
    return json(await getMarketState(context, auth.user.id));
  } catch (error) {
    return json({ error: "Market verisi alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureMarket(context);
    await tickMarketIfNeeded(context);

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
      await resetAccount(context, auth.user.id);
      return json(await getMarketState(context, auth.user.id));
    }

    return json({ error: "Bilinmeyen market işlemi." }, 400);
  } catch (error) {
    return json({ error: readableError(error) }, 400);
  }
}

async function ensureMarket(context: any) {
  const db = context.env.DB;

  await db.prepare(`CREATE TABLE IF NOT EXISTS market_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_stocks (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      description_tr TEXT NOT NULL,
      description_en TEXT NOT NULL,
      price REAL NOT NULL,
      previous_price REAL NOT NULL,
      volatility REAL NOT NULL,
      risk TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_accounts (
      user_id INTEGER PRIMARY KEY,
      cash REAL NOT NULL DEFAULT 100000,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_holdings (
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      shares INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, symbol)
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      day INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      impact REAL NOT NULL,
      tone TEXT NOT NULL,
      title_tr TEXT NOT NULL,
      title_en TEXT NOT NULL,
      lesson_tr TEXT NOT NULL,
      lesson_en TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`INSERT OR IGNORE INTO market_meta (key, value) VALUES ('day', '1')`).run();
  await db.prepare(`INSERT OR IGNORE INTO market_meta (key, value) VALUES ('last_tick', '0')`).run();

  for (const stock of STOCKS) {
    await db.prepare(`
      INSERT OR IGNORE INTO market_stocks
        (symbol, name, sector, description_tr, description_en, price, previous_price, volatility, risk)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(stock.symbol, stock.name, stock.sector, stock.descriptionTr, stock.descriptionEn, stock.price, stock.price, stock.volatility, stock.risk)
      .run();

    const historyCount = await db.prepare(`SELECT COUNT(*) AS count FROM market_price_history WHERE symbol = ?`).bind(stock.symbol).first();
    if (Number(historyCount?.count || 0) === 0) {
      await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, 1)`).bind(stock.symbol, stock.price).run();
    }
  }
}

async function tickMarketIfNeeded(context: any) {
  const db = context.env.DB;
  const lastTick = Number((await getMeta(context, "last_tick")) || 0);
  const now = Date.now();
  if (now - lastTick < MARKET_TICK_MS) return;

  const currentDay = Number((await getMeta(context, "day")) || 1);
  const nextDay = currentDay + 1;
  const stocks = (await db.prepare(`SELECT * FROM market_stocks ORDER BY symbol`).all())?.results || [];
  if (!stocks.length) return;

  const news = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)];
  const targetStock: any = stocks.find((stock: any) => stock.symbol === news.target);
  const targetSector = targetStock?.sector || "";
  const marketMood = (Math.random() - 0.48) * 0.025;

  for (const stock of stocks as any[]) {
    const oldPrice = Number(stock.price || 1);
    const baseMove = (Math.random() - 0.5) * Number(stock.volatility || 0.04);
    const directImpact = stock.symbol === news.target ? news.impact : 0;
    const sectorImpact = stock.sector === targetSector ? news.impact * 0.18 : 0;
    const nextPrice = clampPrice(oldPrice * (1 + marketMood + baseMove + directImpact + sectorImpact));

    await db.prepare(`
      UPDATE market_stocks
      SET previous_price = price, price = ?, updated_at = CURRENT_TIMESTAMP
      WHERE symbol = ?
    `).bind(nextPrice, stock.symbol).run();

    await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, ?)`).bind(stock.symbol, nextPrice, nextDay).run();
  }

  await db.prepare(`
    INSERT INTO market_news (day, symbol, impact, tone, title_tr, title_en, lesson_tr, lesson_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(nextDay, news.target, news.impact, news.tone, news.titleTr, news.titleEn, news.lessonTr, news.lessonEn).run();

  await setMeta(context, "day", String(nextDay));
  await setMeta(context, "last_tick", String(now));
}

async function executeTrade(context: any, userId: number, symbol: string, quantity: number, side: "buy" | "sell") {
  const db = context.env.DB;
  await ensureAccount(context, userId);

  const stock: any = await db.prepare(`SELECT symbol, price FROM market_stocks WHERE symbol = ?`).bind(symbol).first();
  if (!stock) throw new Error("Böyle bir kurgu hisse yok.");

  const price = Number(stock.price || 0);
  const total = Number((price * quantity).toFixed(2));

  if (side === "buy") {
    const account: any = await db.prepare(`SELECT cash FROM market_accounts WHERE user_id = ?`).bind(userId).first();
    const cash = Number(account?.cash || 0);
    if (cash < total) throw new Error("Yeterli sanal nakit yok.");

    await db.prepare(`UPDATE market_accounts SET cash = cash - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT OR IGNORE INTO market_holdings (user_id, symbol, shares) VALUES (?, ?, 0)`).bind(userId, symbol).run();
    await db.prepare(`UPDATE market_holdings SET shares = shares + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(quantity, userId, symbol).run();
  } else {
    const holding: any = await db.prepare(`SELECT shares FROM market_holdings WHERE user_id = ? AND symbol = ?`).bind(userId, symbol).first();
    const shares = Number(holding?.shares || 0);
    if (shares < quantity) throw new Error("Bu kadar adet sende yok.");

    await db.prepare(`UPDATE market_holdings SET shares = shares - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(quantity, userId, symbol).run();
    await db.prepare(`UPDATE market_accounts SET cash = cash + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
  }

  await db.prepare(`
    INSERT INTO market_transactions (user_id, symbol, side, quantity, price, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, symbol, side, quantity, price, total).run();
}

async function resetAccount(context: any, userId: number) {
  const db = context.env.DB;
  await db.prepare(`INSERT OR IGNORE INTO market_accounts (user_id, cash) VALUES (?, ?)`).bind(userId, STARTING_CASH).run();
  await db.prepare(`UPDATE market_accounts SET cash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(STARTING_CASH, userId).run();
  await db.prepare(`DELETE FROM market_holdings WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM market_transactions WHERE user_id = ?`).bind(userId).run();
}

async function getMarketState(context: any, userId: number) {
  const db = context.env.DB;
  await ensureAccount(context, userId);

  const account: any = await db.prepare(`SELECT cash FROM market_accounts WHERE user_id = ?`).bind(userId).first();
  const stocks = ((await db.prepare(`
    SELECT
      symbol,
      name,
      sector,
      description_tr AS descriptionTr,
      description_en AS descriptionEn,
      price,
      previous_price AS previousPrice,
      volatility,
      risk
    FROM market_stocks
    ORDER BY symbol
  `).all())?.results || []).map((stock: any) => {
    const price = Number(stock.price || 0);
    const previous = Number(stock.previousPrice || price || 1);
    const change = previous > 0 ? ((price - previous) / previous) * 100 : 0;
    return { ...stock, price, volatility: Number(stock.volatility || 0), change };
  });

  const holdingRows = (await db.prepare(`SELECT symbol, shares FROM market_holdings WHERE user_id = ? AND shares > 0`).bind(userId).all())?.results || [];
  const holdings: Record<string, number> = {};
  for (const row of holdingRows as any[]) holdings[row.symbol] = Number(row.shares || 0);

  const historyRows = (await db.prepare(`
    SELECT symbol, price
    FROM market_price_history
    WHERE id IN (
      SELECT id FROM market_price_history AS inner_history
      WHERE inner_history.symbol = market_price_history.symbol
      ORDER BY id DESC
      LIMIT 14
    )
    ORDER BY id ASC
  `).all())?.results || [];

  const history: Record<string, number[]> = {};
  for (const stock of stocks as any[]) history[stock.symbol] = [];
  for (const row of historyRows as any[]) {
    if (!history[row.symbol]) history[row.symbol] = [];
    history[row.symbol].push(Number(row.price || 0));
  }

  const news = ((await db.prepare(`
    SELECT
      day,
      symbol AS target,
      impact,
      tone,
      title_tr AS titleTr,
      title_en AS titleEn,
      lesson_tr AS lessonTr,
      lesson_en AS lessonEn,
      created_at AS createdAt
    FROM market_news
    ORDER BY id DESC
    LIMIT 6
  `).all())?.results || []).map((item: any) => ({ ...item, day: Number(item.day || 1), impact: Number(item.impact || 0) }));

  return {
    mode: "online-d1",
    day: Number((await getMeta(context, "day")) || 1),
    cash: Number(account?.cash || STARTING_CASH),
    holdings,
    stocks,
    history,
    news,
  };
}

async function ensureAccount(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO market_accounts (user_id, cash) VALUES (?, ?)`).bind(userId, STARTING_CASH).run();
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

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ?
        AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function clampPrice(value: number) {
  return Math.max(5, Number(value.toFixed(2)));
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
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
