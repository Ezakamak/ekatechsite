import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, TrendingUp } from "lucide-react";

export type SessionStatsGameKey = "tech-mines" | "eka-towers" | "tech-aviator" | "tech-dice" | "tech-blackjack";

type SessionStats = {
  netGain: number;
  amount: number;
  wins: number;
  losses: number;
  points: number[];
};

type ChartDot = {
  x: number;
  y: number;
  value: number;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 128;
const MIN_VISIBLE_POINTS = 36;
const TARGET_STARTER_POINTS = 44;
const MAX_SESSION_POINTS = 60;

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
    points: points.slice(-MAX_SESSION_POINTS),
  };
}

function formatTc(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
}

export function useGameSessionStats(gameKey: SessionStatsGameKey) {
  const [stats, setStats] = useState<SessionStats>(() => EMPTY_STATS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(storageKey(gameKey));
      if (saved) setStats(sanitizeStats(JSON.parse(saved)));
    } catch {
      setStats(EMPTY_STATS);
    }
  }, [gameKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(gameKey), JSON.stringify(stats));
    } catch {
      // Session stats are cosmetic; storage restrictions must never crash a game.
    }
  }, [gameKey, stats]);

  const recordBet = useCallback((amount: number) => {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (!safeAmount) return;
    setStats((current) => ({ ...current, amount: current.amount + safeAmount }));
  }, []);

  const recordResult = useCallback((netGain: number) => {
    const safeNet = Math.round(Number(netGain) || 0);
    setStats((current) => {
      const previousNetGain = current.netGain;
      const nextNetGain = previousNetGain + safeNet;
      const sessionTrail = buildOrganicSessionTrail(current.points, previousNetGain, nextNetGain, safeNet);

      return {
        ...current,
        netGain: nextNetGain,
        wins: safeNet > 0 ? current.wins + 1 : current.wins,
        losses: safeNet < 0 ? current.losses + 1 : current.losses,
        points: sessionTrail,
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
  const lastPoint = lastItem(stats.points) ?? 0;

  return (
    <section className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#07111a]/92 p-3 shadow-2xl shadow-black/35 ring-1 ring-emerald-300/10 backdrop-blur-xl sm:p-4">
      <style>{`
        @keyframes session-chart-draw-${chartId} {
          from { stroke-dashoffset: 1; opacity: 0.45; transform: translateX(8px); }
          to { stroke-dashoffset: 0; opacity: 1; transform: translateX(0); }
        }
        .session-chart-line-${chartId} {
          stroke-dasharray: 1;
          animation: session-chart-draw-${chartId} 720ms cubic-bezier(.2,.8,.2,1) both;
          transition: stroke 240ms ease, filter 240ms ease;
        }
      `}</style>
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

      <div className="relative mt-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,17,26,0.92),rgba(2,6,12,0.96))] p-2 shadow-inner shadow-black/40 sm:p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_70%_100%,rgba(248,113,113,0.12),transparent_30%)]" />
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="relative h-36 w-full max-w-full overflow-visible sm:h-40" role="img" aria-label={`${gameName} session profit chart`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`profit-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(52,211,153,0.58)" />
              <stop offset="62%" stopColor="rgba(16,185,129,0.24)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.03)" />
            </linearGradient>
            <linearGradient id={`loss-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(248,113,113,0.03)" />
              <stop offset="45%" stopColor="rgba(248,113,113,0.22)" />
              <stop offset="100%" stopColor="rgba(239,68,68,0.56)" />
            </linearGradient>
            <filter id={`glow-${chartId}`} x="-15%" y="-40%" width="130%" height="180%">
              <feGaussianBlur stdDeviation="3.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id={`profit-clip-${chartId}`}>
              <rect x="0" y="0" width={CHART_WIDTH} height={chart.zeroY} />
            </clipPath>
            <clipPath id={`loss-clip-${chartId}`}>
              <rect x="0" y={chart.zeroY} width={CHART_WIDTH} height={CHART_HEIGHT - chart.zeroY} />
            </clipPath>
          </defs>
          <path d={chart.areaPath} fill={`url(#profit-${chartId})`} clipPath={`url(#profit-clip-${chartId})`} opacity="0.95" />
          <path d={chart.areaPath} fill={`url(#loss-${chartId})`} clipPath={`url(#loss-clip-${chartId})`} opacity="0.95" />
          <line x1="0" y1={chart.zeroY} x2={CHART_WIDTH} y2={chart.zeroY} stroke="rgba(255,255,255,0.36)" strokeWidth="1" strokeDasharray="4 6" />
          <path d={chart.linePath} fill="none" stroke="rgba(52,211,153,0.22)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${chartId})`} clipPath={`url(#profit-clip-${chartId})`} />
          <path d={chart.linePath} fill="none" stroke="rgba(248,113,113,0.24)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${chartId})`} clipPath={`url(#loss-clip-${chartId})`} />
          <path key={`${chart.linePath}-${lastPoint}`} d={chart.linePath} pathLength="1" className={`session-chart-line-${chartId}`} fill="none" stroke="#39ff9f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${chartId})`} clipPath={`url(#profit-clip-${chartId})`} />
          <path key={`loss-${chart.linePath}-${lastPoint}`} d={chart.linePath} pathLength="1" className={`session-chart-line-${chartId}`} fill="none" stroke="#ff5f6d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${chartId})`} clipPath={`url(#loss-clip-${chartId})`} />
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

function lastItem<T>(items: T[]) {
  return items.length ? items[items.length - 1] : undefined;
}

function buildOrganicSessionTrail(points: number[], previousNetGain: number, nextNetGain: number, result: number) {
  const startingTrail = points.length ? points : [previousNetGain];
  const previousPoint = lastItem(startingTrail) ?? previousNetGain;
  const delta = nextNetGain - previousPoint;
  const magnitude = Math.max(1, Math.abs(delta));
  const steps = Math.min(14, Math.max(8, Math.ceil(Math.sqrt(magnitude) / 3) + 7));
  const direction = delta >= 0 ? 1 : -1;
  const volatility = Math.min(magnitude * 0.22, Math.max(2, magnitude * 0.08 + Math.abs(result) * 0.04));
  const segment = Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    if (index === steps - 1) return nextNetGain;

    const eased = progress * progress * (3 - 2 * progress);
    const wave = Math.sin((progress * Math.PI * 2.4) + (direction > 0 ? 0.8 : 2.1));
    const counterMove = Math.sin(progress * Math.PI * 5.1) * 0.45;
    const taper = Math.sin(progress * Math.PI);
    const jitter = (wave + counterMove) * volatility * taper;
    const value = previousPoint + delta * eased + jitter;
    const overshootLimit = magnitude * 0.18 + 2;
    const min = Math.min(previousPoint, nextNetGain) - overshootLimit;
    const max = Math.max(previousPoint, nextNetGain) + overshootLimit;

    return Math.round(Math.max(min, Math.min(max, value)));
  });

  return [...startingTrail, ...segment].slice(-MAX_SESSION_POINTS);
}

function buildChart(points: number[]) {
  const visiblePoints = normalizeVisiblePoints(points);
  const rawMax = Math.max(...visiblePoints, 0);
  const rawMin = Math.min(...visiblePoints, 0);
  const rangePadding = Math.max(8, (rawMax - rawMin) * 0.16);
  const maxValue = Math.max(rawMax + rangePadding, 10);
  const minValue = Math.min(rawMin - rangePadding, -10);
  const valueRange = Math.max(1, maxValue - minValue);
  const zeroY = Math.max(18, Math.min(CHART_HEIGHT - 18, ((maxValue - 0) / valueRange) * CHART_HEIGHT));
  const dots: ChartDot[] = visiblePoints.map((value, index) => {
    const x = visiblePoints.length === 1 ? 0 : (index / (visiblePoints.length - 1)) * CHART_WIDTH;
    const y = ((maxValue - value) / valueRange) * CHART_HEIGHT;
    return { x, y: Math.max(8, Math.min(CHART_HEIGHT - 8, y)), value };
  });
  const linePath = buildSmoothPath(dots);
  const first = dots[0];
  const last = lastItem(dots) ?? first;
  const areaPath = first && last ? `M ${first.x.toFixed(2)} ${zeroY.toFixed(2)} L ${linePath.slice(2)} L ${last.x.toFixed(2)} ${zeroY.toFixed(2)} Z` : "";

  return { zeroY, linePath, areaPath };
}

function normalizeVisiblePoints(points: number[]) {
  const safePoints = points.length ? points.map((point) => Math.round(Number(point) || 0)) : [0];
  if (safePoints.length <= 1 && safePoints[0] === 0) return buildStarterPoints();
  const trimmed = safePoints.slice(-MAX_SESSION_POINTS);
  if (trimmed.length >= MIN_VISIBLE_POINTS) return trimmed;
  return densifyPoints(trimmed, MIN_VISIBLE_POINTS);
}

function buildStarterPoints() {
  return Array.from({ length: TARGET_STARTER_POINTS }, (_, index) => {
    const progress = index / (TARGET_STARTER_POINTS - 1);
    const pulse = Math.sin(progress * Math.PI * 7.6) * 4.2;
    const drift = Math.sin(progress * Math.PI * 2.2 + 0.7) * 2.4;
    const settle = (1 - progress) * -1.5 + progress * 1.5;
    return Math.round((pulse + drift + settle) * (0.75 + Math.sin(progress * Math.PI) * 0.28));
  });
}

function densifyPoints(points: number[], targetCount: number) {
  if (points.length <= 1) return buildStarterPoints();
  const result: number[] = [];
  const segments = points.length - 1;
  const subdivisions = Math.max(2, Math.ceil((targetCount - 1) / segments));

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const delta = end - start;
    const volatility = Math.min(Math.max(Math.abs(delta) * 0.12, 1), Math.max(2, Math.abs(delta) * 0.2));
    if (segmentIndex === 0) result.push(start);

    for (let step = 1; step <= subdivisions; step += 1) {
      const progress = step / subdivisions;
      if (segmentIndex === segments - 1 && step === subdivisions) {
        result.push(end);
        continue;
      }
      const eased = progress * progress * (3 - 2 * progress);
      const jitter = Math.sin((segmentIndex + 1) * 1.7 + progress * Math.PI * 3.2) * volatility * Math.sin(progress * Math.PI);
      result.push(Math.round(start + delta * eased + jitter));
    }
  }

  return result.slice(-MAX_SESSION_POINTS);
}

function buildSmoothPath(dots: ChartDot[]) {
  if (!dots.length) return "";
  if (dots.length === 1) return `M ${dots[0].x.toFixed(2)} ${dots[0].y.toFixed(2)}`;

  return dots.reduce((path, dot, index) => {
    if (index === 0) return `M ${dot.x.toFixed(2)} ${dot.y.toFixed(2)}`;

    const previous = dots[index - 1];
    const next = dots[index + 1] ?? dot;
    const previousPrevious = dots[index - 2] ?? previous;
    const smoothing = 0.18;
    const cp1x = previous.x + (dot.x - previousPrevious.x) * smoothing;
    const cp1y = previous.y + (dot.y - previousPrevious.y) * smoothing;
    const cp2x = dot.x - (next.x - previous.x) * smoothing;
    const cp2y = dot.y - (next.y - previous.y) * smoothing;

    return `${path} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${dot.x.toFixed(2)} ${dot.y.toFixed(2)}`;
  }, "");
}
