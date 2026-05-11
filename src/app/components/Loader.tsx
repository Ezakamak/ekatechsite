import { motion, AnimatePresence } from "motion/react";
import logo from "../../imports/View_recent_photos.png";

type LoaderProps = {
  show: boolean;
};

const shapes = [
  { type: "square", x: -90, delay: 0 },
  { type: "triangle", x: 60, delay: 0.25 },
  { type: "circle", x: -30, delay: 0.5 },
  { type: "diamond", x: 100, delay: 0.75 },
  { type: "square", x: 20, delay: 1 },
];

export function Loader({ show }: LoaderProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.22),transparent_45%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-25" />

          <div className="relative w-72 h-72 flex items-center justify-center">
            {shapes.map((shape, index) => (
              <motion.div
                key={index}
                className="absolute top-[-120px]"
                style={{ x: shape.x }}
                initial={{ y: -80, opacity: 0, rotate: 0, scale: 0.7 }}
                animate={{
                  y: 150,
                  opacity: [0, 1, 1, 0],
                  rotate: [0, 180, 260],
                  scale: [0.7, 1, 0.45],
                }}
                transition={{
                  duration: 1.05,
                  delay: shape.delay,
                  ease: "easeInOut",
                }}
              >
                {shape.type === "square" && (
                  <div className="w-8 h-8 border border-white/60 bg-white/5 shadow-[0_0_25px_rgba(139,92,246,0.45)]" />
                )}

                {shape.type === "triangle" && (
                  <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[32px] border-l-transparent border-r-transparent border-b-white/70 drop-shadow-[0_0_18px_rgba(0,212,255,0.5)]" />
                )}

                {shape.type === "circle" && (
                  <div className="w-8 h-8 rounded-full border border-white/60 bg-white/5 shadow-[0_0_25px_rgba(0,212,255,0.4)]" />
                )}

                {shape.type === "diamond" && (
                  <div className="w-8 h-8 rotate-45 border border-white/60 bg-white/5 shadow-[0_0_25px_rgba(139,92,246,0.45)]" />
                )}
              </motion.div>
            ))}

            <motion.div
              className="relative flex items-center justify-center w-36 h-36 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_60px_rgba(139,92,246,0.25)]"
              animate={{
                scale: [1, 1.08, 0.98, 1.05, 1],
                rotate: [0, -2, 2, -1, 0],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.18),transparent_60%)]"
                animate={{ opacity: [0.25, 0.7, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />

              <img
                src={logo}
                alt="EkaTech Logo"
                className="relative z-10 w-24 h-24 object-contain"
              />
            </motion.div>

            <motion.p
              className="absolute bottom-0 text-xs tracking-[0.35em] text-white/45 uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Loading System
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}