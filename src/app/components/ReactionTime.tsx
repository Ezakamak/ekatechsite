import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type State = "idle" | "waiting" | "ready" | "result" | "early";

type DriverTier = {
  name: string;
  tier: string;
  note: string;
};

function getDriverTier(ms: number | null, language: "en" | "tr"): DriverTier {
  if (ms === null) return { name: "", tier: "", note: "" };

  const tr = language === "tr";

  if (ms <= 160) {
    return {
      name: "Max Verstappen",
      tier: tr ? "Elit refleks seviyesi" : "Elite reaction tier",
      note: tr ? "Bu inanılmaz hızlıydı." : "That was brutally fast.",
    };
  }

  if (ms <= 220) {
    return {
      name: "Lewis Hamilton",
      tier: tr ? "Şampiyon refleks seviyesi" : "Champion reaction tier",
      note: tr ? "Keskin, temiz ve kontrollü." : "Sharp, clean, and controlled.",
    };
  }

  if (ms <= 260) {
    return {
      name: "Fernando Alonso",
      tier: tr ? "Tecrübeli içgüdü seviyesi" : "Veteran instinct tier",
      note: tr ? "Zeki zamanlama, güçlü refleks." : "Smart timing, strong reflexes.",
    };
  }

  if (ms <= 300) {
    return {
      name: "Charles Leclerc",
      tier: tr ? "Sıralama turu temposu" : "Qualifying pace tier",
      note: tr ? "Tehlikeli görünecek kadar hızlı." : "Fast enough to look dangerous.",
    };
  }

  if (ms <= 340) {
    return {
      name: "Lando Norris",
      tier: tr ? "Hızlı tepki seviyesi" : "Rapid response tier",
      note: tr ? "Akıcı tepki, sağlam tempo." : "Smooth reaction, solid pace.",
    };
  }

  if (ms <= 380) {
    return {
      name: "Carlos Sainz",
      tier: tr ? "İstikrarlı sürücü seviyesi" : "Consistent driver tier",
      note: tr ? "Güvenilir ve dengeli." : "Reliable and steady.",
    };
  }

  return {
    name: "Valtteri Bottas",
    tier: tr ? "Sakin sürücü seviyesi" : "Calm driver tier",
    note: tr ? "Dengeliydi ama sistem bu kez daha hızlıydı." : "Steady, but the system was faster.",
  };
}

export function ReactionTime() {
  const { language } = useLanguage();
  const [state, setState] = useState<State>("idle");
  const [time, setTime] = useState<number | null>(null);

  const timer = useRef<number | null>(null);
  const start = useRef(0);

  const driverTier = getDriverTier(time, language);
  const tr = language === "tr";

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
      const result = Math.round(performance.now() - start.current);
      setTime(result);
      setState("result");
    }
  };

  const bigText =
    state === "waiting"
      ? tr ? "Bekle..." : "Wait..."
      : state === "ready"
        ? tr ? "Tıkla" : "Click"
        : state === "early"
          ? tr ? "Çok erken" : "Too early"
          : state === "result"
            ? `${time} ms`
            : tr ? "Başlat" : "Start";

  const smallText =
    state === "result"
      ? tr ? "Bu kadar hızlı dönüş yapıyoruz." : "We respond this fast."
      : state === "waiting"
        ? tr ? "Panel cyan olana kadar bekle." : "Wait until the panel turns cyan."
        : state === "ready"
          ? tr ? "Şimdi." : "Now."
          : state === "early"
            ? tr ? "Sinyalden sonra tekrar dene." : "Try again after the signal."
            : tr ? "Refleks hızını test et." : "Test your reaction time.";

  const copy = tr
    ? {
        eyebrow: "Canlı tepki demosu",
        title: "Bu kadar hızlı dönüş yapıyoruz.",
        subtitle: "Panel cyan olduğunda tıkla ve tepki süreni gör. Sonucun bir Formula 1 sürücü seviyesiyle eşleşir.",
        reaction: "Tepki hızı",
        match: "F1 eşleşmen",
        youAre: "Sen",
        start: "Testi başlat",
        wait: "Tıklama",
        click: "Şimdi tıkla",
        again: "Tekrar dene",
      }
    : {
        eyebrow: "Live response demo",
        title: "We respond this fast.",
        subtitle: "When the panel turns cyan, click it and see your reaction time. Your result gets matched with a Formula 1 driver tier.",
        reaction: "Reaction speed",
        match: "Your F1 match",
        youAre: "You are",
        start: "Start test",
        wait: "Do not click",
        click: "Click now",
        again: "Try again",
      };

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
            {copy.eyebrow}
          </p>

          <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            {copy.title}
          </h2>

          <p className="mt-5 max-w-xl text-lg leading-8 text-white/55">
            {copy.subtitle}
          </p>
        </motion.div>

        <motion.button
          onClick={press}
          className={`relative min-h-[370px] overflow-hidden rounded-[2rem] border p-8 text-center backdrop-blur-xl transition-all active:scale-[0.98] ${
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_50%)]" />

          <span className="relative z-10 block text-sm uppercase tracking-[0.35em] text-white/45">
            {copy.reaction}
          </span>

          <motion.span
            key={bigText}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
            className="relative z-10 mt-5 block text-5xl font-semibold tracking-[-0.04em] text-white"
          >
            {bigText}
          </motion.span>

          <span className="relative z-10 mx-auto mt-4 block max-w-sm text-sm leading-6 text-white/55">
            {smallText}
          </span>

          {state === "result" && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 mx-auto mt-6 max-w-sm rounded-2xl border border-white/10 bg-black/35 px-5 py-4"
            >
              <p className="text-xs uppercase tracking-[0.28em] text-white/35">
                {copy.match}
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                {copy.youAre} {driverTier.name}.
              </p>

              <p className="mt-2 text-sm text-[#00D4FF]">{driverTier.tier}</p>
              <p className="mt-1 text-sm text-white/45">{driverTier.note}</p>
            </motion.div>
          )}

          <span className="relative z-10 mt-8 inline-flex rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white/70">
            {state === "idle" ? copy.start : state === "waiting" ? copy.wait : state === "ready" ? copy.click : copy.again}
          </span>
        </motion.button>
      </div>
    </section>
  );
}
