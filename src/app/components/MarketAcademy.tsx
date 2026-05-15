import { useEffect } from "react";
import { MarketAcademy as MarketAcademyV2 } from "./MarketAcademyV2";
import { MarketStockCommentsDock } from "./MarketStockCommentsDock";
import { MarketStockSubmissionPanel } from "./MarketStockSubmissionPanel";

function InvestSimVisualFixes() {
  useEffect(() => {
    return undefined;
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
