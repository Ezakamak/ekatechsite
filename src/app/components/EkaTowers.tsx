import { useEffect, useMemo, useState } from "react";
import { Bomb, Coins, Gem, RotateCcw, ShieldCheck, Sparkles, Star, Trophy, Wallet, Zap } from "lucide-react";

const STORAGE_KEY = "ekatech:eka-towers:v1";
const LEVELS = 9;
const TILES_PER_ROW = 4;
const FIXED_BET = 10;
const FAUCET_AMOUNT = 250;
const START_BALANCE = 1000;
const HOUSE_RTP = 0.99;

type DifficultyKey = "easy" | "medium" | "hard";
type TileKind = "safe" | "trap";
type RoundStatus = "idle" | "playing" | "won" | "lost" | "cashed";

type Tile = {
  id: string;
  kind: TileKind;
  revealed: boolean;
};

type Difficulty = {
  key: DifficultyKey;
  label: string;
  safeTiles: number;
  traps: number;
  chance: string;
  accent: string;
};

const DIFFICULTIES: Difficulty[] = [
  { key: "easy", label: "Easy", safeTiles: 3, traps: 1, chance: "75%", accent: "from-emerald-300 to-cyan-300" },
  { key: "medium", label: "Medium", safeTiles: 2, traps: 2, chance: "50%", accent: "from-cyan-300 to-blue-300" },
  { key: "hard", label: "Hard", safeTiles: 1, traps: 3, chance: "25%", accent: "from-rose-300 to-amber-300" },
];

