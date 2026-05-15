const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const MARKET_TICK_MS = 90_000;

type Risk = "low" | "medium" | "high";
type NewsTone = "positive" | "negative" | "neutral";

type StockSeed = {
  symbol: string;
  name: string;
  sector: string;
  descriptionTr: string;
  descriptionEn: string;
  price: number;
  volatility: number;
  risk: Risk;
};

type NewsConcept = {
  tone: NewsTone;
  impact: number;
  titleTr: string;
  titleEn: string;
  lessonTr: string;
  lessonEn: string;
};

type NewsSeed = {
  target: string;
  impact: number;
  tone: NewsTone;
  titleTr: string;
  titleEn: string;
  lessonTr: string;
  lessonEn: string;
};

type RewardSeed = {
  key: string;
  amount: number;
  titleTr: string;
  titleEn: string;
};

const SIMULATION_NOTE_TR = "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.";
const SIMULATION_NOTE_EN = "OFF simulation asset; not real company/stock data.";

const STOCKS: StockSeed[] = [
  { symbol: "EKA", name: "EKA Yazılım", sector: "Teknoloji", descriptionTr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.", descriptionEn: "A fictional cloud software and automation company.", price: 124, volatility: 0.055, risk: "medium" },
  { symbol: "MGROS", name: "Migros", sector: "Perakende", descriptionTr: `${SIMULATION_NOTE_TR} Perakende ve gıda zinciri temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents retail and food chain themes.`, price: 82, volatility: 0.04, risk: "low" },
  { symbol: "BIM", name: "BİM", sector: "Perakende", descriptionTr: `${SIMULATION_NOTE_TR} İndirim market ve temel tüketim temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents discount retail and staples themes.`, price: 69, volatility: 0.034, risk: "low" },
  { symbol: "THY", name: "Türk Hava Yolları", sector: "Ulaşım", descriptionTr: `${SIMULATION_NOTE_TR} Havacılık ve yolcu taşımacılığı temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents aviation and passenger transport themes.`, price: 142, volatility: 0.068, risk: "high" },
  { symbol: "PGSUS", name: "Pegasus", sector: "Ulaşım", descriptionTr: `${SIMULATION_NOTE_TR} Düşük maliyetli havacılık ve turizm temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents low-cost aviation and tourism themes.`, price: 91, volatility: 0.072, risk: "high" },
  { symbol: "TUPRS", name: "Tüpraş", sector: "Enerji", descriptionTr: `${SIMULATION_NOTE_TR} Enerji ve rafineri temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents energy and refinery themes.`, price: 118, volatility: 0.056, risk: "medium" },
  { symbol: "PETKM", name: "Petkim", sector: "Kimya", descriptionTr: `${SIMULATION_NOTE_TR} Petrokimya ve sanayi girdileri temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents petrochemicals and industrial input themes.`, price: 44, volatility: 0.058, risk: "medium" },
  { symbol: "TCELL", name: "Turkcell", sector: "Telekom", descriptionTr: `${SIMULATION_NOTE_TR} Telekom ve dijital servis temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents telecom and digital service themes.`, price: 74, volatility: 0.045, risk: "medium" },
  { symbol: "ASELS", name: "Aselsan", sector: "Savunma", descriptionTr: `${SIMULATION_NOTE_TR} Savunma teknolojileri temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents defense technology themes.`, price: 96, volatility: 0.062, risk: "medium" },
  { symbol: "SISE", name: "Şişecam", sector: "Sanayi", descriptionTr: `${SIMULATION_NOTE_TR} Cam, kimya ve sanayi temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents glass, chemicals and industrial themes.`, price: 58, volatility: 0.049, risk: "medium" },
  { symbol: "KRDMD", name: "Kardemir", sector: "Sanayi", descriptionTr: `${SIMULATION_NOTE_TR} Demir-çelik ve ağır sanayi temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents steel and heavy industry themes.`, price: 37, volatility: 0.066, risk: "high" },
  { symbol: "ARCLK", name: "Arçelik", sector: "Dayanıklı Tüketim", descriptionTr: `${SIMULATION_NOTE_TR} Beyaz eşya ve teknoloji üretimi temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents home appliances and technology manufacturing themes.`, price: 64, volatility: 0.052, risk: "medium" },
  { symbol: "VESTL", name: "Vestel", sector: "Teknoloji", descriptionTr: `${SIMULATION_NOTE_TR} Elektronik üretimi ve tüketici teknolojisi temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents electronics manufacturing and consumer technology themes.`, price: 49, volatility: 0.067, risk: "high" },
  { symbol: "FROTO", name: "Ford Otosan", sector: "Otomotiv", descriptionTr: `${SIMULATION_NOTE_TR} Otomotiv üretimi ve ihracat temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents automotive production and export themes.`, price: 136, volatility: 0.06, risk: "high" },
  { symbol: "TOASO", name: "Tofaş", sector: "Otomotiv", descriptionTr: `${SIMULATION_NOTE_TR} Otomotiv üretimi ve iç pazar temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents automotive production and domestic market themes.`, price: 84, volatility: 0.057, risk: "medium" },
  { symbol: "GARAN", name: "Garanti BBVA", sector: "Bankacılık", descriptionTr: `${SIMULATION_NOTE_TR} Bankacılık ve kredi döngüsü temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents banking and credit cycle themes.`, price: 73, volatility: 0.061, risk: "medium" },
  { symbol: "AKBNK", name: "Akbank", sector: "Bankacılık", descriptionTr: `${SIMULATION_NOTE_TR} Mevduat, kredi ve finansal hizmetler temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents deposits, loans and financial services themes.`, price: 61, volatility: 0.058, risk: "medium" },
  { symbol: "ISCTR", name: "İş Bankası", sector: "Bankacılık", descriptionTr: `${SIMULATION_NOTE_TR} Bankacılık ve iştirak yapısı temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents banking and subsidiary structure themes.`, price: 55, volatility: 0.055, risk: "medium" },
  { symbol: "KCHOL", name: "Koç Holding", sector: "Holding", descriptionTr: `${SIMULATION_NOTE_TR} Çok sektörlü holding ve iştirak portföyü temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents diversified holding and subsidiary portfolio themes.`, price: 103, volatility: 0.046, risk: "medium" },
  { symbol: "SAHOL", name: "Sabancı Holding", sector: "Holding", descriptionTr: `${SIMULATION_NOTE_TR} Finans, enerji ve sanayi iştirakleri temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents finance, energy and industrial subsidiary themes.`, price: 78, volatility: 0.048, risk: "medium" },
  { symbol: "ENKAI", name: "Enka İnşaat", sector: "İnşaat", descriptionTr: `${SIMULATION_NOTE_TR} İnşaat, altyapı ve proje yönetimi temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents construction, infrastructure and project management themes.`, price: 66, volatility: 0.044, risk: "medium" },
  { symbol: "CCOLA", name: "Coca-Cola İçecek", sector: "Gıda İçecek", descriptionTr: `${SIMULATION_NOTE_TR} İçecek, dağıtım ve tüketim temasını temsil eder.`, descriptionEn: `${SIMULATION_NOTE_EN} Represents beverages, distribution and consumption themes.`, price: 88, volatility: 0.039, risk: "low" },
];

const LEGACY_SYMBOL_MAP: Record<string, string> = {
  NOVA: "THY",
  MARM: "MGROS",
  PIXEL: "TCELL",
  TURK: "ASELS",
  LUNA: "TUPRS",
};

const REWARDS: RewardSeed[] = [
  { key: "first_trade", amount: 15, titleTr: "İlk Tech Coin işlemini yaptın", titleEn: "Made your first Tech Coin trade" },
  { key: "diversified_3", amount: 30, titleTr: "3 farklı hisseyle dağılım yaptın", titleEn: "Diversified into 3 different stocks" },
  { key: "cash_buffer_10", amount: 20, titleTr: "En az %10 Tech Coin bakiyesi bıraktın", titleEn: "Kept at least 10% Tech Coin balance" },
  { key: "concentration_under_50", amount: 25, titleTr: "Tek hisse ağırlığını %50 altına indirdin", titleEn: "Kept one-stock weight below 50%" },
  { key: "observed_3_news", amount: 20, titleTr: "3 piyasa haberini gözlemledin", titleEn: "Observed 3 market news events" },
  { key: "portfolio_growth_5", amount: 35, titleTr: "Portföyünü başlangıca göre %5 büyüttün", titleEn: "Grew your portfolio 5% above baseline" },
];

const NEWS_CONCEPTS: NewsConcept[] = [
  { tone: "positive", impact: 0.045, titleTr: "{name} yeni müşteri kazanımı açıkladı.", titleEn: "{name} announced a new customer win.", lessonTr: "Yeni müşteri gelir beklentisini artırabilir; sürdürülebilirlik ayrıca izlenir.", lessonEn: "A new customer can improve revenue expectations; sustainability still needs to be watched." },
  { tone: "positive", impact: 0.052, titleTr: "{name} operasyon verimliliğinde iyileşme bildirdi.", titleEn: "{name} reported improved operational efficiency.", lessonTr: "Verimlilik artışı aynı satıştan daha fazla kâr üretme ihtimalini güçlendirir.", lessonEn: "Efficiency gains can increase the chance of producing more profit from the same sales." },
  { tone: "positive", impact: 0.061, titleTr: "{name} yeni ürün lansmanında güçlü talep gördü.", titleEn: "{name} saw strong demand after a new product launch.", lessonTr: "Talep haberi fiyatı destekleyebilir; önemli olan talebin satışa dönüşmesidir.", lessonEn: "Demand news can support price; what matters is whether demand converts into sales." },
  { tone: "positive", impact: 0.038, titleTr: "{sector} sektöründe beklentiler toparlandı; {name} olumlu ayrıştı.", titleEn: "Expectations improved in the {sector} sector; {name} outperformed.", lessonTr: "Sektör havası iyi olduğunda aynı sektördeki şirketler birlikte etkilenebilir.", lessonEn: "When sector sentiment improves, companies in that sector can move together." },
  { tone: "positive", impact: 0.072, titleTr: "{name} büyük ölçekli stratejik ortaklık duyurdu.", titleEn: "{name} announced a large-scale strategic partnership.", lessonTr: "Ortaklıklar büyüme hikâyesini güçlendirir ama beklenti fazla şişerse risk artar.", lessonEn: "Partnerships can strengthen growth stories, but overextended expectations increase risk." },
  { tone: "positive", impact: 0.034, titleTr: "{name} borçluluk oranını düşürdüğünü açıkladı.", titleEn: "{name} said it reduced its debt ratio.", lessonTr: "Borç azalması finansal riski düşürebilir ve şirketi daha dayanıklı gösterebilir.", lessonEn: "Lower debt can reduce financial risk and make a company look more resilient." },
  { tone: "positive", impact: 0.066, titleTr: "{name} beklentilerin üzerinde dönemsel sonuç yayımladı.", titleEn: "{name} published results above expectations.", lessonTr: "Piyasa çoğu zaman mutlak sonuçtan çok beklentiye göre gelen sürprizi fiyatlar.", lessonEn: "Markets often price the surprise versus expectations more than the absolute result." },
  { tone: "negative", impact: -0.042, titleTr: "{name} beklenenden zayıf talep sinyali verdi.", titleEn: "{name} signaled weaker-than-expected demand.", lessonTr: "Talep zayıflığı gelir beklentisini bozar ve kısa vadeli baskı yaratabilir.", lessonEn: "Weak demand hurts revenue expectations and can create short-term pressure." },
  { tone: "negative", impact: -0.054, titleTr: "{name} maliyet artışı nedeniyle marj baskısı bildirdi.", titleEn: "{name} reported margin pressure from rising costs.", lessonTr: "Maliyet artışı satış iyi olsa bile kârlılığı düşürebilir.", lessonEn: "Rising costs can reduce profitability even when sales look healthy." },
  { tone: "negative", impact: -0.067, titleTr: "{name} ürün veya proje teslimatında gecikme açıkladı.", titleEn: "{name} announced a product or project delivery delay.", lessonTr: "Gecikmeler beklentiyi bozar; yüksek oynak hisselerde etki daha sert olabilir.", lessonEn: "Delays weaken expectations; impact can be sharper in high-volatility stocks." },
  { tone: "negative", impact: -0.049, titleTr: "{sector} sektöründe regülasyon belirsizliği arttı; {name} baskı gördü.", titleEn: "Regulatory uncertainty increased in the {sector} sector; {name} came under pressure.", lessonTr: "Regülasyon belirsizliği şirketten bağımsız sektör riski yaratabilir.", lessonEn: "Regulatory uncertainty can create sector risk independent of company quality." },
  { tone: "negative", impact: -0.074, titleTr: "{name} beklenti altı finansal sonuç yayımladı.", titleEn: "{name} published financial results below expectations.", lessonTr: "Beklenti altı sonuç, kötü haber fiyatlanmadıysa sert tepki doğurabilir.", lessonEn: "Below-expectation results can cause a sharp reaction if bad news was not priced in." },
  { tone: "neutral", impact: 0.012, titleTr: "{name} yatırımcı sunumunu güncelledi.", titleEn: "{name} updated its investor presentation.", lessonTr: "Her haber büyük fiyat hareketi yaratmaz; bazen bilgi akışı sadece izleme sinyalidir.", lessonEn: "Not every headline causes a large move; some news is simply information to monitor." },
  { tone: "neutral", impact: -0.009, titleTr: "{name} olağan kurul toplantısı takvimini paylaştı.", titleEn: "{name} shared its regular meeting calendar.", lessonTr: "Takvim haberleri genelde sınırlı etki yapar; önemli olan toplantıdan çıkacak kararlardır.", lessonEn: "Calendar news usually has limited impact; decisions from the meeting matter more." },
  { tone: "neutral", impact: 0.008, titleTr: "{name} sürdürülebilirlik hedeflerini tekrar teyit etti.", titleEn: "{name} reaffirmed its sustainability targets.", lessonTr: "Hedef teyidi güven verir ama fiyat etkisi genellikle performans verisiyle oluşur.", lessonEn: "Target reaffirmation can build trust, but price impact usually needs performance data." },
];

const STOCK_SYMBOLS = STOCKS.map((stock) => stock.symbol);
const NEWS_POOL: NewsSeed[] = buildNewsPool();

function buildNewsPool() {
  return STOCKS.flatMap((stock) => {
    const riskMultiplier = stock.risk === "high" ? 1.22 : stock.risk === "low" ? 0.72 : 1;
    const sectorMultiplier = stock.sector === "Perakende" ? 0.82 : stock.sector === "Teknoloji" ? 1.08 : 1;
    return NEWS_CONCEPTS.map((concept) => ({
      target: stock.symbol,
      impact: Number((concept.impact * riskMultiplier * sectorMultiplier).toFixed(4)),
      tone: concept.tone,
      titleTr: fillNewsTemplate(concept.titleTr, stock),
      titleEn: fillNewsTemplate(concept.titleEn, stock),
      lessonTr: concept.lessonTr,
      lessonEn: concept.lessonEn,
    }));
  });
}

function fillNewsTemplate(template: string, stock: StockSeed) {
  return template.replaceAll("{name}", stock.name).replaceAll("{symbol}", stock.symbol).replaceAll("{sector}", stock.sector);
}

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    await ensureMarket(context);
    await migrateLegacyPortfolio(context, auth.user.id);
    await tickMarketIfNeeded(context);
    await ensurePortfolioBaseline(context, auth.user.id);
    const rewards = await evaluateMarketRewards(context, auth.user.id);
    return json(await getMarketState(context, auth.user.id, rewards));
  } catch (error) {
    return json({ error: "Market verisi alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    await ensureMarket(context);
    await migrateLegacyPortfolio(context, auth.user.id);
    await tickMarketIfNeeded(context);
    await ensurePortfolioBaseline(context, auth.user.id);
    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "");
    if (action === "buy" || action === "sell") {
      const symbol = String(body?.symbol || "").toUpperCase().trim();
      const quantity = Math.floor(Number(body?.quantity || 0));
      if (!symbol || quantity < 1) return json({ error: "Geçersiz işlem adedi." }, 400);
      await executeTrade(context, auth.user.id, symbol, quantity, action);
      const rewards = await evaluateMarketRewards(context, auth.user.id);
      return json(await getMarketState(context, auth.user.id, rewards));
    }
    if (action === "reset") {
      await liquidatePortfolio(context, auth.user.id);
      return json(await getMarketState(context, auth.user.id, []));
    }
    return json({ error: "Bilinmeyen market işlemi." }, 400);
  } catch (error) {
    return json({ error: readableError(error) }, 400);
  }
}

