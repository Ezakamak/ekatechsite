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
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-[100] inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-black/75 px-2.5 text-sm font-medium text-white shadow-[0_0_28px_rgba(0,212,255,0.22)] backdrop-blur-xl transition-all duration-300 [position:fixed] hover:scale-105 hover:border-[#00D4FF]/50 hover:bg-black/90 lg:px-3.5 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
        <ArrowUp className="h-4 w-4" />
      </span>
      <span className="hidden lg:inline">{tr ? "Yukarı" : "Back"}</span>
    </button>
  );
}
