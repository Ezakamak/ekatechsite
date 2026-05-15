import { useEffect, useMemo, useState } from "react";
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
  Sparkles,
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
  change: number;
  volatility: number;
  risk: "low" | "medium" | "high";
};

type NewsTemplate = {
  target: string;
  impact: number;
  tone: "positive" | "negative" | "neutral";
  titleTr: string;
  titleEn: string;
  lessonTr: string;
  lessonEn: string;
};

type NewsItem = NewsTemplate & {
  day: number;
};

type MarketState = {
  day: number;
  cash: number;
  holdings: Record<string, number>;
  stocks: Stock[];
  history: Record<string, number[]>;
  news: NewsItem[];
};

const STORAGE_KEY = "ekatech-market-academy-v1";
const STARTING_CASH = 100000;

const INITIAL_STOCKS: Stock[] = [
  {
    symbol: "EKA",
    name: "EKA Yazılım",
    sector: "Teknoloji",
    descriptionTr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.",
    descriptionEn: "A fictional cloud software and automation company.",
    price: 124,
    change: 0,
    volatility: 0.055,
    risk: "medium",
  },
  {
    symbol: "NOVA",
    name: "NOVA Enerji",
    sector: "Enerji",
    descriptionTr: "Yenilenebilir enerji projelerine odaklanan kurgu şirket.",
    descriptionEn: "A fictional company focused on renewable energy projects.",
    price: 88,
    change: 0,
    volatility: 0.07,
    risk: "high",
  },
  {
    symbol: "MARM",
    name: "Marmara Gıda",
    sector: "Gıda",
    descriptionTr: "Temel tüketim ürünleri satan savunmacı kurgu şirket.",
    descriptionEn: "A fictional defensive consumer staples company.",
    price: 52,
    change: 0,
    volatility: 0.032,
    risk: "low",
  },
  {
    symbol: "PIXEL",
    name: "Pixel Teknoloji",
    sector: "Teknoloji",
    descriptionTr: "Oyun motoru ve grafik yazılımları geliştiren kurgu şirket.",
    descriptionEn: "A fictional game engine and graphics software company.",
    price: 41,
    change: 0,
    volatility: 0.085,
    risk: "high",
  },
  {
    symbol: "TURK",
    name: "TURK Savunma",
    sector: "Sanayi",
    descriptionTr: "Endüstriyel güvenlik sistemleri geliştiren kurgu şirket.",
    descriptionEn: "A fictional industrial security systems company.",
    price: 96,
    change: 0,
    volatility: 0.052,
    risk: "medium",
  },
  {
    symbol: "LUNA",
    name: "Luna Lojistik",
    sector: "Lojistik",
    descriptionTr: "Depo, kargo ve tedarik zinciri ağı işleten kurgu şirket.",
    descriptionEn: "A fictional warehousing, cargo and supply chain company.",
    price: 67,
    change: 0,
    volatility: 0.044,
    risk: "medium",
  },
];

