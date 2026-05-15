import { useEffect, useLayoutEffect } from "react";
import { MarketAcademy as MarketAcademyV2 } from "./MarketAcademyV2";
import { MarketStockCommentsDock } from "./MarketStockCommentsDock";
import { MarketStockSubmissionPanel } from "./MarketStockSubmissionPanel";

let originalFetch: typeof window.fetch | null = null;
let redirectUsers = 0;

function isInvestSimMarketRequest(input: RequestInfo | URL) {
  if (typeof window === "undefined") return false;
  const rawUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const url = new URL(rawUrl, window.location.origin);
  return url.pathname === "/api/market";
}

function rewriteMarketRequest(input: RequestInfo | URL) {
  const rawUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const url = new URL(rawUrl, window.location.origin);
  url.pathname = "/api/market-safe";

  if (input instanceof Request) {
    return new Request(url.toString(), input);
  }

  return url.toString();
}

function InvestSimSafeMarketEndpoint() {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    redirectUsers += 1;

    if (!originalFetch) {
      originalFetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const safeFetch = originalFetch || window.fetch.bind(window);
        if (!isInvestSimMarketRequest(input)) return safeFetch(input, init);
        return safeFetch(rewriteMarketRequest(input), init);
      };
    }

    return () => {
      redirectUsers -= 1;
      if (redirectUsers <= 0 && originalFetch) {
        window.fetch = originalFetch;
        originalFetch = null;
        redirectUsers = 0;
      }
    };
  }, []);

  return null;
}

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
      <InvestSimSafeMarketEndpoint />
      <MarketAcademyV2 />
      <MarketStockSubmissionPanel />
      <InvestSimVisualFixes />
      <MarketStockCommentsDock />
    </>
  );
}
