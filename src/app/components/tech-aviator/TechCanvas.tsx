import { Plane, RadioTower } from "lucide-react";
import type { GameStatus } from "./types";

interface TechCanvasProps {
  multiplier: number;
  status: GameStatus;
  countdown: number;
  crashPoint?: number;
}

export function TechCanvas({ multiplier, status, countdown, crashPoint }: TechCanvasProps) {
  const flightProgress = Math.min(86, Math.max(8, (Math.log(multiplier) / Math.log(20)) * 80 + 8));
  const isFlying = status === "STATUS_FLYING";
  const isCrashed = status === "STATUS_CRASHED";

  return (
    <section className="relative min-h-[460px] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,#12384b_0%,#05080f_45%,#020304_100%)] shadow-[0_0_70px_rgba(6,182,212,0.12)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:46px_46px] opacity-50" />
      <div className="absolute -left-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="techTrail" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.05" />
            <stop offset="45%" stopColor="#2dd4bf" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
          </linearGradient>
          <filter id="neonBlur">
            <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={`M 4 86 C 23 78, 35 74, ${flightProgress} ${92 - flightProgress * 0.72}`}
          fill="none"
          stroke="url(#techTrail)"
          strokeDasharray="2 1"
          strokeLinecap="round"
          strokeWidth="1.8"
          filter="url(#neonBlur)"
        />
        <path d="M 4 92 C 25 82, 42 78, 91 28" fill="none" stroke="#0f172a" strokeWidth="0.5" opacity="0.7" />
      </svg>

      <div
        className={`absolute transition-all duration-75 ${isCrashed ? "text-red-400" : "text-cyan-200"}`}
        style={{ left: `${flightProgress}%`, top: `${Math.max(10, 86 - flightProgress * 0.72)}%` }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2 rotate-[-18deg]">
          <Plane className={`h-14 w-14 ${isFlying ? "drop-shadow-[0_0_18px_rgba(34,211,238,0.95)]" : ""}`} />
        </div>
      </div>

      <div className="relative z-10 flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.4em] text-cyan-100/80">
          <RadioTower className="h-4 w-4 text-emerald-300" /> Provably Fair SHA-256 Flight
        </p>
        <h1 className={`font-mono text-7xl font-black sm:text-8xl ${isCrashed ? "text-red-400 drop-shadow-[0_0_26px_rgba(248,113,113,0.9)]" : "text-emerald-300 drop-shadow-[0_0_30px_rgba(16,185,129,0.9)]"}`}>
          {multiplier.toFixed(2)}x
        </h1>
        {status === "STATUS_BETTING" ? (
          <p className="mt-6 text-2xl font-bold text-white">Bahis dönemi: {countdown}s</p>
        ) : null}
        {isCrashed ? (
          <p className="mt-6 text-3xl font-black uppercase tracking-[0.2em] text-red-300">TECH CRASH / FLEW AWAY</p>
        ) : null}
        {crashPoint ? <p className="mt-3 text-sm text-zinc-400">Son doğrulanan crash point: {crashPoint.toFixed(2)}x</p> : null}
      </div>
    </section>
  );
}
