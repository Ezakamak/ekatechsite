import { useEffect } from "react";
import { CoreClash as CoreClashBase } from "./CoreClashSequential";
import { CoreClashBotAssist } from "./CoreClashBotAssist";

const DEFENSE_TERMS = [
  "firewall",
  "core shield",
  "static field",
  "false firewall",
  "defense",
  "kalkan",
  "koruma",
  "savunma",
  "engeller",
  "engelledi",
];

const HEAL_TERMS = [
  "emergency patch",
  "full restore",
  "heal",
  "restore",
  "yenile",
  "yenileniyor",
  "iyileş",
  "iyiles",
];

const DAMAGE_TERMS = ["hasar", "damage", "drains", "azalıyor"];

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function getHpPanel(label: Element) {
  const statBox = label.parentElement;
  const panel = statBox?.closest(".relative.overflow-hidden.rounded-3xl.border.p-4");
  const valueNode = Array.from(statBox?.children || []).find((child) => /^\d+$/.test(child.textContent?.trim() || ""));
  const value = Number(valueNode?.textContent?.trim() || NaN);
  return Number.isFinite(value) && panel ? { panel, value } : null;
}

function flash(element: Element, className: string, duration = 1000) {
  element.classList.remove(className);
  void (element as HTMLElement).offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

export function CoreClash() {
  useEffect(() => {
    const previousHp = new WeakMap<Element, number>();
    const delayedTimers: number[] = [];
    let lastDefenseText = "";
    let guardedDamageWindowUntil = 0;

    const delayedFlash = (element: Element, className: string, delay: number, duration = 900) => {
      const timer = window.setTimeout(() => flash(element, className, duration), delay);
      delayedTimers.push(timer);
    };

    const scan = () => {
      const banners = Array.from(document.querySelectorAll(".fixed.inset-x-0.top-28"));
      let defenseActive = false;
      let guardedDamageActive = false;

      banners.forEach((banner) => {
        const text = (banner.textContent || "").toLowerCase();
        const healing = hasAny(text, HEAL_TERMS);
        const defending = !healing && hasAny(text, DEFENSE_TERMS);
        const damageMentioned = !healing && hasAny(text, DAMAGE_TERMS);
        const guardedDamage = defending && damageMentioned;
        const damaging = !healing && !defending && damageMentioned;

        banner.classList.toggle("core-clash-heal-flow", healing);
        banner.classList.toggle("core-clash-defense-flow", defending && !guardedDamage);
        banner.classList.toggle("core-clash-guarded-damage-flow", guardedDamage);
        banner.classList.toggle("core-clash-damage-flow", damaging);

        if (guardedDamage) {
          defenseActive = true;
          guardedDamageActive = true;
          guardedDamageWindowUntil = Date.now() + 1500;
        }

        if (defending && !guardedDamage) {
          defenseActive = true;
          if (text !== lastDefenseText) {
            lastDefenseText = text;
            const panels = Array.from(document.querySelectorAll(".relative.overflow-hidden.rounded-3xl.border.p-4")).slice(0, 2);
            panels.forEach((panel) => flash(panel, "core-clash-defense-panel", 900));
          }
        }
      });

      if (!defenseActive) lastDefenseText = "";

      const hpLabels = Array.from(document.querySelectorAll("p")).filter((node) => {
        const value = node.textContent?.trim().toLowerCase();
        return value === "core hp" || value === "hp";
      });

      hpLabels.forEach((label) => {
        const entry = getHpPanel(label);
        if (!entry) return;

        const before = previousHp.get(entry.panel);
        previousHp.set(entry.panel, entry.value);

        if (typeof before !== "number") return;

        if (entry.value > before) {
          flash(entry.panel, "core-clash-heal-panel", 1200);
          return;
        }

        if (entry.value < before && (guardedDamageActive || Date.now() < guardedDamageWindowUntil)) {
          flash(entry.panel, "core-clash-shield-before-damage-panel", 650);
          delayedFlash(entry.panel, "core-clash-delayed-damage-panel", 560, 950);
        }
      });
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    const interval = window.setInterval(scan, 180);
    scan();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      delayedTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <>
      <CoreClashBase />
      <CoreClashBotAssist />
    </>
  );
}
