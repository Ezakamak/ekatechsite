import { useCallback, useEffect, useMemo, useState } from "react";
import { Bomb, Coins, Gem, Info, RotateCcw, ShieldCheck, Sparkles, Star, Trophy, Wallet, Zap } from "lucide-react";

const STORAGE_KEY = "ekatech:eka-towers:v2";
const LEVELS = 9;
const TILES_PER_ROW = 4;
const DEFAULT_BET = 10;
const HOUSE_RTP = 0.99;

type DifficultyKey = "easy" | "medium" | "hard";
type TileKind = "safe" | "trap";
type Notice = { type: "success" | "error" | "info"; text: string } | null;

type Tile = {
  id: string;
  kind: TileKind | null;
  revealed: boolean;
};

type Round = {
  betAmount: number;
  difficultyKey: DifficultyKey;
  currentLevel: number;
  clearedLevels: number;
  currentMultiplier: number;
  status: string;
  isRoundActive: boolean;
  payoutAmount: number;
  matrix: Tile[][];
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

function roundTc(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function formatTc(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(roundTc(value));
}

function getDifficulty(key: DifficultyKey) {
  return DIFFICULTIES.find((difficulty) => difficulty.key === key) || DIFFICULTIES[1];
}

function multiplierForLevel(level: number, difficulty: Difficulty) {
  if (level <= 0) return 1;
  const rowWinChance = difficulty.safeTiles / TILES_PER_ROW;
  return HOUSE_RTP / Math.pow(rowWinChance, level);
}

function payoutForLevel(betAmount: number, level: number, difficulty: Difficulty) {
  return roundTc(betAmount * multiplierForLevel(level, difficulty));
}

function createEmptyMatrix() {
  return Array.from({ length: LEVELS }, (_, rowIndex) =>
    Array.from({ length: TILES_PER_ROW }, (_, tileIndex) => ({
      id: `empty-${rowIndex}-${tileIndex}`,
      kind: null,
      revealed: false,
    })),
  );
}

export function EkaTowers() {
  const [walletBalance, setWalletBalance] = useState(0);
  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  const [difficultyKey, setDifficultyKey] = useState<DifficultyKey>("medium");
  const [round, setRound] = useState<Round | null>(null);
  const [matrix, setMatrix] = useState<Tile[][]>(() => createEmptyMatrix());
  const [notice, setNotice] = useState<Notice>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [lastWin, setLastWin] = useState(0);

  const difficulty = useMemo(() => getDifficulty(round?.difficultyKey || difficultyKey), [difficultyKey, round?.difficultyKey]);
  const isPlaying = Boolean(round?.isRoundActive);
  const currentLevel = isPlaying ? round?.currentLevel || 0 : 0;
  const clearedLevels = round?.clearedLevels || 0;
  const activeBet = isPlaying ? round?.betAmount || betAmount : betAmount;
  const cashoutValue = isPlaying ? payoutForLevel(activeBet, clearedLevels, difficulty) : 0;
  const canCashout = isPlaying && clearedLevels > 0 && !actionLoading;
  const canStart = !isPlaying && !walletLoading && !actionLoading && betAmount >= 1 && walletBalance >= betAmount;
  const previewValue = payoutForLevel(activeBet, Math.max(clearedLevels || 1, 1), difficulty);

  const applyServerState = useCallback((data: any) => {
    const nextRound = data?.round || null;
    setWalletBalance(roundTc(Number(data?.wallet?.balance || 0)));
    setRound(nextRound);
    if (nextRound?.matrix) {
      setMatrix(nextRound.matrix);
      setBetAmount(roundTc(Number(nextRound.betAmount || DEFAULT_BET)));
      if (nextRound.difficultyKey) setDifficultyKey(nextRound.difficultyKey);
      if (["won", "cashed"].includes(String(nextRound.status))) setLastWin(roundTc(Number(nextRound.payoutAmount || 0)));
    } else {
      setMatrix(createEmptyMatrix());
    }
  }, []);

  const loadLiveState = useCallback(async () => {
    setWalletLoading(true);
    try {
      const response = await fetch("/api/techcoin-towers", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Live Tech Coin wallet connection failed.");
      applyServerState(data);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Live Tech Coin wallet connection failed." });
    } finally {
      setWalletLoading(false);
    }
  }, [applyServerState]);

  const runTowerAction = useCallback(async (payload: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/techcoin-towers", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Eka Towers action failed.");
      applyServerState(data);
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      return data;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Eka Towers action failed." });
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [applyServerState]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as { betAmount?: number; difficultyKey?: DifficultyKey };
    setBetAmount(roundTc(Math.min(Number(parsed.betAmount ?? DEFAULT_BET), 1_000_000)) || DEFAULT_BET);
    if (parsed.difficultyKey && DIFFICULTIES.some((item) => item.key === parsed.difficultyKey)) setDifficultyKey(parsed.difficultyKey);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ betAmount, difficultyKey }));
  }, [betAmount, difficultyKey]);

  useEffect(() => {
    loadLiveState();
    const timer = window.setInterval(loadLiveState, 10_000);
    window.addEventListener("ekatech-techcoin-refresh", loadLiveState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekatech-techcoin-refresh", loadLiveState);
    };
  }, [loadLiveState]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function startGame() {
    const nextBet = roundTc(betAmount);
    if (nextBet < 1) {
      setNotice({ type: "error", text: "Bet must be at least 1 Tech Coin." });
      return;
    }
    if (walletBalance < nextBet) {
      setNotice({ type: "error", text: "Not enough live Tech Coin. Lower the bet or earn more TC." });
      return;
    }

    const data = await runTowerAction({ action: "start", betAmount: nextBet, difficultyKey });
    if (!data) return;
    setNotice({ type: "info", text: "Round started with your live OFF Tech Coin balance." });
    setLastWin(0);
  }

  async function cashout() {
    if (!canCashout) return;
    const data = await runTowerAction({ action: "cashout" });
    if (!data) return;
    setNotice({ type: "success", text: `Cashed out ${formatTc(data.payout || 0)} TC to the live wallet.` });
  }

  async function pickTile(rowIndex: number, tileIndex: number) {
    if (!isPlaying || rowIndex !== currentLevel || actionLoading) return;
    const data = await runTowerAction({ action: "reveal", tileIndex });
    if (!data) return;

    if (data.message === "trap_hit") {
      setShake(true);
      window.setTimeout(() => setShake(false), 520);
      setNotice({ type: "error", text: "Bomb hit. The round is over and the bet stays spent." });
      return;
    }

    if (data.message === "tower_cleared") {
      setNotice({ type: "success", text: `Tower cleared! ${formatTc(data.payout || 0)} TC landed in your live wallet.` });
      return;
    }

    setNotice({ type: "success", text: "Star found. Next level unlocked." });
  }

  const actionButton = isPlaying ? (
    <button
      type="button"
      onClick={cashout}
      disabled={!canCashout}
      className="rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
    >
      Cashout {formatTc(cashoutValue)} TC
    </button>
  ) : (
    <button
      type="button"
      onClick={startGame}
      disabled={!canStart}
      className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-500 disabled:text-white/45 disabled:hover:scale-100"
    >
      Start Climb ({formatTc(betAmount)} TC)
    </button>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#0f212e] px-3 pb-10 pt-24 text-white sm:px-5">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <section className="relative mx-auto grid max-w-7xl gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[1.6rem] border border-cyan-300/15 bg-[#1a2c38]/95 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">
                  <Zap className="h-3.5 w-3.5" /> Eka Towers
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Live Tech Coin tower</h1>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  Uses the live OFF Tech Coin wallet. Fixed bets are removed: enter any TC amount and climb the compact 9-level board.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-amber-300/20 bg-black/25 p-3 text-center shadow-xl shadow-amber-400/10">
                <Wallet className="mx-auto h-5 w-5 text-amber-200" />
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-amber-100/55">Live wallet</p>
                <p className="mt-1 text-2xl font-black text-white drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]">{walletLoading ? "..." : `${formatTc(walletBalance)} TC`}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-[#1a2c38]/95 p-4 backdrop-blur-xl sm:p-5">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Bet amount (Tech Coin)</span>
              <input
                type="number"
                min="1"
                step="1"
                disabled={isPlaying || actionLoading || walletLoading}
                value={betAmount}
                onChange={(event) => setBetAmount(roundTc(Math.min(Number(event.target.value), 1_000_000)))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0f212e] px-4 py-3 text-lg font-black text-white outline-none transition focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-55"
              />
            </label>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[10, 25, 50].map((amount) => (
                <button key={amount} type="button" disabled={isPlaying || actionLoading || walletLoading} onClick={() => setBetAmount(amount)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45">
                  {amount} TC
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-[#1a2c38]/95 p-4 backdrop-blur-xl sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Difficulty</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {DIFFICULTIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isPlaying || actionLoading}
                  onClick={() => setDifficultyKey(item.key)}
                  className={`rounded-2xl border p-3 text-left transition ${difficulty.key === item.key ? "border-cyan-200/60 bg-cyan-200/12" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"} disabled:cursor-not-allowed disabled:opacity-55`}
                >
                  <span className={`inline-flex rounded-full bg-gradient-to-r ${item.accent} px-3 py-1 text-[11px] font-black text-slate-950`}>{item.label}</span>
                  <p className="mt-2 text-xs font-semibold text-white">{item.safeTiles} Stars / {item.traps} Bomb{item.traps > 1 ? "s" : ""}</p>
                  <p className="mt-1 text-[11px] text-white/45">{item.chance} per row</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={<Coins className="h-4 w-4" />} label="Bet" value={`${formatTc(activeBet)} TC`} />
            <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Level" value={isPlaying ? `${currentLevel + 1} / ${LEVELS}` : "Ready"} />
            <StatCard icon={<Trophy className="h-4 w-4" />} label="Cashout" value={`${formatTc(cashoutValue)} TC`} />
            <StatCard icon={<Sparkles className="h-4 w-4" />} label="Last win" value={`${formatTc(lastWin)} TC`} />
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-[#1a2c38]/95 p-4 backdrop-blur-xl sm:p-5">
            <div className="grid gap-3">
              {actionButton}
              {!isPlaying && round && round.status !== "active" ? (
                <button type="button" onClick={loadLiveState} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.08]">
                  <RotateCcw className="h-4 w-4" /> Refresh Board
                </button>
              ) : null}
            </div>
            {notice ? <p className={`mt-3 rounded-2xl border p-3 text-sm leading-6 ${notice.type === "error" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : notice.type === "success" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"}`}>{notice.text}</p> : null}
          </div>
        </div>

        <div className={`rounded-[1.7rem] border border-cyan-300/15 bg-[#1a2c38]/95 p-3 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:p-4 ${shake ? "animate-[eka-tower-shake_0.52s_ease-in-out]" : ""}`}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/55">9-level tower</p>
              <h2 className="mt-1 text-xl font-black text-white">Pick one tile on the active row</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-bold text-white/60"><Info className="h-3.5 w-3.5" /> Bottom starts at Level 1</div>
          </div>

          <div className="flex flex-col-reverse gap-1.5">
            {matrix.map((row, rowIndex) => {
              const active = isPlaying && rowIndex === currentLevel;
              const completed = isPlaying && rowIndex < currentLevel;
              const ended = Boolean(round && !round.isRoundActive);
              const locked = !active && !completed && !ended;
              const levelLabel = rowIndex + 1;

              return (
                <div key={`row-${rowIndex}`} className={`grid grid-cols-[2.35rem_1fr] items-center gap-1.5 rounded-xl border p-1.5 transition ${active ? "border-cyan-200/70 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.14)]" : completed ? "border-emerald-300/25 bg-emerald-300/5" : "border-white/5 bg-black/10"} ${locked ? "opacity-45" : "opacity-100"}`}>
                  <div className="text-center text-[10px] font-black uppercase tracking-[0.08em] text-white/50">L{levelLabel}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {row.map((tile, tileIndex) => {
                      const showSafe = tile.revealed && tile.kind === "safe";
                      const showTrap = tile.revealed && tile.kind === "trap";

                      return (
                        <button
                          key={tile.id}
                          type="button"
                          disabled={!active || tile.revealed || actionLoading}
                          onClick={() => pickTile(rowIndex, tileIndex)}
                          className={`h-9 rounded-xl border text-base transition duration-200 sm:h-10 md:h-11 lg:h-12 ${active ? "cursor-pointer border-cyan-200/55 bg-[#0f212e] hover:-translate-y-0.5 hover:border-cyan-100 hover:bg-cyan-300/10" : "cursor-default border-white/10 bg-[#0f212e]/80"} ${showSafe ? "!border-emerald-200/70 !bg-emerald-400/20 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.2)]" : ""} ${showTrap ? "!border-rose-200/70 !bg-rose-500/25 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.22)]" : ""}`}
                          aria-label={`Level ${levelLabel} tile ${tileIndex + 1}`}
                        >
                          {showSafe ? <Star className="mx-auto h-4 w-4 fill-current sm:h-5 sm:w-5" /> : showTrap ? <Bomb className="mx-auto h-4 w-4 sm:h-5 sm:w-5" /> : active ? <Gem className="mx-auto h-4 w-4 text-cyan-100/75" /> : <span className="text-white/20">◆</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/45">
            Formula: payout = bet × 0.99 ÷ cumulative survival probability. Current {difficulty.label} row chance is {difficulty.chance}; next preview is {formatTc(previewValue)} TC.
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
    <div className="rounded-2xl border border-white/10 bg-[#1a2c38]/95 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-cyan-100/70">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-black text-white sm:text-xl">{value}</p>
    </div>
  );
}
