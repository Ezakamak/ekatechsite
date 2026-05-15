import { useEffect } from "react";
import { useLanguage } from "../i18n";
import { MarketAcademy as MarketAcademyV2 } from "./MarketAcademyV2";
import { MarketStockCommentsDock } from "./MarketStockCommentsDock";
import { MarketStockSubmissionPanel } from "./MarketStockSubmissionPanel";

const TECHNICAL_CONNECTION_TEXTS = [
  "Online market API şu an cevap vermedi. Al/sat işlemleri devre dışı.",
  "The online market API did not respond. Trading is disabled.",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Sunucuya bağlanılıyor, lütfen bekleyiniz...",
  "Connecting to server, please wait...",
];

function normalizeInvestSimConnectionText(language: string) {
  if (typeof document === "undefined") return;

  const fallback = language === "tr" ? "Sunucuya bağlanılıyor, lütfen bekleyiniz..." : "Connecting to server, please wait...";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    if (current.nodeValue && TECHNICAL_CONNECTION_TEXTS.some((text) => current?.nodeValue?.includes(text))) {
      nodes.push(current as Text);
    }
    current = walker.nextNode();
  }

  for (const node of nodes) {
    node.nodeValue = fallback;
  }
}

function InvestSimVisualFixes() {
  const { language } = useLanguage();

  useEffect(() => {
    normalizeInvestSimConnectionText(language);
    const observer = new MutationObserver(() => normalizeInvestSimConnectionText(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return (
    <style>{`
      .eka-investsim .eka-pulse-dot {
        display: none !important;
        animation: none !important;
        transform: none !important;
      }

      .eka-investsim .eka-draw-line {
        stroke-dasharray: none !important;
        stroke-dashoffset: 0 !important;
        animation: none !important;
      }
    `}</style>
  );
}

export function MarketAcademy() {
  return (
    <>
      <MarketAcademyV2 />
      <MarketStockSubmissionPanel />
      <InvestSimVisualFixes />
      <MarketStockCommentsDock />
    </>
  );
}