const NEWS_POOL: NewsTemplate[] = [
  {
    target: "EKA",
    impact: 0.09,
    tone: "positive",
    titleTr: "EKA Yazılım yeni kurumsal otomasyon anlaşması duyurdu.",
    titleEn: "EKA Software announced a new enterprise automation deal.",
    lessonTr: "Pozitif haber fiyatı yükseltebilir; yine de fiyat her zaman haber kadar yükselmek zorunda değildir.",
    lessonEn: "Positive news can lift price, but price does not have to rise exactly as much as the news sounds.",
  },
  {
    target: "PIXEL",
    impact: -0.1,
    tone: "negative",
    titleTr: "Pixel Teknoloji ürün gecikmesi açıkladı.",
    titleEn: "Pixel Technology announced a product delay.",
    lessonTr: "Gecikme haberleri beklentiyi bozar. Kısa vadede oynaklık artabilir.",
    lessonEn: "Delay news weakens expectations. Short-term volatility can increase.",
  },
  {
    target: "NOVA",
    impact: 0.11,
    tone: "positive",
    titleTr: "NOVA Enerji yeni güneş paneli sahası için izin aldı.",
    titleEn: "NOVA Energy received approval for a new solar panel site.",
    lessonTr: "Büyüme haberi güçlüdür ama yüksek oynak hisselerde risk de büyür.",
    lessonEn: "Growth news is powerful, but risk also rises in volatile stocks.",
  },
  {
    target: "MARM",
    impact: 0.035,
    tone: "positive",
    titleTr: "Marmara Gıda istikrarlı satış raporu yayımladı.",
    titleEn: "Marmara Food published a stable sales report.",
    lessonTr: "Savunmacı şirketlerde hareket daha yavaş olabilir; amaç bazen istikrarı korumaktır.",
    lessonEn: "Defensive companies may move slower; sometimes the goal is stability.",
  },
  {
    target: "TURK",
    impact: -0.065,
    tone: "negative",
    titleTr: "TURK Savunma maliyet baskısı bildirdi.",
    titleEn: "TURK Defense reported cost pressure.",
    lessonTr: "Maliyet artışı kâr beklentisini düşürebilir. Sadece ciroya değil marja da bakılır.",
    lessonEn: "Rising costs can reduce profit expectations. Investors watch margins, not just revenue.",
  },
  {
    target: "LUNA",
    impact: 0.07,
    tone: "positive",
    titleTr: "Luna Lojistik yeni dağıtım merkezi açtı.",
    titleEn: "Luna Logistics opened a new distribution center.",
    lessonTr: "Kapasite artışı büyüme sinyalidir; fakat yatırımın geri dönüş süresi önemlidir.",
    lessonEn: "Capacity growth is a growth signal, but payback time matters.",
  },
  {
    target: "EKA",
    impact: -0.055,
    tone: "negative",
    titleTr: "Teknoloji sektöründe kâr realizasyonu görüldü.",
    titleEn: "Profit-taking appeared in the technology sector.",
    lessonTr: "İyi şirket bile düşebilir. Fiyat, haber, beklenti ve duygu birlikte hareket eder.",
    lessonEn: "Even a good company can fall. Price, news, expectations and sentiment move together.",
  },
];

function createDefaultState(): MarketState {
  return {
    day: 1,
    cash: STARTING_CASH,
    holdings: {},
    stocks: INITIAL_STOCKS,
    history: Object.fromEntries(INITIAL_STOCKS.map((stock) => [stock.symbol, [stock.price]])),
    news: [],
  };
}