function tc(value: number) {
  return Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

function formatTc(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tc(value));
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getDifficulty(key: DifficultyKey) {
  return DIFFICULTIES.find((difficulty) => difficulty.key === key) || DIFFICULTIES[1];
}

function multiplierForLevel(level: number, difficulty: Difficulty) {
  if (level <= 0) return 0;
  const rowWinChance = difficulty.safeTiles / TILES_PER_ROW;
  return HOUSE_RTP / Math.pow(rowWinChance, level);
}

function payoutForLevel(level: number, difficulty: Difficulty) {
  return tc(FIXED_BET * multiplierForLevel(level, difficulty));
}

function createMatrix(difficulty: Difficulty) {
  return Array.from({ length: LEVELS }, (_, rowIndex) => {
    const row: TileKind[] = [
      ...Array.from({ length: difficulty.safeTiles }, () => "safe" as const),
      ...Array.from({ length: difficulty.traps }, () => "trap" as const),
    ];

    return shuffle(row).map((kind, tileIndex) => ({
      id: `${Date.now()}-${rowIndex}-${tileIndex}-${Math.random().toString(16).slice(2)}`,
      kind,
      revealed: false,
    }));
  });
}

function createEmptyMatrix() {
  return Array.from({ length: LEVELS }, (_, rowIndex) =>
    Array.from({ length: TILES_PER_ROW }, (_, tileIndex) => ({
      id: `empty-${rowIndex}-${tileIndex}`,
      kind: "safe" as const,
      revealed: false,
    })),
  );
}

export function EkaTowers() {
  const [walletBalance, setWalletBalance] = useState(START_BALANCE);
  const [difficultyKey, setDifficultyKey] = useState<DifficultyKey>("medium");
  const [matrix, setMatrix] = useState<Tile[][]>(() => createEmptyMatrix());
  const [currentLevel, setCurrentLevel] = useState(0);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [status, setStatus] = useState<RoundStatus>("idle");
  const [message, setMessage] = useState("Pick a mode, then start your Eka Towers climb.");
  const [shake, setShake] = useState(false);
  const [lastWin, setLastWin] = useState(0);

  const difficulty = useMemo(() => getDifficulty(difficultyKey), [difficultyKey]);
  const isPlaying = status === "playing";
  const cashoutValue = payoutForLevel(clearedLevels, difficulty);
  const canCashout = isPlaying && clearedLevels > 0;
  const needsRefill = walletBalance < FIXED_BET && !isPlaying;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { walletBalance?: number; difficultyKey?: DifficultyKey };
      setWalletBalance(tc(Number(parsed.walletBalance ?? START_BALANCE)));
      if (parsed.difficultyKey && DIFFICULTIES.some((item) => item.key === parsed.difficultyKey)) {
        setDifficultyKey(parsed.difficultyKey);
      }
    } catch {
      setWalletBalance(START_BALANCE);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ walletBalance, difficultyKey }));
  }, [walletBalance, difficultyKey]);

  const revealEverything = (board: Tile[][]) => board.map((row) => row.map((tile) => ({ ...tile, revealed: true })));

  const resetBoard = (nextStatus: RoundStatus = "idle", nextMessage = "Board reset. Start a fresh climb when ready.") => {
    setMatrix(createEmptyMatrix());
    setCurrentLevel(0);
    setClearedLevels(0);
    setStatus(nextStatus);
    setMessage(nextMessage);
  };

  const startGame = () => {
    if (walletBalance < FIXED_BET) {
      setMessage("Wallet is below 10.00 TC. Refill your internal TechCoin wallet to climb again.");
      return;
    }

    setWalletBalance((balance) => tc(balance - FIXED_BET));
    setMatrix(createMatrix(difficulty));
    setCurrentLevel(0);
    setClearedLevels(0);
    setStatus("playing");
    setLastWin(0);
    setMessage(`Level 1 is live. Find a star and avoid ${difficulty.traps} bomb${difficulty.traps > 1 ? "s" : ""}.`);
  };

  const cashout = () => {
    if (!canCashout) return;
    setWalletBalance((balance) => tc(balance + cashoutValue));
    setLastWin(cashoutValue);
    resetBoard("cashed", `Cashed out ${formatTc(cashoutValue)} TC from Level ${clearedLevels}.`);
  };

  const refillWallet = () => {
    if (isPlaying) return;
    setWalletBalance((balance) => tc(balance + FAUCET_AMOUNT));
    setMessage("Internal wallet refilled with +250.00 TC. No external wallet connected.");
  };

  const pickTile = (rowIndex: number, tileIndex: number) => {
    if (!isPlaying || rowIndex !== currentLevel) return;

    const picked = matrix[rowIndex]?.[tileIndex];
    if (!picked || picked.revealed) return;

    if (picked.kind === "trap") {
      setMatrix((board) => revealEverything(board.map((row, rIndex) => row.map((tile, tIndex) => (rIndex === rowIndex && tIndex === tileIndex ? { ...tile, revealed: true } : tile)))));
      setShake(true);
      window.setTimeout(() => setShake(false), 520);
      setStatus("lost");
      setCurrentLevel(0);
      setClearedLevels(0);
      setMessage("Bomb hit. The tower revealed, round ended, and the wallet gained 0 TC.");
      return;
    }

    const nextCleared = clearedLevels + 1;
    setMatrix((board) => board.map((row, rIndex) => row.map((tile, tIndex) => (rIndex === rowIndex && tIndex === tileIndex ? { ...tile, revealed: true } : tile))));
    setClearedLevels(nextCleared);

    if (nextCleared >= LEVELS) {
      const jackpot = payoutForLevel(LEVELS, difficulty);
      setWalletBalance((balance) => tc(balance + jackpot));
      setLastWin(jackpot);
      setMatrix((board) => revealEverything(board));
      setStatus("won");
      setCurrentLevel(LEVELS - 1);
      setMessage(`Tower cleared! ${formatTc(jackpot)} TC landed in your integrated wallet.`);
      return;
    }

    setCurrentLevel((level) => level + 1);
    setMessage(`Star found. Level ${nextCleared + 1} unlocked. Cashout is now ${formatTc(payoutForLevel(nextCleared, difficulty))} TC.`);
  };

  const actionButton = isPlaying ? (
    <button
      type="button"
      onClick={cashout}
      disabled={!canCashout}
      className="rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-2xl shadow-cyan-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
    >
      Cashout {formatTc(cashoutValue)} TC
    </button>
  ) : (
    <button
      type="button"
      onClick={startGame}
      disabled={walletBalance < FIXED_BET}
      className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-2xl shadow-cyan-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-500 disabled:text-white/45 disabled:hover:scale-100"
    >
      Start Climb (Cost: 10 TC)
    </button>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#0f212e] px-4 pb-16 pt-28 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <section className="relative mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-cyan-300/15 bg-[#1a2c38]/95 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
                  <Zap className="h-3.5 w-3.5" /> Eka Towers
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Crypto tower climb</h1>
                <p className="mt-4 text-sm leading-7 text-white/55 sm:text-base">
                  A client-side TechCoin tower game with fixed 10 TC rounds, local storage wallet, no real-money inputs, and no external wallet buttons.
                </p>
              </div>
              <div className="rounded-3xl border border-amber-300/20 bg-black/25 p-4 text-center shadow-2xl shadow-amber-400/10">
                <Wallet className="mx-auto h-6 w-6 text-amber-200" />
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-100/55">Wallet</p>
                <p className="mt-1 text-3xl font-black text-white drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]">{formatTc(walletBalance)} TC</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#1a2c38]/95 p-5 backdrop-blur-xl sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Difficulty matrix</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {DIFFICULTIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isPlaying}
                  onClick={() => setDifficultyKey(item.key)}
                  className={`rounded-2xl border p-4 text-left transition ${difficultyKey === item.key ? "border-cyan-200/60 bg-cyan-200/12" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"} disabled:cursor-not-allowed disabled:opacity-55`}
                >
                  <span className={`inline-flex rounded-full bg-gradient-to-r ${item.accent} px-3 py-1 text-xs font-black text-slate-950`}>{item.label}</span>
                  <p className="mt-3 text-sm font-semibold text-white">{item.safeTiles} Stars / {item.traps} Bomb{item.traps > 1 ? "s" : ""}</p>
                  <p className="mt-1 text-xs text-white/45">{item.chance} win chance per row</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard icon={<Coins className="h-5 w-5" />} label="Fixed bet" value={`${formatTc(FIXED_BET)} TC`} />
            <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Current level" value={isPlaying ? `${currentLevel + 1} / ${LEVELS}` : "Locked"} />
            <StatCard icon={<Trophy className="h-5 w-5" />} label="Cashout" value={`${formatTc(cashoutValue)} TC`} />
            <StatCard icon={<Sparkles className="h-5 w-5" />} label="Last win" value={`${formatTc(lastWin)} TC`} />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#1a2c38]/95 p-5 backdrop-blur-xl sm:p-6">
            <div className="grid gap-3">
              {actionButton}
              {needsRefill ? (
                <button type="button" onClick={refillWallet} className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15">
                  Refill Wallet (+250.00 TC)
                </button>
              ) : null}
              {!isPlaying && status !== "idle" ? (
                <button type="button" onClick={() => resetBoard()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.08]">
                  <RotateCcw className="h-4 w-4" /> Reset Board
                </button>
              ) : null}
            </div>
            <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/60">{message}</p>
          </div>
        </div>

        <div className={`rounded-[2.4rem] border border-cyan-300/15 bg-[#1a2c38]/95 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:p-6 ${shake ? "animate-[eka-tower-shake_0.52s_ease-in-out]" : ""}`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/55">9-level tower</p>
              <h2 className="mt-1 text-2xl font-black text-white">Choose one tile on the active row</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-bold text-white/60">Bottom starts at Level 1</div>
          </div>

          <div className="flex flex-col-reverse gap-2.5">
            {matrix.map((row, rowIndex) => {
              const active = isPlaying && rowIndex === currentLevel;
              const completed = isPlaying && rowIndex < currentLevel;
              const locked = !active && !completed && !(status === "lost" || status === "won");
              const levelLabel = rowIndex + 1;

              return (
                <div key={`row-${rowIndex}`} className={`grid grid-cols-[3rem_1fr] items-center gap-2 rounded-2xl border p-2 transition ${active ? "border-cyan-200/70 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,0.16)]" : completed ? "border-emerald-300/25 bg-emerald-300/5" : "border-white/5 bg-black/10"} ${locked ? "opacity-40 blur-[1px]" : "opacity-100"}`}>
                  <div className="text-center text-xs font-black uppercase tracking-[0.12em] text-white/50">L{levelLabel}</div>
                  <div className="grid grid-cols-4 gap-2">
                    {row.map((tile, tileIndex) => {
                      const revealed = tile.revealed || status === "lost" || status === "won";
                      const showSafe = revealed && tile.kind === "safe";
                      const showTrap = revealed && tile.kind === "trap";

                      return (
                        <button
                          key={tile.id}
                          type="button"
                          disabled={!active || tile.revealed}
                          onClick={() => pickTile(rowIndex, tileIndex)}
                          className={`aspect-square rounded-2xl border text-xl transition duration-200 sm:text-2xl ${active ? "cursor-pointer border-cyan-200/55 bg-[#0f212e] hover:-translate-y-0.5 hover:border-cyan-100 hover:bg-cyan-300/10" : "cursor-default border-white/10 bg-[#0f212e]/80"} ${showSafe ? "!border-emerald-200/70 !bg-emerald-400/20 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.22)]" : ""} ${showTrap ? "!border-rose-200/70 !bg-rose-500/25 text-rose-100 shadow-[0_0_22px_rgba(244,63,94,0.25)]" : ""}`}
                          aria-label={`Level ${levelLabel} tile ${tileIndex + 1}`}
                        >
                          {showSafe ? <Star className="mx-auto h-6 w-6 fill-current" /> : showTrap ? <Bomb className="mx-auto h-6 w-6" /> : active ? <Gem className="mx-auto h-5 w-5 text-cyan-100/75" /> : <span className="text-white/20">◆</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-white/45">
            Multiplier formula: payout = 10 TC × 0.99 ÷ cumulative survival probability. Current {difficulty.label} row probability is {difficulty.chance}; Level {Math.max(clearedLevels, 1)} cashout preview is {formatTc(payoutForLevel(Math.max(clearedLevels, 1), difficulty))} TC.
          </div>
        </div>
      </section>

      <style>{`
        @keyframes eka-tower-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-10px) rotate(-0.4deg); }
          30% { transform: translateX(8px) rotate(0.35deg); }
          45% { transform: translateX(-7px) rotate(-0.25deg); }
          60% { transform: translateX(5px) rotate(0.2deg); }
          75% { transform: translateX(-3px); }
        }
      `}</style>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#1a2c38]/95 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-cyan-100/70">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
