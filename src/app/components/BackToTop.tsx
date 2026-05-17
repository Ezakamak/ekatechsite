import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLanguage } from "../i18n";

export function BackToTop() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 700);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={tr ? "Yukarı dön" : "Back to top"}
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-[2147483000] flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-3 text-sm font-medium text-white shadow-[0_0_34px_rgba(0,212,255,0.24)] backdrop-blur-xl transition-all duration-300 [position:fixed] hover:scale-105 hover:border-[#00D4FF]/50 hover:bg-black/90 md:bottom-[calc(env(safe-area-inset-bottom)+2rem)] md:left-[calc(env(safe-area-inset-left)+2rem)] ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
        <ArrowUp className="h-4 w-4" />
      </span>
      <span className="hidden sm:inline">{tr ? "Yukarı" : "Back"}</span>
    </button>
  );
}
