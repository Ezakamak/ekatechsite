import { useEffect, useLayoutEffect } from "react";
import { useLanguage } from "../i18n";
import { MarketAcademy as MarketAcademyV2 } from "./MarketAcademyV2";
import { MarketStockCommentsDock } from "./MarketStockCommentsDock";
import { MarketStockSubmissionPanel } from "./MarketStockSubmissionPanel";

const MARKET_GET_CACHE_MS = 300_000;
let originalFetch: typeof window.fetch | null = null;
let marketCache: { at: number; body: string; init: ResponseInit } | null = null;
let marketGateUsers = 0;

const TECHNICAL_CONNECTION_TEXTS = [
  "Online market API şu an cevap vermedi. Al/sat işlemleri devre dışı.",
  "The online market API did not respond. Trading is disabled.",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Sunucuya bağlanılıyor, lütfen bekleyiniz...",
  "Connecting to server, please wait...",
];

function isMarketGetRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof window === "undefined") return false;
  const rawUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = new URL(rawUrl, window.location.origin);
  return method === "GET" && url.pathname === "/api/market";
}

function InvestSimMarketRequestGate() {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    marketGateUsers += 1;

    if (!originalFetch) {
      originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!isMarketGetRequest(input, init) || !originalFetch) return fetch(input, init);

        const now = Date.now();
        if (marketCache && now - marketCache.at < MARKET_GET_CACHE_MS) {
          return new Response(marketCache.body, marketCache.init);
        }

        const response = await originalFetch(input, init);
        if (response.ok) {
          const clone = response.clone();
          const body = await clone.text();
          marketCache = {
            at: now,
            body,
            init: {
              status: response.status,
              statusText: response.statusText,
              headers: Array.from(response.headers.entries()),
            },
          };
        }
        return response;
      };
    }

    return () => {
      marketGateUsers -= 1;
      if (marketGateUsers <= 0 && originalFetch) {
        window.fetch = originalFetch;
        originalFetch = null;
        marketCache = null;
        marketGateUsers = 0;
      }
    };
  }, []);

  return null;
}

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
      <InvestSimMarketRequestGate />
      <MarketAcademyV2 />
      <MarketStockSubmissionPanel />
      <InvestSimVisualFixes />
      <MarketStockCommentsDock />
    </>
  );
}
