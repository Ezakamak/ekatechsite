import { useEffect, useLayoutEffect } from "react";
import { useLanguage } from "../i18n";
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

function parsePolylinePoints(points: string) {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    })
    .filter(Boolean) as Array<{ x: number; y: number }>;
}

function parseLocaleNumber(raw: string | null) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1;
    normalized = decimals > 0 && decimals <= 2 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const decimals = cleaned.length - lastDot - 1;
    normalized = decimals > 0 && decimals <= 2 ? cleaned : cleaned.replace(/\./g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractChartBounds(card: HTMLElement) {
  const text = card.textContent || "";
  const highMatch = text.match(/(?:Grafik zirvesi|Chart high|High price)\s*([\d.,]+)/i);
  const lowMatch = text.match(/(?:Grafik dibi|Chart low|Low price)\s*([\d.,]+)/i);
  return {
    high: parseLocaleNumber(highMatch?.[1] || null),
    low: parseLocaleNumber(lowMatch?.[1] || null),
  };
}

function detectChartRange(card: HTMLElement, panel?: HTMLElement | null) {
  const datasetRange = panel?.dataset.chartRange;
  if (datasetRange === "daily" || datasetRange === "weekly" || datasetRange === "hourly") return datasetRange;
  const activeButton = Array.from(card.querySelectorAll("button")).find((button) => {
    const text = button.textContent || "";
    return /Saatlik|Hourly|Günlük|Daily|Haftalık|Weekly/i.test(text) && button.className.includes("bg-white");
  });
  const label = activeButton?.textContent || "";
  if (/Günlük|Daily/i.test(label)) return "daily";
  if (/Haftalık|Weekly/i.test(label)) return "weekly";
  return "hourly";
}

function getPointDate(index: number, total: number, range: string, panel?: HTMLElement | null) {
  const timestamps = String(panel?.dataset.chartTimestamps || "")
    .split("|")
    .filter(Boolean);
  const stampedDate = timestamps[index] ? new Date(timestamps[index]) : null;
  if (stampedDate && Number.isFinite(stampedDate.getTime())) return stampedDate;

  const date = new Date();
  const distance = Math.max(0, total - 1 - index);
  const spanMs =
    range === "weekly"
      ? 7 * 24 * 60 * 60_000
      : range === "daily"
        ? 24 * 60 * 60_000
        : 60 * 60_000;
  const stepMs = total > 1 ? spanMs / (total - 1) : 0;
  date.setTime(date.getTime() - distance * stepMs);
  return date;
}

function removeChartInspector() {
  document.querySelectorAll(".eka-chart-point-marker, .eka-chart-point-tooltip").forEach((node) => node.remove());
}

function InvestSimChartPointInspector() {
  const { language } = useLanguage();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const svg = target?.closest?.(".eka-range-panel svg") as SVGSVGElement | null;
      if (!svg) return;

      const panel = svg.closest(".eka-range-panel") as HTMLElement | null;
      const card = panel?.parentElement as HTMLElement | null;
      const polyline = svg.querySelector("polyline");
      const rawPoints = polyline?.getAttribute("points") || "";
      const points = parsePolylinePoints(rawPoints);
      if (!panel || !card || points.length === 0) return;

      const rect = svg.getBoundingClientRect();
      const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const nearest = points.reduce((best, point, index) => {
        const distance = Math.abs(point.x - viewX);
        return distance < best.distance ? { point, index, distance } : best;
      }, { point: points[0], index: 0, distance: Number.POSITIVE_INFINITY });

      const bounds = extractChartBounds(card);
      const high = bounds.high ?? 0;
      const low = bounds.low ?? high;
      const value = high !== low ? low + ((160 - nearest.point.y) / 130) * (high - low) : high;
      const range = detectChartRange(card, panel);
      const date = getPointDate(nearest.index, points.length, range, panel);
      const locale = language === "tr" ? "tr-TR" : "en-US";
      const dateText = new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
      const valueText = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

      removeChartInspector();
      panel.style.position = "relative";

      const marker = document.createElement("div");
      marker.className = "eka-chart-point-marker";
      marker.style.left = `${nearest.point.x}%`;
      marker.style.top = `${(nearest.point.y / 180) * 100}%`;

      const tooltip = document.createElement("div");
      tooltip.className = "eka-chart-point-tooltip";
      tooltip.style.left = `${Math.min(78, Math.max(4, nearest.point.x))}%`;
      tooltip.style.top = `${Math.min(72, Math.max(8, (nearest.point.y / 180) * 100))}%`;
      tooltip.innerHTML = `
        <div class="eka-chart-tooltip-title">${language === "tr" ? "Seçili nokta" : "Selected point"}</div>
        <div>${language === "tr" ? "Tarih/Saat" : "Date/Time"}: <strong>${dateText}</strong></div>
        <div>${language === "tr" ? "Değer" : "Value"}: <strong>${valueText} Tech Coin</strong></div>
      `;

      panel.appendChild(marker);
      panel.appendChild(tooltip);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      removeChartInspector();
    };
  }, [language]);

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

      .eka-investsim .eka-range-panel {
        cursor: crosshair;
      }

      .eka-chart-point-marker {
        position: absolute;
        z-index: 20;
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        border: 2px solid rgba(255,255,255,.95);
        background: rgba(34,211,238,.95);
        box-shadow: 0 0 0 6px rgba(34,211,238,.18), 0 0 28px rgba(34,211,238,.45);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      .eka-chart-point-tooltip {
        position: absolute;
        z-index: 21;
        min-width: 210px;
        max-width: 260px;
        border-radius: 1.25rem;
        border: 1px solid rgba(103,232,249,.24);
        background: rgba(0,0,0,.86);
        padding: .8rem .95rem;
        color: rgba(255,255,255,.82);
        font-size: .78rem;
        line-height: 1.55;
        box-shadow: 0 24px 70px rgba(0,0,0,.45), 0 0 30px rgba(34,211,238,.12);
        backdrop-filter: blur(16px);
        transform: translate(-12px, -100%);
        pointer-events: none;
      }

      .eka-chart-tooltip-title {
        margin-bottom: .25rem;
        color: rgb(165,243,252);
        font-size: .68rem;
        font-weight: 700;
        letter-spacing: .14em;
        text-transform: uppercase;
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
      <InvestSimChartPointInspector />
      <InvestSimVisualFixes />
      <MarketStockCommentsDock />
    </>
  );
}
