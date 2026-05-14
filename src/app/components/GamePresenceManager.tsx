import { useEffect, useRef, useState } from "react";

type GameKey = "tech_duel" | "cipher" | "core_clash";
type Session = { game: GameKey; lobby_id: number };
type Presence = {
  game: string;
  lobby_id: number;
  paused: boolean;
  missing_user_id: number | null;
  winner_user_id?: number | null;
  deadline_at: string | null;
  seconds_left: number;
  reason?: string;
};

function sameSession(a?: Session | null, b?: Session | null) {
  return Boolean(a && b && a.game === b.game && Number(a.lobby_id) === Number(b.lobby_id));
}

function pageText() {
  return (document.body?.textContent || "").toLowerCase();
}

function isVisibleGameScreen(game: GameKey) {
  const text = pageText();
  if (game === "core_clash") return window.location.pathname === "/core-clash";
  if (game === "cipher") return window.location.pathname === "/off" && text.includes("cipher break") && text.includes("hedef kod");
  return window.location.pathname === "/off" && text.includes("tech duel") && (text.includes("draw") || text.includes("release") || text.includes("aktif düellolar"));
}

async function discoverSession(): Promise<Session | null> {
  try {
    if (isVisibleGameScreen("core_clash")) {
      const response = await fetch("/api/core-clash-v2", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      const lobby = [...(data?.mine || []), ...(data?.open || [])].find((item: any) => item?.status === "in_progress");
      return lobby?.id ? { game: "core_clash", lobby_id: Number(lobby.id) } : null;
    }

    if (isVisibleGameScreen("cipher")) {
      const response = await fetch("/cipher", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      const lobby = [...(data?.mine || []), ...(data?.open || [])].find((item: any) => item?.status === "in_progress");
      return lobby?.id ? { game: "cipher", lobby_id: Number(lobby.id) } : null;
    }

    if (isVisibleGameScreen("tech_duel")) {
      const response = await fetch("/api/duels", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      const lobby = [...(data?.mine || []), ...(data?.open || [])].find((item: any) => item?.status === "in_progress");
      return lobby?.id ? { game: "tech_duel", lobby_id: Number(lobby.id) } : null;
    }
  } catch {}

  return null;
}

async function postPresence(session: Session, action: "active" | "leave") {
  const response = await fetch("/api/game-presence", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    keepalive: action === "leave",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game: session.game, lobby_id: session.lobby_id, action }),
  });
  return await response.json().catch(() => null) as Presence | null;
}

function labels(presence: Presence | null) {
  const tr = document.documentElement.lang?.toLowerCase().startsWith("tr") || pageText().includes("lobi") || pageText().includes("maça gir");
  const seconds = Math.max(0, Number(presence?.seconds_left || 0));
  if (tr) {
    return {
      title: "Oyun duraklatıldı",
      desc: presence?.reason === "you_left" ? "Maça geri döndün. Senkronizasyon yenileniyor." : "Rakip oyundan çıktı veya lobiye döndü. Süre bitmeden dönmezse sen kazanırsın.",
      countdown: `${seconds} saniye`,
      footer: "Rakip dönerse oyun kaldığı yerden devam eder.",
    };
  }
  return {
    title: "Game paused",
    desc: presence?.reason === "you_left" ? "You returned. Sync is being restored." : "Opponent left or returned to the lobby. If they do not return before the timer ends, you win.",
    countdown: `${seconds}s`,
    footer: "If the opponent returns in time, the match resumes.",
  };
}

export function GamePresenceManager() {
  const [presence, setPresence] = useState<Presence | null>(null);
  const currentRef = useRef<Session | null>(null);
  const lastLeaveRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const found = await discoverSession();
      const previous = currentRef.current;

      if (previous && !sameSession(previous, found)) {
        const key = `${previous.game}:${previous.lobby_id}`;
        if (lastLeaveRef.current !== key) {
          lastLeaveRef.current = key;
          postPresence(previous, "leave").catch(() => {});
        }
      }

      if (found) {
        currentRef.current = found;
        lastLeaveRef.current = "";
        const next = await postPresence(found, "active").catch(() => null);
        if (!cancelled && next) setPresence(next.paused ? next : null);
        return;
      }

      currentRef.current = null;
      if (!cancelled) setPresence(null);
    };

    const interval = window.setInterval(tick, 1000);
    const slowDiscover = window.setInterval(tick, 3500);
    window.addEventListener("ekatech-route-change", tick);
    window.addEventListener("popstate", tick);
    window.setTimeout(tick, 600);

    const leaveCurrent = () => {
      const current = currentRef.current;
      if (current) postPresence(current, "leave").catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") leaveCurrent();
      else tick();
    };

    window.addEventListener("beforeunload", leaveCurrent);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearInterval(slowDiscover);
      window.removeEventListener("ekatech-route-change", tick);
      window.removeEventListener("popstate", tick);
      window.removeEventListener("beforeunload", leaveCurrent);
      document.removeEventListener("visibilitychange", onVisibility);
      leaveCurrent();
    };
  }, []);

  if (!presence?.paused) return null;

  const copy = labels(presence);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 text-white backdrop-blur-md">
      <div className="w-full max-w-md rounded-[2rem] border border-cyan-300/25 bg-black/85 p-6 text-center shadow-2xl shadow-cyan-500/20">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/60">Pause / Forfeit</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{copy.title}</h2>
        <p className="mt-4 text-sm leading-6 text-white/60">{copy.desc}</p>
        <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-3xl font-semibold text-cyan-100 shadow-2xl shadow-cyan-500/20">
          {copy.countdown}
        </div>
        <p className="mt-5 text-xs uppercase tracking-[0.18em] text-white/35">{copy.footer}</p>
      </div>
    </div>
  );
}
