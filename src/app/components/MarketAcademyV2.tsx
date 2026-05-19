import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  LineChart,
  ListFilter,
  Newspaper,
  PieChart,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";
import { playOffSound } from "./OffSoundEngine";

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
};

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
  marketProfit?: number;
  profitPercent?: number;
};

type MarketState = {
  day: number;
  cash: number;
  startingValue: number;
  holdings: Record<string, number>;
  stocks: Stock[];
  history: Record<string, number[]>;
  news: NewsItem[];
  rewards?: Array<{
    key: string;
    amount: number;
    titleTr: string;
    titleEn: string;
  }>;
};

type ChartRange = "hourly" | "daily" | "weekly";
type ViewMode = "all" | "owned" | "favorites";
type Tone = "white" | "cyan" | "emerald" | "red" | "amber" | "purple";
type PriceFlashMap = Record<string, "up" | "down">;
type TradeBurst = {
  id: number;
  side: "buy" | "sell";
  symbol: string;
  amount: number;
} | null;

const FAVORITES_KEY = "eka-investsim-favorites";
const PAGE_SIZE = 5;

const FALLBACK_STOCKS: Stock[] = [
  {
    symbol: "EKA",
    name: "EKA Yazılım",
    sector: "Teknoloji",
    descriptionTr: "Bulut yazılım ve otomasyon çözümleri üreten kurgu şirket.",
    descriptionEn: "A fictional cloud software and automation company.",
    price: 124,
    previousPrice: 124,
    change: 0,
    volatility: 0.055,
    risk: "medium",
  },
  {
    symbol: "THY",
    name: "Türk Hava Yolları",
    sector: "Ulaşım",
    descriptionTr:
      "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.",
    descriptionEn: "OFF simulation asset; not real company/stock data.",
    price: 142,
    previousPrice: 142,
    change: 0,
    volatility: 0.068,
    risk: "high",
  },
  {
    symbol: "MGROS",
    name: "Migros",
    sector: "Perakende",
    descriptionTr:
      "OFF simülasyon varlığıdır; gerçek şirket/hisse verisi değildir.",
    descriptionEn: "OFF simulation asset; not real company/stock data.",
    price: 82,
    previousPrice: 82,
    change: 0,
    volatility: 0.04,
    risk: "low",
  },
];

const FALLBACK_STATE: MarketState = {
  day: 1,
  cash: 0,
  startingValue: 0,
  holdings: {},
  stocks: FALLBACK_STOCKS,
  history: Object.fromEntries(
    FALLBACK_STOCKS.map((stock) => [stock.symbol, [stock.price]]),
  ),
  news: [],
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.round(value || 0),
  );
}

function formatPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function readFavorites() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set<string>(
      JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]"),
    );
  } catch {
    return new Set<string>();
  }
}

function writeFavorites(value: Set<string>) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...value]));
}

function shuffleSymbols(symbols: string[]) {
  const next = [...symbols];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

async function readJson(response: Response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const raw = await response.text();
  const looksLikeHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(raw) || /^\s*<html/i.test(raw);
  if (looksLikeHtml) {
    throw new Error("Market servisi HTML döndürdü. Lütfen oturumunu yenileyip tekrar dene.");
  }
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok)
    throw new Error(
      data?.error ||
        data?.detail ||
        raw?.slice(0, 160) ||
        `HTTP ${response.status}`,
    );
  return data;
}

function normalizeMarketState(data: any): MarketState {
  const stocks =
    Array.isArray(data?.stocks) && data.stocks.length
      ? data.stocks
      : FALLBACK_STOCKS;
  return {
    day: safeNumber(data?.day) || 1,
    cash: data?.cash === 0 ? 0 : safeNumber(data?.cash),
    startingValue:
      data?.startingValue === 0 ? 0 : safeNumber(data?.startingValue),
    holdings:
      data?.holdings && typeof data.holdings === "object" ? data.holdings : {},
    stocks: stocks.map((stock: any) => ({
      symbol: String(stock.symbol || ""),
      name: String(stock.name || stock.symbol || ""),
      sector: String(stock.sector || "Genel"),
      descriptionTr: String(stock.descriptionTr || stock.description_tr || ""),
      descriptionEn: String(stock.descriptionEn || stock.description_en || ""),
      price: safeNumber(stock.price),
      previousPrice: safeNumber(
        stock.previousPrice || stock.previous_price || stock.price,
      ),
      change: safeNumber(stock.change),
      volatility: safeNumber(stock.volatility),
      risk:
        stock.risk === "low" || stock.risk === "medium" || stock.risk === "high"
          ? stock.risk
          : "medium",
    })),
    history:
      data?.history && typeof data.history === "object"
        ? data.history
        : FALLBACK_STATE.history,
    news: Array.isArray(data?.news) ? data.news : [],
    rewards: Array.isArray(data?.rewards) ? data.rewards : [],
  };
}

function buildRangeValues(
  history: number[] | undefined,
  fallback: number,
  range: ChartRange,
) {
  const raw =
    Array.isArray(history) && history.length
      ? history.map(safeNumber).filter((value) => value > 0)
      : [fallback];
  const scoped =
    range === "hourly"
      ? raw.slice(-24)
      : range === "daily"
        ? raw.slice(-30)
        : raw.slice(-70);
  const maxPoints = range === "hourly" ? 24 : range === "daily" ? 15 : 10;
  const step = Math.max(1, Math.ceil(scoped.length / maxPoints));
  const sampled = scoped.filter((_, index) => index % step === 0);
  const last = scoped[scoped.length - 1] || fallback;
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled.length > 1 ? sampled : [last, last];
}


function buildRangePointTimes(count: number, range: ChartRange) {
  const total = Math.max(2, count);
  const now = Date.now();
  const spanMs =
    range === "hourly"
      ? 60 * 60_000
      : range === "daily"
        ? 24 * 60 * 60_000
        : 7 * 24 * 60 * 60_000;
  return Array.from({ length: count }, (_, index) => {
    const ratio = total <= 1 ? 1 : index / (total - 1);
    return new Date(now - spanMs + spanMs * ratio).toISOString();
  });
}

function getRangeChange(values: number[]) {
  const first = values[0] || 0;
  const last = values[values.length - 1] || first;
  const diff = last - first;
  const percent = first > 0 ? (diff / first) * 100 : 0;
  return { first, last, diff, percent };
}

function makePriceFlash(previous: MarketState, next: MarketState) {
  const previousMap = new Map(
    previous.stocks.map((stock) => [stock.symbol, stock.price]),
  );
  return next.stocks.reduce<PriceFlashMap>((acc, stock) => {
    const oldPrice = previousMap.get(stock.symbol);
    if (typeof oldPrice !== "number" || oldPrice === stock.price) return acc;
    acc[stock.symbol] = stock.price > oldPrice ? "up" : "down";
    return acc;
  }, {});
}

