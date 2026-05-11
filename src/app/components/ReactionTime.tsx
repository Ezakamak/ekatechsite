import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

type State = "idle" | "waiting" | "ready" | "result" | "early";

export function ReactionTime() {
  const [state, setState] = useState<State>("idle");
  const [time, setTime] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const start = useRef(0);

  const clearTimer = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const begin = () => {
    clearTimer();
    setTime(null);
    setState("waiting");

    const delay = Math.floor(Math.random() * 1600) + 1200;

    timer.current = window.setTimeout(() => {
      start.current = performance.now();
      setState("ready");
    }, delay);
  };

  const press = () => {
    if (state === "idle" || state === "result" || state === "early") {
      begin();
      return;
    }

    if (state === "waiting") {
      clearTimer();
      setState("early");
      return;
    }

    if (state === "ready") {
      setTime(Math.round(performance.now() - start.current));
      setState("result");
    }
  };

  const bigText =
    state === "waiting"
      ? "Wait..."
      : state === "ready"
        ? "Click"
        : state === "early"
          ? "Too early"
          : state === "result"
            ? `${time} ms`
            : "Start";

  const smallText =
    state === "result"
      ? "We respond this fast."
      : state === "waiting"
        ? "Wait until the panel turns cyan."
        : state === "ready"
          ? "Now."
          : state === "early"
            ? "Try again after the signal."
            : "Test your reaction time.";

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.12),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-white/40">
            Live response demo
          </p>
          <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            We respond this fast.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/55">
            When the panel turns cyan, click it and see your reaction time.
          </p>
        </motion.div>

        <motion.button
          onClick={press}
          className={`relative min-h-[310px] overflow-hidden rounded-[2rem] border p-8 text-center backdrop-blur-xl transition-all active:scale-[0.98] ${
            state === "ready"
              ? "border-[#00D4FF]/60 bg-[#00D4FF]/15 shadow-[0_0_70px_rgba(0,212,255,0.35)]"
              : state === "early"
                ? "border-red-400/40 bg-red-500/10 shadow-[0_0_70px_rgba(239,68,68,0.18)]"
                : "border-white/10 bg-white/[0.04] shadow-[0_0_70px_rgba(139,92,246,0.18)] hover:bg-white/[0.06]"
          }`}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="block text-sm uppercase tracking-[0.35em] text-white/45">
            Reaction time
          </span>

          <motion.span
            key={bigText}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
            className="mt-5 block text-5xl font-semibold tracking-[-0.04em] text-white"
          >
            {bigText}
          </motion.span>

          <span className="mx-auto mt-4 block max-w-sm text-sm leading-6 text-white/55">
            {smallText}
          </span>

          <span className="mt-8 inline-flex rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white/70">
            {state === "idle"
              ? "Start test"
              : state === "waiting"
                ? "Do not click"
                : state === "ready"
                  ? "Click now"
                  : "Try again"}
          </span>
        </motion.button>
      </div>
    </section>
  );
}
