import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot,
  Calculator,
  FolderKanban,
  HelpCircle,
  Languages,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useLanguage } from "../i18n";

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  action: () => void;
};

export function CommandMenu() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const tr = language === "tr";

  const scrollTo = (selector: string) => {
    setOpen(false);
    window.setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const commands: Command[] = useMemo(
    () => [
      {
        id: "projects",
        label: tr ? "Projelere git" : "Go to Projects",
        hint: tr ? "Öne çıkan işleri aç" : "Open featured work",
        icon: FolderKanban,
        action: () => scrollTo("#projects"),
      },
      {
        id: "services",
        label: tr ? "Servisleri gör" : "View Services",
        hint: tr ? "Hizmet detaylarını aç" : "Open service details",
        icon: Sparkles,
        action: () => scrollTo("#services"),
      },
      {
        id: "estimator",
        label: tr ? "Maliyet hesaplayıcı" : "Project Cost Estimator",
        hint: tr ? "Proje aralığını hesapla" : "Estimate project range",
        icon: Calculator,
        action: () => scrollTo("#estimator"),
      },
      {
        id: "automation",
        label: tr ? "AI simülatörüne git" : "Run AI Simulator",
        hint: tr ? "Otomasyon demosunu aç" : "Open automation demo",
        icon: Bot,
        action: () => scrollTo("#automation"),
      },
      {
        id: "faq",
        label: tr ? "SSS bölümüne git" : "Open FAQ",
        hint: tr ? "Sık soruları gör" : "View common questions",
        icon: HelpCircle,
        action: () => scrollTo("#faq"),
      },
      {
        id: "contact",
        label: tr ? "İletişime git" : "Open Contact",
        hint: tr ? "Proje başlatma bölümünü aç" : "Open project contact section",
        icon: MessageCircle,
        action: () => scrollTo("#contact"),
      },
      {
        id: "language",
        label: tr ? "Switch to English" : "Türkçeye geç",
        hint: tr ? "Site dilini EN yap" : "Switch site language to TR",
        icon: Languages,
        action: () => {
          setOpen(false);
          setLanguage(tr ? "en" : "tr");
        },
      },
    ],
    [tr, setLanguage]
  );

  const filteredCommands = commands.filter((command) => {
    const value = `${command.label} ${command.hint}`.toLowerCase();
    return value.includes(query.toLowerCase());
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommandKey = event.metaKey || event.ctrlKey;
      if (isCommandKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] hidden items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-3 text-sm text-white/70 shadow-[0_0_30px_rgba(139,92,246,0.18)] backdrop-blur-xl transition-all hover:scale-105 hover:border-[#00D4FF]/40 hover:text-white md:flex"
      >
        <Search className="h-4 w-4" />
        <span>{tr ? "Komut" : "Command"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/40">⌘K</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_0_90px_rgba(0,212,255,0.16)]"
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                <Search className="h-5 w-5 text-[#00D4FF]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoFocus
                  placeholder={tr ? "Komut ara..." : "Search commands..."}
                  className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/30"
                />
                <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[440px] overflow-y-auto p-3">
                {filteredCommands.map((command) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      onClick={command.action}
                      className="flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all hover:bg-white/[0.06]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10">
                        <Icon className="h-5 w-5 text-[#00D4FF]" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{command.label}</p>
                        <p className="mt-1 text-sm text-white/40">{command.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
