import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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

function Shape({ type }: { type: string }) {
  if (type === "triangle") {
    return (
      <div className="w-0 h-0 border-l-[17px] border-r-[17px] border-b-[30px] border-l-transparent border-r-transparent border-b-white/70 drop-shadow-[0_0_18px_rgba(0,212,255,0.45)]" />
    );
  }

  if (type === "circle") {
    return (
      <div className="w-8 h-8 rounded-full border border-white/60 bg-white/5 shadow-[0_0_22px_rgba(0,212,255,0.4)]" />
    );
  }

  if (type === "diamond") {
    return (
      <div className="w-8 h-8 rotate-45 border border-white/60 bg-white/5 shadow-[0_0_22px_rgba(139,92,246,0.45)]" />
    );
  }

  return (
    <div className="w-8 h-8 border border-white/60 bg-white/5 shadow-[0_0_22px_rgba(139,92,246,0.45)]" />
  );
}

export function Loader({ show }: LoaderProps) {
  const [impact, setImpact] = useState(0);

  useEffect(() => {
    if (!show) return;

    const timers = drops.map((drop) =>
      window.setTimeout(() => {
        setImpact((value) => value + 1);
      }, (drop.delay + 0.62) * 1000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_48%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

          <div className="relative w-80 h-80 flex items-center justify-center">
            {drops.map((drop, index) => (
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
                  rotate: [0, 25, 70],
                  scale: [0.95, 1, 0.55],
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

            <motion.div
              key={impact}
              className="relative z-10 flex items-center justify-center w-40 h-40 rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_0_60px_rgba(139,92,246,0.25)] overflow-hidden"
              initial={{
                y: 0,
                scale: 1,
                rotate: 0,
              }}
              animate={
                impact === 0
                  ? {
                      y: 0,
                      scale: 1,
                      rotate: 0,
                    }
                  : {
                      y: [0, 9, -4, 2, 0],
                      scale: [1, 1.08, 0.96, 1.02, 1],
                      rotate: [0, -1.4, 1.2, -0.5, 0],
                    }
              }
              transition={{
                duration: 0.32,
                ease: "easeOut",
              }}
            >
              <motion.div
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.16),transparent_62%)]"
                animate={{
                  opacity: impact === 0 ? 0.25 : [0.25, 0.8, 0.25],
                }}
                transition={{
                  duration: 0.32,
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
              animate={{ opacity: 1 }}
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