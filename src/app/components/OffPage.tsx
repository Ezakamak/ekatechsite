import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Shield, Sparkles, Trophy, Gamepad2, Coins, RotateCcw, Crown } from "lucide-react";
import { useLanguage } from "../i18n";
import techCoin from "../../imports/ekatech-coin.png";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
};

type Wallet = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  best_round: number;
  perfect_clears: number;
  total_rounds: number;
};

type LeaderboardUser = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  balance: number;
  best_round: number;
  perfect_clears: number;
  total_rounds: number;
};

type CellState = "hidden" | "safe" | "mine";

type GameState = {
  mineIndexes: number[];
  cells: CellState[];
  openedSafe: number;
  roundPoints: number;
  status: "playing" | "lost" | "perfect";
};

const TOTAL_CELLS = 25;
const BASE_SAFE_POINTS = 5;
const CELL_OPEN_COST = 3;

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function TechCoinIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };

  return (
    <span className={`${sizes[size]} inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-purple-200/25 shadow-[0_0_18px_rgba(168,85,247,0.35)]`}>
      <img src={techCoin} alt="Tech Coin" className="h-full w-full object-cover" />
    </span>
  );
}

function CoinAmount({ amount, size = "large" }: { amount: number; size?: "small" | "large" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-medium tracking-tight text-white ${size === "large" ? "text-5xl" : "text-lg"}`}>
      <span>{Math.round(amount)}</span>
      <TechCoinIcon size={size === "large" ? "lg" : "sm"} />
    </span>
  );
}

function createMines(count: number) {
  const pool = Array.from({ length: TOTAL_CELLS }, (_, index) => index);
  const mines: number[] = [];

  while (mines.length < count && pool.length > 0) {
    const pick = Math.floor(Math.random() * pool.length);
    const [index] = pool.splice(pick, 1);
    mines.push(index);
  }

  return mines;
}

function createGame(mineCount: number): GameState {
  return {
    mineIndexes: createMines(mineCount),
    cells: Array.from({ length: TOTAL_CELLS }, () => "hidden" as CellState),
    openedSafe: 0,
    roundPoints: 0,
    status: "playing",
  };
}

function getDifficultyBonus(mineCount: number, openedSafe: number) {
  const safeCells = TOTAL_CELLS - mineCount;
  const safeRatio = safeCells / TOTAL_CELLS;
  const progressRatio = openedSafe / Math.max(1, safeCells);
  const difficultyBase = 1 / Math.max(0.25, safeRatio);
  const progressBoost = 1 + progressRatio * 0.65;
  const bonus = difficultyBase * progressBoost;

  return Math.min(5, Math.max(1, bonus));
}

function initials(name: string, email: string) {
  const source = name || email || "E";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "E";
}

export function OffPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [wallet, setWallet] = useState<Wallet>({ balance: 100, lifetime_earned: 0, lifetime_spent: 0, best_round: 0, perfect_clears: 0, total_rounds: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [mineCount, setMineCount] = useState(5);
  const [game, setGame] = useState<GameState>(() => createGame(5));
  const [busyCell, setBusyCell] = useState<number | null>(null);

  const difficultyBonus = useMemo(() => getDifficultyBonus(mineCount, game.openedSafe), [mineCount, game.openedSafe]);
  const nextPoints = Math.round(BASE_SAFE_POINTS * difficultyBonus);
  const safeTarget = TOTAL_CELLS - mineCount;

  const copy = tr
    ? {
        eyebrow: "Admin özel alanı",
        title: "EkaTech OFF",
        subtitle: "Only for fun. Bu alan sadece admin ve owner hesaplarına görünür.",
        balance: "Tech Coin Bakiyesi",
        balanceNote: "Tech Coin sadece site içi eğlence puanıdır; gerçek para, ödeme veya transfer değildir.",
        coinDesc: "EkaTech içi eğlence puanı.",
        gameTitle: "EkaMines",
        gameDesc: "Her kutuyu açmak küçük bir Tech Coin harcar. Güvenli kutu açarsan zorluk bonusuna göre puan kazanırsın.",
        bestRound: "En iyi tur",
        perfectClear: "Perfect clear",
        mines: "Mayın",
        safeOpened: "Güvenli açılan",
        difficultyBonus: "Zorluk bonusu",
        nextPoints: "Sıradaki puan",
        openCost: "Kutu açma bedeli",
        roundPoints: "Tur puanı",
        newRound: "Yeni tur",
        leaderboard: "Sıralama",
        lifetimeSpent: "Toplam harcanan",
        statusPlaying: "Oynanıyor. Her kutu açılışı küçük bir Tech Coin harcar.",
        statusLost: "Mayına bastın, tur bitti. Sadece açma bedeli harcandı.",
        statusPerfect: "Perfect Clear! Tüm güvenli kutular açıldı.",
        notEnough: "Yeterli Tech Coin yok. Yeni kutu açmak için puan gerekli.",
        accessDeniedTitle: "Yetkili erişimi gerekli",
        accessDeniedDesc: "Bu sayfa sadece admin ve owner hesapları için açık.",
        signIn: "Yetkili giriş",
        home: "Ana sayfa",
        loading: "OFF alanı kontrol ediliyor...",
        walletLoading: "Tech Coin cüzdanı yükleniyor...",
        d1Hint: "D1 tabloları eksikse d1-tech-coin.sql dosyasını çalıştır.",
      }
    : {
        eyebrow: "Admin-only area",
        title: "EkaTech OFF",
        subtitle: "Only for fun. This area is visible only to admin and owner accounts.",
        balance: "Tech Coin Balance",
        balanceNote: "Tech Coin is only an internal fun score; not real money, payment, or transfer.",
        coinDesc: "Internal EkaTech fun points.",
        gameTitle: "EkaMines",
        gameDesc: "Opening each cell costs a small amount of Tech Coin. Safe cells earn points based on the difficulty bonus.",
        bestRound: "Best round",
        perfectClear: "Perfect clear",
        mines: "Mines",
        safeOpened: "Safe opened",
        difficultyBonus: "Difficulty bonus",
        nextPoints: "Next points",
        openCost: "Cell open cost",
        roundPoints: "Round points",
        newRound: "New round",
        leaderboard: "Leaderboard",
        lifetimeSpent: "Lifetime spent",
        statusPlaying: "Playing. Every cell opening spends a small Tech Coin cost.",
        statusLost: "Mine opened. Round over. Only the open cost was spent.",
        statusPerfect: "Perfect Clear! All safe cells opened.",
        notEnough: "Not enough Tech Coin. You need points to open another cell.",
        accessDeniedTitle: "Authorized access required",
        accessDeniedDesc: "This page is available only to admin and owner accounts.",
        signIn: "Authorized login",
        home: "Home",
        loading: "Checking OFF access...",
        walletLoading: "Loading Tech Coin wallet...",
        d1Hint: "If D1 tables are missing, run d1-tech-coin.sql.",
      };

  const loadWallet = async () => {
    setWalletLoading(true);
    setWalletError("");

    try {
      const response = await fetch("/api/admin/tech-coin", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Tech Coin failed");
      if (data?.wallet) setWallet({ lifetime_spent: 0, ...data.wallet });
      setLeaderboard(data?.leaderboard || []);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Tech Coin failed");
    } finally {
      setWalletLoading(false);
    }
  };

  const recordTechCoin = async (eventType: string, amount: number, roundPoints: number, perfect = false) => {
    setWallet((current) => ({
      ...current,
      balance: current.balance + amount,
      lifetime_earned: current.lifetime_earned + Math.max(0, amount),
      lifetime_spent: current.lifetime_spent + Math.max(0, -amount),
      best_round: Math.max(current.best_round, roundPoints),
      perfect_clears: current.perfect_clears + (perfect ? 1 : 0),
      total_rounds: current.total_rounds + (eventType === "perfect_clear" || eventType === "round_end" ? 1 : 0),
    }));

    try {
      const response = await fetch("/api/admin/tech-coin", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, amount, roundGain: roundPoints, perfect, details: `EkaMines · mines=${mineCount}` }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Tech Coin update failed");
      if (data?.wallet) setWallet({ lifetime_spent: 0, ...data.wallet });
      if (eventType === "perfect_clear" || eventType === "round_end") loadWallet();
      return true;
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Tech Coin update failed");
      await loadWallet();
      return false;
    }
  };

  useEffect(() => {
    let active = true;

    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.json().catch(() => null))
      .then((data) => {
        if (!active) return;
        setUser(data?.loggedIn ? data.user : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "owner") loadWallet();
  }, [user?.id, user?.role]);

  const startNewRound = (nextMineCount = mineCount) => {
    setMineCount(nextMineCount);
    setGame(createGame(nextMineCount));
    setWalletError("");
  };

  const revealCell = async (index: number) => {
    if (game.status !== "playing" || game.cells[index] !== "hidden" || busyCell !== null) return;

    if (wallet.balance < CELL_OPEN_COST) {
      setWalletError(copy.notEnough);
      return;
    }

    setBusyCell(index);
    setWalletError("");

    const spent = await recordTechCoin("cell_cost", -CELL_OPEN_COST, game.roundPoints, false);
    if (!spent) {
      setBusyCell(null);
      return;
    }

    const isMine = game.mineIndexes.includes(index);
    const nextCells = [...game.cells];

    if (isMine) {
      game.mineIndexes.forEach((mineIndex) => {
        nextCells[mineIndex] = "mine";
      });
      setGame({ ...game, cells: nextCells, status: "lost" });
      await recordTechCoin("round_end", 0, game.roundPoints, false);
      setBusyCell(null);
      return;
    }

    const points = Math.round(BASE_SAFE_POINTS * getDifficultyBonus(mineCount, game.openedSafe));
    const nextOpenedSafe = game.openedSafe + 1;
    const nextRoundPoints = game.roundPoints + points;
    nextCells[index] = "safe";

    if (nextOpenedSafe >= safeTarget) {
      const perfectBonus = Math.round(50 + mineCount * 8);
      const totalAdded = points + perfectBonus;
      const finalRoundPoints = nextRoundPoints + perfectBonus;
      setGame({ ...game, cells: nextCells, openedSafe: nextOpenedSafe, roundPoints: finalRoundPoints, status: "perfect" });
      await recordTechCoin("perfect_clear", totalAdded, finalRoundPoints, true);
      setBusyCell(null);
      return;
    }

    setGame({ ...game, cells: nextCells, openedSafe: nextOpenedSafe, roundPoints: nextRoundPoints, status: "playing" });
    await recordTechCoin("safe_cell", points, nextRoundPoints, false);
    setBusyCell(null);
  };

  const canAccess = user?.role === "admin" || user?.role === "owner";

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">
          {copy.loading}
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="relative flex min-h-screen items-center overflow-hidden bg-black px-4 py-24 sm:px-6">
        <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center backdrop-blur-xl sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-purple-200/20 bg-purple-200/10 text-purple-100">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-white">{copy.accessDeniedTitle}</h1>
          <p className="mt-4 leading-7 text-white/55">{copy.accessDeniedDesc}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => navigateTo("/signin?authorized=1")} className="rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200">
              {copy.signIn}
            </button>
            <button type="button" onClick={() => navigateTo("/")} className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-medium text-white/80 transition-all hover:bg-white/[0.1]">
              {copy.home}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const statusText = game.status === "lost" ? copy.statusLost : game.status === "perfect" ? copy.statusPerfect : copy.statusPlaying;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-purple-200/30 to-transparent" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
                <TechCoinIcon size="sm" /> {copy.eyebrow}
              </div>
              <div>
                <h1 className="text-5xl font-medium tracking-tight text-white sm:text-7xl">{copy.title}</h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
              </div>
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-200/20 bg-purple-200/10 px-4 py-2 text-sm text-purple-100">
                <Sparkles className="h-4 w-4" /> {copy.coinDesc}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/35 p-6">
              <p className="text-sm text-white/45">{copy.balance}</p>
              <div className="mt-4"><CoinAmount amount={wallet.balance} /></div>
              <p className="mt-4 text-sm leading-6 text-white/40">{copy.balanceNote}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/40">
                <span>{copy.lifetimeSpent}: {wallet.lifetime_spent || 0}</span>
                <span>{copy.openCost}: {CELL_OPEN_COST}</span>
              </div>
              {walletLoading && <p className="mt-3 text-xs text-cyan-100/70">{copy.walletLoading}</p>}
              {walletError && <p className="mt-3 text-xs leading-5 text-red-100">{walletError} · {copy.d1Hint}</p>}
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 md:grid-cols-3">
          <StatCard icon={<Coins className="h-5 w-5" />} title={copy.roundPoints} value={<CoinAmount amount={game.roundPoints} size="small" />} desc={`${copy.openCost}: -${CELL_OPEN_COST} · ${copy.nextPoints}: +${nextPoints}`} />
          <StatCard icon={<Trophy className="h-5 w-5" />} title={copy.bestRound} value={<CoinAmount amount={wallet.best_round} size="small" />} desc={`${copy.perfectClear}: ${wallet.perfect_clears}`} />
          <StatCard icon={<Sparkles className="h-5 w-5" />} title={copy.difficultyBonus} value={`${difficultyBonus.toFixed(2)}x`} desc={`${copy.mines}: ${mineCount} · ${copy.safeOpened}: ${game.openedSafe}/${safeTarget}`} />
        </div>

        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.12 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="space-y-5">
              <div>
                <p className="flex items-center gap-2 text-sm text-cyan-100/70"><Gamepad2 className="h-4 w-4" /> Internal mini-game</p>
                <h2 className="mt-2 text-3xl font-medium text-white">{copy.gameTitle}</h2>
                <p className="mt-2 text-white/45">{copy.gameDesc}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <label className="text-sm text-white/45">{copy.mines}: {mineCount}</label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={mineCount}
                  onChange={(event) => startNewRound(Number(event.target.value))}
                  className="mt-4 w-full accent-purple-300"
                />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label={copy.difficultyBonus} value={`${difficultyBonus.toFixed(2)}x`} />
                  <Metric label={copy.openCost} value={`-${CELL_OPEN_COST}`} />
                  <Metric label={copy.nextPoints} value={`+${nextPoints}`} />
                  <Metric label={copy.safeOpened} value={`${game.openedSafe}/${safeTarget}`} />
                </div>
              </div>

              <div className={`rounded-2xl border px-4 py-3 text-sm ${game.status === "lost" ? "border-red-300/20 bg-red-300/10 text-red-100" : game.status === "perfect" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"}`}>
                {statusText}
              </div>

              <button type="button" onClick={() => startNewRound()} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200">
                <RotateCcw className="h-4 w-4" /> {copy.newRound}
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 rounded-[2rem] border border-white/10 bg-black/35 p-3 sm:gap-3 sm:p-5">
              {game.cells.map((cell, index) => {
                const revealedMine = cell === "mine";
                const revealedSafe = cell === "safe";
                const disabled = game.status !== "playing" || cell !== "hidden" || busyCell !== null || wallet.balance < CELL_OPEN_COST;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => revealCell(index)}
                    disabled={disabled}
                    className={`aspect-square rounded-2xl border text-lg font-semibold transition-all sm:text-2xl disabled:cursor-not-allowed ${
                      revealedMine
                        ? "border-red-300/30 bg-red-400/20 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.22)]"
                        : revealedSafe
                          ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                          : busyCell === index
                            ? "border-purple-200/40 bg-purple-300/15 text-purple-100"
                            : "border-white/10 bg-white/[0.045] text-white/35 hover:border-purple-200/30 hover:bg-purple-300/10 hover:text-white disabled:opacity-45"
                    }`}
                  >
                    {revealedMine ? "✕" : revealedSafe ? "+" : busyCell === index ? "…" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.18 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-100" />
            <h2 className="text-2xl font-medium text-white">{copy.leaderboard}</h2>
          </div>
          <div className="mt-5 space-y-2">
            {leaderboard.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <span className="w-6 text-sm text-white/35">#{index + 1}</span>
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-black">
                  {item.avatar_url ? <img src={item.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(item.name, item.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{item.name}</p>
                  <p className="truncate text-xs text-white/35">{item.email}</p>
                </div>
                <div className="text-right">
                  <CoinAmount amount={item.balance || 0} size="small" />
                  <p className="mt-1 text-xs text-white/35">{copy.bestRound}: {item.best_round || 0}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </div>
  );
}

function StatCard({ icon, title, value, desc }: { icon: React.ReactNode; title: string; value: React.ReactNode; desc: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-200/15 bg-purple-200/10 text-purple-100">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-medium text-white">{title}</h3>
      <div className="mt-3 text-4xl font-medium tracking-tight text-white">{value}</div>
      <p className="mt-3 text-sm leading-6 text-white/45">{desc}</p>
    </div>
  );
}
