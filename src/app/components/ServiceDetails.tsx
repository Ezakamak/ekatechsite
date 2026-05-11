import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Code2, LayoutDashboard, MessageSquare, X } from "lucide-react";
import { useLanguage } from "../i18n";

const icons = [Code2, Bot, LayoutDashboard, MessageSquare];

export function ServiceDetails() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const copy = tr
    ? {
        eyebrow: "Servis detayları",
        title: "Neyi inşa edebiliriz?",
        subtitle: "Her hizmet kartına tıkla ve EkaTech’in o alanda nasıl değer üretebileceğini gör.",
        close: "Kapat",
        details: "Detaylar",
        items: [
          {
            title: "Premium Web Siteleri",
            short: "Hızlı, şık ve modern marka deneyimleri.",
            bullets: ["Landing page", "Kurumsal site", "Portfolio", "Performans odaklı arayüz"],
          },
          {
            title: "AI Otomasyon",
            short: "Tekrar eden işleri akıllı sistemlere dönüştür.",
            bullets: ["E-posta akışları", "Destek yönlendirme", "Raporlama", "Veri temizleme"],
          },
          {
            title: "Dashboard Sistemleri",
            short: "Veriyi anlaşılır ve yönetilebilir hale getir.",
            bullets: ["Analitik paneller", "Admin arayüzleri", "Performans takibi", "İş akışı görünürlüğü"],
          },
          {
            title: "Chatbot Entegrasyonu",
            short: "Ziyaretçiyi karşılayan akıllı destek katmanı.",
            bullets: ["Canlı destek", "Hazır cevaplar", "Lead toplama", "Tawk.to entegrasyonu"],
          },
        ],
      }
    : {
        eyebrow: "Service details",
        title: "What can we build?",
        subtitle: "Click any service card and see how EkaTech can create value in that area.",
        close: "Close",
        details: "Details",
        items: [
          {
            title: "Premium Websites",
            short: "Fast, elegant and modern brand experiences.",
            bullets: ["Landing page", "Business website", "Portfolio", "Performance-focused UI"],
          },
          {
            title: "AI Automation",
            short: "Turn repetitive work into intelligent systems.",
            bullets: ["Email workflows", "Support routing", "Reporting", "Data cleanup"],
          },
          {
            title: "Dashboard Systems",
            short: "Make data understandable and manageable.",
            bullets: ["Analytics panels", "Admin interfaces", "Performance tracking", "Workflow visibility"],
          },
          {
            title: "Chatbot Integration",
            short: "A smart support layer that welcomes visitors.",
            bullets: ["Live support", "Quick replies", "Lead capture", "Tawk.to integration"],
          },
        ],
      };

  const active = activeIndex === null ? null : copy.items[activeIndex];
  const ActiveIcon = activeIndex === null ? null : icons[activeIndex];

  return (
    <section id="services" className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(0,212,255,0.14),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.15),transparent_36%)]" />
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

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {copy.items.map((item, index) => {
            const Icon = icons[index];
            return (
              <button
                key={item.title}
                onClick={() => setActiveIndex(index)}
                className="group rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-left backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-[#00D4FF]/35 hover:bg-white/[0.06]"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/10">
                  <Icon className="h-6 w-6 text-[#00D4FF]" />
                </div>
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/50">{item.short}</p>
                <p className="mt-6 text-sm text-[#00D4FF]">{copy.details} →</p>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {active && ActiveIcon && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-6 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveIndex(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-black p-8 shadow-[0_0_90px_rgba(0,212,255,0.18)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.12),transparent_60%)]" />
              <div className="relative">
                <button
                  onClick={() => setActiveIndex(null)}
                  className="absolute right-0 top-0 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white"
                  aria-label={copy.close}
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/10">
                  <ActiveIcon className="h-7 w-7 text-[#00D4FF]" />
                </div>
                <h3 className="text-3xl font-semibold tracking-[-0.04em] text-white">{active.title}</h3>
                <p className="mt-3 text-white/55">{active.short}</p>

                <div className="mt-8 space-y-3">
                  {active.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-white/70">
                      <span className="h-2 w-2 rounded-full bg-[#00D4FF] shadow-[0_0_14px_rgba(0,212,255,0.8)]" />
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
