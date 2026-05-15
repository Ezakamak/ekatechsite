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

const STOCKS: StockSeed[] = [
  { symbol: "EKA", name: "EKA Yazılım", sector: "Teknoloji", descriptionTr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.", descriptionEn: "A fictional cloud software and automation company.", price: 124, volatility: 0.055, risk: "medium" },
  { symbol: "NOVA", name: "NOVA Enerji", sector: "Enerji", descriptionTr: "Yenilenebilir enerji projelerine odaklanan kurgu şirket.", descriptionEn: "A fictional company focused on renewable energy projects.", price: 88, volatility: 0.07, risk: "high" },
  { symbol: "MARM", name: "Marmara Gıda", sector: "Gıda", descriptionTr: "Temel tüketim ürünleri satan savunmacı kurgu şirket.", descriptionEn: "A fictional defensive consumer staples company.", price: 52, volatility: 0.032, risk: "low" },
  { symbol: "PIXEL", name: "Pixel Teknoloji", sector: "Teknoloji", descriptionTr: "Oyun motoru ve grafik yazılımları geliştiren kurgu şirket.", descriptionEn: "A fictional game engine and graphics software company.", price: 41, volatility: 0.085, risk: "high" },
  { symbol: "TURK", name: "TURK Savunma", sector: "Sanayi", descriptionTr: "Endüstriyel güvenlik sistemleri geliştiren kurgu şirket.", descriptionEn: "A fictional industrial security systems company.", price: 96, volatility: 0.052, risk: "medium" },
  { symbol: "LUNA", name: "Luna Lojistik", sector: "Lojistik", descriptionTr: "Depo, kargo ve tedarik zinciri ağı işleten kurgu şirket.", descriptionEn: "A fictional warehousing, cargo and supply chain company.", price: 67, volatility: 0.044, risk: "medium" },
];

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
  { tone: "positive", impact: 0.049, titleTr: "{name} yeni pazara giriş planını hızlandırdı.", titleEn: "{name} accelerated its new market entry plan.", lessonTr: "Yeni pazar büyüme fırsatı demektir; uygulama maliyeti de dikkate alınır.", lessonEn: "A new market means growth opportunity, but execution cost also matters." },
  { tone: "positive", impact: 0.041, titleTr: "{name} maliyet kontrol programında ilk sonuçları aldı.", titleEn: "{name} saw early results from its cost control program.", lessonTr: "Maliyet kontrolü marjları destekleyebilir; gelir büyümesiyle birleşirse etkisi artar.", lessonEn: "Cost control can support margins; impact grows when combined with revenue growth." },
  { tone: "positive", impact: 0.057, titleTr: "{name} analist beklentilerinde yukarı revizyon aldı.", titleEn: "{name} received upward analyst expectation revisions.", lessonTr: "Beklenti revizyonları fiyatı etkileyebilir; tek başına karar sebebi değildir.", lessonEn: "Expectation revisions can affect price, but they are not a decision reason alone." },
  { tone: "positive", impact: 0.029, titleTr: "{name} tedarik zincirinde iyileşme sinyali verdi.", titleEn: "{name} signaled improvement in its supply chain.", lessonTr: "Tedarik rahatlaması stok, teslimat ve maliyet tarafında olumlu algılanabilir.", lessonEn: "Supply-chain relief can be positive for inventory, delivery and cost expectations." },
  { tone: "positive", impact: 0.063, titleTr: "{name} yeni teknoloji yatırımıyla kapasite artırıyor.", titleEn: "{name} is expanding capacity with a new technology investment.", lessonTr: "Kapasite artışı büyüme sinyalidir; yatırımın geri dönüş süresi kritik kalır.", lessonEn: "Capacity expansion is a growth signal; payback time remains critical." },
  { tone: "positive", impact: 0.047, titleTr: "{name} müşteri memnuniyeti skorunda yükseliş açıkladı.", titleEn: "{name} reported an increase in customer satisfaction scores.", lessonTr: "Müşteri memnuniyeti uzun vadede sadakat ve satış kalitesini etkileyebilir.", lessonEn: "Customer satisfaction can affect loyalty and sales quality over the long term." },
  { tone: "positive", impact: 0.055, titleTr: "{name} dış gelir kanalını güçlendirdi.", titleEn: "{name} strengthened an external revenue channel.", lessonTr: "Gelir çeşitliliği tek pazara bağımlılığı azaltabilir.", lessonEn: "Revenue diversification can reduce dependence on a single market." },
  { tone: "positive", impact: 0.036, titleTr: "{name} kurumsal yönetim notunda iyileşme duyurdu.", titleEn: "{name} announced an improvement in its governance score.", lessonTr: "Kurumsal yönetim algısı güveni artırabilir fakat fiyat etkisi genelde sınırlıdır.", lessonEn: "Governance perception can improve trust, though price impact is often limited." },
  { tone: "positive", impact: 0.068, titleTr: "{name} pazar payında artış yakaladı.", titleEn: "{name} captured higher market share.", lessonTr: "Pazar payı artışı rekabet gücü sinyalidir; marjlarla birlikte okunmalıdır.", lessonEn: "Market share growth signals competitiveness; read it with margins." },
  { tone: "negative", impact: -0.042, titleTr: "{name} beklenenden zayıf talep sinyali verdi.", titleEn: "{name} signaled weaker-than-expected demand.", lessonTr: "Talep zayıflığı gelir beklentisini bozar ve kısa vadeli baskı yaratabilir.", lessonEn: "Weak demand hurts revenue expectations and can create short-term pressure." },
  { tone: "negative", impact: -0.054, titleTr: "{name} maliyet artışı nedeniyle marj baskısı bildirdi.", titleEn: "{name} reported margin pressure from rising costs.", lessonTr: "Maliyet artışı satış iyi olsa bile kârlılığı düşürebilir.", lessonEn: "Rising costs can reduce profitability even when sales look healthy." },
  { tone: "negative", impact: -0.067, titleTr: "{name} ürün veya proje teslimatında gecikme açıkladı.", titleEn: "{name} announced a product or project delivery delay.", lessonTr: "Gecikmeler beklentiyi bozar; yüksek oynak hisselerde etki daha sert olabilir.", lessonEn: "Delays weaken expectations; impact can be sharper in high-volatility stocks." },
  { tone: "negative", impact: -0.049, titleTr: "{sector} sektöründe regülasyon belirsizliği arttı; {name} baskı gördü.", titleEn: "Regulatory uncertainty increased in the {sector} sector; {name} came under pressure.", lessonTr: "Regülasyon belirsizliği şirketten bağımsız sektör riski yaratabilir.", lessonEn: "Regulatory uncertainty can create sector risk independent of company quality." },
  { tone: "negative", impact: -0.036, titleTr: "{name} rekabet baskısının arttığını belirtti.", titleEn: "{name} said competitive pressure increased.", lessonTr: "Rekabet artışı fiyatlama gücünü ve kâr marjını zorlayabilir.", lessonEn: "Rising competition can pressure pricing power and profit margins." },
  { tone: "negative", impact: -0.074, titleTr: "{name} beklenti altı finansal sonuç yayımladı.", titleEn: "{name} published financial results below expectations.", lessonTr: "Beklenti altı sonuç, kötü haber fiyatlanmadıysa sert tepki doğurabilir.", lessonEn: "Below-expectation results can cause a sharp reaction if bad news was not priced in." },
  { tone: "negative", impact: -0.031, titleTr: "{name} kısa vadeli nakit akışı baskısı yaşayabileceğini açıkladı.", titleEn: "{name} said it may face short-term cash flow pressure.", lessonTr: "Nakit akışı günlük dayanıklılığı gösterir; kârdan ayrı takip edilir.", lessonEn: "Cash flow shows day-to-day resilience and is tracked separately from profit." },
  { tone: "negative", impact: -0.058, titleTr: "{name} tedarik sorunu nedeniyle üretim planını aşağı çekti.", titleEn: "{name} lowered its production plan due to supply issues.", lessonTr: "Tedarik sorunu satış ve teslimat zincirini bozabilir.", lessonEn: "Supply issues can disrupt sales and delivery chains." },
  { tone: "negative", impact: -0.046, titleTr: "{name} yönetim değişikliği sonrası belirsizlikle karşılaştı.", titleEn: "{name} faced uncertainty after a management change.", lessonTr: "Yönetim değişikliği her zaman kötü değildir; geçişte belirsizlik artar.", lessonEn: "Management change is not always bad, but uncertainty rises during transition." },
  { tone: "negative", impact: -0.052, titleTr: "{name} büyük müşterilerinden birinde sipariş yavaşlaması gördü.", titleEn: "{name} saw order slowdown from a major customer.", lessonTr: "Müşteri yoğunlaşması varsa tek müşterideki yavaşlama büyük etki yaratabilir.", lessonEn: "If customer concentration is high, one customer slowdown can matter a lot." },
  { tone: "negative", impact: -0.039, titleTr: "{name} stok seviyelerinde geçici artış bildirdi.", titleEn: "{name} reported a temporary increase in inventory levels.", lessonTr: "Stok artışı bazen talep zayıflığına, bazen hazırlığa işaret eder; bağlam önemlidir.", lessonEn: "Inventory growth can signal weak demand or preparation; context matters." },
  { tone: "negative", impact: -0.061, titleTr: "{name} yatırım harcamalarının beklenenden yüksek olacağını açıkladı.", titleEn: "{name} said investment spending will be higher than expected.", lessonTr: "Yatırım büyümeyi destekler ama kısa vadede nakit ve kârı baskılayabilir.", lessonEn: "Investment supports growth but can pressure cash and profit short-term." },
  { tone: "negative", impact: -0.044, titleTr: "{name} fiyatlama gücünde sınırlı zayıflama sinyali verdi.", titleEn: "{name} signaled limited weakening in pricing power.", lessonTr: "Fiyatlama gücü azalınca şirket maliyeti müşteriye yansıtmakta zorlanabilir.", lessonEn: "When pricing power weakens, passing costs to customers can become harder." },
  { tone: "negative", impact: -0.057, titleTr: "{name} siber/operasyonel güvenlik testinde sorun yaşadı.", titleEn: "{name} faced an issue in a cyber or operational security test.", lessonTr: "Operasyonel riskler gelir tablosuna hemen girmese bile güven algısını etkileyebilir.", lessonEn: "Operational risks may not immediately hit income statements but can affect trust." },
  { tone: "negative", impact: -0.033, titleTr: "{name} kısa vadeli görünümde temkinli ton kullandı.", titleEn: "{name} used a cautious tone for the short-term outlook.", lessonTr: "Şirket dili bazen sayılardan önce beklentiyi değiştirir.", lessonEn: "Company tone can sometimes shift expectations before the numbers do." },
  { tone: "negative", impact: -0.069, titleTr: "{name} ana projesinde beklenmedik revizyon açıkladı.", titleEn: "{name} announced an unexpected revision in a key project.", lessonTr: "Ana projedeki revizyon hikâyeyi değiştirirse fiyat tepkisi güçlü olabilir.", lessonEn: "If a key project revision changes the story, price reaction can be strong." },
  { tone: "neutral", impact: 0.012, titleTr: "{name} yatırımcı sunumunu güncelledi.", titleEn: "{name} updated its investor presentation.", lessonTr: "Her haber büyük fiyat hareketi yaratmaz; bazen bilgi akışı sadece izleme sinyalidir.", lessonEn: "Not every headline causes a large move; some news is simply information to monitor." },
  { tone: "neutral", impact: -0.009, titleTr: "{name} olağan kurul toplantısı takvimini paylaştı.", titleEn: "{name} shared its regular meeting calendar.", lessonTr: "Takvim haberleri genelde sınırlı etki yapar; önemli olan toplantıdan çıkacak kararlardır.", lessonEn: "Calendar news usually has limited impact; decisions from the meeting matter more." },
  { tone: "neutral", impact: 0.006, titleTr: "{name} sektör raporunda ortalama görünümle yer aldı.", titleEn: "{name} appeared with an average outlook in a sector report.", lessonTr: "Nötr haberler piyasayı sakin tutabilir; fiyat yine de genel duyguya bağlı oynar.", lessonEn: "Neutral news can keep markets calm; price can still move with broader sentiment." },
  { tone: "neutral", impact: 0.014, titleTr: "{name} küçük ölçekli süreç iyileştirmesi duyurdu.", titleEn: "{name} announced a small process improvement.", lessonTr: "Küçük iyileştirmeler uzun vadede anlamlı olabilir ama kısa vadede etkisi sınırlıdır.", lessonEn: "Small improvements can matter long-term, but short-term impact is limited." },
  { tone: "neutral", impact: -0.012, titleTr: "{name} geçici bakım çalışması planladığını bildirdi.", titleEn: "{name} announced planned temporary maintenance work.", lessonTr: "Planlı bakım olağan olabilir; sorun plansız kesinti veya uzun süreli aksaklıktır.", lessonEn: "Planned maintenance can be normal; unplanned or prolonged disruption is the issue." },
  { tone: "neutral", impact: 0.01, titleTr: "{name} marka yenileme çalışmasını tamamladı.", titleEn: "{name} completed a brand refresh.", lessonTr: "Marka haberleri algıyı etkileyebilir; finansal etki için satış verisi gerekir.", lessonEn: "Brand news can affect perception; sales data is needed for financial impact." },
  { tone: "neutral", impact: -0.006, titleTr: "{name} küçük çaplı organizasyon güncellemesi yaptı.", titleEn: "{name} made a small organizational update.", lessonTr: "Organizasyon haberleri tek başına güçlü sinyal değildir; sonuçları izlemek gerekir.", lessonEn: "Organizational news is not a strong signal alone; outcomes need to be watched." },
  { tone: "neutral", impact: 0.008, titleTr: "{name} sürdürülebilirlik hedeflerini tekrar teyit etti.", titleEn: "{name} reaffirmed its sustainability targets.", lessonTr: "Hedef teyidi güven verir ama fiyat etkisi genellikle performans verisiyle oluşur.", lessonEn: "Target reaffirmation can build trust, but price impact usually needs performance data." },
];

