import { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import logo from "../../imports/View_recent_photos.png";

type LoaderProps = {
  show: boolean;
};

const drops = [
  { type: "square", delay: 0.15, x: -7, rotate: 92, mass: 1.05 },
  { type: "triangle", delay: 0.55, x: 8, rotate: -80, mass: 1.18 },
  { type: "circle", delay: 0.95, x: -4, rotate: 44, mass: 0.92 },
  { type: "diamond", delay: 1.35, x: 7, rotate: 126, mass: 1.12 },
  { type: "square", delay: 1.75, x: -2, rotate: -114, mass: 1.25 },
] as const;

const burstPieces = [
  { type: "square", x: -160, y: -90, rotate: -240 },
  { type: "triangle", x: 120, y: -130, rotate: 180 },
  { type: "circle", x: -110, y: 120, rotate: 90 },
  { type: "diamond", x: 170, y: 80, rotate: 260 },
  { type: "square", x: 40, y: -170, rotate: -180 },
  { type: "circle", x: -190, y: 20, rotate: 130 },
  { type: "triangle", x: 140, y: 160, rotate: -120 },
] as const;

const splashPieces = [
  { x: -22, y: -20, size: 3, delay: 0 },
  { x: -10, y: -27, size: 2, delay: 0.018 },
  { x: 4, y: -22, size: 3, delay: 0.03 },
  { x: 16, y: -18, size: 2, delay: 0.048 },
];

const bubbles = [
  { left: 28, size: 3, delay: 0.1, duration: 2.4 },
  { left: 46, size: 2, delay: 0.55, duration: 2.1 },
  { left: 63, size: 3, delay: 0.9, duration: 2.6 },
  { left: 74, size: 2, delay: 1.25, duration: 2.2 },
] as const;

function Shape({ type, small = false }: { type: string; small?: boolean }) {
  const size = small ? "w-5 h-5" : "w-8 h-8";

  if (type === "triangle") {
    return (
      <div
        className={
          small
            ? "w-0 h-0 border-l-[11px] border-r-[11px] border-b-[20px] border-l-transparent border-r-transparent border-b-white/75 drop-shadow-[0_0_18px_rgba(0,212,255,0.5)]"
            : "w-0 h-0 border-l-[17px] border-r-[17px] border-b-[30px] border-l-transparent border-r-transparent border-b-white/75 drop-shadow-[0_0_18px_rgba(0,212,255,0.5)]"
        }
      />
    );
  }

  if (type === "circle") {
    return (
      <div
        className={`${size} rounded-full border border-white/65 bg-white/5 shadow-[0_0_22px_rgba(0,212,255,0.45)]`}
      />
    );
  }

  if (type === "diamond") {
    return (
      <div
        className={`${size} rotate-45 border border-white/65 bg-white/5 shadow-[0_0_22px_rgba(139,92,246,0.5)]`}
      />
    );
  }

  return (
    <div
      className={`${size} border border-white/65 bg-white/5 shadow-[0_0_22px_rgba(139,92,246,0.5)]`}
    />
  );
}

function liquidPath(fillPercent: number, impact: number, layer = 0) {
  const fill = Math.max(0, Math.min(100, fillPercent));
  const y = 160 - fill * 1.6;
  const hit = impact === 0 ? 0 : 1;
  const amp = hit ? Math.max(2.2, 8.5 - impact * 0.75) : 1.2;
  const offset = layer ? 4 : 0;
  const phase = layer ? -amp * 0.45 : amp * 0.35;

  return [
    `M 0 ${y + offset}`,
    `C 18 ${y + amp + offset} 30 ${y - amp * 0.55 + offset} 48 ${y + phase + offset}`,
    `C 66 ${y + amp * 0.55 + offset} 82 ${y - amp * 0.75 + offset} 100 ${y + amp * 0.15 + offset}`,
    `C 122 ${y + amp * 0.85 + offset} 138 ${y - amp * 0.35 + offset} 160 ${y + offset}`,
    "L 160 160 L 0 160 Z",
  ].join(" ");
}

function FluidFill({ fillPercent, impact, burst }: { fillPercent: number; impact: number; burst: boolean }) {
  const safeFill = Math.max(0, Math.min(100, fillPercent));
  const surfaceY = 100 - safeFill;
  const fluidPath = liquidPath(safeFill, impact, 0);
  const backPath = liquidPath(safeFill, impact, 1);

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 160" preserveAspectRatio="none">
        <defs>
          <linearGradient id="loaderLiquid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="34%" stopColor="rgba(0,212,255,0.34)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.28)" />
          </linearGradient>
          <linearGradient id="loaderLiquidBack" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(139,92,246,0.20)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0.20)" />
          </linearGradient>
        </defs>

        <motion.path
          key={`back-${impact}`}
          d={backPath}
          fill="url(#loaderLiquidBack)"
          initial={{ opacity: 0.46, x: 3 }}
          animate={{ opacity: burst ? [0.46, 0.76, 0] : 0.46, x: [3, -2, 0] }}
          transition={{ duration: 0.88, ease: "easeOut" }}
        />
        <motion.path
          key={`front-${impact}`}
          d={fluidPath}
          fill="url(#loaderLiquid)"
          initial={{ opacity: 0.82, y: impact ? 5 : 0 }}
          animate={{ opacity: burst ? [0.82, 1, 0] : 0.82, y: impact ? [5, -2, 1, 0] : 0 }}
          transition={{ duration: 0.72, ease: [0.18, 0.8, 0.24, 1] }}
        />
      </svg>

      <motion.div
        key={`surface-${impact}`}
        className="absolute left-[9%] h-px w-[82%] rounded-full bg-cyan-100/45 shadow-[0_0_16px_rgba(0,212,255,0.5)]"
        style={{ top: `${surfaceY}%` }}
        initial={{ scaleX: 0.74, opacity: 0.28 }}
        animate={{ scaleX: impact ? [0.74, 1.12, 0.94, 1] : 0.92, opacity: impact ? [0.28, 0.72, 0.35] : 0.28 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />

      {bubbles.map((bubble, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border border-cyan-100/35 bg-white/10"
          style={{ left: `${bubble.left}%`, width: bubble.size, height: bubble.size, bottom: "8%" }}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: [18, -42, -72], opacity: [0, 0.45, 0] }}
          transition={{ duration: bubble.duration, delay: bubble.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}

      <motion.div
        key={`meniscus-${impact}`}
        className="absolute left-0 right-0 h-7 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14),transparent_68%)]"
        style={{ top: `calc(${surfaceY}% - 14px)` }}
        initial={{ opacity: 0.12 }}
        animate={{ opacity: impact ? [0.12, 0.42, 0.16] : 0.12 }}
        transition={{ duration: 0.64 }}
      />
    </div>
  );
}

function Splash({ impact, fillPercent, burst }: { impact: number; fillPercent: number; burst: boolean }) {
  if (impact === 0 || burst) return null;
  const top = Math.max(9, Math.min(86, 100 - fillPercent - 3));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {splashPieces.map((piece, index) => (
        <motion.span
          key={`${impact}-${index}`}
          className="absolute left-1/2 rounded-full bg-cyan-100/70 shadow-[0_0_10px_rgba(0,212,255,0.55)]"
          style={{ width: piece.size, height: piece.size, top: `${top}%` }}
          initial={{ x: 0, y: 0, opacity: 0.85, scale: 0.75 }}
          animate={{ x: [0, piece.x * 0.6, piece.x], y: [0, piece.y, piece.y + 16], opacity: [0.85, 0.58, 0], scale: [0.75, 1, 0.35] }}
          transition={{ duration: 0.46, delay: piece.delay, ease: [0.2, 0.72, 0.28, 1] }}
        />
      ))}
    </div>
  );
}

export function Loader({ show }: LoaderProps) {
  const [impact, setImpact] = useState(0);
  const [burst, setBurst] = useState(false);

  const boxControls = useAnimationControls();

  useEffect(() => {
    if (!show) return;

    setImpact(0);
    setBurst(false);
    boxControls.set({
      y: 0,
      scale: 1,
      rotate: 0,
      opacity: 1,
    });

    const impactTimers = drops.map((drop) =>
      window.setTimeout(() => {
        setImpact((value) => value + 1);

        const force = drop.mass;
        boxControls.start({
          y: [0, 5.5 * force, -2.8 * force, 1.4, 0],
          scale: [1, 1 + 0.045 * force, 0.982, 1.01, 1],
          rotate: [0, -0.75 * force, 0.85 * force, -0.25, 0],
          transition: {
            duration: 0.34,
            ease: [0.16, 0.78, 0.25, 1],
          },
        });
      }, (drop.delay + 0.72) * 1000)
    );

    const burstTimer = window.setTimeout(() => {
      setBurst(true);

      boxControls.start({
        y: [0, 6, -5],
        scale: [1, 1.2, 0.12],
        rotate: [0, -3, 8],
        opacity: [1, 1, 0],
        transition: {
          duration: 0.48,
          ease: "easeOut",
        },
      });
    }, 2850);

    return () => {
      impactTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(burstTimer);
    };
  }, [show, boxControls]);

  const fillPercent = Math.min((impact / drops.length) * 100, 100);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.2),transparent_48%)]" />

          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

          <div className="relative w-80 h-80 flex items-center justify-center">
            {!burst &&
              drops.map((drop, index) => (
                <motion.div
                  key={index}
                  className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2"
                  initial={{
                    x: drop.x,
                    y: -280,
                    opacity: 0,
                    rotate: 0,
                    scale: 0.96,
                  }}
                  animate={{
                    x: [drop.x, drop.x * 0.5, 0],
                    y: [-280, -170, -70, -8, 10],
                    opacity: [0, 0.72, 0.64, 0.42, 0],
                    rotate: [0, drop.rotate * 0.18, drop.rotate * 0.55, drop.rotate, drop.rotate + 28],
                    scale: [0.96, 1, 1, 0.76, 0.45],
                  }}
                  transition={{
                    duration: 0.82,
                    delay: drop.delay,
                    times: [0, 0.2, 0.62, 0.88, 1],
                    ease: [0.18, 0.02, 0.9, 0.28],
                  }}
                >
                  <Shape type={drop.type} />
                </motion.div>
              ))}

            {burst &&
              burstPieces.map((piece, index) => (
                <motion.div
                  key={index}
                  className="absolute z-40 left-1/2 top-1/2"
                  initial={{
                    x: 0,
                    y: 0,
                    opacity: 1,
                    scale: 0.7,
                    rotate: 0,
                  }}
                  animate={{
                    x: [0, piece.x * 0.82, piece.x],
                    y: [0, piece.y * 0.72, piece.y + 42],
                    opacity: [1, 1, 0],
                    scale: [0.8, 1.15, 0.4],
                    rotate: piece.rotate,
                  }}
                  transition={{
                    duration: 0.88,
                    ease: [0.18, 0.72, 0.24, 1],
                    delay: index * 0.025,
                  }}
                >
                  <Shape type={piece.type} small />
                </motion.div>
              ))}

            <motion.div
              className="relative z-30 flex items-center justify-center w-40 h-40 rounded-3xl border border-white/14 bg-black/35 backdrop-blur-xl shadow-[0_0_60px_rgba(139,92,246,0.25)] overflow-hidden"
              initial={{
                y: 0,
                scale: 1,
                rotate: 0,
                opacity: 1,
              }}
              animate={boxControls}
            >
              <FluidFill fillPercent={fillPercent} impact={impact} burst={burst} />
              <Splash impact={impact} fillPercent={fillPercent} burst={burst} />

              <motion.div
                className="absolute inset-0 z-30 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.13),transparent_62%)]"
                animate={{
                  opacity: burst
                    ? [0.28, 0.8, 0]
                    : impact === 0
                      ? 0.2
                      : [0.2, 0.48, 0.22],
                }}
                transition={{
                  duration: burst ? 0.45 : 0.34,
                }}
              />

              <div className="pointer-events-none absolute inset-0 z-40 rounded-3xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_35%,rgba(255,255,255,0.05)_70%,transparent)] shadow-[inset_0_0_30px_rgba(255,255,255,0.08)]" />

              <img
                src={logo}
                alt="EkaTech Logo"
                className="relative z-50 w-28 h-28 object-contain drop-shadow-[0_0_22px_rgba(255,255,255,0.18)]"
              />
            </motion.div>

            <motion.p
              className="absolute bottom-0 text-xs tracking-[0.35em] text-white/45 uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: burst ? 0 : 1 }}
              transition={{ delay: 0.35 }}
            >
              Loading System
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
