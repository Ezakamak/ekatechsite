import { motion } from "motion/react";
import { Activity, CheckCircle2, Cpu, Headphones, Rocket } from "lucide-react";
import { useLanguage } from "../i18n";

export function SystemStatus() {
  const { language } = useLanguage();
  const tr = language === "tr";

  const copy = tr
    ? {
        eyebrow: "Canlı sistem durumu",
        title: "EkaTech sinyalleri hazır.",
        subtitle: "Küçük ama premium bir sistem paneli: destek, AI core, deploy ve yanıt katmanı aktif görünüyor.",
        items: [
          { icon: Cpu, label: "AI Core", value: "Online" },
          { icon: Headphones, label: "Destek", value: "Aktif" },
          { icon: Rocket, label: "Deploy", value: "Hazır" },
          { icon: Activity, label: "Yanıt", value: "Hızlı" },
        ],
      }
    : {
        eyebrow: "Live system status",
        title: "EkaTech signals are ready.",
        subtitle: "A small premium status panel: support, AI core, deploy and response layer are shown as active.",
        items: [
          { icon: Cpu, label: "AI Core", value: "Online" },
          { icon: Headphones, label: "Support", value: "Active" },
          { icon: Rocket, label: "Deployment", value: "Ready" },
          { icon: Activity, label: "Response", value: "Fast" },
        ],
      };

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.12),transparent_45%)]" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-3xl text-center"
        >
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-white/40">{copy.eyebrow}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-4">
          {copy.items.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/10">
                    <Icon className="h-5 w-5 text-[#00D4FF]" />
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </div>
                <p className="text-sm uppercase tracking-[0.22em] text-white/35">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{item.value}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
