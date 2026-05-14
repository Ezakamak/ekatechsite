import { useEffect, useRef } from "react";

const ENTER_LABELS = ["maça gir", "enter match"];
const LIVE_MARKERS = ["live", "canlı maç", "in_progress"];
const GAME_PATHS = ["/off", "/core-clash"];

function isGamePath() {
  return GAME_PATHS.some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function normalize(text?: string | null) {
  return (text || "").trim().toLowerCase();
}

function isEnterButton(button: HTMLButtonElement) {
  const text = normalize(button.textContent);
  return ENTER_LABELS.some((label) => text === label || text.includes(label));
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function getLobbyCard(button: HTMLElement) {
  return button.closest(".rounded-3xl.border") || button.closest("section") || button.parentElement;
}

function isLiveCard(card: Element | null) {
  const text = normalize(card?.textContent);
  return LIVE_MARKERS.some((marker) => text.includes(marker));
}

export function AutoEnterLobbies() {
  const clickedLobbyRef = useRef<string>("");
  const lastClickAtRef = useRef(0);

  useEffect(() => {
    const scan = () => {
      if (!isGamePath()) return;

      const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
      const target = buttons.find((button) => {
        if (button.disabled || !isVisible(button) || !isEnterButton(button)) return false;
        return isLiveCard(getLobbyCard(button));
      });

      if (!target) return;

      const card = getLobbyCard(target);
      const fingerprint = normalize(card?.textContent).slice(0, 320);
      const now = Date.now();

      if (fingerprint && clickedLobbyRef.current === fingerprint) return;
      if (now - lastClickAtRef.current < 1800) return;

      clickedLobbyRef.current = fingerprint;
      lastClickAtRef.current = now;
      target.click();
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(scan, 900);
    window.addEventListener("ekatech-route-change", scan);
    window.addEventListener("popstate", scan);
    window.setTimeout(scan, 350);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("ekatech-route-change", scan);
      window.removeEventListener("popstate", scan);
    };
  }, []);

  return null;
}
