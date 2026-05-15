import { MarketAcademy as MarketAcademyV2 } from "./MarketAcademyV2";
import { MarketStockCommentsDock } from "./MarketStockCommentsDock";

function InvestSimVisualFixes() {
  return (
    <style>{`
      .eka-investsim .eka-pulse-dot {
        display: none !important;
        animation: none !important;
        transform: none !important;
      }
    `}</style>
  );
}

export function MarketAcademy() {
  return (
    <>
      <MarketAcademyV2 />
      <InvestSimVisualFixes />
      <MarketStockCommentsDock />
    </>
  );
}