async function ensureMarket(context: any) {
  const db = context.env.DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_stocks (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, price REAL NOT NULL, previous_price REAL NOT NULL, volatility REAL NOT NULL, risk TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_accounts (user_id INTEGER PRIMARY KEY, cash REAL NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_holdings (user_id INTEGER NOT NULL, symbol TEXT NOT NULL, shares INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, symbol))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, symbol TEXT NOT NULL, side TEXT NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL, total REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, price REAL NOT NULL, day INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_news (id INTEGER PRIMARY KEY AUTOINCREMENT, day INTEGER NOT NULL, symbol TEXT NOT NULL, impact REAL NOT NULL, tone TEXT NOT NULL, title_tr TEXT NOT NULL, title_en TEXT NOT NULL, lesson_tr TEXT NOT NULL, lesson_en TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_reward_claims (user_id INTEGER NOT NULL, reward_key TEXT NOT NULL, amount INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, reward_key))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_portfolio_baselines (user_id INTEGER PRIMARY KEY, starting_value REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_wallet_migrations (user_id INTEGER PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`INSERT OR IGNORE INTO market_meta (key, value) VALUES ('day', '1')`).run();
  await db.prepare(`INSERT OR IGNORE INTO market_meta (key, value) VALUES ('last_tick', '0')`).run();
  await migrateLegacySymbols(context);
  for (const stock of STOCKS) {
    await db.prepare(`INSERT INTO market_stocks (symbol, name, sector, description_tr, description_en, price, previous_price, volatility, risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET name = excluded.name, sector = excluded.sector, description_tr = excluded.description_tr, description_en = excluded.description_en, volatility = excluded.volatility, risk = excluded.risk, updated_at = CURRENT_TIMESTAMP`).bind(stock.symbol, stock.name, stock.sector, stock.descriptionTr, stock.descriptionEn, stock.price, stock.price, stock.volatility, stock.risk).run();
    const historyCount: any = await db.prepare(`SELECT COUNT(*) AS count FROM market_price_history WHERE symbol = ?`).bind(stock.symbol).first();
    if (Number(historyCount?.count || 0) === 0) await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, 1)`).bind(stock.symbol, stock.price).run();
  }
  await cleanupLegacyStocks(context);
}

async function migrateLegacySymbols(context: any) {
  const db = context.env.DB;
  for (const [oldSymbol, newSymbol] of Object.entries(LEGACY_SYMBOL_MAP)) {
    const oldRows = (await db.prepare(`SELECT user_id, shares FROM market_holdings WHERE symbol = ? AND shares > 0`).bind(oldSymbol).all())?.results || [];
    for (const row of oldRows as any[]) {
      await db.prepare(`INSERT OR IGNORE INTO market_holdings (user_id, symbol, shares) VALUES (?, ?, 0)`).bind(row.user_id, newSymbol).run();
      await db.prepare(`UPDATE market_holdings SET shares = shares + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(Number(row.shares || 0), row.user_id, newSymbol).run();
    }
    await db.prepare(`DELETE FROM market_holdings WHERE symbol = ?`).bind(oldSymbol).run();
  }
}

