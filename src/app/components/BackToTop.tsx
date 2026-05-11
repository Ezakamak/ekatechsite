import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
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
      aria-label="Back to top"
      className={`fixed bottom-24 left-6 z-[90] flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-3 text-sm font-medium text-white shadow-[0_0_34px_rgba(0,212,255,0.24)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-[#00D4FF]/50 hover:bg-black/90 md:bottom-8 md:left-8 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
        <ArrowUp className="h-4 w-4" />
      </span>
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
