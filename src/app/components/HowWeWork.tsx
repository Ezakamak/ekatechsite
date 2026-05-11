import { motion } from "motion/react";
import { Compass, Palette, Code2, Rocket } from "lucide-react";
import { useLanguage } from "../i18n";

const icons = [Compass, Palette, Code2, Rocket];

export function HowWeWork() {
  const { language } = useLanguage();
  const tr = language === "tr";

  const copy = tr
    ? {
        eyebrow: "Çalışma süreci",
        title: "Fikirden yayına net bir yol.",
        subtitle: "Her projeyi anlaşılır, kontrollü ve hızlı ilerleyen bir sisteme böleriz.",
        steps: [
          { title: "Keşif", desc: "Hedefi, problemi ve başarı kriterlerini netleştiririz." },
          { title: "Tasarım", desc: "Premium kullanıcı deneyimi ve güçlü görsel hiyerarşi kurarız." },
          { title: "Geliştirme", desc: "Modern, hızlı ve sürdürülebilir kod yapısıyla ürünü inşa ederiz." },
          { title: "Yayın", desc: "Projeyi yayına alır, performans ve deneyimi kontrol ederiz." },
        ],
      }
    : {
        eyebrow: "How we work",
        title: "A clear path from idea to launch.",
        subtitle: "We break every project into a clean, controlled and fast-moving system.",
        steps: [
          { title: "Discover", desc: "Define the goal, problem and success criteria clearly." },
          { title: "Design", desc: "Create a premium user experience with strong visual hierarchy." },
          { title: "Develop", desc: "Build with a modern, fast and maintainable code structure." },
          { title: "Launch", desc: "Ship the project and check performance, polish and experience." },
        ],
      };

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,212,255,0.10),transparent_45%)]" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mx-auto mb-14 max-w-3xl text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-white/40">{copy.eyebrow}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
        </motion.div>

        <div className="relative grid gap-5 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-16 hidden h-px bg-[linear-gradient(90deg,transparent,rgba(0,212,255,0.5),rgba(139,92,246,0.5),transparent)] md:block" />
          {copy.steps.map((step, index) => {
            const Icon = icons[index];
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: index * 0.1 }}
                className="relative rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055]"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 shadow-[0_0_30px_rgba(0,212,255,0.12)]">
                  <Icon className="h-7 w-7 text-[#00D4FF]" />
                </div>
                <p className="mb-3 text-sm uppercase tracking-[0.25em] text-white/35">0{index + 1}</p>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/50">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