async function cleanupLegacyStocks(context: any) {
  const db = context.env.DB;
  const placeholders = STOCK_SYMBOLS.map(() => "?").join(", ");
  await db.prepare(`DELETE FROM market_stocks WHERE symbol NOT IN (${placeholders})`).bind(...STOCK_SYMBOLS).run();
  await db.prepare(`DELETE FROM market_price_history WHERE symbol NOT IN (${placeholders})`).bind(...STOCK_SYMBOLS).run();
}

async function migrateLegacyPortfolio(context: any, userId: number) {
  await ensureCoinWallet(context, userId);
  await context.env.DB.prepare(`INSERT OR IGNORE INTO market_wallet_migrations (user_id) VALUES (?)`).bind(userId).run();
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
    await db.prepare(`UPDATE market_stocks SET previous_price = price, price = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?`).bind(nextPrice, stock.symbol).run();
    await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, ?)`).bind(stock.symbol, nextPrice, nextDay).run();
  }
  await db.prepare(`INSERT INTO market_news (day, symbol, impact, tone, title_tr, title_en, lesson_tr, lesson_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(nextDay, news.target, news.impact, news.tone, news.titleTr, news.titleEn, news.lessonTr, news.lessonEn).run();
  await setMeta(context, "day", String(nextDay));
  await setMeta(context, "last_tick", String(now));
}