const NEWS_POOL: NewsSeed[] = buildNewsPool();

function buildNewsPool() {
  return STOCKS.flatMap((stock) => {
    const riskMultiplier = stock.risk === "high" ? 1.22 : stock.risk === "low" ? 0.72 : 1;
    const sectorMultiplier = stock.sector === "Gıda" ? 0.82 : stock.sector === "Teknoloji" ? 1.08 : 1;
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

  for (const stock of STOCKS) {
    await db.prepare(`INSERT OR IGNORE INTO market_stocks (symbol, name, sector, description_tr, description_en, price, previous_price, volatility, risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(stock.symbol, stock.name, stock.sector, stock.descriptionTr, stock.descriptionEn, stock.price, stock.price, stock.volatility, stock.risk).run();
    const historyCount: any = await db.prepare(`SELECT COUNT(*) AS count FROM market_price_history WHERE symbol = ?`).bind(stock.symbol).first();
    if (Number(historyCount?.count || 0) === 0) await db.prepare(`INSERT INTO market_price_history (symbol, price, day) VALUES (?, ?, 1)`).bind(stock.symbol, stock.price).run();
  }
}

async function migrateLegacyPortfolio(context: any, userId: number) {
  const db = context.env.DB;
  await ensureCoinWallet(context, userId);
  const migrated: any = await db.prepare(`SELECT user_id FROM market_wallet_migrations WHERE user_id = ?`).bind(userId).first();
  if (migrated) return;

  await db.prepare(`DELETE FROM market_holdings WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM market_transactions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM market_portfolio_baselines WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`INSERT OR IGNORE INTO market_wallet_migrations (user_id) VALUES (?)`).bind(userId).run();
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
  if (!stock) throw new Error("Böyle bir kurgu hisse yok.");

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

  const stocks = ((await db.prepare(`SELECT symbol, name, sector, description_tr AS descriptionTr, description_en AS descriptionEn, price, previous_price AS previousPrice, volatility, risk FROM market_stocks ORDER BY symbol`).all())?.results || []).map((stock: any) => {
    const price = Number(stock.price || 0);
    const previous = Number(stock.previousPrice || price || 1);
    const change = previous > 0 ? ((price - previous) / previous) * 100 : 0;
    return { ...stock, price, volatility: Number(stock.volatility || 0), change };
  });

  const historyRows = (await db.prepare(`SELECT symbol, price FROM market_price_history ORDER BY id DESC LIMIT 84`).all())?.results || [];
  const history: Record<string, number[]> = {};
  for (const stock of stocks as any[]) history[stock.symbol] = [];
  for (const row of [...(historyRows as any[])].reverse()) {
    if (!history[row.symbol]) history[row.symbol] = [];
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
    holdings[row.symbol] = shares;
    invested += shares * Number(prices[row.symbol] || 0);
  }

  const total = walletBalance + invested;
  const weights = (holdingRows as any[]).map((row) => (Number(row.shares || 0) * Number(prices[row.symbol] || 0)) / Math.max(1, total));
  return {
    walletBalance,
    holdings,
    invested,
    total,
    holdingCount: holdingRows.length,
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
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
