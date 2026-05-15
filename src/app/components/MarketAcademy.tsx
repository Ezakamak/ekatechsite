import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  LineChart,
  Newspaper,
  PieChart,
  RefreshCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "../i18n";

type Stock = {
  symbol: string;
  name: string;
  sector: string;
  descriptionTr: string;
  descriptionEn: string;
  price: number;
  previousPrice?: number;
  change: number;
  volatility: number;
  risk: "low" | "medium" | "high";
};

type NewsItem = {
  target: string;
  impact: number;
  tone: "positive" | "negative" | "neutral";
  titleTr: string;
  titleEn: string;
  lessonTr: string;
  lessonEn: string;
  day: number;
  createdAt?: string;
};

type MarketState = {
  mode?: string;
  day: number;
  cash: number;
  holdings: Record<string, number>;
  stocks: Stock[];
  history: Record<string, number[]>;
  news: NewsItem[];
};

const STARTING_CASH = 100000;

const FALLBACK_STATE: MarketState = {
  mode: "offline-preview",
  day: 1,
  cash: STARTING_CASH,
  holdings: {},
  history: {
    EKA: [124],
    NOVA: [88],
    MARM: [52],
    PIXEL: [41],
    TURK: [96],
    LUNA: [67],
  },
  news: [],
  stocks: [
    { symbol: "EKA", name: "EKA Yazılım", sector: "Teknoloji", descriptionTr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.", descriptionEn: "A fictional cloud software and automation company.", price: 124, change: 0, volatility: 0.055, risk: "medium" },
    { symbol: "NOVA", name: "NOVA Enerji", sector: "Enerji", descriptionTr: "Yenilenebilir enerji projelerine odaklanan kurgu şirket.", descriptionEn: "A fictional company focused on renewable energy projects.", price: 88, change: 0, volatility: 0.07, risk: "high" },
    { symbol: "MARM", name: "Marmara Gıda", sector: "Gıda", descriptionTr: "Temel tüketim ürünleri satan savunmacı kurgu şirket.", descriptionEn: "A fictional defensive consumer staples company.", price: 52, change: 0, volatility: 0.032, risk: "low" },
    { symbol: "PIXEL", name: "Pixel Teknoloji", sector: "Teknoloji", descriptionTr: "Oyun motoru ve grafik yazılımları geliştiren kurgu şirket.", descriptionEn: "A fictional game engine and graphics software company.", price: 41, change: 0, volatility: 0.085, risk: "high" },
    { symbol: "TURK", name: "TURK Savunma", sector: "Sanayi", descriptionTr: "Endüstriyel güvenlik sistemleri geliştiren kurgu şirket.", descriptionEn: "A fictional industrial security systems company.", price: 96, change: 0, volatility: 0.052, risk: "medium" },
    { symbol: "LUNA", name: "Luna Lojistik", sector: "Lojistik", descriptionTr: "Depo, kargo ve tedarik zinciri ağı işleten kurgu şirket.", descriptionEn: "A fictional warehousing, cargo and supply chain company.", price: 67, change: 0, volatility: 0.044, risk: "medium" },
  ],
};

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

function formatPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readJson(response: Response) {
  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || raw?.slice(0, 160) || `HTTP ${response.status}`);
  }

  return data;
}

