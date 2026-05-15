import { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import logo from "../../imports/View_recent_photos.png";

type LoaderProps = {
  show: boolean;
};

const drops = [
  { type: "square", delay: 0.15, x: -6, rotate: 96, mass: 1.05 },
  { type: "triangle", delay: 0.55, x: 8, rotate: -84, mass: 1.18 },
  { type: "circle", delay: 0.95, x: -4, rotate: 44, mass: 0.92 },
  { type: "diamond", delay: 1.35, x: 7, rotate: 132, mass: 1.12 },
  { type: "square", delay: 1.75, x: -2, rotate: -118, mass: 1.25 },
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
  { x: -30, y: -34, size: 4, delay: 0 },
  { x: -18, y: -44, size: 3, delay: 0.018 },
  { x: -6, y: -28, size: 5, delay: 0.036 },
  { x: 10, y: -40, size: 3, delay: 0.012 },
  { x: 22, y: -31, size: 4, delay: 0.03 },
  { x: 34, y: -24, size: 3, delay: 0.048 },
];

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

function FluidFill({ fillPercent, impact, burst }: { fillPercent: number; impact: number; burst: boolean }) {
  const safeFill = Math.max(0, Math.min(100, fillPercent));
  const waveLift = impact === 0 ? 0 : Math.min(10, 3 + impact * 1.15);

  return (
    <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: `${safeFill}%` }}>
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,212,255,0.34),rgba(139,92,246,0.22)_68%,rgba(255,255,255,0.10))]"
        initial={false}
        animate={{ opacity: burst ? [0.8, 1, 0.25] : 1 }}
        transition={{ duration: burst ? 0.45 : 0.2 }}
        style={{ height: "100%" }}
      />

      <motion.svg
        key={`front-wave-${impact}`}
        className="absolute -top-7 left-[-50%] h-14 w-[200%] drop-shadow-[0_0_18px_rgba(0,212,255,0.35)]"
        viewBox="0 0 320 56"
        preserveAspectRatio="none"
        initial={{ x: -34, y: waveLift, scaleY: 0.65 }}
        animate={{ x: 0, y: [waveLift, -4, 2, 0], scaleY: [0.65, 1.35, 0.86, 1] }}
        transition={{ duration: 0.82, ease: [0.2, 0.75, 0.22, 1] }}
      >
        <path
          d="M0 25 C28 2 52 47 82 24 C112 2 138 46 168 24 C198 3 226 45 254 24 C284 2 302 32 320 18 L320 56 L0 56 Z"
          fill="rgba(0,212,255,0.42)"
        />
      </motion.svg>

      <motion.svg
        key={`back-wave-${impact}`}
        className="absolute -top-6 left-[-45%] h-12 w-[190%] opacity-80"
        viewBox="0 0 320 48"
        preserveAspectRatio="none"
        initial={{ x: 18, y: waveLift * 0.45, scaleY: 0.72 }}
        animate={{ x: -18, y: [waveLift * 0.45, 3, -2, 0], scaleY: [0.72, 1.18, 0.92, 1] }}
        transition={{ duration: 1.05, ease: [0.2, 0.72, 0.22, 1] }}
      >
        <path
          d="M0 22 C34 41 58 4 92 22 C126 40 150 6 184 22 C218 40 244 7 276 22 C298 34 312 25 320 20 L320 48 L0 48 Z"
          fill="rgba(139,92,246,0.32)"
        />
      </motion.svg>

      <motion.div
        key={`shine-${impact}`}
        className="absolute left-[-20%] top-0 h-10 w-[140%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.30),transparent_62%)]"
        initial={{ opacity: 0.15, x: -18, y: -10 }}
        animate={{ opacity: [0.15, 0.55, 0.18], x: 18, y: [-10, -16, -8] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

function Splash({ impact, fillPercent, burst }: { impact: number; fillPercent: number; burst: boolean }) {
  if (impact === 0 || burst) return null;
  const bottom = Math.max(12, Math.min(88, fillPercent + 2));

  return (
    <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
      {splashPieces.map((piece, index) => (
        <motion.span
          key={`${impact}-${index}`}
          className="absolute left-1/2 rounded-full bg-cyan-100/75 shadow-[0_0_12px_rgba(0,212,255,0.75)]"
          style={{ width: piece.size, height: piece.size, bottom: `${bottom}%` }}
          initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.7 }}
          animate={{ x: [0, piece.x * 0.45, piece.x], y: [0, piece.y, piece.y + 22], opacity: [0.95, 0.9, 0], scale: [0.7, 1.15, 0.35] }}
          transition={{ duration: 0.58, delay: piece.delay, ease: [0.16, 0.75, 0.28, 1] }}
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
          y: [0, 8 * force, -4 * force, 2, 0],
          scale: [1, 1 + 0.08 * force, 0.96, 1.018, 1],
          rotate: [0, -1.1 * force, 1.35 * force, -0.45, 0],
          transition: {
            duration: 0.36,
            ease: [0.16, 0.78, 0.25, 1],
          },
        });
      }, (drop.delay + 0.72) * 1000)
    );

    const burstTimer = window.setTimeout(() => {
      setBurst(true);

      boxControls.start({
        y: [0, 6, -5],
        scale: [1, 1.22, 0.12],
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
                  className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2"
                  initial={{
                    x: drop.x,
                    y: -280,
                    opacity: 0,
                    rotate: 0,
                    scale: 0.96,
                  }}
                  animate={{
                    x: [drop.x, drop.x * 0.5, 0],
                    y: [-280, -170, -66, 0, 8],
                    opacity: [0, 1, 1, 1, 0],
                    rotate: [0, drop.rotate * 0.18, drop.rotate * 0.55, drop.rotate, drop.rotate + 34],
                    scale: [0.96, 1, 1, 0.72, 0.42],
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
                  className="absolute z-30 left-1/2 top-1/2"
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
              className="relative z-10 flex items-center justify-center w-40 h-40 rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_0_60px_rgba(139,92,246,0.25)] overflow-hidden"
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
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.18),transparent_62%)]"
                animate={{
                  opacity: burst
                    ? [0.4, 1, 0]
                    : impact === 0
                      ? 0.25
                      : [0.25, 0.85, 0.25],
                }}
                transition={{
                  duration: burst ? 0.45 : 0.32,
                }}
              />

              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/10 shadow-[inset_0_0_28px_rgba(255,255,255,0.08)]" />

              <img
                src={logo}
                alt="EkaTech Logo"
                className="relative z-20 w-28 h-28 object-contain drop-shadow-[0_0_22px_rgba(255,255,255,0.16)]"
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
