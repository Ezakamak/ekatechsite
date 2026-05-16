import { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import logo from "../../imports/View_recent_photos.png";

type LoaderProps = {
  show: boolean;
};

const drops = [
  { type: "square", delay: 0.15 },
  { type: "triangle", delay: 0.55 },
  { type: "circle", delay: 0.95 },
  { type: "diamond", delay: 1.35 },
  { type: "square", delay: 1.75 },
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

        boxControls.start({
          y: [0, 9, -4, 2, 0],
          scale: [1, 1.08, 0.96, 1.02, 1],
          rotate: [0, -1.4, 1.2, -0.5, 0],
          transition: {
            duration: 0.32,
            ease: "easeOut",
          },
        });
      }, (drop.delay + 0.62) * 1000)
    );

    const burstTimer = window.setTimeout(() => {
      setBurst(true);

      boxControls.start({
        y: [0, 4, -2],
        scale: [1, 1.18, 0.15],
        rotate: [0, -3, 8],
        opacity: [1, 1, 0],
        transition: {
          duration: 0.45,
          ease: "easeOut",
        },
      });
    }, 2650);

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
                    y: -260,
                    opacity: 0,
                    rotate: 0,
                    scale: 0.95,
                  }}
                  animate={{
                    y: [-260, -80, 0],
                    opacity: [0, 1, 1, 0],
                    rotate: [0, 20, 70],
                    scale: [0.95, 1, 0.5],
                  }}
                  transition={{
                    duration: 0.68,
                    delay: drop.delay,
                    times: [0, 0.82, 1],
                    ease: "easeIn",
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
                    x: piece.x,
                    y: piece.y,
                    opacity: [1, 1, 0],
                    scale: [0.8, 1.15, 0.4],
                    rotate: piece.rotate,
                  }}
                  transition={{
                    duration: 0.75,
                    ease: "easeOut",
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
              <motion.div
                className="absolute bottom-0 left-0 right-0 bg-[linear-gradient(to_top,rgba(0,212,255,0.28),rgba(139,92,246,0.16))]"
                animate={{
                  height: `${fillPercent}%`,
                }}
                transition={{
                  duration: 0.25,
                  ease: "easeOut",
                }}
              />

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

              <img
                src={logo}
                alt="EkaTech Logo"
                className="relative z-10 w-28 h-28 object-contain"
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
