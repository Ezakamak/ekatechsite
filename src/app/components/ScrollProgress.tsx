import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      if (animationFrame) return;

      animationFrame = window.requestAnimationFrame(() => {
        const page = document.documentElement;
        const scrollableHeight = page.scrollHeight - window.innerHeight;
        const currentProgress =
          scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;
        const safeProgress = Math.min(Math.max(currentProgress, 0), 100);

        if (barRef.current) {
          barRef.current.style.transform = `scaleX(${safeProgress / 100})`;
        }

        animationFrame = 0;
      });
    };

    updateProgress();

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    document.addEventListener("scroll", updateProgress, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      document.removeEventListener("scroll", updateProgress);
    };
  }, []);

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] h-[3px] pointer-events-none bg-transparent">
      <div
        ref={barRef}
        className="h-full origin-left rounded-r-full bg-[linear-gradient(90deg,#00D4FF,#8B5CF6,#ffffff)] shadow-[0_0_18px_rgba(0,212,255,0.65)] will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
