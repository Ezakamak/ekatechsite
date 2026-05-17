import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, TrendingUp } from "lucide-react";

export type SessionStatsGameKey = "tech-mines" | "eka-towers" | "tech-aviator";

type SessionStats = {
  netGain: number;
  amount: number;
  wins: number;
  losses: number;
  points: number[];
};

const EMPTY_STATS: SessionStats = {
  netGain: 0,
  amount: 0,
  wins: 0,
  losses: 0,
  points: [0],
};

function storageKey(gameKey: SessionStatsGameKey) {
  return `ekatech:session-stats:${gameKey}:v1`;
}

function sanitizeStats(value: unknown): SessionStats {
  if (!value || typeof value !== "object") return EMPTY_STATS;
  const parsed = value as Partial<SessionStats>;
  const points = Array.isArray(parsed.points) && parsed.points.length ? parsed.points.map((point) => Number(point) || 0) : [0];
  return {
    netGain: Number(parsed.netGain) || 0,
    amount: Math.max(0, Number(parsed.amount) || 0),
    wins: Math.max(0, Math.floor(Number(parsed.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(parsed.losses) || 0)),
    points: points.slice(-40),
  };
}

function formatTc(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
}

export function useGameSessionStats(gameKey: SessionStatsGameKey) {
  const [stats, setStats] = useState<SessionStats>(() => EMPTY_STATS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(gameKey));
      if (saved) setStats(sanitizeStats(JSON.parse(saved)));
    } catch {
      setStats(EMPTY_STATS);
    }
  }, [gameKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(gameKey), JSON.stringify(stats));
  }, [gameKey, stats]);

  const recordBet = useCallback((amount: number) => {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (!safeAmount) return;
    setStats((current) => ({ ...current, amount: current.amount + safeAmount }));
  }, []);

  const recordResult = useCallback((netGain: number) => {
    const safeNet = Math.round(Number(netGain) || 0);
    setStats((current) => {
      const nextNetGain = current.netGain + safeNet;
      return {
        ...current,
        netGain: nextNetGain,
        wins: safeNet > 0 ? current.wins + 1 : current.wins,
        losses: safeNet < 0 ? current.losses + 1 : current.losses,
        points: [...current.points, nextNetGain].slice(-40),
      };
    });
  }, []);

  const resetStats = useCallback(() => setStats(EMPTY_STATS), []);

  return { stats, recordBet, recordResult, resetStats };
}

export function GameSessionStatsPanel({ gameName, stats, onReset }: { gameName: string; stats: SessionStats; onReset?: () => void }) {
  const netPositive = stats.netGain >= 0;
  const chart = useMemo(() => buildChart(stats.points), [stats.points]);
  const chartId = useMemo(() => gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), [gameName]);

  return (
    <section className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#07111a]/92 p-4 shadow-2xl shadow-black/35 ring-1 ring-emerald-300/10 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.13),transparent_32%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/45">Session Stats</p>
          <h3 className="mt-1 flex items-center gap-2 text-xl font-black text-white"><TrendingUp className="h-5 w-5 text-emerald-300" /> Profit Chart</h3>
          <p className="mt-1 text-xs text-white/40">{gameName} · Tech Coin oturum performansı</p>
        </div>
        {onReset ? <button type="button" onClick={onReset} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55 transition hover:bg-white/[0.08]">Reset</button> : null}
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Net Gain" value={`${netPositive ? "+" : ""}${formatTc(stats.netGain)} TC`} tone={netPositive ? "positive" : "negative"} />
        <Metric label="Amount" value={`${formatTc(stats.amount)} TC`} icon={<Coins className="h-4 w-4 text-amber-300" />} />
        <Metric label="Wins" value={String(stats.wins)} tone="positive" />
        <Metric label="Losses" value={String(stats.losses)} tone="negative" />
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3">
        <div className="absolute left-3 right-3 top-1/2 h-px bg-white/18" />
        <svg viewBox="0 0 320 116" className="h-36 w-full overflow-visible" role="img" aria-label={`${gameName} session profit chart`}>
          <defs>
            <linearGradient id={`profit-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(52,211,153,0.34)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0.02)" />
            </linearGradient>
            <linearGradient id={`loss-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(248,113,113,0.02)" />
              <stop offset="100%" stopColor="rgba(248,113,113,0.34)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="320" height={chart.zeroY} fill={`url(#profit-${chartId})`} opacity="0.8" />
          <rect x="0" y={chart.zeroY} width="320" height={116 - chart.zeroY} fill={`url(#loss-${chartId})`} opacity="0.8" />
          <line x1="0" y1={chart.zeroY} x2="320" y2={chart.zeroY} stroke="rgba(255,255,255,0.28)" strokeDasharray="5 5" />
          <polyline points={chart.polyline} fill="none" stroke={netPositive ? "#34d399" : "#f87171"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px rgba(52,211,153,0.45))" />
          {chart.dots.map((dot, index) => <circle key={`${dot.x}-${dot.y}-${index}`} cx={dot.x} cy={dot.y} r="3" fill={dot.value >= 0 ? "#34d399" : "#f87171"} />)}
        </svg>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "neutral", icon }: { label: string; value: string; tone?: "positive" | "negative" | "neutral"; icon?: JSX.Element }) {
  const toneClass = tone === "positive" ? "text-emerald-200" : tone === "negative" ? "text-red-200" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-2 flex items-center gap-1.5 text-lg font-black ${toneClass}`}>{icon}{value}</p>
    </div>
  );
}

function buildChart(points: number[]) {
  const safePoints = points.length > 1 ? points : [0, 0];
  const maxAbs = Math.max(1, ...safePoints.map((point) => Math.abs(point)));
  const zeroY = 58;
  const dots = safePoints.map((value, index) => {
    const x = safePoints.length === 1 ? 0 : (index / (safePoints.length - 1)) * 320;
    const y = zeroY - (value / maxAbs) * 50;
    return { x, y: Math.max(6, Math.min(110, y)), value };
  });
  return { zeroY, dots, polyline: dots.map((dot) => `${dot.x.toFixed(2)},${dot.y.toFixed(2)}`).join(" ") };
}