async function executeTrade(context: any, userId: number, symbol: string, quantity: number, side: "buy" | "sell") {
  const db = context.env.DB;
  await ensureCoinWallet(context, userId);
  const stock: any = await db.prepare(`SELECT symbol, price FROM market_stocks WHERE symbol = ?`).bind(symbol).first();
  if (!stock) throw new Error("Böyle bir simülasyon hissesi yok.");
  const price = Number(stock.price || 0);
  const total = Math.max(1, Math.round(price * quantity));
  if (side === "buy") {
    const balance = await getWalletBalance(context, userId);
    if (balance < total) throw new Error("Yeterli Tech Coin yok.");
    await db.prepare(`UPDATE coin_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, -total, `EkaTrade buy ${symbol}`).run();
    await db.prepare(`INSERT OR IGNORE INTO market_holdings (user_id, symbol, shares) VALUES (?, ?, 0)`).bind(userId, symbol).run();
    await db.prepare(`UPDATE market_holdings SET shares = shares + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(quantity, userId, symbol).run();
  } else {
    const holding: any = await db.prepare(`SELECT shares FROM market_holdings WHERE user_id = ? AND symbol = ?`).bind(userId, symbol).first();
    const shares = Number(holding?.shares || 0);
    if (shares < quantity) throw new Error("Bu kadar adet sende yok.");
    await db.prepare(`UPDATE market_holdings SET shares = shares - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ?`).bind(quantity, userId, symbol).run();
    await db.prepare(`UPDATE coin_wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, total, `EkaTrade sell ${symbol}`).run();
  }
  await db.prepare(`INSERT INTO market_transactions (user_id, symbol, side, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`).bind(userId, symbol, side, quantity, price, total).run();
}

async function liquidatePortfolio(context: any, userId: number) {
  const db = context.env.DB;
  await ensureCoinWallet(context, userId);
  const holdings = (await db.prepare(`SELECT symbol, shares FROM market_holdings WHERE user_id = ? AND shares > 0`).bind(userId).all())?.results || [];
  if (!holdings.length) return;
  const stocks = (await db.prepare(`SELECT symbol, price FROM market_stocks`).all())?.results || [];
  const prices = Object.fromEntries((stocks as any[]).map((stock) => [stock.symbol, Number(stock.price || 0)]));
  const total = Math.round((holdings as any[]).reduce((sum, holding) => sum + Number(holding.shares || 0) * Number(prices[holding.symbol] || 0), 0));
  if (total > 0) {
    await db.prepare(`UPDATE coin_wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(total, userId).run();
    await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, total, "EkaTrade portfolio liquidation").run();
  }
  await db.prepare(`DELETE FROM market_holdings WHERE user_id = ?`).bind(userId).run();
}

async function evaluateMarketRewards(context: any, userId: number) {
  const db = context.env.DB;
  await ensureCoinWallet(context, userId);
  const portfolio = await calculatePortfolio(context, userId);
  const tradeCount = Number((await db.prepare(`SELECT COUNT(*) AS count FROM market_transactions WHERE user_id = ?`).bind(userId).first())?.count || 0);
  const newsCount = Number((await db.prepare(`SELECT COUNT(*) AS count FROM market_news`).first())?.count || 0);
  const startingValue = await ensurePortfolioBaseline(context, userId);
  const achieved = new Set<string>();
  if (tradeCount >= 1) achieved.add("first_trade");
  if (portfolio.holdingCount >= 3) achieved.add("diversified_3");
  if (tradeCount >= 1 && portfolio.cashRatio >= 0.1) achieved.add("cash_buffer_10");
  if (portfolio.holdingCount >= 2 && portfolio.maxWeight <= 0.5) achieved.add("concentration_under_50");
  if (newsCount >= 3) achieved.add("observed_3_news");
  if (tradeCount >= 1 && startingValue > 0 && portfolio.total >= startingValue * 1.05) achieved.add("portfolio_growth_5");
  const awarded: RewardSeed[] = [];
  for (const reward of REWARDS) {
    if (!achieved.has(reward.key)) continue;
    const inserted = await db.prepare(`INSERT OR IGNORE INTO market_reward_claims (user_id, reward_key, amount) VALUES (?, ?, ?)`).bind(userId, reward.key, reward.amount).run();
    if (!inserted.meta?.changes) continue;
    await awardTechCoin(context, userId, reward.amount, `EkaTrade Academy: ${reward.titleTr}`);
    awarded.push(reward);
  }
  return awarded;
}

async function awardTechCoin(context: any, userId: number, amount: number, reason: string) {
  const db = context.env.DB;
  await ensureCoinWallet(context, userId);
  await db.prepare(`UPDATE coin_wallets SET balance = balance + ?, lifetime_earned = lifetime_earned + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(amount, amount, userId).run();
  await db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, amount, reason).run();
}

async function getMarketState(context: any, userId: number, rewards: RewardSeed[] = []) {
  const db = context.env.DB;
  const portfolio = await calculatePortfolio(context, userId);
  const startingValue = await ensurePortfolioBaseline(context, userId);
  const wallet: any = await db.prepare(`SELECT balance, lifetime_earned FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
  const stocks = ((await db.prepare(`SELECT symbol, name, sector, description_tr AS descriptionTr, description_en AS descriptionEn, price, previous_price AS previousPrice, volatility, risk FROM market_stocks ORDER BY sector, symbol`).all())?.results || []).map((stock: any) => {
    const price = Number(stock.price || 0);
    const previous = Number(stock.previousPrice || price || 1);
    const change = previous > 0 ? ((price - previous) / previous) * 100 : 0;
    return { ...stock, price, volatility: Number(stock.volatility || 0), change };
  });
  const historyRows = (await db.prepare(`SELECT symbol, price FROM market_price_history ORDER BY id DESC LIMIT 360`).all())?.results || [];
  const history: Record<string, number[]> = {};
  for (const stock of stocks as any[]) history[stock.symbol] = [];
  for (const row of [...(historyRows as any[])].reverse()) {
    if (!history[row.symbol]) continue;
    if (history[row.symbol].length < 14) history[row.symbol].push(Number(row.price || 0));
  }
  const news = ((await db.prepare(`SELECT day, symbol AS target, impact, tone, title_tr AS titleTr, title_en AS titleEn, lesson_tr AS lessonTr, lesson_en AS lessonEn, created_at AS createdAt FROM market_news ORDER BY id DESC LIMIT 6`).all())?.results || []).map((item: any) => ({ ...item, day: Number(item.day || 1), impact: Number(item.impact || 0) }));
  return {
    mode: "real-tech-coin-wallet",
    day: Number((await getMeta(context, "day")) || 1),
    cash: portfolio.walletBalance,
    startingValue,
    holdings: portfolio.holdings,
    stocks,
    history,
    news,
    rewards,
    techCoin: {
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
    },
  };
}

async function calculatePortfolio(context: any, userId: number) {
  const db = context.env.DB;
  await ensureCoinWallet(context, userId);
  const walletBalance = await getWalletBalance(context, userId);
  const stocks = (await db.prepare(`SELECT symbol, price FROM market_stocks`).all())?.results || [];
  const holdingRows = (await db.prepare(`SELECT symbol, shares FROM market_holdings WHERE user_id = ? AND shares > 0`).bind(userId).all())?.results || [];
  const prices = Object.fromEntries((stocks as any[]).map((stock) => [stock.symbol, Number(stock.price || 0)]));
  const holdings: Record<string, number> = {};
  let invested = 0;
  for (const row of holdingRows as any[]) {
    const shares = Number(row.shares || 0);
    const price = Number(prices[row.symbol] || 0);
    if (shares <= 0 || price <= 0) continue;
    holdings[row.symbol] = shares;
    invested += shares * price;
  }
  const total = walletBalance + invested;
  const weights = Object.entries(holdings).map(([symbol, shares]) => (Number(shares) * Number(prices[symbol] || 0)) / Math.max(1, total));
  return {
    walletBalance,
    holdings,
    invested,
    total,
    holdingCount: Object.keys(holdings).length,
    cashRatio: total > 0 ? walletBalance / total : 1,
    maxWeight: weights.length ? Math.max(...weights) : 0,
  };
}

async function ensurePortfolioBaseline(context: any, userId: number) {
  const db = context.env.DB;
  const existing: any = await db.prepare(`SELECT starting_value FROM market_portfolio_baselines WHERE user_id = ?`).bind(userId).first();
  if (existing) return Number(existing.starting_value || 0);
  const portfolio = await calculatePortfolio(context, userId);
  await db.prepare(`INSERT OR IGNORE INTO market_portfolio_baselines (user_id, starting_value) VALUES (?, ?)`).bind(userId, portfolio.total).run();
  return portfolio.total;
}

async function ensureCoinWallet(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned) VALUES (?, 0, 0)`).bind(userId).run();
}

async function getWalletBalance(context: any, userId: number) {
  await ensureCoinWallet(context, userId);
  const wallet: any = await context.env.DB.prepare(`SELECT balance FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
  return Number(wallet?.balance || 0);
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
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
