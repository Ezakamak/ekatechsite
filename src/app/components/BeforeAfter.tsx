import { useState } from "react";
import { motion } from "motion/react";
import beforeImage from "../../imports/bizco-after.png";
import afterImage from "../../imports/bizco-before.png";

export function BeforeAfter() {
  const [value, setValue] = useState(50);

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.14),transparent_48%)]" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-white/40">
            Before / After
          </p>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            From outdated to future-ready.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">
            Drag the slider to see how a basic website can become a premium digital experience.
          </p>
        </motion.div>

        <div className="relative aspect-[16/9] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_0_90px_rgba(0,212,255,0.12)]">
          <img
            src={beforeImage}
            alt="Outdated BizCo website before redesign"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />

          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
          >
            <img
              src={afterImage}
              alt="Modern BizCo website after redesign"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          </div>

          <div
            className="absolute inset-y-0 z-20 w-[2px] bg-white shadow-[0_0_24px_rgba(255,255,255,0.8)]"
            style={{ left: `${value}%` }}
          >
            <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white backdrop-blur-xl">
              ↔
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/75 backdrop-blur-md">
            Before
          </div>
          <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/75 backdrop-blur-md">
            After
          </div>

          <input
            aria-label="Before after slider"
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      </div>
    </section>
  );
}
