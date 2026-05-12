import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Shield, Sparkles, Trophy, Gamepad2, Coins, RotateCcw } from "lucide-react";
import { useLanguage } from "../i18n";
import techCoin from "../../imports/ekatech-coin.png";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

type CellState = "hidden" | "safe" | "mine";

type GameState = {
  mineIndexes: number[];
  cells: CellState[];
  openedSafe: number;
  roundGain: number;
  status: "ready" | "playing" | "lost" | "perfect";
};

const TOTAL_CELLS = 25;
const BASE_SAFE_REWARD = 5;

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
      <span>{amount}</span>
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
    roundGain: 0,
    status: "playing",
  };
}

function getFairPointMultiplier(mineCount: number, openedSafe: number) {
  const safeCells = TOTAL_CELLS - mineCount;
  const safeRatio = safeCells / TOTAL_CELLS;
  const progressRatio = openedSafe / Math.max(1, safeCells);
  const riskBase = 1 / Math.max(0.25, safeRatio);
  const progressiveBoost = 1 + progressRatio * 0.65;
  const multiplier = riskBase * progressiveBoost;

  return Math.min(5, Math.max(1, multiplier));
}

export function OffPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(100);
  const [bestRound, setBestRound] = useState(0);
  const [perfectClears, setPerfectClears] = useState(0);
  const [mineCount, setMineCount] = useState(5);
  const [game, setGame] = useState<GameState>(() => createGame(5));

  const currentMultiplier = useMemo(() => getFairPointMultiplier(mineCount, game.openedSafe), [mineCount, game.openedSafe]);
  const nextReward = Math.round(BASE_SAFE_REWARD * currentMultiplier);
  const safeTarget = TOTAL_CELLS - mineCount;

  const copy = tr
    ? {
        eyebrow: "Admin özel alanı",
        title: "EkaTech OFF",
        subtitle: "Only for fun. Bu alan sadece admin ve owner hesaplarına görünür.",
        balance: "Tech Coin Bakiyesi",
        balanceNote: "Tech Coin sadece site içi eğlence puanıdır.",
        coinDesc: "EkaTech içi eğlence puanı.",
        gameTitle: "EkaMines",
        gameDesc: "Mayın sayısına göre adil puan çarpanı kullanan admin mini oyunu.",
        bestRound: "En iyi tur",
        perfectClear: "Perfect clear",
        mines: "Mayın",
        safeOpened: "Güvenli açılan",
        multiplier: "Çarpan",
        nextReward: "Sıradaki güvenli kutu",
        roundGain: "Tur kazancı",
        newRound: "Yeni tur",
        statusReady: "Hazır",
        statusPlaying: "Oynanıyor",
        statusLost: "Mayına bastın, tur bitti.",
        statusPerfect: "Perfect Clear! Tüm güvenli kutular açıldı.",
        accessDeniedTitle: "Yetkili erişimi gerekli",
        accessDeniedDesc: "Bu sayfa sadece admin ve owner hesapları için açık.",
        signIn: "Yetkili giriş",
        home: "Ana sayfa",
        loading: "OFF alanı kontrol ediliyor...",
      }
    : {
        eyebrow: "Admin-only area",
        title: "EkaTech OFF",
        subtitle: "Only for fun. This area is visible only to admin and owner accounts.",
        balance: "Tech Coin Balance",
        balanceNote: "Tech Coin is only an internal fun score.",
        coinDesc: "Internal EkaTech fun points.",
        gameTitle: "EkaMines",
        gameDesc: "An admin mini-game with a fair point multiplier based on mine count.",
        bestRound: "Best round",
        perfectClear: "Perfect clear",
        mines: "Mines",
        safeOpened: "Safe opened",
        multiplier: "Multiplier",
        nextReward: "Next safe cell",
        roundGain: "Round gain",
        newRound: "New round",
        statusReady: "Ready",
        statusPlaying: "Playing",
        statusLost: "Mine opened. Round over.",
        statusPerfect: "Perfect Clear! All safe cells opened.",
        accessDeniedTitle: "Authorized access required",
        accessDeniedDesc: "This page is available only to admin and owner accounts.",
        signIn: "Authorized login",
        home: "Home",
        loading: "Checking OFF access...",
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

  const startNewRound = (nextMineCount = mineCount) => {
    setMineCount(nextMineCount);
    setGame(createGame(nextMineCount));
  };

  const revealCell = (index: number) => {
    if (game.status !== "playing" || game.cells[index] !== "hidden") return;

    const isMine = game.mineIndexes.includes(index);
    const nextCells = [...game.cells];

    if (isMine) {
      game.mineIndexes.forEach((mineIndex) => {
        nextCells[mineIndex] = "mine";
      });
      setGame({ ...game, cells: nextCells, status: "lost" });
      setBestRound((current) => Math.max(current, game.roundGain));
      return;
    }

    const reward = Math.round(BASE_SAFE_REWARD * getFairPointMultiplier(mineCount, game.openedSafe));
    const nextOpenedSafe = game.openedSafe + 1;
    const nextRoundGain = game.roundGain + reward;
    nextCells[index] = "safe";

    if (nextOpenedSafe >= safeTarget) {
      const perfectBonus = Math.round(50 + mineCount * 8);
      const finalGain = nextRoundGain + perfectBonus;
      setBalance((current) => current + finalGain);
      setBestRound((current) => Math.max(current, finalGain));
      setPerfectClears((current) => current + 1);
      setGame({ ...game, cells: nextCells, openedSafe: nextOpenedSafe, roundGain: finalGain, status: "perfect" });
      return;
    }

    setBalance((current) => current + reward);
    setGame({ ...game, cells: nextCells, openedSafe: nextOpenedSafe, roundGain: nextRoundGain, status: "playing" });
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
              <div className="mt-4"><CoinAmount amount={balance} /></div>
              <p className="mt-4 text-sm leading-6 text-white/40">{copy.balanceNote}</p>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 md:grid-cols-3">
          <StatCard icon={<Coins className="h-5 w-5" />} title={copy.roundGain} value={<CoinAmount amount={game.roundGain} size="small" />} desc={`${copy.nextReward}: +${nextReward}`} />
          <StatCard icon={<Trophy className="h-5 w-5" />} title={copy.bestRound} value={<CoinAmount amount={bestRound} size="small" />} desc={`${copy.perfectClear}: ${perfectClears}`} />
          <StatCard icon={<Sparkles className="h-5 w-5" />} title={copy.multiplier} value={`${currentMultiplier.toFixed(2)}x`} desc={`${copy.mines}: ${mineCount} · ${copy.safeOpened}: ${game.openedSafe}/${safeTarget}`} />
        </div>

        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.12 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
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
                  <Metric label={copy.multiplier} value={`${currentMultiplier.toFixed(2)}x`} />
                  <Metric label={copy.nextReward} value={`+${nextReward}`} />
                  <Metric label={copy.roundGain} value={`${game.roundGain}`} />
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

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => revealCell(index)}
                    disabled={game.status !== "playing" || cell !== "hidden"}
                    className={`aspect-square rounded-2xl border text-lg font-semibold transition-all sm:text-2xl ${
                      revealedMine
                        ? "border-red-300/30 bg-red-400/20 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.22)]"
                        : revealedSafe
                          ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                          : "border-white/10 bg-white/[0.045] text-white/35 hover:border-purple-200/30 hover:bg-purple-300/10 hover:text-white"
                    }`}
                  >
                    {revealedMine ? "✕" : revealedSafe ? "+" : ""}
                  </button>
                );
              })}
            </div>
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
