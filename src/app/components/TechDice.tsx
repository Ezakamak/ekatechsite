import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Dice5, Gauge, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { createToastNoFactionSuccessId, ToastNoFactionSuccess, type ToastNoFactionSuccessPayload } from "./ToastNoFactionSuccess";
import { playOffSound } from "./OffSoundEngine";

type DiceMode = "over" | "under";

type WalletState = {
  currency: string;
  symbol: string;
  balance: number;
  lifetime_earned: number;
};

type DiceResult = {
  mode: DiceMode;
  target: number;
  rolledNumber: number;
  won: boolean;
  amount: number;
  multiplier: number;
  winChance: number;
  rewardAmount: number;
  lossAmount: number;
  net: number;
  message: string;
};

type DiceLog = {
  mode: DiceMode;
  target_number: number;
  rolled_number: number;
  amount: number;
  multiplier: number;
  win_chance: number;
  reward_amount: number;
  net_amount: number;
  result: "win" | "loss";
  created_at: string;
};

const TARGET_MIN = 2;
const TARGET_MAX = 98;
const RTP = 0.96;

export function TechDice() {
  const locale = "en-US";
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [amount, setAmount] = useState(25);
  const [mode, setMode] = useState<DiceMode>("over");
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [message, setMessage] = useState("");
  const [recent, setRecent] = useState<DiceLog[]>([]);
  const [sessionStats, setSessionStats] = useState({ wins: 0, losses: 0, net: 0 });
  const [successToasts, setSuccessToasts] = useState<ToastNoFactionSuccessPayload[]>([]);

  const math = useMemo(() => diceMath(mode, target), [mode, target]);
  const potentialReward = Math.max(1, Math.floor(amount * math.multiplier));
  const profitPoints = useMemo(() => {
    let running = 0;
    return recent
      .slice(0, 12)
      .reverse()
      .map((item) => {
        running += Number(item.net_amount || 0);
        return running;
      });
  }, [recent]);

  const loadState = useCallback(() => {
    fetch("/api/tech-dice", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json().catch(() => null))
      .then((data) => {
        if (!data) return;
        if (data.wallet) setWallet(data.wallet);
        if (Array.isArray(data.recent)) setRecent(data.recent);
      })
      .catch(() => setMessage("Tech Dice is warming up. Try again in a moment."));
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const removeSuccessToast = useCallback((id: string) => {
    setSuccessToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  function pushSuccessToast(rewardAmount: number, multiplier: number) {
    setSuccessToasts((current) => [
      ...current.slice(-2),
      {
        id: createToastNoFactionSuccessId("toast-tech-dice"),
        amount: rewardAmount,
        multiplier,
        currency: "TC",
        title: "SUCCESSFUL ROLL",
      },
    ]);
  }

  async function roll() {
    if (rolling) return;
    setRolling(true);
    setMessage("");
    setResult(null);
    playOffSound("bet");

    const animation = window.setInterval(() => {
      setDisplayRoll(Number((Math.random() * 100).toFixed(2)));
    }, 45);

    try {
      const response = await fetch("/api/tech-dice", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, mode, target }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Roll could not be completed.");

      window.setTimeout(() => {
        window.clearInterval(animation);
        setWallet(data.wallet || null);
        setRecent(Array.isArray(data.recent) ? data.recent : []);
        setDisplayRoll(data.result.rolledNumber);
        setResult(data.result);
        setSessionStats((current) => ({
          wins: current.wins + (data.result.won ? 1 : 0),
          losses: current.losses + (data.result.won ? 0 : 1),
          net: current.net + Number(data.result.net || 0),
        }));
        setMessage(data.result.message);
        if (data.result.won) {
          playOffSound("success");
          pushSuccessToast(data.result.rewardAmount, data.result.multiplier);
        } else {
          playOffSound("error");
        }
        window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
        setRolling(false);
      }, 620);
    } catch (error) {
      window.clearInterval(animation);
      setMessage(error instanceof Error ? error.message : "Roll could not be completed.");
      playOffSound("error");
      setRolling(false);
    }
  }

  const sliderBackground =
    mode === "over"
      ? `linear-gradient(90deg, rgba(248,113,113,0.9) 0%, rgba(248,113,113,0.9) ${target}%, rgba(52,211,153,0.95) ${target}%, rgba(52,211,153,0.95) 100%)`
      : `linear-gradient(90deg, rgba(52,211,153,0.95) 0%, rgba(52,211,153,0.95) ${target}%, rgba(248,113,113,0.9) ${target}%, rgba(248,113,113,0.9) 100%)`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      {successToasts.length ? (
        <div className="toast-nofaction-success-stack" aria-live="polite">
          {successToasts.map((toast) => <ToastNoFactionSuccess key={toast.id} {...toast} locale={locale} onClose={removeSuccessToast} />)}
        </div>
      ) : null}
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                <Dice5 className="h-4 w-4" /> OFF Hub mini-game · Tech Coin support
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight sm:text-7xl">Tech Dice</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
                Pick Roll Over or Roll Under, move the target, and send a Tech Coin play into the green zone.
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5 text-emerald-100">
              <div className="flex items-center gap-2 text-sm text-emerald-100/75"><Wallet className="h-4 w-4" /> Tech Coin Wallet</div>
              <div className="mt-2 text-4xl font-black">{formatNumber(wallet?.balance || 0, locale)} TC</div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Selected mode" value={mode === "over" ? "Roll Over" : "Roll Under"} />
              <Stat label="Target number" value={target.toFixed(2)} />
              <Stat label="Win chance" value={`${(math.winChance * 100).toFixed(2)}%`} />
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/35 p-5 shadow-inner shadow-black/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-white/40">Winning area</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{mode === "over" ? "Green zone is right of target" : "Green zone is left of target"}</h2>
                </div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] p-1">
                  {(["over", "under"] as DiceMode[]).map((item) => (
                    <button key={item} type="button" onClick={() => { setMode(item); playOffSound("click"); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === item ? "bg-cyan-100 text-black" : "text-white/65 hover:text-white"}`}>
                      Roll {item === "over" ? "Over" : "Under"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <input
                  type="range"
                  min={TARGET_MIN}
                  max={TARGET_MAX}
                  step="0.01"
                  value={target}
                  onChange={(event) => setTarget(Number(event.target.value))}
                  className="tech-dice-slider w-full"
                  style={{ background: sliderBackground }}
                  aria-label="Target number selector"
                />
                <div className="mt-3 flex justify-between text-xs font-semibold uppercase tracking-[0.18em]">
                  <span className={mode === "under" ? "text-emerald-200" : "text-red-200"}>{mode === "under" ? "Win" : "Miss"} · 0</span>
                  <span className="text-white/45">Target {target.toFixed(2)}</span>
                  <span className={mode === "over" ? "text-emerald-200" : "text-red-200"}>100 · {mode === "over" ? "Win" : "Miss"}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <span className="text-sm text-white/45">Tech Coin amount</span>
                <input type="number" min="1" max="10000" value={amount} onChange={(event) => setAmount(Math.max(1, Math.floor(Number(event.target.value || 1))))} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-lg font-bold text-white outline-none focus:border-cyan-200/50" />
              </label>
              <Stat label="Multiplier" value={`${math.multiplier.toFixed(2)}x`} glow />
              <Stat label="Potential reward" value={`${formatNumber(potentialReward, locale)} TC`} glow />
            </div>

            <button type="button" disabled={rolling} onClick={roll} className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-cyan-100 via-white to-purple-100 px-6 py-4 text-base font-black text-black shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">
              <Sparkles className="h-5 w-5" /> {rolling ? "Rolling..." : "Roll"}
            </button>
          </div>

          <aside className="space-y-6">
            <div className={`rounded-[2rem] border p-6 text-center backdrop-blur-xl ${result?.won ? "border-emerald-300/25 bg-emerald-300/10" : result ? "border-red-300/25 bg-red-300/10" : "border-white/10 bg-white/[0.045]"}`}>
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Rolled number</p>
              <div className="mt-4 text-7xl font-black tracking-tight text-white drop-shadow-[0_0_22px_rgba(34,211,238,0.25)]">{displayRoll == null ? "--" : displayRoll.toFixed(2)}</div>
              <p className="mt-4 text-lg font-semibold text-white">{message || "Result display appears here after your roll."}</p>
              {result ? (
                <div className="mt-5 grid gap-2 text-sm text-white/70">
                  <ResultLine label="Mode" value={result.mode === "over" ? "Roll Over" : "Roll Under"} />
                  <ResultLine label="Target" value={result.target.toFixed(2)} />
                  <ResultLine label={result.won ? "Reward" : "Loss amount"} value={`${formatNumber(result.won ? result.rewardAmount : result.lossAmount, locale)} TC`} />
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-cyan-100" /><h2 className="text-xl font-semibold">Session Result</h2></div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Net gain" value={`${sessionStats.net >= 0 ? "+" : ""}${formatNumber(sessionStats.net, locale)} TC`} />
                <Stat label="Wins" value={sessionStats.wins} />
                <Stat label="Losses" value={sessionStats.losses} />
              </div>
              <ProfitChart points={profitPoints} />
            </div>
          </aside>
        </section>
      </div>
      <style>{`
        .tech-dice-slider { height: 18px; border-radius: 999px; appearance: none; box-shadow: 0 0 28px rgba(34, 211, 238, 0.18); outline: none; }
        .tech-dice-slider::-webkit-slider-thumb { appearance: none; width: 34px; height: 34px; border-radius: 999px; border: 3px solid white; background: radial-gradient(circle, #67e8f9, #8b5cf6); box-shadow: 0 0 26px rgba(103, 232, 249, 0.65); cursor: pointer; transition: transform .18s ease; }
        .tech-dice-slider::-webkit-slider-thumb:hover { transform: scale(1.08); }
        .tech-dice-slider::-moz-range-thumb { width: 34px; height: 34px; border-radius: 999px; border: 3px solid white; background: #67e8f9; box-shadow: 0 0 26px rgba(103, 232, 249, 0.65); cursor: pointer; }
      `}</style>
    </main>
  );
}

function diceMath(mode: DiceMode, target: number) {
  const winChance = mode === "over" ? (100 - target) / 100 : target / 100;
  return { winChance, multiplier: Number((RTP / winChance).toFixed(2)) };
}

function Stat({ label, value, glow = false }: { label: string; value: string | number; glow?: boolean }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-black/30 p-4 ${glow ? "shadow-xl shadow-cyan-500/10" : ""}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><span>{label}</span><strong className="text-white">{value}</strong></div>;
}

function ProfitChart({ points }: { points: number[] }) {
  const width = 320;
  const height = 110;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = Math.max(1, max - min);
  const path = points.length
    ? points.map((point, index) => {
        const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
        const y = height - ((point - min) / range) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : `M0,${height} L${width},${height}`;

  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm text-white/55"><Gauge className="h-4 w-4 text-purple-100" /> Profit chart</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible">
        <path d={`M0,${height - ((0 - min) / range) * height} L${width},${height - ((0 - min) / range) * height}`} stroke="rgba(255,255,255,.16)" strokeDasharray="5 6" />
        <path d={path} fill="none" stroke="url(#diceProfit)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <defs><linearGradient id="diceProfit" x1="0" x2="1"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs>
      </svg>
    </div>
  );
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value || 0);
}
