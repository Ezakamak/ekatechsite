import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      window.cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        const page = document.documentElement;
        const scrollableHeight = page.scrollHeight - window.innerHeight;
        const currentProgress =
          scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;

        setProgress(Math.min(Math.max(currentProgress, 0), 100));
      });
    };

    updateProgress();

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] h-[3px] pointer-events-none bg-transparent">
      <div
        className="h-full rounded-r-full bg-[linear-gradient(90deg,#00D4FF,#8B5CF6,#ffffff)] shadow-[0_0_18px_rgba(0,212,255,0.65)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
