import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "../i18n";

type SoundKey =
  | "click"
  | "hover"
  | "success"
  | "error"
  | "coin"
  | "buy"
  | "sell"
  | "join"
  | "bot"
  | "ready"
  | "countdown"
  | "round"
  | "win"
  | "lose"
  | "draw"
  | "card"
  | "damage"
  | "heal"
  | "shield"
  | "code"
  | "market"
  | "notify";

type SoundConfig = {
  name: string;
  volume: number;
  paths: string[];
};

const STORAGE_KEY = "ekatech_off_sound_enabled";
const SOUND_BASE = "/sounds/off";

const SOUND_LIBRARY: Record<SoundKey, SoundConfig> = {
  click: { name: "UI Click", volume: 0.35, paths: ["click.mp3", "click.ogg", "ui-click.mp3", "button.mp3"] },
  hover: { name: "Hover", volume: 0.18, paths: ["hover.mp3", "hover.ogg", "soft-hover.mp3"] },
  success: { name: "Success", volume: 0.42, paths: ["success.mp3", "success.ogg", "complete.mp3"] },
  error: { name: "Error", volume: 0.38, paths: ["error.mp3", "error.ogg", "fail.mp3"] },
  coin: { name: "Coin", volume: 0.5, paths: ["coin.mp3", "coin.ogg", "tech-coin.mp3", "reward.mp3"] },
  buy: { name: "Buy", volume: 0.42, paths: ["buy.mp3", "market-buy.mp3", "coin.mp3"] },
  sell: { name: "Sell", volume: 0.42, paths: ["sell.mp3", "market-sell.mp3", "coin.mp3"] },
  join: { name: "Join", volume: 0.42, paths: ["join.mp3", "lobby-join.mp3", "connect.mp3"] },
  bot: { name: "Bot", volume: 0.45, paths: ["bot.mp3", "robot.mp3", "bot-join.mp3"] },
  ready: { name: "Ready", volume: 0.35, paths: ["ready.mp3", "start.mp3", "confirm.mp3"] },
  countdown: { name: "Countdown", volume: 0.32, paths: ["countdown.mp3", "tick.mp3", "beep.mp3"] },
  round: { name: "Round", volume: 0.44, paths: ["round.mp3", "round-start.mp3", "whoosh.mp3"] },
  win: { name: "Win", volume: 0.55, paths: ["win.mp3", "victory.mp3", "success.mp3"] },
  lose: { name: "Lose", volume: 0.42, paths: ["lose.mp3", "defeat.mp3", "error.mp3"] },
  draw: { name: "Draw", volume: 0.34, paths: ["draw.mp3", "neutral.mp3", "complete.mp3"] },
  card: { name: "Card", volume: 0.35, paths: ["card.mp3", "card-play.mp3", "flip.mp3"] },
  damage: { name: "Damage", volume: 0.46, paths: ["damage.mp3", "hit.mp3", "impact.mp3"] },
  heal: { name: "Heal", volume: 0.42, paths: ["heal.mp3", "restore.mp3", "success.mp3"] },
  shield: { name: "Shield", volume: 0.38, paths: ["shield.mp3", "block.mp3", "defense.mp3"] },
  code: { name: "Code", volume: 0.36, paths: ["code.mp3", "lock.mp3", "cipher.mp3"] },
  market: { name: "Market", volume: 0.3, paths: ["market.mp3", "chart.mp3", "tick.mp3"] },
  notify: { name: "Notify", volume: 0.34, paths: ["notify.mp3", "notification.mp3", "ping.mp3"] },
};

const KEYWORDS: Array<{ test: RegExp; sound: SoundKey }> = [
  { test: /botla oyna|play with bot|bot rakip|bot bağlandı|bot player/i, sound: "bot" },
  { test: /lobby oluştur|create lobby|join|katıl|maça gir|enter match/i, sound: "join" },
  { test: /hazır|ready|başlat|start/i, sound: "ready" },
  { test: /kilitle|lock code|cipher|hedef kod/i, sound: "code" },
  { test: /kart|card|skip|oyna/i, sound: "card" },
  { test: /al$|sat$|buy|sell|hisse aldı|hisse sattı/i, sound: "market" },
  { test: /kazan|winner|victory|maç tamamlandı|completed/i, sound: "win" },
  { test: /kaybet|defeat|lose/i, sound: "lose" },
  { test: /berabere|draw/i, sound: "draw" },
  { test: /hasar|damage|hit/i, sound: "damage" },
  { test: /heal|restore|yenile|iyileş|hp yeniledi/i, sound: "heal" },
  { test: /shield|firewall|kalkan|blok|block|defense/i, sound: "shield" },
  { test: /coin|ödül|reward|bonus/i, sound: "coin" },
  { test: /hata|error|başarısız|failed/i, sound: "error" },
  { test: /başarılı|success|tamamlandı/i, sound: "success" },
];

const WATCHED_PATHS = ["/off", "/core-clash"];

function currentPathIsOff() {
  if (typeof window === "undefined") return false;
  return WATCHED_PATHS.some((path) => window.location.pathname.startsWith(path));
}

function pathOf(file: string) {
  return `${SOUND_BASE}/${file}`;
}

function readEnabled() {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored !== "0";
}

