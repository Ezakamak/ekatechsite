import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useLanguage } from "../i18n";

export function FAQAccordion() {
  const { language } = useLanguage();
  const [openIndex, setOpenIndex] = useState(0);
  const tr = language === "tr";

  const copy = tr
    ? {
        eyebrow: "Sık sorulan sorular",
        title: "Başlamadan önce bilmen gerekenler.",
        subtitle: "Süreç, otomasyon, bakım ve proje başlangıcı hakkında kısa cevaplar.",
        items: [
          {
            q: "Bir proje ne kadar sürer?",
            a: "Basit bir landing page birkaç gün içinde çıkabilir. Daha kapsamlı web uygulamaları, otomasyon sistemleri veya dashboard projeleri genelde 2–4 hafta aralığında planlanır.",
          },
          {
            q: "AI otomasyon geliştirebilir misiniz?",
            a: "Evet. E-posta iş akışları, müşteri destek yönlendirme, raporlama, veri temizleme ve tekrar eden operasyonel işleri otomatikleştiren sistemler tasarlanabilir.",
          },
          {
            q: "Yayın sonrası bakım olur mu?",
            a: "Evet. Performans kontrolü, küçük güncellemeler, içerik değişimleri ve teknik düzenlemeler için bakım paketi oluşturulabilir.",
          },
          {
            q: "Projeye nasıl başlarız?",
            a: "Önce ihtiyacı netleştiririz. Hedef, kapsam, zaman çizelgesi ve istenen özellikler belirlendikten sonra en uygun yol haritası çıkarılır.",
          },
        ],
      }
    : {
        eyebrow: "FAQ",
        title: "What you should know before starting.",
        subtitle: "Short answers about process, automation, maintenance and project kickoff.",
        items: [
          {
            q: "How long does a project take?",
            a: "A simple landing page can be shipped in a few days. Larger web apps, automation systems or dashboard projects are usually planned around a 2–4 week timeline.",
          },
          {
            q: "Can you build AI automations?",
            a: "Yes. We can design systems for email workflows, support routing, reporting, data cleanup and repetitive operational work.",
          },
          {
            q: "Do you offer support after launch?",
            a: "Yes. Maintenance can include performance checks, small updates, content changes and technical improvements after launch.",
          },
          {
            q: "How do we start?",
            a: "We first clarify the need. After the goal, scope, timeline and requested features are defined, a clean project roadmap can be created.",
          },
        ],
      };

  return (
    <section id="faq" className="relative overflow-hidden bg-gray-950 px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(139,92,246,0.16),transparent_38%)]" />
      <div className="relative mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55 backdrop-blur-md">
            <HelpCircle className="h-4 w-4 text-[#00D4FF]" />
            {copy.eyebrow}
          </div>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
        </motion.div>

        <div className="space-y-4">
          {copy.items.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.q} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 p-6 text-left"
                >
                  <span className="text-lg font-medium text-white">{item.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28 }}
                    >
                      <p className="px-6 pb-6 text-sm leading-7 text-white/55">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
