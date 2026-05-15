import { useEffect } from "react";
import { MarketAcademy as MarketAcademyV2 } from "./MarketAcademyV2";
import { MarketStockCommentsDock } from "./MarketStockCommentsDock";
import { MarketStockSubmissionPanel } from "./MarketStockSubmissionPanel";

const TECHNICAL_CONNECTION_TEXTS = [
  "Online market API şu an cevap vermedi. Al/sat işlemleri devre dışı.",
  "The online market API did not respond. Trading is disabled.",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
];

function normalizeInvestSimConnectionText() {
  if (typeof document === "undefined") return;

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
    const original = node.nodeValue || "";
    const isEnglish = original.includes("The online market API") || original.includes("Failed to fetch") || original.includes("NetworkError");
    node.nodeValue = isEnglish ? "Connecting to server, please wait..." : "Sunucuya bağlanılıyor, lütfen bekleyiniz...";
  }
}

function InvestSimVisualFixes() {
  useEffect(() => {
    normalizeInvestSimConnectionText();
    const observer = new MutationObserver(() => normalizeInvestSimConnectionText());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

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