function clampPrice(value: number) {
  return Math.max(5, Number(value.toFixed(2)));
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MarketAcademy() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const copy = tr
    ? {
        eyebrow: "Eğitim amaçlı sanal borsa oyunu",
        title: "EkaTrade Academy",
        subtitle: "Gerçek para yok, gerçek hisse yok. Amaç: portföy, risk, haber etkisi ve panik satış mantığını güvenli şekilde öğrenmek.",
        disclaimer: "Bu simülasyon yalnızca eğitim amaçlıdır. Gerçek yatırım tavsiyesi değildir; gerçek para kullanılmaz.",
        day: "Gün",
        cash: "Nakit",
        total: "Portföy değeri",
        pnl: "Toplam sonuç",
        nextDay: "Sonraki günü simüle et",
        reset: "Sıfırla",
        market: "Piyasa ekranı",
        orderPanel: "İşlem paneli",
        symbol: "Hisse",
        quantity: "Adet",
        buy: "Sanal alım yap",
        sell: "Sanal satış yap",
        owned: "Sende var",
        portfolio: "Portföy",
        risk: "Risk analizi",
        missions: "Eğitim görevleri",
        news: "Haber akışı",
        emptyNews: "Henüz haber yok. Sonraki günü simüle ettiğinde ilk haber gelecek.",
        lesson: "Ders notu",
        price: "Fiyat",
        value: "Değer",
        weight: "Ağırlık",
        sector: "Sektör",
        shares: "adet",
        emptyPortfolio: "Henüz hisse almadın. Küçük bir alım yapıp portföy mantığını dene.",
        buyOk: "Sanal alım tamamlandı.",
        sellOk: "Sanal satış tamamlandı.",
        invalidQty: "Adet 1 veya daha büyük olmalı.",
        notEnoughCash: "Yeterli sanal nakit yok.",
        notEnoughShares: "Bu kadar adet sende yok.",
        resetConfirm: "Sanal portföy sıfırlansın mı?",
        completed: "tamamlandı",
        low: "Düşük",
        medium: "Orta",
        high: "Yüksek",
      }
    : {
        eyebrow: "Educational virtual market game",
        title: "EkaTrade Academy",
        subtitle: "No real money, no real stocks. Learn portfolio logic, risk, news impact and panic selling safely.",
        disclaimer: "This simulation is for education only. It is not investment advice; no real money is used.",
        day: "Day",
        cash: "Cash",
        total: "Portfolio value",
        pnl: "Total result",
        nextDay: "Simulate next day",
        reset: "Reset",
        market: "Market board",
        orderPanel: "Order panel",
        symbol: "Stock",
        quantity: "Quantity",
        buy: "Virtual buy",
        sell: "Virtual sell",
        owned: "Owned",
        portfolio: "Portfolio",
        risk: "Risk analysis",
        missions: "Learning missions",
        news: "News feed",
        emptyNews: "No news yet. Simulate the next day to receive the first update.",
        lesson: "Lesson note",
        price: "Price",
        value: "Value",
        weight: "Weight",
        sector: "Sector",
        shares: "shares",
        emptyPortfolio: "You have not bought anything yet. Try a small virtual order to learn portfolio logic.",
        buyOk: "Virtual buy completed.",
        sellOk: "Virtual sell completed.",
        invalidQty: "Quantity must be 1 or higher.",
        notEnoughCash: "Not enough virtual cash.",
        notEnoughShares: "You do not own that many shares.",
        resetConfirm: "Reset the virtual portfolio?",
        completed: "completed",
        low: "Low",
        medium: "Medium",
        high: "High",
      };

  const [state, setState] = useState<MarketState>(() => createDefaultState());
  const [selectedSymbol, setSelectedSymbol] = useState(INITIAL_STOCKS[0].symbol);
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as MarketState;
      if (!parsed?.stocks?.length || typeof parsed.cash !== "number") return;
      setState({
        ...createDefaultState(),
        ...parsed,
        holdings: parsed.holdings || {},
        history: parsed.history || Object.fromEntries(INITIAL_STOCKS.map((stock) => [stock.symbol, [stock.price]])),
        news: parsed.news || [],
      });
    } catch {
      setState(createDefaultState());
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
        text: tr
          ? "Portföyün tek hisseye veya tek sektöre fazla yığılmış. Bu, tek kötü haberle sert düşüş riski oluşturur."
          : "Your portfolio is too concentrated in one stock or sector. One bad headline can hurt too much.",
      };
    }

    if (portfolio.maxWeight > 0.45 || portfolio.rows.length < 3) {
      return {
        label: tr ? "Yüksek risk" : "High risk",
        tone: "amber",
        text: tr
          ? "Dağılım hâlâ zayıf. En az 3 farklı hisse ve mümkünse farklı sektörler kullan."
          : "Diversification is still weak. Use at least 3 stocks and preferably different sectors.",
      };
    }

    return {
      label: tr ? "Dengeli" : "Balanced",
      tone: "emerald",
      text: tr
        ? "Portföy tek noktaya yığılmamış. Bu, temel risk yönetimi açısından daha sağlıklı."
        : "Your portfolio is not concentrated in one spot. That is healthier for basic risk management.",
    };
  }, [portfolio, tr]);

  const missions = useMemo(() => {
    const hasAnyStock = portfolio.rows.length > 0;
    const diversified = portfolio.rows.length >= 3;
    const cashRatio = portfolio.total > 0 ? state.cash / portfolio.total : 1;
    const hasNews = state.news.length >= 3;
    const concentrationOk = hasAnyStock && portfolio.maxWeight <= 0.5;

    return [
      { done: hasAnyStock, title: tr ? "İlk sanal alımını yap" : "Make your first virtual buy", desc: tr ? "Alış/satış ekranını öğren." : "Learn the buy/sell screen." },
      { done: diversified, title: tr ? "3 farklı hisseye böl" : "Hold 3 different stocks", desc: tr ? "Tek hisse riskini azalt." : "Reduce single-stock risk." },
      { done: cashRatio >= 0.1, title: tr ? "En az %10 nakit bırak" : "Keep at least 10% cash", desc: tr ? "Fırsat ve hata payı için nakit tut." : "Keep cash for flexibility and mistakes." },
      { done: concentrationOk, title: tr ? "Tek hisse ağırlığını %50 altına indir" : "Keep one stock below 50%", desc: tr ? "Yoğunlaşma riskini kontrol et." : "Control concentration risk." },
      { done: hasNews, title: tr ? "3 haber etkisi gözlemle" : "Observe 3 news events", desc: tr ? "Fiyatın habere nasıl tepki verdiğini izle." : "Watch how prices react to news." },
    ];
  }, [portfolio, state.cash, state.news.length, tr]);

  const completedMissions = missions.filter((mission) => mission.done).length;

  function setTemporaryMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 2600);
  }

  function handleTrade(type: "buy" | "sell") {
    const qty = Math.floor(safeNumber(quantity));
    if (qty < 1) {
      setTemporaryMessage(copy.invalidQty);
      return;
    }

    const cost = qty * selectedStock.price;

    if (type === "buy") {
      if (cost > state.cash) {
        setTemporaryMessage(copy.notEnoughCash);
        return;
      }
      setState((current) => ({
        ...current,
        cash: Number((current.cash - cost).toFixed(2)),
        holdings: {
          ...current.holdings,
          [selectedStock.symbol]: safeNumber(current.holdings[selectedStock.symbol]) + qty,
        },
      }));
      setTemporaryMessage(copy.buyOk);
      return;
    }

    if (selectedOwned < qty) {
      setTemporaryMessage(copy.notEnoughShares);
      return;
    }

    setState((current) => {
      const nextShares = safeNumber(current.holdings[selectedStock.symbol]) - qty;
      return {
        ...current,
        cash: Number((current.cash + cost).toFixed(2)),
        holdings: {
          ...current.holdings,
          [selectedStock.symbol]: Math.max(0, nextShares),
        },
      };
    });
    setTemporaryMessage(copy.sellOk);
  }

  function simulateNextDay() {
    setState((current) => {
      const template = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)];
      const marketMood = (Math.random() - 0.48) * 0.025;
      const nextStocks = current.stocks.map((stock) => {
        const baseMove = (Math.random() - 0.5) * stock.volatility;
        const directImpact = stock.symbol === template.target ? template.impact : 0;
        const sectorImpact = stock.sector === current.stocks.find((item) => item.symbol === template.target)?.sector ? template.impact * 0.18 : 0;
        const nextPrice = clampPrice(stock.price * (1 + marketMood + baseMove + directImpact + sectorImpact));
        const change = stock.price > 0 ? ((nextPrice - stock.price) / stock.price) * 100 : 0;
        return { ...stock, price: nextPrice, change };
      });

      const nextHistory = { ...current.history };
      for (const stock of nextStocks) {
        const previous = nextHistory[stock.symbol] || [];
        nextHistory[stock.symbol] = [...previous, stock.price].slice(-14);
      }

      const nextNews: NewsItem = { ...template, day: current.day + 1 };

      return {
        ...current,
        day: current.day + 1,
        stocks: nextStocks,
        history: nextHistory,
        news: [nextNews, ...current.news].slice(0, 6),
      };
    });
  }

  function resetGame() {
    if (!window.confirm(copy.resetConfirm)) return;
    setState(createDefaultState());
    setSelectedSymbol(INITIAL_STOCKS[0].symbol);
    setQuantity(10);
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
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100 lg:max-w-sm">
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                <p>{copy.disclaimer}</p>
              </div>
            </div>
          </div>
        </motion.section>

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
                <button type="button" onClick={simulateNextDay} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200">
                  <LineChart className="h-4 w-4" /> {copy.nextDay}
                </button>
                <button type="button" onClick={resetGame} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1]">
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
                  <div>
                    <p className="text-white/35">{copy.price}</p>
                    <p className="mt-1 font-medium">{formatPrice(selectedStock.price, locale)} ₺</p>
                  </div>
                  <div>
                    <p className="text-white/35">{copy.value}</p>
                    <p className="mt-1 font-medium">{formatMoney(orderValue, locale)} ₺</p>
                  </div>
                  <div>
                    <p className="text-white/35">{copy.owned}</p>
                    <p className="mt-1 font-medium">{selectedOwned} {copy.shares}</p>
                  </div>
                  <div>
                    <p className="text-white/35">{copy.sector}</p>
                    <p className="mt-1 font-medium">{selectedStock.sector}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => handleTrade("buy")} className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-200">{copy.buy}</button>
                  <button type="button" onClick={() => handleTrade("sell")} className="rounded-full border border-red-300/30 bg-red-300/10 px-5 py-3 text-sm font-semibold text-red-100 transition-all hover:bg-red-300/15">{copy.sell}</button>
                </div>
                {message ? <p className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/70">{message}</p> : null}
              </div>
            </div>

            <RiskCard label={risk.label} text={risk.text} tone={risk.tone} title={copy.risk} />
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-white/35">{copy.portfolio}</p>
            <div className="mt-5 space-y-3">
              {portfolio.rows.length === 0 ? (
                <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">{copy.emptyPortfolio}</p>
              ) : (
                portfolio.rows.map((row) => {
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

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">{copy.missions}</p>
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

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">{copy.news}</p>
              <div className="mt-5 space-y-3">
                {state.news.length === 0 ? (
                  <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">{copy.emptyNews}</p>
                ) : (
                  state.news.map((item, index) => (
                    <div key={`${item.day}-${item.target}-${index}`} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                      <div className="flex items-center gap-2 text-xs text-white/35">
                        <Newspaper className="h-4 w-4" /> {copy.day} {item.day} · {item.target}
                      </div>
                      <p className="mt-2 font-medium">{tr ? item.titleTr : item.titleEn}</p>
                      <p className={`mt-2 text-sm ${item.tone === "positive" ? "text-emerald-300" : item.tone === "negative" ? "text-red-300" : "text-cyan-300"}`}>{item.impact > 0 ? "+" : ""}{formatPrice(item.impact * 100, locale)}%</p>
                      <p className="mt-3 text-sm leading-6 text-white/45"><span className="text-white/70">{copy.lesson}:</span> {tr ? item.lessonTr : item.lessonEn}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <LessonCard icon={<Brain />} title={tr ? "Fiyat = beklenti" : "Price = expectation"} text={tr ? "Hisse fiyatı sadece bugünkü durumu değil, geleceğe dair beklentiyi de taşır." : "A stock price reflects not only today, but also expectations about the future."} />
          <LessonCard icon={<ShieldCheck />} title={tr ? "Risk dağıtılır" : "Risk is diversified"} text={tr ? "Bütün sanal paranı tek şirkete koyarsan tek haber portföyü sert etkiler." : "If all virtual money is in one company, one headline can heavily affect the portfolio."} />
          <LessonCard icon={<Building2 />} title={tr ? "Sektör etkisi var" : "Sectors matter"} text={tr ? "Aynı sektördeki şirketler bazen beraber hareket eder. Bu yüzden sektör dağılımı önemlidir." : "Companies in the same sector can move together. That makes sector allocation important."} />
        </section>
      </div>
    </main>
  );
}

function MetricCard({ icon, label, value, detail, tone = "white" }: { icon: React.ReactNode; label: string; value: string; detail?: string; tone?: "white" | "cyan" | "emerald" | "red" }) {
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

function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const safeValues = values.length > 1 ? values : [values[0] || 1, values[0] || 1];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(1, safeValues.length - 1)) * 100;
      const y = 38 - ((value - min) / range) * 32;
      return `${x},${y}`;
    })
    .join(" ");

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

function LessonCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-300/10 text-purple-100">{icon}</div>
      <h3 className="mt-4 text-xl font-medium">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/45">{text}</p>
    </div>
  );
}