export function MarketAcademy() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const copy = tr ? trCopy : enCopy;

  const [state, setState] = useState<MarketState>(FALLBACK_STATE);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(
    FALLBACK_STOCKS[0].symbol,
  );
  const [selectedSector, setSelectedSector] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("all");
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    readFavorites(),
  );
  const [stockOrder, setStockOrder] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);
  const [openingSymbol, setOpeningSymbol] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [priceFlash, setPriceFlash] = useState<PriceFlashMap>({});
  const [tradeBurst, setTradeBurst] = useState<TradeBurst>(null);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const completedAchievementRef = useRef<number | null>(null);

  const selectedStock =
    state.stocks.find((stock) => stock.symbol === selectedSymbol) ||
    state.stocks[0] ||
    FALLBACK_STOCKS[0];
  const selectedOwned = safeNumber(state.holdings[selectedStock.symbol]);
  const orderValue = selectedStock.price * Math.max(0, safeNumber(quantity));
  const stockSignature = useMemo(
    () =>
      state.stocks
        .map((stock) => stock.symbol)
        .sort()
        .join("|"),
    [state.stocks],
  );

  const portfolio = useMemo(() => {
    const rows = state.stocks
      .map((stock) => {
        const shares = safeNumber(state.holdings[stock.symbol]);
        const value = shares * stock.price;
        return {
          ...stock,
          shares,
          value,
          pnlPercent: safeNumber(stock.change),
        };
      })
      .filter((row) => row.shares > 0);
    const invested = rows.reduce((sum, row) => sum + row.value, 0);
    const total = state.cash + invested;
    const baseline = Math.max(0, safeNumber(state.startingValue));
    const pnl = baseline > 0 ? total - baseline : 0;
    const pnlPercent = baseline > 0 ? (pnl / baseline) * 100 : 0;
    const maxWeight =
      total > 0 ? Math.max(0, ...rows.map((row) => row.value / total)) : 0;
    const sectorMap = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.sector] = (acc[row.sector] || 0) + row.value;
      return acc;
    }, {});
    const maxSectorWeight =
      total > 0
        ? Math.max(0, ...Object.values(sectorMap).map((value) => value / total))
        : 0;
    const holdingsReturnPercent =
      invested > 0
        ? rows.reduce(
            (sum, row) => sum + row.value * safeNumber(row.pnlPercent),
            0,
          ) / invested
        : 0;
    return {
      rows,
      invested,
      total,
      baseline,
      pnl,
      pnlPercent,
      holdingsReturnPercent,
      maxWeight,
      maxSectorWeight,
      sectorMap,
    };
  }, [state]);

  const sectors = useMemo(
    () => [
      "all",
      ...Array.from(new Set(state.stocks.map((stock) => stock.sector))).sort(
        (a, b) => a.localeCompare(b, "tr"),
      ),
    ],
    [state.stocks],
  );

  const orderedStocks = useMemo(() => {
    const stockMap = new Map(
      state.stocks.map((stock) => [stock.symbol, stock]),
    );
    const ordered = stockOrder
      .map((symbol) => stockMap.get(symbol))
      .filter(Boolean) as Stock[];
    const missing = state.stocks.filter(
      (stock) => !stockOrder.includes(stock.symbol),
    );
    return [...ordered, ...missing];
  }, [state.stocks, stockOrder]);

  const filteredStocks = useMemo(() => {
    const lowered = query.trim().toLocaleLowerCase("tr-TR");
    return orderedStocks.filter((stock) => {
      if (selectedSector !== "all" && stock.sector !== selectedSector)
        return false;
      if (view === "owned" && safeNumber(state.holdings[stock.symbol]) <= 0)
        return false;
      if (view === "favorites" && !favorites.has(stock.symbol)) return false;
      if (!lowered) return true;
      return `${stock.symbol} ${stock.name} ${stock.sector}`
        .toLocaleLowerCase("tr-TR")
        .includes(lowered);
    });
  }, [orderedStocks, state.holdings, selectedSector, query, view, favorites]);

  const visibleStocks = useMemo(
    () => filteredStocks.slice(0, visibleCount),
    [filteredStocks, visibleCount],
  );
  const hasMoreStocks = visibleCount < filteredStocks.length;

  const summary = useMemo(() => {
    const sorted = [...state.stocks].sort((a, b) => b.change - a.change);
    const sectorScores = state.stocks.reduce<
      Record<string, { total: number; count: number }>
    >((acc, stock) => {
      acc[stock.sector] ||= { total: 0, count: 0 };
      acc[stock.sector].total += stock.change;
      acc[stock.sector].count += 1;
      return acc;
    }, {});
    const sectorsRanked = Object.entries(sectorScores)
      .map(([sector, item]) => ({
        sector,
        avg: item.count ? item.total / item.count : 0,
      }))
      .sort((a, b) => b.avg - a.avg);
    return {
      topGainer: sorted[0],
      topLoser: sorted[sorted.length - 1],
      bestSector: sectorsRanked[0],
      weakSector: sectorsRanked[sectorsRanked.length - 1],
    };
  }, [state.stocks]);

  const risk = useMemo(() => {
    if (!portfolio.rows.length)
      return {
        label: copy.starter,
        tone: "cyan" as Tone,
        text: portfolio.total <= 0 ? copy.noCoins : copy.noRisk,
      };
    if (portfolio.maxWeight > 0.65 || portfolio.maxSectorWeight > 0.8)
      return {
        label: copy.overconcentrated,
        tone: "red" as Tone,
        text: copy.overconcentratedText,
      };
    if (portfolio.maxWeight > 0.45 || portfolio.rows.length < 3)
      return {
        label: copy.highRisk,
        tone: "amber" as Tone,
        text: copy.highRiskText,
      };
    return {
      label: copy.balanced,
      tone: "emerald" as Tone,
      text: copy.balancedText,
    };
  }, [portfolio, copy]);

  const missions = useMemo(() => {
    const cashRatio = portfolio.total > 0 ? state.cash / portfolio.total : 1;
    return [
      {
        done: portfolio.rows.length > 0,
        title: copy.firstBuy,
        desc: copy.firstBuyDesc,
      },
      {
        done: portfolio.rows.length >= 3,
        title: copy.diversify,
        desc: copy.diversifyDesc,
      },
      { done: cashRatio >= 0.1, title: copy.keepCash, desc: copy.keepCashDesc },
      {
        done: portfolio.rows.length > 0 && portfolio.maxWeight <= 0.5,
        title: copy.concentration,
        desc: copy.concentrationDesc,
      },
      {
        done: state.news.length >= 3,
        title: copy.observeNews,
        desc: copy.observeNewsDesc,
      },
    ];
  }, [portfolio, state.cash, state.news.length, copy]);

  const achievements = useMemo(() => {
    const ownedSectors = new Set(portfolio.rows.map((row) => row.sector));
    return [
      {
        key: "first",
        title: copy.badgeFirst,
        desc: copy.badgeFirstDesc,
        done: portfolio.rows.length > 0,
        icon: <CheckCircle2 className="h-5 w-5" />,
      },
      {
        key: "sector",
        title: copy.badgeSector,
        desc: copy.badgeSectorDesc,
        done: ownedSectors.size >= 3,
        icon: <PieChart className="h-5 w-5" />,
      },
      {
        key: "cash",
        title: copy.badgeCash,
        desc: copy.badgeCashDesc,
        done: portfolio.total > 0 && state.cash / portfolio.total >= 0.1,
        icon: <ShieldCheck className="h-5 w-5" />,
      },
      {
        key: "profit",
        title: copy.badgeProfit,
        desc: copy.badgeProfitDesc,
        done: portfolio.pnl > 0,
        icon: <TrendingUp className="h-5 w-5" />,
      },
      {
        key: "news",
        title: copy.badgeNews,
        desc: copy.badgeNewsDesc,
        done: state.news.length >= 3,
        icon: <Newspaper className="h-5 w-5" />,
      },
      {
        key: "favorite",
        title: copy.badgeFavorite,
        desc: copy.badgeFavoriteDesc,
        done: favorites.size >= 3,
        icon: <Star className="h-5 w-5" />,
      },
    ];
  }, [portfolio, state.cash, state.news.length, favorites.size, copy]);

  const completedMissions = missions.filter((mission) => mission.done).length;
  const completedAchievements = achievements.filter(
    (achievement) => achievement.done,
  ).length;

  useEffect(() => {
    loadMarket(true);
    loadLeaderboard();
    const timer = window.setInterval(() => {
      loadMarket(false);
      loadLeaderboard();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const symbols = state.stocks.map((stock) => stock.symbol);
    setStockOrder((current) => {
      const currentSignature = [...current].sort().join("|");
      if (current.length && currentSignature === stockSignature)
        return current.filter((symbol) => symbols.includes(symbol));
      return shuffleSymbols(symbols);
    });
  }, [stockSignature, state.stocks]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedSector, query, view, favorites.size]);

  useEffect(() => {
    if (!state.stocks.some((stock) => stock.symbol === selectedSymbol))
      setSelectedSymbol(state.stocks[0]?.symbol || "EKA");
  }, [state.stocks, selectedSymbol]);

  useEffect(() => {
    if (completedAchievementRef.current === null) {
      completedAchievementRef.current = completedAchievements;
      return;
    }
    if (completedAchievements > completedAchievementRef.current) {
      const unlocked =
        achievements.find((item) => item.done)?.title || copy.achievements;
      setAchievementToast(unlocked);
      window.setTimeout(() => setAchievementToast(null), 2800);
    }
    completedAchievementRef.current = completedAchievements;
  }, [completedAchievements, achievements, copy.achievements]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3200);
  }

  function applyMarketState(next: MarketState) {
    setState((previous) => {
      const flashMap = makePriceFlash(previous, next);
      if (Object.keys(flashMap).length) {
        setPriceFlash(flashMap);
        window.setTimeout(() => setPriceFlash({}), 900);
      }
      return next;
    });
  }

  async function loadMarket(showLoader: boolean) {
    if (showLoader) setLoading(true);
    try {
      const data = normalizeMarketState(
        await readJson(
          await fetch("/api/market", {
            credentials: "same-origin",
            cache: "no-store",
          }),
        ),
      );
      applyMarketState(data);
      setOnline(true);
      if (data.rewards?.length) {
        const amount = data.rewards.reduce(
          (sum: number, reward: any) => sum + safeNumber(reward.amount),
          0,
        );
        const title = tr ? data.rewards[0].titleTr : data.rewards[0].titleEn;
        flash(
          `${copy.rewardPrefix}: +${formatNumber(amount, locale)} Tech Coin · ${title}`,
        );
      }
    } catch (error) {
      setOnline(false);
      flash(error instanceof Error ? error.message : copy.offline);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function loadLeaderboard() {
    try {
      const data = await readJson(
        await fetch("/api/market-leaderboard", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      );
      setLeaderboard(Array.isArray(data?.leaderboard) ? data.leaderboard : []);
    } catch {
      setLeaderboard([]);
    }
  }

  async function postAction(
    payload: Record<string, unknown>,
    okMessage: string,
    burst?: TradeBurst,
  ) {
    setBusy(true);
    try {
      const data = normalizeMarketState(
        await readJson(
          await fetch("/api/market", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        ),
      );
      applyMarketState(data);
      setOnline(true);
      loadLeaderboard();
      flash(okMessage);
      if (burst) {
        playOffSound(burst.side);
        setTradeBurst(burst);
        window.setTimeout(() => setTradeBurst(null), 1300);
      }
    } catch (error) {
      playOffSound("error");
      flash(error instanceof Error ? error.message : copy.offline);
    } finally {
      setBusy(false);
    }
  }

  function handleTrade(side: "buy" | "sell") {
    const qty = Math.floor(safeNumber(quantity));
    if (qty < 1) {
      playOffSound("error");
      return flash(copy.invalidQty);
    }
    postAction(
      { action: side, symbol: selectedStock.symbol, quantity: qty },
      side === "buy" ? copy.buyOk : copy.sellOk,
      { id: Date.now(), side, symbol: selectedStock.symbol, amount: qty },
    );
  }

  function resetPortfolio() {
    if (!window.confirm(copy.resetConfirm)) return;
    playOffSound("market");
    postAction({ action: "reset" }, copy.resetOk);
  }

  function toggleFavorite(symbol: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      writeFavorites(next);
      return next;
    });
  }

  function openDetails(symbol: string) {
    setOpeningSymbol(symbol);
    window.setTimeout(() => {
      setDetailSymbol(symbol);
      setOpeningSymbol(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 260);
  }

  const detailStock = detailSymbol
    ? state.stocks.find((stock) => stock.symbol === detailSymbol)
    : null;
  if (detailStock)
    return (
      <StockDetailView
        stock={detailStock}
        state={state}
        copy={copy}
        tr={tr}
        locale={locale}
        online={online}
        busy={busy}
        onBack={() => setDetailSymbol(null)}
        onRefresh={() => loadMarket(false)}
      />
    );

  return (
    <main className="eka-investsim relative min-h-screen overflow-hidden bg-black px-3 pb-28 pt-28 text-white sm:px-6">
      <AnimationStyles />
      <BackgroundGlow />
      <TradeBurstOverlay burst={tradeBurst} copy={copy} />
      <DetailTransitionOverlay symbol={openingSymbol} copy={copy} />
      <AchievementToast title={achievementToast} copy={copy} />
      <div className="relative mx-auto max-w-7xl space-y-6 eka-page-in">
        <Hero copy={copy} online={online} />
        <MarketTicker
          copy={copy}
          locale={locale}
          summary={summary}
          news={state.news}
          tr={tr}
        />
        {loading ? <StatusBox>{copy.loading}</StatusBox> : null}
        {message ? <StatusBox tone="amber">{message}</StatusBox> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            delay={0}
            icon={<CircleDollarSign />}
            label={copy.cash}
            value={<CoinAmount amount={state.cash} locale={locale} size="lg" />}
          />
          <MetricCard
            delay={70}
            icon={<PieChart />}
            label={copy.total}
            value={
              <CoinAmount amount={portfolio.total} locale={locale} size="lg" />
            }
          />
          <MetricCard
            delay={140}
            icon={
              portfolio.holdingsReturnPercent >= 0 ? (
                <TrendingUp />
              ) : (
                <TrendingDown />
              )
            }
            label={copy.pnl}
            value={`${portfolio.holdingsReturnPercent >= 0 ? "+" : ""}${formatPrice(portfolio.holdingsReturnPercent, locale)}%`}
            detail={copy.holdingsGainDetail}
            tone={portfolio.holdingsReturnPercent >= 0 ? "emerald" : "red"}
          />
          <MetricCard
            delay={210}
            icon={<Award />}
            label={copy.achievements}
            value={`${completedAchievements}/${achievements.length}`}
            detail={`${completedMissions}/${missions.length} ${copy.completed}`}
            tone="cyan"
          />
        </section>

        <DailySummaryCard copy={copy} locale={locale} summary={summary} />

        <section className="grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
          <MarketBoard
            copy={copy}
            tr={tr}
            locale={locale}
            state={state}
            sectors={sectors}
            selectedSector={selectedSector}
            visibleStocks={visibleStocks}
            totalFiltered={filteredStocks.length}
            selectedSymbol={selectedSymbol}
            query={query}
            view={view}
            favorites={favorites}
            hasMore={hasMoreStocks}
            visibleCount={visibleStocks.length}
            priceFlash={priceFlash}
            onLoadMore={() => setVisibleCount((value) => value + PAGE_SIZE)}
            onSector={setSelectedSector}
            onQuery={setQuery}
            onView={setView}
            onFavorite={toggleFavorite}
            onSelect={setSelectedSymbol}
            onDetails={openDetails}
            busy={busy}
            online={online}
            onRefresh={() => loadMarket(false)}
            onReset={resetPortfolio}
          />
          <aside
            className="eka-stagger order-none space-y-6 max-md:order-first"
            style={{ animationDelay: "260ms" }}
          >
            <OrderPanel
              copy={copy}
              locale={locale}
              stock={selectedStock}
              selectedSymbol={selectedSymbol}
              stocks={state.stocks}
              quantity={quantity}
              owned={selectedOwned}
              orderValue={orderValue}
              busy={busy}
              online={online}
              onSymbol={setSelectedSymbol}
              onQuantity={setQuantity}
              onTrade={handleTrade}
            />
            <RiskCard
              label={risk.label}
              text={risk.text}
              tone={risk.tone}
              title={copy.risk}
            />
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <PortfolioCard copy={copy} portfolio={portfolio} locale={locale} />
          <div className="grid gap-6 lg:grid-cols-2">
            <LeaderboardCard copy={copy} locale={locale} rows={leaderboard} />
            <AchievementCard copy={copy} achievements={achievements} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <MissionCard title={copy.missions} missions={missions} />
          <NewsCard
            title={copy.news}
            empty={copy.emptyNews}
            lesson={copy.lesson}
            dayLabel={copy.day}
            news={state.news}
            tr={tr}
            locale={locale}
          />
        </section>
      </div>
    </main>
  );
}

function AnimationStyles() {
  return (
    <style>{`
    @keyframes eka-page-in { from { opacity: 0; transform: translateY(22px); filter: blur(10px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
    @keyframes eka-stagger-in { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes eka-glow-up { 0% { box-shadow: 0 0 0 rgba(16,185,129,0); } 35% { box-shadow: 0 0 38px rgba(16,185,129,.34); border-color: rgba(110,231,183,.6); } 100% { box-shadow: 0 0 0 rgba(16,185,129,0); } }
    @keyframes eka-glow-down { 0% { box-shadow: 0 0 0 rgba(248,113,113,0); } 35% { box-shadow: 0 0 38px rgba(248,113,113,.34); border-color: rgba(252,165,165,.6); } 100% { box-shadow: 0 0 0 rgba(248,113,113,0); } }
    @keyframes eka-draw-line { to { stroke-dashoffset: 0; } }
    @keyframes eka-pulse-dot { 0%,100% { opacity: .6; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.35); } }
    @keyframes eka-range-swap { from { opacity: 0; transform: translateY(10px) scale(.99); filter: blur(8px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
    @keyframes eka-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes eka-coin-burst-buy { 0% { opacity: 0; transform: translate(-40px, 28px) scale(.5) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(70px, -78px) scale(1.05) rotate(360deg); } }
    @keyframes eka-coin-burst-sell { 0% { opacity: 0; transform: translate(70px, -78px) scale(.5) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-40px, 28px) scale(1.05) rotate(-360deg); } }
    @keyframes eka-detail-open { from { opacity: 0; transform: scale(.86); filter: blur(14px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
    @keyframes eka-achievement { 0% { opacity: 0; transform: translateY(-18px) scale(.96); } 18% { opacity: 1; transform: translateY(0) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes eka-rank-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
    .eka-page-in { animation: eka-page-in .55s ease both; }
    .eka-stagger { opacity: 0; animation: eka-stagger-in .52s ease both; }
    .eka-card-hover { transform: translateY(0) scale(1); transition: transform .22s ease, border-color .22s ease, background .22s ease, box-shadow .22s ease; }
    .eka-card-hover:hover { transform: translateY(-5px) scale(1.012); box-shadow: 0 24px 60px rgba(0, 212, 255, .11), 0 0 42px rgba(139, 92, 246, .10); }
    .eka-price-up { animation: eka-glow-up .85s ease both; }
    .eka-price-down { animation: eka-glow-down .85s ease both; }
    .eka-range-panel { animation: eka-range-swap .34s ease both; }
    .eka-draw-line { stroke-dasharray: 240; stroke-dashoffset: 240; animation: eka-draw-line .95s ease forwards; }
    .eka-pulse-dot { transform-origin: center; animation: eka-pulse-dot 1.25s ease-in-out infinite; }
    .eka-ticker-track { width: max-content; animation: eka-ticker 28s linear infinite; }
    .eka-rank-row { animation: eka-rank-in .35s ease both; }
    @media (prefers-reduced-motion: reduce) { .eka-page-in, .eka-stagger, .eka-card-hover, .eka-price-up, .eka-price-down, .eka-range-panel, .eka-draw-line, .eka-pulse-dot, .eka-ticker-track, .eka-rank-row { animation: none !important; transition: none !important; transform: none !important; } }
  `}</style>
  );
}

function BackgroundGlow() {
  return (
    <>
      <div className="absolute left-1/2 top-16 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute bottom-28 right-0 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
    </>
  );
}

function Hero({ copy, online }: { copy: any; online: boolean }) {
  return (
    <section className="eka-stagger overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <BarChart3 className="h-4 w-4" /> {copy.eyebrow}
          </div>
          <h1 className="mt-5 text-4xl font-medium tracking-tight sm:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
            {copy.subtitle}
          </p>
        </div>
        <div
          className={`rounded-3xl border p-4 text-sm leading-6 lg:max-w-sm ${online ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
            <p>
              {online ? `${copy.online}. ${copy.disclaimer}` : copy.offline}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketTicker({
  copy,
  locale,
  summary,
  news,
  tr,
}: {
  copy: any;
  locale: string;
  summary: any;
  news: NewsItem[];
  tr: boolean;
}) {
  const items = [
    summary.topGainer
      ? `${copy.topGainer}: ${summary.topGainer.symbol} +${formatPrice(summary.topGainer.change, locale)}%`
      : null,
    summary.topLoser
      ? `${copy.topLoser}: ${summary.topLoser.symbol} ${formatPrice(summary.topLoser.change, locale)}%`
      : null,
    summary.bestSector
      ? `${copy.bestSector}: ${summary.bestSector.sector}`
      : null,
    ...news
      .slice(0, 3)
      .map((item) => `${item.target}: ${tr ? item.titleTr : item.titleEn}`),
  ].filter(Boolean) as string[];
  const tickerItems = items.length ? items : [copy.tickerEmpty];
  return (
    <div
      className="eka-stagger overflow-hidden rounded-full border border-white/10 bg-white/[0.04] py-3 text-sm text-white/60 backdrop-blur-xl"
      style={{ animationDelay: "90ms" }}
    >
      <div className="eka-ticker-track flex gap-8 px-5">
        {[...tickerItems, ...tickerItems].map((item, index) => (
          <span key={`${item}-${index}`} className="shrink-0">
            <span className="mr-8 text-cyan-200">•</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusBox({
  children,
  tone = "white",
}: {
  children: ReactNode;
  tone?: "white" | "amber";
}) {
  const classes =
    tone === "amber"
      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
      : "border-white/10 bg-white/[0.045] text-white/55";
  return (
    <div
      className={`eka-stagger rounded-[2rem] border p-4 text-sm backdrop-blur-xl ${classes}`}
    >
      {children}
    </div>
  );
}

function DailySummaryCard({
  copy,
  locale,
  summary,
}: {
  copy: any;
  locale: string;
  summary: any;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <SummaryTile
        delay={0}
        icon={<TrendingUp />}
        title={copy.topGainer}
        label={summary.topGainer?.symbol || "-"}
        detail={
          summary.topGainer
            ? `${summary.topGainer.name} · +${formatPrice(summary.topGainer.change, locale)}%`
            : "-"
        }
        tone="emerald"
      />
      <SummaryTile
        delay={70}
        icon={<TrendingDown />}
        title={copy.topLoser}
        label={summary.topLoser?.symbol || "-"}
        detail={
          summary.topLoser
            ? `${summary.topLoser.name} · ${formatPrice(summary.topLoser.change, locale)}%`
            : "-"
        }
        tone="red"
      />
      <SummaryTile
        delay={140}
        icon={<Activity />}
        title={copy.bestSector}
        label={summary.bestSector?.sector || "-"}
        detail={
          summary.bestSector
            ? `+${formatPrice(summary.bestSector.avg, locale)}%`
            : "-"
        }
        tone="cyan"
      />
      <SummaryTile
        delay={210}
        icon={<ListFilter />}
        title={copy.weakSector}
        label={summary.weakSector?.sector || "-"}
        detail={
          summary.weakSector
            ? `${formatPrice(summary.weakSector.avg, locale)}%`
            : "-"
        }
        tone="white"
      />
    </section>
  );
}

function SummaryTile({
  icon,
  title,
  label,
  detail,
  tone,
  delay,
}: {
  icon: ReactNode;
  title: string;
  label: string;
  detail: string;
  tone: Tone;
  delay: number;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "cyan"
          ? "text-cyan-200"
          : "text-white";
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"
      style={{ animationDelay: `${delay + 120}ms` }}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] ${toneClass}`}
      >
        {icon}
      </div>
      <p className="mt-4 text-sm text-white/40">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{label}</p>
      <p className="mt-1 line-clamp-1 text-sm text-white/45">{detail}</p>
    </div>
  );
}

function MarketBoard(props: {
  copy: any;
  tr: boolean;
  locale: string;
  state: MarketState;
  sectors: string[];
  selectedSector: string;
  visibleStocks: Stock[];
  totalFiltered: number;
  selectedSymbol: string;
  query: string;
  view: ViewMode;
  favorites: Set<string>;
  hasMore: boolean;
  visibleCount: number;
  priceFlash: PriceFlashMap;
  onLoadMore: () => void;
  onSector: (sector: string) => void;
  onQuery: (query: string) => void;
  onView: (view: ViewMode) => void;
  onFavorite: (symbol: string) => void;
  onSelect: (symbol: string) => void;
  onDetails: (symbol: string) => void;
  busy: boolean;
  online: boolean;
  onRefresh: () => void;
  onReset: () => void;
}) {
  const {
    copy,
    tr,
    locale,
    state,
    sectors,
    selectedSector,
    visibleStocks,
    totalFiltered,
    selectedSymbol,
    query,
    view,
    favorites,
    hasMore,
    visibleCount,
    priceFlash,
    onLoadMore,
    onSector,
    onQuery,
    onView,
    onFavorite,
    onSelect,
    onDetails,
    busy,
    online,
    onRefresh,
    onReset,
  } = props;
  const countForSector = (sector: string) =>
    sector === "all"
      ? state.stocks.length
      : state.stocks.filter((stock) => stock.sector === sector).length;
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-6"
      style={{ animationDelay: "220ms" }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/35">
            {copy.market}
          </p>
          <h2 className="mt-2 text-3xl font-medium">{copy.fictionalStocks}</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-50"
          >
            <LineChart className="h-4 w-4" /> {copy.refresh}
          </button>
          <button
            type="button"
            disabled={busy || !online}
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
          >
            <RefreshCcw className="h-4 w-4" /> {copy.reset}
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white/70">
          <Search className="h-4 w-4 text-cyan-200" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </label>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <FilterButton active={view === "all"} onClick={() => onView("all")}>
            {copy.allStocks}
          </FilterButton>
          <FilterButton
            active={view === "owned"}
            onClick={() => onView("owned")}
          >
            {copy.onlyOwned}
          </FilterButton>
          <FilterButton
            active={view === "favorites"}
            onClick={() => onView("favorites")}
          >
            {copy.favorites}
          </FilterButton>
        </div>
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {sectors.map((sector) => (
          <button
            key={sector}
            type="button"
            onClick={() => onSector(sector)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-all ${selectedSector === sector ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-black/25 text-white/55 hover:bg-white/[0.07] hover:text-white"}`}
          >
            {sector === "all" ? copy.allSectors : sector}{" "}
            <span className="ml-1 text-xs opacity-60">
              {countForSector(sector)}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/45">
        {copy.sectorHint}:{" "}
        <span className="text-white/75">
          {selectedSector === "all" ? copy.allSectors : selectedSector}
        </span>{" "}
        · {visibleCount}/{totalFiltered} {copy.showing} · {copy.doubleClickHint}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {visibleStocks.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">
            {copy.noStockResult}
          </p>
        ) : (
          visibleStocks.map((stock, index) => {
            const positive = safeNumber(stock.change) >= 0;
            const history = buildRangeValues(
              state.history[stock.symbol],
              stock.price,
              "hourly",
            );
            const flash = priceFlash[stock.symbol];
            return (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => onSelect(stock.symbol)}
                onDoubleClick={() => onDetails(stock.symbol)}
                className={`eka-card-hover eka-stagger text-left rounded-[1.5rem] border p-4 ${flash === "up" ? "eka-price-up" : flash === "down" ? "eka-price-down" : ""} ${selectedSymbol === stock.symbol ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-black/25 hover:bg-white/[0.06]"}`}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-white">
                      {stock.symbol}
                    </p>
                    <p className="mt-1 text-sm text-white/45">
                      {stock.name} · {stock.sector}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onFavorite(stock.symbol);
                    }}
                    className={`rounded-full border p-2 transition-all ${favorites.has(stock.symbol) ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.04] text-white/35 hover:text-amber-100"}`}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                </div>
                <MiniSparkline values={history} positive={positive} />
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/35">{copy.price}</p>
                    <CoinAmount amount={stock.price} locale={locale} decimals />
                  </div>
                  <div
                    className={`text-right text-sm font-semibold transition-all ${positive ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {positive ? "+" : ""}
                    {formatPrice(stock.change, locale)}%
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-white/35">
                  <span>
                    {copy.risk}: {tr ? copy[stock.risk] : stock.risk}
                  </span>
                  <span>{copy.detailHint}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="mt-5 w-full rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-medium text-cyan-100 transition-all hover:bg-cyan-300/15"
        >
          {copy.loadMoreStocks}
        </button>
      ) : null}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm transition-all ${active ? "border-white/25 bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function OrderPanel(props: {
  copy: any;
  locale: string;
  stock: Stock;
  selectedSymbol: string;
  stocks: Stock[];
  quantity: number;
  owned: number;
  orderValue: number;
  busy: boolean;
  online: boolean;
  onSymbol: (symbol: string) => void;
  onQuantity: (value: number) => void;
  onTrade: (side: "buy" | "sell") => void;
}) {
  const {
    copy,
    locale,
    stock,
    selectedSymbol,
    stocks,
    quantity,
    owned,
    orderValue,
    busy,
    online,
    onSymbol,
    onQuantity,
    onTrade,
  } = props;
  return (
    <div className="eka-card-hover rounded-[2rem] border border-cyan-300/15 bg-white/[0.06] p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/35">
            {copy.orderPanel}
          </p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {stock.symbol}
          </h3>
          <p className="mt-1 text-sm text-white/45">{stock.name}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/60">
          <span className="block text-xs uppercase tracking-[0.16em] text-white/35">
            {copy.price}
          </span>
          <span className="mt-1 block text-lg font-semibold text-cyan-100">
            {formatPrice(stock.price, locale)}
          </span>
        </div>
      </div>
      {!online ? (
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
          {copy.marketConnectionWaiting}
        </div>
      ) : null}
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm text-white/45">
          {copy.symbol}
          <select
            value={selectedSymbol}
            onChange={(event) => onSymbol(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none"
          >
            {stocks.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-white/45">
          {copy.quantity}
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => onQuantity(Number(event.target.value))}
            className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCell
            label={copy.owned}
            value={`${formatNumber(owned, locale)} ${copy.shares}`}
          />
          <InfoCell
            label={copy.value}
            value={<CoinAmount amount={orderValue} locale={locale} />}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => onTrade("buy")}
            className="rounded-full bg-emerald-300 px-4 py-4 text-base font-bold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-200 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/50 disabled:shadow-none"
          >
            {copy.buy}
          </button>
          <button
            type="button"
            disabled={busy || !online || owned <= 0}
            onClick={() => onTrade("sell")}
            className="rounded-full border border-red-300/30 bg-red-400/20 px-4 py-4 text-base font-bold text-red-50 shadow-lg shadow-red-500/10 transition-all hover:bg-red-400/30 active:scale-95 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/40 disabled:shadow-none"
          >
            {copy.sell}
          </button>
        </div>
        <p className="text-xs leading-5 text-white/35">
          {stock.symbol} · {stock.name} · {copy.price}:{" "}
          {formatPrice(stock.price, locale)}
        </p>
      </div>
    </div>
  );
}

function StockDetailView(props: {
  stock: Stock;
  state: MarketState;
  copy: any;
  tr: boolean;
  locale: string;
  online: boolean;
  busy: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const { stock, state, copy, tr, locale, online, busy, onBack, onRefresh } =
    props;
  const [range, setRange] = useState<ChartRange>("hourly");
  const history = buildRangeValues(
    state.history[stock.symbol],
    stock.price,
    range,
  );
  const pointTimes = useMemo(
    () => buildRangePointTimes(history.length, range),
    [history.length, range],
  );
  const rangeChange = getRangeChange(history);
  const positive = rangeChange.diff >= 0;
  const owned = safeNumber(state.holdings[stock.symbol]);
  const relatedNews = state.news.filter((item) => item.target === stock.symbol);
  const high = Math.max(...history);
  const low = Math.min(...history);
  return (
    <main className="eka-investsim relative min-h-screen overflow-hidden bg-black px-3 pb-28 pt-28 text-white sm:px-6">
      <AnimationStyles />
      <BackgroundGlow />
      <div className="relative mx-auto max-w-7xl space-y-6 eka-page-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1]"
          >
            <ArrowLeft className="h-4 w-4" /> {copy.backToMarket}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRefresh}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" /> {copy.refresh}
          </button>
        </div>
        <section className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-white/35">
            {copy.stockDetail}
          </p>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
                {stock.symbol}
              </h1>
              <p className="mt-3 text-lg text-white/55">
                {stock.name} · {stock.sector}
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/45">
                {tr ? stock.descriptionTr : stock.descriptionEn}
              </p>
            </div>
            <div
              className={`rounded-3xl border p-4 text-sm leading-6 ${online ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}
            >
              {online ? copy.online : copy.offline}
            </div>
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div
            className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                  {copy.bigChart}
                </p>
                <h2 className="mt-2 text-3xl font-medium">
                  {copy[`${range}Range`]}
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-black/25 p-1">
                {(["hourly", "daily", "weekly"] as ChartRange[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRange(item)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${range === item ? "bg-white text-black shadow-lg shadow-white/10" : "text-white/55 hover:bg-white/[0.08] hover:text-white"}`}
                  >
                    {copy[`${item}Short`]}
                  </button>
                ))}
              </div>
            </div>
            <LargeSparkline
              key={`${range}-${history.join("-")}`}
              values={history}
              positive={positive}
              range={range}
              pointTimes={pointTimes}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <InfoBox
                label={copy.rangeChange}
                value={
                  <span
                    className={positive ? "text-emerald-300" : "text-red-300"}
                  >
                    {positive ? "+" : ""}
                    {formatPrice(rangeChange.percent, locale)}%
                  </span>
                }
              />
              <InfoBox
                label={copy.highPrice}
                value={formatPrice(high, locale)}
              />
              <InfoBox label={copy.lowPrice} value={formatPrice(low, locale)} />
            </div>
          </div>
          <aside className="space-y-6">
            <div className="eka-card-hover rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                {copy.metrics}
              </p>
              <div className="mt-5 grid gap-3">
                <InfoBox
                  label={copy.currentPrice}
                  value={
                    <CoinAmount amount={stock.price} locale={locale} decimals />
                  }
                />
                <InfoBox
                  label={copy.previousPrice}
                  value={
                    <CoinAmount
                      amount={safeNumber(stock.previousPrice)}
                      locale={locale}
                      decimals
                    />
                  }
                />
                <InfoBox
                  label={copy.positionValue}
                  value={
                    <CoinAmount
                      amount={owned * stock.price}
                      locale={locale}
                      decimals
                    />
                  }
                />
                <InfoBox
                  label={copy.volatility}
                  value={`${formatPrice(stock.volatility * 100, locale)}%`}
                />
              </div>
            </div>
            <div className="eka-card-hover rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                {copy.relatedNews}
              </p>
              <div className="mt-5 space-y-3">
                {relatedNews.length === 0 ? (
                  <p className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white/45">
                    {copy.noRelatedNews}
                  </p>
                ) : (
                  relatedNews.map((item, index) => (
                    <div
                      key={`${item.day}-${index}`}
                      className="eka-rank-row rounded-3xl border border-white/10 bg-black/25 p-4"
                    >
                      <p className="text-xs text-white/35">
                        {copy.day} {item.day} · {stock.symbol}
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {tr ? item.titleTr : item.titleEn}
                      </p>
                      <p
                        className={`mt-2 text-sm ${item.impact >= 0 ? "text-emerald-300" : "text-red-300"}`}
                      >
                        {item.impact >= 0 ? "+" : ""}
                        {formatPrice(item.impact * 100, locale)}%
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MiniSparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  const safeValues =
    values.length > 1 ? values : [values[0] || 1, values[0] || 1];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues
    .map(
      (value, index) =>
        `${(index / Math.max(1, safeValues.length - 1)) * 100},${38 - ((value - min) / range) * 32}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 100 42" className="mt-4 h-14 w-full overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${positive ? "text-emerald-300" : "text-red-300"} transition-all`}
      />
    </svg>
  );
}

function LargeSparkline({
  values,
  positive,
  range: chartRange,
  pointTimes,
}: {
  values: number[];
  positive: boolean;
  range?: ChartRange;
  pointTimes?: string[];
}) {
  const safeValues =
    values.length > 1 ? values : [values[0] || 1, values[0] || 1];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const valueRange = max - min || 1;
  const points = safeValues
    .map(
      (value, index) =>
        `${(index / Math.max(1, safeValues.length - 1)) * 100},${160 - ((value - min) / valueRange) * 130}`,
    )
    .join(" ");
  const lastY =
    160 - (((safeValues[safeValues.length - 1] || min) - min) / valueRange) * 130;
  return (
    <div
      className="eka-range-panel mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-4"
      data-chart-range={chartRange}
      data-chart-timestamps={pointTimes?.join("|") || ""}
    >
      <svg
        viewBox="0 0 100 180"
        preserveAspectRatio="none"
        className="h-80 w-full overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`eka-draw-line ${positive ? "text-emerald-300" : "text-red-300"}`}
        />
        <circle
          cx="100"
          cy={lastY}
          r="1.6"
          className={`eka-pulse-dot ${positive ? "fill-emerald-300" : "fill-red-300"}`}
        />
      </svg>
    </div>
  );
}

function CoinIcon({ size = "sm" }: { size?: "xs" | "sm" | "md" }) {
  const className =
    size === "md" ? "h-8 w-8" : size === "xs" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`inline-flex ${className} shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-300/30 bg-amber-100/5 p-[1px]`}
    >
      <img
        src={coinIcon}
        alt="Tech Coin"
        className="h-full w-full rounded-full object-cover"
        style={{ clipPath: "circle(50% at 50% 50%)" }}
      />
    </span>
  );
}

function CoinAmount({
  amount,
  locale,
  prefix = "",
  decimals = false,
  size = "sm",
}: {
  amount: number;
  locale: string;
  prefix?: string;
  decimals?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const value = decimals
    ? formatPrice(amount, locale)
    : formatNumber(amount, locale);
  const textSize =
    size === "xl"
      ? "text-4xl"
      : size === "lg"
        ? "text-3xl"
        : size === "md"
          ? "text-2xl"
          : "text-base";
  return (
    <span
      className={`inline-flex items-center justify-end gap-2 font-semibold tracking-tight text-white ${textSize}`}
    >
      <span>
        {prefix}
        {value}
      </span>
      <CoinIcon
        size={
          size === "xl" || size === "lg" ? "md" : size === "md" ? "sm" : "xs"
        }
      />
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "white",
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: Tone;
  delay?: number;
}) {
  const toneClass =
    tone === "cyan"
      ? "text-cyan-200"
      : tone === "emerald"
        ? "text-emerald-300"
        : tone === "red"
          ? "text-red-300"
          : "text-white";
  return (
    <div
      className="eka-stagger eka-card-hover rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] ${toneClass}`}
      >
        {icon}
      </div>
      <p className="mt-4 text-sm text-white/40">{label}</p>
      <div className={`mt-2 ${toneClass}`}>{value}</div>
      {detail ? <p className="mt-1 text-sm text-white/40">{detail}</p> : null}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-white/35">{label}</p>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function RiskCard({
  label,
  text,
  tone,
  title,
}: {
  label: string;
  text: string;
  tone: Tone;
  title: string;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-300/25 bg-red-300/10 text-red-100"
      : tone === "amber"
        ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
        : tone === "emerald"
          ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
          : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return (
    <div
      className={`eka-card-hover rounded-[2rem] border p-5 backdrop-blur-xl sm:p-6 ${toneClass}`}
    >
      <p className="text-sm uppercase tracking-[0.2em] opacity-70">{title}</p>
      <h2 className="mt-3 text-3xl font-medium">{label}</h2>
      <p className="mt-4 text-sm leading-6 opacity-75">{text}</p>
    </div>
  );
}

function PortfolioCard({
  copy,
  portfolio,
  locale,
}: {
  copy: any;
  portfolio: any;
  locale: string;
}) {
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
      style={{ animationDelay: "300ms" }}
    >
      <p className="text-sm uppercase tracking-[0.2em] text-white/35">
        {copy.portfolio}
      </p>
      <div className="mt-5 space-y-3">
        {portfolio.rows.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">
            {copy.emptyPortfolio}
          </p>
        ) : (
          portfolio.rows.map((row: any) => {
            const pnlPercent = safeNumber(row.pnlPercent);
            const isProfit = pnlPercent >= 0;
            return (
              <div
                key={row.symbol}
                className="eka-card-hover rounded-3xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {row.symbol} · {row.name}
                    </p>
                    <p className="mt-1 text-sm text-white/40">
                      {row.shares} {copy.shares} · {row.sector}
                    </p>
                  </div>
                  <div className="text-right">
                    <CoinAmount amount={row.value} locale={locale} size="sm" />
                    <p
                      className={`mt-1 text-sm font-medium ${isProfit ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {isProfit ? "+" : ""}
                      {formatPrice(pnlPercent, locale)}% {copy.profitLossShort}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LeaderboardCard({
  copy,
  locale,
  rows,
}: {
  copy: any;
  locale: string;
  rows: LeaderboardRow[];
}) {
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
      style={{ animationDelay: "360ms" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-[0.2em] text-white/35">
          {copy.leaderboard}
        </p>
        <Trophy className="h-5 w-5 text-amber-200" />
      </div>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-white/45">
            {copy.emptyLeaderboard}
          </p>
        ) : (
          rows.map((row, index) => {
            const profit = safeNumber(row.marketProfit ?? row.totalValue);
            return (
              <div
                key={row.userId}
                className={`eka-rank-row flex items-center gap-3 rounded-3xl border border-white/10 bg-black/25 p-3 ${row.rank <= 3 ? "shadow-lg shadow-amber-500/10" : ""}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${row.rank <= 3 ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.06]"}`}
                >
                  #{row.rank}
                </span>
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                    {row.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-white/35">
                    {row.holdingsCount} {copy.shares} · {row.tradesCount}{" "}
                    {copy.trades} · {profit >= 0 ? "+" : ""}
                    {formatPrice(safeNumber(row.profitPercent), locale)}%
                  </p>
                </div>
                <span
                  className={profit >= 0 ? "text-emerald-300" : "text-red-300"}
                >
                  <CoinAmount
                    amount={profit}
                    locale={locale}
                    prefix={profit >= 0 ? "+" : ""}
                    size="sm"
                  />
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AchievementCard({
  copy,
  achievements,
}: {
  copy: any;
  achievements: Array<{
    key: string;
    title: string;
    desc: string;
    done: boolean;
    icon: ReactNode;
  }>;
}) {
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
      style={{ animationDelay: "420ms" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-[0.2em] text-white/35">
          {copy.achievements}
        </p>
        <Award className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="mt-5 grid gap-3">
        {achievements.map((item) => (
          <div
            key={item.key}
            className={`eka-card-hover rounded-3xl border p-4 ${item.done ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100 shadow-lg shadow-emerald-500/10" : "border-white/10 bg-black/25 text-white/45"}`}
          >
            <div className="flex gap-3">
              <div className="mt-1">{item.icon}</div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-75">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionCard({
  title,
  missions,
}: {
  title: string;
  missions: Array<{ done: boolean; title: string; desc: string }>;
}) {
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
      style={{ animationDelay: "470ms" }}
    >
      <p className="text-sm uppercase tracking-[0.2em] text-white/35">
        {title}
      </p>
      <div className="mt-5 space-y-3">
        {missions.map((mission) => (
          <div
            key={mission.title}
            className={`eka-card-hover rounded-3xl border p-4 ${mission.done ? "border-emerald-300/20 bg-emerald-300/10" : "border-white/10 bg-black/25"}`}
          >
            <div className="flex gap-3">
              <CheckCircle2
                className={`mt-1 h-5 w-5 shrink-0 ${mission.done ? "text-emerald-300" : "text-white/25"}`}
              />
              <div>
                <p className="font-medium">{mission.title}</p>
                <p className="mt-1 text-sm leading-6 text-white/45">
                  {mission.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsCard({
  title,
  empty,
  lesson,
  dayLabel,
  news,
  tr,
  locale,
}: {
  title: string;
  empty: string;
  lesson: string;
  dayLabel: string;
  news: NewsItem[];
  tr: boolean;
  locale: string;
}) {
  return (
    <div
      className="eka-stagger rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
      style={{ animationDelay: "520ms" }}
    >
      <p className="text-sm uppercase tracking-[0.2em] text-white/35">
        {title}
      </p>
      <div className="mt-5 space-y-3">
        {news.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/50">
            {empty}
          </p>
        ) : (
          news.map((item, index) => (
            <div
              key={`${item.day}-${item.target}-${index}`}
              className="eka-rank-row rounded-3xl border border-white/10 bg-black/25 p-4"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex items-center gap-2 text-xs text-white/35">
                <Newspaper className="h-4 w-4" /> {dayLabel} {item.day} ·{" "}
                {item.target}
              </div>
              <p className="mt-2 font-medium">
                {tr ? item.titleTr : item.titleEn}
              </p>
              <p
                className={`mt-2 text-sm ${item.tone === "positive" ? "text-emerald-300" : item.tone === "negative" ? "text-red-300" : "text-cyan-300"}`}
              >
                {item.impact > 0 ? "+" : ""}
                {formatPrice(item.impact * 100, locale)}%
              </p>
              <p className="mt-3 text-sm leading-6 text-white/45">
                <span className="text-white/70">{lesson}:</span>{" "}
                {tr ? item.lessonTr : item.lessonEn}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TradeBurstOverlay({ burst, copy }: { burst: TradeBurst; copy: any }) {
  if (!burst) return null;
  return (
    <div className="pointer-events-none fixed bottom-8 right-6 z-[120] rounded-[2rem] border border-amber-300/20 bg-black/75 px-5 py-4 text-amber-100 shadow-2xl shadow-amber-500/20 backdrop-blur-xl">
      <p className="mb-2 text-sm font-medium">
        {burst.side === "buy" ? copy.buyAnimation : copy.sellAnimation} ·{" "}
        {burst.symbol}
      </p>
      <div className="relative h-16 w-52 overflow-visible">
        {Array.from({ length: 12 }).map((_, index) => (
          <img
            key={index}
            src={coinIcon}
            alt=""
            className="absolute h-6 w-6 rounded-full"
            style={{
              left: `${10 + index * 7}%`,
              top: `${18 + (index % 3) * 8}px`,
              animation: `${burst.side === "buy" ? "eka-coin-burst-buy" : "eka-coin-burst-sell"} 950ms ease-out forwards`,
              animationDelay: `${index * 35}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DetailTransitionOverlay({
  symbol,
  copy,
}: {
  symbol: string | null;
  copy: any;
}) {
  if (!symbol) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div
        className="rounded-[2rem] border border-cyan-300/25 bg-white/[0.07] px-8 py-7 text-center shadow-2xl shadow-cyan-500/20"
        style={{ animation: "eka-detail-open 260ms ease both" }}
      >
        <p className="text-sm uppercase tracking-[0.24em] text-cyan-100/70">
          {copy.openingDetail}
        </p>
        <h2 className="mt-2 text-5xl font-semibold text-white">{symbol}</h2>
      </div>
    </div>
  );
}

function AchievementToast({
  title,
  copy,
}: {
  title: string | null;
  copy: any;
}) {
  if (!title) return null;
  return (
    <div
      className="fixed right-5 top-24 z-[125] max-w-xs rounded-[2rem] border border-emerald-300/25 bg-emerald-300/10 p-5 text-emerald-100 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl"
      style={{ animation: "eka-achievement .42s ease both" }}
    >
      <div className="flex gap-3">
        <Award className="mt-1 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm uppercase tracking-[0.18em] opacity-70">
            {copy.unlocked}
          </p>
          <p className="mt-1 font-semibold">{title}</p>
        </div>
      </div>
    </div>
  );
}

const trCopy = {
  eyebrow: "Tech Coin cüzdanına bağlı sanal borsa simülasyonu",
  title: "Eka InvestSim",
  subtitle:
    "OFF Tech Coin cüzdanı, görevler, rozetler, günlük özet ve arkadaş leaderboard'u ile borsa mantığını oyunlaştırılmış şekilde öğren.",
  disclaimer:
    "Bu alan eğitim simülasyonudur. Tech Coin puandır; gerçek para, gerçek hisse veya yatırım tavsiyesi yoktur.",
  loading: "Eka InvestSim verisi yükleniyor...",
  offline:
    "Online market API şu an cevap vermedi. Al/sat işlemleri devre dışı.",
  marketConnectionWaiting:
    "Market bağlantısı bekleniyor. Bağlantı kurulunca Al/Sat butonları aktifleşir.",
  online: "Tech Coin cüzdanı aktif",
  day: "Piyasa turu",
  cash: "Cüzdan bakiyesi",
  total: "Toplam varlık",
  pnl: "Başlangıca göre sonuç",
  holdingsGainDetail: "Mevcut toplam hisselerin ağırlıklı kazanç yüzdesi",
  achievements: "Achievement rozetleri",
  completed: "tamamlandı",
  topGainer: "Günün yükseleni",
  topLoser: "Günün düşeni",
  bestSector: "Güçlü sektör",
  weakSector: "Zayıf sektör",
  refresh: "Canlı veriyi yenile",
  reset: "Portföyü Tech Coin'e çevir",
  market: "Eka InvestSim piyasası",
  fictionalStocks: "Kurgu hisseler",
  allSectors: "Tümü",
  sectorHint: "Sektör filtresi",
  showing: "gösterilen",
  loadMoreStocks: "5 hisse daha göster",
  allStocks: "Tümü",
  onlyOwned: "Elde olan",
  favorites: "Favoriler",
  searchPlaceholder: "Hisse, sembol veya sektör ara...",
  noStockResult: "Bu filtrede hisse bulunamadı.",
  orderPanel: "Tech Coin işlem paneli",
  symbol: "Hisse",
  quantity: "Adet",
  buy: "Tech Coin ile al",
  sell: "Tech Coin'e sat",
  buyAnimation: "Coinler pozisyona aktı",
  sellAnimation: "Coinler cüzdana döndü",
  owned: "Sende var",
  portfolio: "Hesap portföyün",
  leaderboard: "Kâr leaderboard'u",
  emptyLeaderboard:
    "Henüz leaderboard verisi yok. İlk işlemlerden sonra dolacak.",
  trades: "işlem",
  risk: "Risk",
  missions: "Eğitim görevleri",
  news: "Global haber akışı",
  tickerEmpty:
    "Piyasa verisi bekleniyor · İşlemler Tech Coin ile simüle edilir",
  emptyNews: "Henüz haber yok. Piyasa otomatik tick aldığında haber oluşur.",
  lesson: "Ders notu",
  price: "Tech Coin fiyatı",
  value: "İşlem değeri",
  sector: "Sektör",
  shares: "adet",
  emptyPortfolio:
    "Bu hesapta henüz hisse yok. İşlem yapmak için cüzdanında Tech Coin olmalı.",
  buyOk: "Alım yapıldı; Tech Coin cüzdanından düşüldü.",
  sellOk: "Satış yapıldı; Tech Coin cüzdanına eklendi.",
  resetOk: "Portföy mevcut fiyatlardan Tech Coin'e çevrildi.",
  invalidQty: "Adet 1 veya daha büyük olmalı.",
  resetConfirm:
    "Tüm Eka InvestSim hisselerin mevcut fiyattan Tech Coin'e çevrilsin mi?",
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  detailHint: "Çift tıkla: detay",
  doubleClickHint: "Detaylı grafik için hisseye çift tıkla",
  openingDetail: "Detay ekranı açılıyor",
  backToMarket: "Piyasaya dön",
  stockDetail: "Hisse detay ekranı",
  bigChart: "Detaylı fiyat grafiği",
  relatedNews: "Bu hisseyle ilgili haberler",
  noRelatedNews: "Bu hisse için henüz özel haber yok.",
  currentPrice: "Güncel fiyat",
  previousPrice: "Önceki fiyat",
  positionValue: "Pozisyon değeri",
  volatility: "Oynaklık",
  highPrice: "Grafik zirvesi",
  lowPrice: "Grafik dibi",
  rangeChange: "Seçili değişim",
  metrics: "Özet metrikler",
  hourlyRange: "Saatlik değişim",
  dailyRange: "Günlük değişim",
  weeklyRange: "Haftalık değişim",
  hourlyShort: "Saatlik",
  dailyShort: "Günlük",
  weeklyShort: "Haftalık",
  rewardPrefix: "Tech Coin ödülü",
  unlocked: "Rozet açıldı",
  profitLossShort: "K/Z",
  starter: "Başlangıç",
  noCoins:
    "Cüzdanında Tech Coin yoksa alım yapamazsın. Önce OFF görevlerinden coin kazan.",
  noRisk:
    "Henüz risk oluşmadı. İlk amaç küçük bir pozisyon açıp ekranı tanımak.",
  overconcentrated: "Aşırı yoğunlaşma",
  overconcentratedText: "Portföy tek hisseye veya tek sektöre fazla yığılmış.",
  highRisk: "Yüksek risk",
  highRiskText:
    "Dağılım hâlâ zayıf. En az 3 farklı hisse ve mümkünse farklı sektörler kullan.",
  balanced: "Dengeli",
  balancedText:
    "Portföy tek noktaya yığılmamış. Temel risk yönetimi daha sağlıklı.",
  firstBuy: "İlk Tech Coin alımını yap",
  firstBuyDesc: "İşlem OFF Tech Coin cüzdanına yansır.",
  diversify: "3 farklı hisseye böl",
  diversifyDesc: "Tek hisse riskini azalt.",
  keepCash: "En az %10 Tech Coin bırak",
  keepCashDesc: "Fırsat ve hata payı için cüzdan bakiyesi tut.",
  concentration: "Tek hisse ağırlığını %50 altına indir",
  concentrationDesc: "Yoğunlaşma riskini kontrol et.",
  observeNews: "3 global haber etkisi gözlemle",
  observeNewsDesc: "Fiyatın habere nasıl tepki verdiğini izle.",
  badgeFirst: "İlk İşlem",
  badgeFirstDesc: "İlk pozisyonunu aç.",
  badgeSector: "3 Sektör Ustası",
  badgeSectorDesc: "3 farklı sektörden hisse tut.",
  badgeCash: "Tech Coin Koruyucusu",
  badgeCashDesc: "Portföyde en az %10 nakit bırak.",
  badgeProfit: "Yeşil Portföy",
  badgeProfitDesc: "Başlangıca göre artıya geç.",
  badgeNews: "Haber Analisti",
  badgeNewsDesc: "3 haber akışını gözlemle.",
  badgeFavorite: "Radar Listesi",
  badgeFavoriteDesc: "3 hisseyi favoriye ekle.",
};

const enCopy = {
  ...trCopy,
  eyebrow: "Virtual market simulator connected to Tech Coin wallet",
  title: "Eka InvestSim",
  subtitle:
    "Learn market logic with OFF Tech Coin wallet, missions, badges, daily summary and friend leaderboard.",
  disclaimer:
    "This is an education simulation. Tech Coin is a score; no real money, real stocks, or investment advice are used.",
  loading: "Loading Eka InvestSim data...",
  offline: "The online market API did not respond. Trading is disabled.",
  marketConnectionWaiting:
    "Waiting for market connection. Buy/Sell buttons will activate once connected.",
  online: "Tech Coin wallet active",
  cash: "Wallet balance",
  total: "Total assets",
  pnl: "Result vs baseline",
  holdingsGainDetail: "Weighted gain percentage of current total holdings",
  topGainer: "Top gainer",
  topLoser: "Top loser",
  bestSector: "Strong sector",
  weakSector: "Weak sector",
  refresh: "Refresh live data",
  reset: "Convert portfolio to Tech Coin",
  market: "Eka InvestSim market",
  allSectors: "All",
  sectorHint: "Sector filter",
  showing: "showing",
  loadMoreStocks: "Show 5 more stocks",
  allStocks: "All",
  onlyOwned: "Owned",
  favorites: "Favorites",
  searchPlaceholder: "Search stock, symbol or sector...",
  noStockResult: "No stocks found for this filter.",
  buy: "Buy with Tech Coin",
  sell: "Sell for Tech Coin",
  buyAnimation: "Coins moved into position",
  sellAnimation: "Coins returned to wallet",
  portfolio: "Account portfolio",
  leaderboard: "Profit leaderboard",
  emptyLeaderboard: "No leaderboard data yet. It will fill after trades.",
  trades: "trades",
  missions: "Learning missions",
  news: "Global news feed",
  tickerEmpty: "Waiting for market data · Trades are simulated with Tech Coin",
  achievements: "Achievement badges",
  profitLossShort: "P/L",
  doubleClickHint: "Double-click a stock for the detailed chart",
  openingDetail: "Opening detail view",
  hourlyRange: "Hourly change",
  dailyRange: "Daily change",
  weeklyRange: "Weekly change",
  hourlyShort: "Hourly",
  dailyShort: "Daily",
  weeklyShort: "Weekly",
  unlocked: "Achievement unlocked",
};