export function MarketAcademy() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const copy = tr
    ? {
        eyebrow: "Online SQL tabanlı eğitim borsası",
        title: "EkaTrade Academy",
        subtitle: "Kurgu piyasa artık cihazda değil, D1 veritabanında tutulur. Her hesap kendi sanal portföyünü görür; fiyatlar ortak piyasada süreyle güncellenir.",
        disclaimer: "Bu simülasyon yalnızca eğitim amaçlıdır. Gerçek yatırım tavsiyesi değildir; gerçek para veya gerçek hisse kullanılmaz.",
        loading: "Online market verisi yükleniyor...",
        offline: "Online market API şu an cevap vermedi. Önizleme verisi gösteriliyor; al/sat işlemleri devre dışı.",
        online: "Online D1 modu aktif",
        day: "Piyasa günü",
        cash: "Sanal nakit",
        total: "Portföy değeri",
        pnl: "Toplam sonuç",
        refresh: "Canlı veriyi yenile",
        reset: "Portföyü sıfırla",
        market: "Global kurgu piyasa",
        orderPanel: "Online işlem paneli",
        symbol: "Hisse",
        quantity: "Adet",
        buy: "Online sanal alım",
        sell: "Online sanal satış",
        owned: "Sende var",
        portfolio: "Hesap portföyün",
        risk: "Risk analizi",
        missions: "Eğitim görevleri",
        news: "Global haber akışı",
        emptyNews: "Henüz haber yok. Piyasa otomatik tick aldığında haber oluşur.",
        lesson: "Ders notu",
        price: "Fiyat",
        value: "İşlem değeri",
        sector: "Sektör",
        shares: "adet",
        emptyPortfolio: "Bu hesapta henüz hisse yok. Küçük bir sanal alım yaparak başla.",
        buyOk: "Online sanal alım kaydedildi.",
        sellOk: "Online sanal satış kaydedildi.",
        resetOk: "Online portföy sıfırlandı.",
        invalidQty: "Adet 1 veya daha büyük olmalı.",
        resetConfirm: "Bu hesabın sanal borsa portföyü sıfırlansın mı?",
        completed: "tamamlandı",
        low: "Düşük",
        medium: "Orta",
        high: "Yüksek",
      }
    : {
        eyebrow: "Online SQL-based market academy",
        title: "EkaTrade Academy",
        subtitle: "The fictional market is now stored in D1 instead of the device. Each account has its own virtual portfolio; prices update on the shared market timeline.",
        disclaimer: "This simulation is for education only. It is not investment advice; no real money or real stocks are used.",
        loading: "Loading online market data...",
        offline: "The online market API did not respond. Preview data is shown; trading is disabled.",
        online: "Online D1 mode active",
        day: "Market day",
        cash: "Virtual cash",
        total: "Portfolio value",
        pnl: "Total result",
        refresh: "Refresh live data",
        reset: "Reset portfolio",
        market: "Global fictional market",
        orderPanel: "Online order panel",
        symbol: "Stock",
        quantity: "Quantity",
        buy: "Online virtual buy",
        sell: "Online virtual sell",
        owned: "Owned",
        portfolio: "Account portfolio",
        risk: "Risk analysis",
        missions: "Learning missions",
        news: "Global news feed",
        emptyNews: "No news yet. A market tick will create news automatically.",
        lesson: "Lesson note",
        price: "Price",
        value: "Order value",
        sector: "Sector",
        shares: "shares",
        emptyPortfolio: "This account has no stocks yet. Start with a small virtual order.",
        buyOk: "Online virtual buy saved.",
        sellOk: "Online virtual sell saved.",
        resetOk: "Online portfolio reset.",
        invalidQty: "Quantity must be 1 or higher.",
        resetConfirm: "Reset this account's virtual market portfolio?",
        completed: "completed",
        low: "Low",
        medium: "Medium",
        high: "High",
      };

  const [state, setState] = useState<MarketState>(FALLBACK_STATE);
  const [selectedSymbol, setSelectedSymbol] = useState(FALLBACK_STATE.stocks[0].symbol);
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);

  const selectedStock = state.stocks.find((stock) => stock.symbol === selectedSymbol) || state.stocks[0];
  const selectedOwned = safeNumber(state.holdings[selectedStock.symbol]);
  const orderValue = selectedStock.price * Math.max(0, safeNumber(quantity));

  const portfolio = useMemo(() => {
    const rows = state.stocks
      .map((stock) => {
        const shares = safeNumber(state.holdings[stock.symbol]);
        const value = shares * stock.price;
        return { ...stock, shares, value };
      })
      .filter((row) => row.shares > 0);

    const invested = rows.reduce((sum, row) => sum + row.value, 0);
    const total = state.cash + invested;
    const pnl = total - STARTING_CASH;
    const pnlPercent = STARTING_CASH > 0 ? (pnl / STARTING_CASH) * 100 : 0;
    const maxWeight = total > 0 ? Math.max(0, ...rows.map((row) => row.value / total)) : 0;
    const sectorMap = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.sector] = (acc[row.sector] || 0) + row.value;
      return acc;
    }, {});
    const maxSectorWeight = total > 0 ? Math.max(0, ...Object.values(sectorMap).map((value) => value / total)) : 0;

    return { rows, invested, total, pnl, pnlPercent, maxWeight, maxSectorWeight, sectorMap };
  }, [state]);

  const risk = useMemo(() => {
    if (portfolio.rows.length === 0) {
      return {
        label: tr ? "Başlangıç" : "Starter",
        tone: "cyan",
        text: tr ? "Henüz risk oluşmadı. İlk amaç küçük bir pozisyon açıp ekranı tanımak." : "No portfolio risk yet. First goal: open a small position and learn the screen.",
      };
    }

    if (portfolio.maxWeight > 0.65 || portfolio.maxSectorWeight > 0.8) {
      return {
        label: tr ? "Aşırı yoğunlaşma" : "Overconcentrated",
        tone: "red",
        text: tr ? "Portföyün tek hisseye veya tek sektöre fazla yığılmış. Tek kötü haber portföyü sert etkileyebilir." : "Your portfolio is too concentrated in one stock or sector. One bad headline can hurt too much.",
      };
    }

    if (portfolio.maxWeight > 0.45 || portfolio.rows.length < 3) {
      return {
        label: tr ? "Yüksek risk" : "High risk",
        tone: "amber",
        text: tr ? "Dağılım hâlâ zayıf. En az 3 farklı hisse ve mümkünse farklı sektörler kullan." : "Diversification is still weak. Use at least 3 stocks and preferably different sectors.",
      };
    }

    return {
      label: tr ? "Dengeli" : "Balanced",
      tone: "emerald",
      text: tr ? "Portföy tek noktaya yığılmamış. Bu, temel risk yönetimi açısından daha sağlıklı." : "Your portfolio is not concentrated in one spot. That is healthier for basic risk management.",
    };
  }, [portfolio, tr]);

  const missions = useMemo(() => {
    const hasAnyStock = portfolio.rows.length > 0;
    const diversified = portfolio.rows.length >= 3;
    const cashRatio = portfolio.total > 0 ? state.cash / portfolio.total : 1;
    const hasNews = state.news.length >= 3;
    const concentrationOk = hasAnyStock && portfolio.maxWeight <= 0.5;

    return [
      { done: hasAnyStock, title: tr ? "İlk online sanal alımını yap" : "Make your first online virtual buy", desc: tr ? "İşlem artık D1 veritabanına kaydolur." : "The trade is now saved to D1." },
      { done: diversified, title: tr ? "3 farklı hisseye böl" : "Hold 3 different stocks", desc: tr ? "Tek hisse riskini azalt." : "Reduce single-stock risk." },
      { done: cashRatio >= 0.1, title: tr ? "En az %10 nakit bırak" : "Keep at least 10% cash", desc: tr ? "Fırsat ve hata payı için nakit tut." : "Keep cash for flexibility and mistakes." },
      { done: concentrationOk, title: tr ? "Tek hisse ağırlığını %50 altına indir" : "Keep one stock below 50%", desc: tr ? "Yoğunlaşma riskini kontrol et." : "Control concentration risk." },
      { done: hasNews, title: tr ? "3 global haber etkisi gözlemle" : "Observe 3 global news events", desc: tr ? "Fiyatın habere nasıl tepki verdiğini izle." : "Watch how prices react to news." },
    ];
  }, [portfolio, state.cash, state.news.length, tr]);

  const completedMissions = missions.filter((mission) => mission.done).length;

  useEffect(() => {
    loadMarket(true);
    const timer = window.setInterval(() => loadMarket(false), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!state.stocks.some((stock) => stock.symbol === selectedSymbol)) {
      setSelectedSymbol(state.stocks[0]?.symbol || "EKA");
    }
  }, [state.stocks, selectedSymbol]);

  function setTemporaryMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 2800);
  }

  async function loadMarket(showLoader: boolean) {
    if (showLoader) setLoading(true);
    try {
      const data = await readJson(await fetch("/api/market", { credentials: "same-origin", cache: "no-store" }));
      setState(normalizeMarketState(data));
      setOnline(true);
      setMessage(null);
    } catch (error) {
      setOnline(false);
      setTemporaryMessage(error instanceof Error ? error.message : copy.offline);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function postAction(payload: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    try {
      const data = await readJson(await fetch("/api/market", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      setState(normalizeMarketState(data));
      setOnline(true);
      setTemporaryMessage(okMessage);
    } catch (error) {
      setTemporaryMessage(error instanceof Error ? error.message : copy.offline);
    } finally {
      setBusy(false);
    }
  }

  function handleTrade(side: "buy" | "sell") {
    const qty = Math.floor(safeNumber(quantity));
    if (qty < 1) {
      setTemporaryMessage(copy.invalidQty);
      return;
    }
    postAction({ action: side, symbol: selectedStock.symbol, quantity: qty }, side === "buy" ? copy.buyOk : copy.sellOk);
  }

  function resetPortfolio() {
    if (!window.confirm(copy.resetConfirm)) return;
    postAction({ action: "reset" }, copy.resetOk);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-28 text-white sm:px-6">
      <div className="absolute left-1/2 top-16 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute bottom-28 right-0 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                <BarChart3 className="h-4 w-4" /> {copy.eyebrow}
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight sm:text-7xl">{copy.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
            </div>
            <div className={`rounded-3xl border p-4 text-sm leading-6 lg:max-w-sm ${online ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                <p>{online ? `${copy.online}. ${copy.disclaimer}` : copy.offline}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-white/55 backdrop-blur-xl">{copy.loading}</div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<CircleDollarSign />} label={copy.cash} value={`${formatMoney(state.cash, locale)} ₺`} />
          <MetricCard icon={<PieChart />} label={copy.total} value={`${formatMoney(portfolio.total, locale)} ₺`} />
          <MetricCard icon={portfolio.pnl >= 0 ? <TrendingUp /> : <TrendingDown />} label={copy.pnl} value={`${portfolio.pnl >= 0 ? "+" : ""}${formatMoney(portfolio.pnl, locale)} ₺`} detail={`${portfolio.pnl >= 0 ? "+" : ""}${formatPrice(portfolio.pnlPercent, locale)}%`} tone={portfolio.pnl >= 0 ? "emerald" : "red"} />
          <MetricCard icon={<BookOpen />} label={copy.day} value={`${state.day}`} detail={`${completedMissions}/${missions.length} ${copy.completed}`} tone="cyan" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">{copy.market}</p>
                <h2 className="mt-2 text-3xl font-medium">{tr ? "Kurgu hisseler" : "Fictional stocks"}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => loadMarket(false)} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-50">
                  <LineChart className="h-4 w-4" /> {copy.refresh}
                </button>
                <button type="button" disabled={busy || !online} onClick={resetPortfolio} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40">
                  <RefreshCcw className="h-4 w-4" /> {copy.reset}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {state.stocks.map((stock) => (
                <button key={stock.symbol} type="button" onClick={() => setSelectedSymbol(stock.symbol)} className={`group rounded-3xl border p-4 text-left transition-all ${selectedSymbol === stock.symbol ? "border-cyan-300/40 bg-cyan-300/[0.08]" : "border-white/10 bg-black/25 hover:bg-white/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-white">{stock.symbol}</span>
                        <span className="text-xs text-white/40">{stock.sector}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-medium">{stock.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/45">{tr ? stock.descriptionTr : stock.descriptionEn}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold">{formatPrice(stock.price, locale)} ₺</p>
                      <p className={`mt-1 text-sm ${stock.change >= 0 ? "text-emerald-300" : "text-red-300"}`}>{stock.change >= 0 ? "+" : ""}{formatPrice(stock.change, locale)}%</p>
                    </div>
                  </div>
                  <MiniSparkline values={state.history[stock.symbol] || [stock.price]} positive={stock.change >= 0} />
                  <div className="mt-3 flex items-center justify-between text-xs text-white/35">
                    <span>{tr ? "Risk" : "Risk"}: {stock.risk === "low" ? copy.low : stock.risk === "medium" ? copy.medium : copy.high}</span>
                    <span>{copy.owned}: {safeNumber(state.holdings[stock.symbol])} {copy.shares}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">{copy.orderPanel}</p>
              <h2 className="mt-2 text-3xl font-medium">{selectedStock.name}</h2>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm text-white/50">{copy.symbol}</span>
                  <select value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                    {state.stocks.map((stock) => (
                      <option key={stock.symbol} value={stock.symbol}>{stock.symbol} · {stock.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-white/50">{copy.quantity}</span>
                  <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(safeNumber(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
                </label>
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
                  <InfoCell label={copy.price} value={`${formatPrice(selectedStock.price, locale)} ₺`} />
                  <InfoCell label={copy.value} value={`${formatMoney(orderValue, locale)} ₺`} />
                  <InfoCell label={copy.owned} value={`${selectedOwned} ${copy.shares}`} />
                  <InfoCell label={copy.sector} value={selectedStock.sector} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={busy || !online} onClick={() => handleTrade("buy")} className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-200 disabled:opacity-40">{copy.buy}</button>
                  <button type="button" disabled={busy || !online} onClick={() => handleTrade("sell")} className="rounded-full border border-red-300/30 bg-red-300/10 px-5 py-3 text-sm font-semibold text-red-100 transition-all hover:bg-red-300/15 disabled:opacity-40">{copy.sell}</button>
                </div>
                {message ? <p className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/70">{message}</p> : null}
              </div>
            </div>

            <RiskCard label={risk.label} text={risk.text} tone={risk.tone} title={copy.risk} />
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <PortfolioCard copy={copy} portfolio={portfolio} locale={locale} />
          <div className="grid gap-6 lg:grid-cols-2">
            <MissionCard title={copy.missions} missions={missions} />
            <NewsCard title={copy.news} empty={copy.emptyNews} lesson={copy.lesson} dayLabel={copy.day} news={state.news} tr={tr} locale={locale} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <LessonCard icon={<Brain />} title={tr ? "Fiyat = beklenti" : "Price = expectation"} text={tr ? "Hisse fiyatı sadece bugünkü durumu değil, geleceğe dair beklentiyi de taşır." : "A stock price reflects not only today, but also expectations about the future."} />
          <LessonCard icon={<ShieldCheck />} title={tr ? "Risk dağıtılır" : "Risk is diversified"} text={tr ? "Bütün sanal paranı tek şirkete koyarsan tek haber portföyü sert etkiler." : "If all virtual money is in one company, one headline can heavily affect the portfolio."} />
          <LessonCard icon={<Building2 />} title={tr ? "SQL mantığı" : "SQL logic"} text={tr ? "Nakit, portföy, fiyat geçmişi ve haberler ayrı tablolarda tutulur. Bu gerçek uygulama mimarisine daha yakındır." : "Cash, holdings, price history and news live in separate tables. This is closer to real app architecture."} />
        </section>
      </div>
    </main>
  );
}

function normalizeMarketState(data: any): MarketState {
  const stocks = Array.isArray(data?.stocks) && data.stocks.length ? data.stocks : FALLBACK_STATE.stocks;
  const holdings = data?.holdings && typeof data.holdings === "object" ? data.holdings : {};
  const history = data?.history && typeof data.history === "object" ? data.history : FALLBACK_STATE.history;
  const news = Array.isArray(data?.news) ? data.news : [];

  return {
    mode: data?.mode || "online-d1",
    day: safeNumber(data?.day) || 1,
    cash: safeNumber(data?.cash) || STARTING_CASH,
    holdings,
    stocks: stocks.map((stock: any) => ({
      symbol: String(stock.symbol || ""),
      name: String(stock.name || stock.symbol || ""),
      sector: String(stock.sector || "Genel"),
      descriptionTr: String(stock.descriptionTr || stock.description_tr || ""),
      descriptionEn: String(stock.descriptionEn || stock.description_en || ""),
      price: safeNumber(stock.price),
      previousPrice: safeNumber(stock.previousPrice || stock.previous_price || stock.price),
      change: safeNumber(stock.change),
      volatility: safeNumber(stock.volatility),
      risk: stock.risk === "low" || stock.risk === "medium" || stock.risk === "high" ? stock.risk : "medium",
    })),
    history,
    news,
  };
}

function MetricCard({ icon, label, value, detail, tone = "white" }: { icon: ReactNode; label: string; value: string; detail?: string; tone?: "white" | "cyan" | "emerald" | "red" }) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "emerald" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] ${toneClass}`}>{icon}</div>
      <p className="mt-4 text-sm text-white/40">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      {detail ? <p className="mt-1 text-sm text-white/40">{detail}</p> : null}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/35">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const safeValues = values.length > 1 ? values : [values[0] || 1, values[0] || 1];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues.map((value, index) => `${(index / Math.max(1, safeValues.length - 1)) * 100},${38 - ((value - min) / range) * 32}`).join(" ");

  return (
    <svg viewBox="0 0 100 42" className="mt-4 h-14 w-full overflow-visible">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={positive ? "text-emerald-300" : "text-red-300"} />
    </svg>
  );
}

function RiskCard({ label, text, tone, title }: { label: string; text: string; tone: string; title: string }) {
  const toneClass = tone === "red" ? "border-red-300/25 bg-red-300/10 text-red-100" : tone === "amber" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : tone === "emerald" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return (
    <div className={`rounded-[2rem] border p-5 backdrop-blur-xl sm:p-6 ${toneClass}`}>
      <p className="text-sm uppercase tracking-[0.2em] opacity-70">{title}</p>
      <h2 className="mt-3 text-3xl font-medium">{label}</h2>
      <p className="mt-4 text-sm leading-6 opacity-75">{text}</p>
    </div>
  );
}

function PortfolioCard({ copy, portfolio, locale }: { copy: any; portfolio: any; locale: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-white/35">{copy.portfolio}</p>
      <div className="mt-5 space-y-3">
        {portfolio.rows.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">{copy.emptyPortfolio}</p>
        ) : (
          portfolio.rows.map((row: any) => {
            const weight = portfolio.total > 0 ? (row.value / portfolio.total) * 100 : 0;
            return (
              <div key={row.symbol} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{row.symbol} · {row.name}</p>
                    <p className="mt-1 text-sm text-white/40">{row.shares} {copy.shares} · {row.sector}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(row.value, locale)} ₺</p>
                    <p className="mt-1 text-sm text-white/40">{formatPrice(weight, locale)}%</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.min(100, weight)}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MissionCard({ title, missions }: { title: string; missions: Array<{ done: boolean; title: string; desc: string }> }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-white/35">{title}</p>
      <div className="mt-5 space-y-3">
        {missions.map((mission) => (
          <div key={mission.title} className={`rounded-3xl border p-4 ${mission.done ? "border-emerald-300/20 bg-emerald-300/10" : "border-white/10 bg-black/25"}`}>
            <div className="flex gap-3">
              <CheckCircle2 className={`mt-1 h-5 w-5 shrink-0 ${mission.done ? "text-emerald-300" : "text-white/25"}`} />
              <div>
                <p className="font-medium">{mission.title}</p>
                <p className="mt-1 text-sm leading-6 text-white/45">{mission.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsCard({ title, empty, lesson, dayLabel, news, tr, locale }: { title: string; empty: string; lesson: string; dayLabel: string; news: NewsItem[]; tr: boolean; locale: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-white/35">{title}</p>
      <div className="mt-5 space-y-3">
        {news.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">{empty}</p>
        ) : (
          news.map((item, index) => (
            <div key={`${item.day}-${item.target}-${index}`} className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-xs text-white/35">
                <Newspaper className="h-4 w-4" /> {dayLabel} {item.day} · {item.target}
              </div>
              <p className="mt-2 font-medium">{tr ? item.titleTr : item.titleEn}</p>
              <p className={`mt-2 text-sm ${item.tone === "positive" ? "text-emerald-300" : item.tone === "negative" ? "text-red-300" : "text-cyan-300"}`}>{item.impact > 0 ? "+" : ""}{formatPrice(item.impact * 100, locale)}%</p>
              <p className="mt-3 text-sm leading-6 text-white/45"><span className="text-white/70">{lesson}:</span> {tr ? item.lessonTr : item.lessonEn}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LessonCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-300/10 text-purple-100">{icon}</div>
      <h3 className="mt-4 text-xl font-medium">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/45">{text}</p>
    </div>
  );
}