function isVisibleClickable(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest("button,a,[role='button'],input,select,textarea") : null;
  if (!element) return null;
  const text = `${element.textContent || ""} ${(element as HTMLInputElement).value || ""}`.trim();
  return { element, text };
}

function chooseSoundFromText(text: string): SoundKey {
  for (const item of KEYWORDS) {
    if (item.test.test(text)) return item.sound;
  }
  return "click";
}

export function playOffSound(key: SoundKey) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ekatech-off-sound", { detail: { key } }));
}

export function OffSoundEngine() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [enabled, setEnabled] = useState(readEnabled);
  const [active, setActive] = useState(currentPathIsOff);
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastPlayed = useRef<Record<string, number>>({});
  const lastTextSignature = useRef<string>("");

  const copy = useMemo(() => tr ? {
    on: "OFF sesleri açık",
    off: "OFF sesleri kapalı",
    hint: "Hazır ses dosyaları /sounds/off klasöründen okunur.",
  } : {
    on: "OFF sounds on",
    off: "OFF sounds off",
    hint: "Sound files are read from /sounds/off.",
  }, [tr]);

  function getAudio(key: SoundKey) {
    const config = SOUND_LIBRARY[key] || SOUND_LIBRARY.click;
    const cacheKey = key;
    const cached = audioCache.current.get(cacheKey);
    if (cached) return cached;

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = config.volume;
    audio.src = pathOf(config.paths[0]);
    audio.addEventListener("error", () => {
      const currentIndex = config.paths.findIndex((file) => audio.src.endsWith(file));
      const nextFile = config.paths[currentIndex + 1];
      if (nextFile) audio.src = pathOf(nextFile);
    });
    audioCache.current.set(cacheKey, audio);
    return audio;
  }

  function play(key: SoundKey, minGapMs = 90) {
    if (!enabled || !active) return;
    const now = Date.now();
    if (now - Number(lastPlayed.current[key] || 0) < minGapMs) return;
    lastPlayed.current[key] = now;

    try {
      const base = getAudio(key);
      const audio = base.cloneNode(true) as HTMLAudioElement;
      audio.volume = SOUND_LIBRARY[key]?.volume ?? 0.35;
      const result = audio.play();
      if (result && typeof result.catch === "function") result.catch(() => undefined);
    } catch {}
  }

  useEffect(() => {
    const updateActive = () => setActive(currentPathIsOff());
    updateActive();
    window.addEventListener("popstate", updateActive);
    window.addEventListener("ekatech-route-change", updateActive);
    return () => {
      window.removeEventListener("popstate", updateActive);
      window.removeEventListener("ekatech-route-change", updateActive);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }, [enabled]);

  useEffect(() => {
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      play(detail.key || "click", 50);
    };

    const onClick = (event: MouseEvent) => {
      if (!active) return;
      const info = isVisibleClickable(event.target);
      if (!info) return;
      play(chooseSoundFromText(info.text), 70);
    };

    const onPointerEnter = (event: Event) => {
      if (!active) return;
      const info = isVisibleClickable(event.target);
      if (!info) return;
      play("hover", 140);
    };

    const observer = new MutationObserver(() => {
      if (!active || !enabled) return;
      const bodyText = document.body.textContent || "";
      const signatureParts = [
        /Maç tamamlandı[^\n.]*/i.exec(bodyText)?.[0] || "",
        /Match completed[^\n.]*/i.exec(bodyText)?.[0] || "",
        /Round sonucu[^\n.]*/i.exec(bodyText)?.[0] || "",
        /Round result[^\n.]*/i.exec(bodyText)?.[0] || "",
        /hasar verdi[^\n.]*/i.exec(bodyText)?.[0] || "",
        /HP yeniledi[^\n.]*/i.exec(bodyText)?.[0] || "",
        /Doğru kilit|Correct lock/i.exec(bodyText)?.[0] || "",
        /Yanlış kod|Wrong code/i.exec(bodyText)?.[0] || "",
        /Tech Coin kazandı|Tech Coin harcadı/i.exec(bodyText)?.[0] || "",
      ].filter(Boolean);
      const signature = signatureParts.join("|");
      if (!signature || signature === lastTextSignature.current) return;
      lastTextSignature.current = signature;

      if (/yanlış|wrong|kaybet|lose|defeat|hata|error/i.test(signature)) play("error", 300);
      else if (/hasar|damage/i.test(signature)) play("damage", 250);
      else if (/heal|restore|yeniledi/i.test(signature)) play("heal", 250);
      else if (/doğru kilit|correct lock/i.test(signature)) play("code", 250);
      else if (/coin|ödül|reward/i.test(signature)) play("coin", 250);
      else if (/draw|berabere/i.test(signature)) play("draw", 300);
      else if (/tamamlandı|completed|winner|kazandı/i.test(signature)) play("win", 300);
      else play("notify", 300);
    });

    window.addEventListener("ekatech-off-sound", onCustom);
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerenter", onPointerEnter, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.removeEventListener("ekatech-off-sound", onCustom);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerenter", onPointerEnter, true);
      observer.disconnect();
    };
  }, [active, enabled]);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled((value) => !value)}
      title={`${enabled ? copy.on : copy.off} · ${copy.hint}`}
      className="fixed bottom-24 left-5 z-[130] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white/75 shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:bg-white/[0.08] sm:left-6"
    >
      {enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
    </button>
  );
}
