import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "../i18n";

type Option = {
  id: string;
  en: string;
  tr: string;
  value: number;
};

const projectTypes: Option[] = [
  { id: "website", en: "Website", tr: "Web Sitesi", value: 600 },
  { id: "automation", en: "AI Automation", tr: "AI Otomasyon", value: 900 },
  { id: "dashboard", en: "Dashboard", tr: "Dashboard", value: 800 },
  { id: "chatbot", en: "Chatbot", tr: "Chatbot", value: 500 },
  { id: "branding", en: "Branding", tr: "Marka Tasarımı", value: 400 },
  { id: "maintenance", en: "Maintenance", tr: "Bakım", value: 300 },
];

const timelines: Option[] = [
  { id: "fast", en: "1 week", tr: "1 hafta", value: 350 },
  { id: "normal", en: "2–4 weeks", tr: "2–4 hafta", value: 150 },
  { id: "flexible", en: "Flexible", tr: "Esnek", value: 0 },
];

const complexity: Option[] = [
  { id: "starter", en: "Starter", tr: "Başlangıç", value: 0 },
  { id: "premium", en: "Premium", tr: "Premium", value: 450 },
  { id: "custom", en: "Custom", tr: "Özel", value: 900 },
];

export function ProjectEstimator() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["website"]);
  const [timeline, setTimeline] = useState("normal");
  const [level, setLevel] = useState("premium");

  const copy = tr
    ? {
        eyebrow: "Proje maliyet simülatörü",
        title: "Fikrinin yaklaşık kapsamını hesapla.",
        subtitle: "İhtiyacını seç, zaman çizelgesini belirle ve EkaTech tarzı bir projenin yaklaşık aralığını gör.",
        need: "Ne gerekiyor?",
        time: "Teslim süresi",
        complexity: "Seviye",
        range: "Tahmini aralık",
        recommended: "Önerilen plan",
        recommendedValue: "Premium Web Deneyimi",
        note: "Bu gerçek teklif değil; proje kapsamını hızlıca anlamak için demo hesaplayıcıdır.",
        cta: "Proje başlat",
      }
    : {
        eyebrow: "Project cost simulator",
        title: "Estimate the shape of your idea.",
        subtitle: "Select what you need, choose a timeline, and preview the estimated range for an EkaTech-style project.",
        need: "What do you need?",
        time: "Timeline",
        complexity: "Complexity",
        range: "Estimated range",
        recommended: "Recommended plan",
        recommendedValue: "Premium Web Experience",
        note: "This is not a real quote; it is a demo estimator to help understand project scope quickly.",
        cta: "Start your project",
      };

  const totals = useMemo(() => {
    const typeTotal = projectTypes
      .filter((item) => selectedTypes.includes(item.id))
      .reduce((sum, item) => sum + item.value, 0);
    const timelineValue = timelines.find((item) => item.id === timeline)?.value ?? 0;
    const complexityValue = complexity.find((item) => item.id === level)?.value ?? 0;
    const min = Math.max(400, typeTotal + timelineValue + complexityValue);
    const max = min + Math.round(min * 0.65);
    return { min, max };
  }, [selectedTypes, timeline, level]);

  const toggleType = (id: string) => {
    setSelectedTypes((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next.length ? next : current;
      }
      return [...current, id];
    });
  };

  const label = (option: Option) => (tr ? option.tr : option.en);

  return (
    <section id="estimator" className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,212,255,0.16),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(139,92,246,0.18),transparent_38%)]" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55 backdrop-blur-md">
            <Calculator className="h-4 w-4 text-[#00D4FF]" />
            {copy.eyebrow}
          </div>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
            <div className="mb-8">
              <p className="mb-4 text-sm uppercase tracking-[0.28em] text-white/35">{copy.need}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {projectTypes.map((item) => {
                  const active = selectedTypes.includes(item.id);
                  return (
                    <button key={item.id} onClick={() => toggleType(item.id)} className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${active ? "border-[#00D4FF]/40 bg-[#00D4FF]/10 text-white" : "border-white/10 bg-black/25 text-white/55 hover:bg-white/5"}`}>
                      <span>{label(item)}</span>
                      {active && <CheckCircle2 className="h-5 w-5 text-[#00D4FF]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-4 text-sm uppercase tracking-[0.28em] text-white/35">{copy.time}</p>
                <div className="space-y-3">
                  {timelines.map((item) => (
                    <button key={item.id} onClick={() => setTimeline(item.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${timeline === item.id ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white" : "border-white/10 bg-black/25 text-white/55 hover:bg-white/5"}`}>{label(item)}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-4 text-sm uppercase tracking-[0.28em] text-white/35">{copy.complexity}</p>
                <div className="space-y-3">
                  {complexity.map((item) => (
                    <button key={item.id} onClick={() => setLevel(item.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${level === item.id ? "border-[#00D4FF]/50 bg-[#00D4FF]/10 text-white" : "border-white/10 bg-black/25 text-white/55 hover:bg-white/5"}`}>{label(item)}</button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.14),transparent_60%)]" />
            <div className="relative">
              <p className="text-sm uppercase tracking-[0.28em] text-white/35">{copy.range}</p>
              <p className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
                ${totals.min.toLocaleString()} – ${totals.max.toLocaleString()}
              </p>

              <div className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-white/40">{copy.recommended}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{copy.recommendedValue}</p>
              </div>

              <p className="mt-5 text-sm leading-6 text-white/45">{copy.note}</p>

              <a href="#contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] px-6 py-4 font-medium text-white transition-transform hover:scale-[1.02]">
                {copy.cta}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
