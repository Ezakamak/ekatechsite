import { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import logo from "../../imports/View_recent_photos.png";

type LoaderProps = {
  show: boolean;
};

const drops = [
  { type: "square", delay: 0.15, x: -34, y: -168, rotate: 80 },
  { type: "triangle", delay: 0.48, x: 28, y: -158, rotate: -72 },
  { type: "circle", delay: 0.82, x: -18, y: -178, rotate: 40 },
  { type: "diamond", delay: 1.16, x: 34, y: -166, rotate: 116 },
  { type: "square", delay: 1.5, x: -4, y: -190, rotate: -98 },
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

function Shape({ type, small = false }: { type: string; small?: boolean }) {
  const size = small ? "w-4 h-4" : "w-7 h-7";

  if (type === "triangle") {
    return (
      <div
        className={
          small
            ? "w-0 h-0 border-l-[9px] border-r-[9px] border-b-[16px] border-l-transparent border-r-transparent border-b-white/60 drop-shadow-[0_0_14px_rgba(0,212,255,0.35)]"
            : "w-0 h-0 border-l-[14px] border-r-[14px] border-b-[25px] border-l-transparent border-r-transparent border-b-white/55 drop-shadow-[0_0_16px_rgba(0,212,255,0.35)]"
        }
      />
    );
  }

  if (type === "circle") {
    return <div className={`${size} rounded-full border border-white/45 bg-white/[0.03] shadow-[0_0_18px_rgba(0,212,255,0.28)]`} />;
  }

  if (type === "diamond") {
    return <div className={`${size} rotate-45 border border-white/45 bg-white/[0.03] shadow-[0_0_18px_rgba(139,92,246,0.34)]`} />;
  }

  return <div className={`${size} border border-white/45 bg-white/[0.03] shadow-[0_0_18px_rgba(139,92,246,0.34)]`} />;
}

function EnergyFill({ fillPercent, impact, burst }: { fillPercent: number; impact: number; burst: boolean }) {
  const safeFill = Math.max(0, Math.min(100, fillPercent));

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,212,255,0.22),rgba(139,92,246,0.16),transparent)]"
        animate={{ height: `${safeFill}%`, opacity: burst ? [0.8, 1, 0] : 1 }}
        transition={{ height: { duration: 0.42, ease: [0.16, 0.72, 0.24, 1] }, opacity: { duration: 0.45 } }}
      />

      <motion.div
        key={`scan-${impact}`}
        className="absolute left-[10%] h-px w-[80%] rounded-full bg-cyan-100/70 shadow-[0_0_18px_rgba(0,212,255,0.75)]"
        style={{ bottom: `${safeFill}%` }}
        initial={{ opacity: 0, scaleX: 0.35 }}
        animate={{ opacity: impact ? [0, 0.95, 0.25] : 0.25, scaleX: impact ? [0.35, 1.12, 0.86] : 0.82 }}
        transition={{ duration: 0.48, ease: "easeOut" }}
      />

      <motion.div
        className="absolute inset-0 bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.12)_42%,transparent_58%)]"
        animate={{ x: ["-120%", "120%"], opacity: burst ? [0.45, 0.9, 0] : 0.45 }}
        transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_82%,rgba(0,212,255,0.16),transparent_54%)]" />
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
    boxControls.set({ y: 0, scale: 1, rotate: 0, opacity: 1 });

    const impactTimers = drops.map((drop, index) =>
      window.setTimeout(() => {
        setImpact((value) => value + 1);
        boxControls.start({
          y: [0, 4, -2, 0],
          scale: [1, 1.035, 0.99, 1],
          rotate: [0, index % 2 === 0 ? -0.55 : 0.55, 0],
          transition: { duration: 0.28, ease: "easeOut" },
        });
      }, (drop.delay + 0.72) * 1000)
    );

    const burstTimer = window.setTimeout(() => {
      setBurst(true);
      boxControls.start({
        y: [0, 3, -4],
        scale: [1, 1.12, 0.12],
        rotate: [0, -2, 8],
        opacity: [1, 1, 0],
        transition: { duration: 0.45, ease: "easeOut" },
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
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_48%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

          <div className="relative flex h-80 w-80 items-center justify-center">
            {!burst &&
              drops.map((drop, index) => (
                <motion.div
                  key={index}
                  className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2"
                  initial={{ x: drop.x, y: drop.y, opacity: 0, rotate: 0, scale: 0.86 }}
                  animate={{
                    x: [drop.x, drop.x * 0.48, 0],
                    y: [drop.y, -72, -18, 10],
                    opacity: [0, 0.48, 0.42, 0],
                    rotate: [0, drop.rotate * 0.45, drop.rotate],
                    scale: [0.86, 1, 0.42],
                  }}
                  transition={{ duration: 0.86, delay: drop.delay, times: [0, 0.58, 0.84, 1], ease: [0.18, 0.02, 0.9, 0.28] }}
                >
                  <Shape type={drop.type} />
                </motion.div>
              ))}

            {burst &&
              burstPieces.map((piece, index) => (
                <motion.div
                  key={index}
                  className="absolute left-1/2 top-1/2 z-40"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.7, rotate: 0 }}
                  animate={{ x: [0, piece.x * 0.82, piece.x], y: [0, piece.y * 0.72, piece.y + 42], opacity: [1, 1, 0], scale: [0.8, 1.15, 0.4], rotate: piece.rotate }}
                  transition={{ duration: 0.88, ease: [0.18, 0.72, 0.24, 1], delay: index * 0.025 }}
                >
                  <Shape type={piece.type} small />
                </motion.div>
              ))}

            <motion.div
              className="relative z-30 flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl border border-white/14 bg-black/45 shadow-[0_0_60px_rgba(139,92,246,0.24)] backdrop-blur-xl"
              initial={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
              animate={boxControls}
            >
              <EnergyFill fillPercent={fillPercent} impact={impact} burst={burst} />

              <motion.div
                className="absolute inset-0 z-30 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.12),transparent_62%)]"
                animate={{ opacity: burst ? [0.24, 0.75, 0] : impact === 0 ? 0.18 : [0.18, 0.46, 0.22] }}
                transition={{ duration: burst ? 0.45 : 0.34 }}
              />

              <div className="pointer-events-none absolute inset-0 z-40 rounded-3xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_35%,rgba(255,255,255,0.04)_70%,transparent)] shadow-[inset_0_0_30px_rgba(255,255,255,0.08)]" />

              <div className="relative z-50 flex h-28 w-28 items-center justify-center overflow-hidden bg-white shadow-[0_0_22px_rgba(255,255,255,0.12)]">
                <img src={logo} alt="EkaTech Logo" className="h-full w-full object-contain" />
              </div>
            </motion.div>

            <motion.p
              className="absolute bottom-0 text-xs uppercase tracking-[0.35em] text-white/45"
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
