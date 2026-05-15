import { useEffect, useMemo, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { useLanguage } from "../i18n";

type Lobby = {
  id: number;
  creator_user_id: number;
  opponent_user_id?: number | null;
  status: string;
  map_key?: string;
};

type User = {
  id: number;
  name: string;
};

export function CoreClashBotAssist() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () => tr
      ? {
          title: "Player 2 boş",
          desc: "Rakip beklemek istemiyorsan Core Clash için BOT rakip çağırabilirsin. BOT rozeti görünür.",
          action: "Botla Oyna",
          loading: "Kontrol ediliyor...",
          noLobby: "Bot için açık Core Clash lobisi yok.",
        }
      : {
          title: "Player 2 is empty",
          desc: "Call a BOT opponent for Core Clash if you do not want to wait. The BOT badge is visible.",
          action: "Play with Bot",
          loading: "Checking...",
          noLobby: "No open Core Clash lobby for bot.",
        },
    [tr]
  );

  const [user, setUser] = useState<User | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadState();
    const timer = window.setInterval(() => loadState(false), 1600);
    return () => window.clearInterval(timer);
  }, []);

  async function loadState(showLoading = true) {
    if (hidden) return;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/core-clash-v2", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.noLobby);
      const nextUser = data?.user || null;
      const mine = Array.isArray(data?.mine) ? data.mine : [];
      const openMine = mine.find((item: Lobby) =>
        item.status === "open" &&
        Number(item.creator_user_id) === Number(nextUser?.id) &&
        !item.opponent_user_id
      ) || null;
      setUser(nextUser);
      setLobby(openMine);
      if (!openMine) setError(null);
    } catch (caught) {
      if (showLoading) setError(caught instanceof Error ? caught.message : copy.noLobby);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function playWithBot() {
    if (!lobby) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/core-clash-v2-bot", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobby_id: lobby.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.noLobby);
      setHidden(true);
      setLobby(null);
      window.dispatchEvent(new Event("ekatech-core-clash-bot-joined"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.noLobby);
    } finally {
      setLoading(false);
    }
  }

  if (hidden || !user || !lobby) return null;

  return (
    <aside className="fixed bottom-24 right-5 z-[120] w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-[1.75rem] border border-purple-300/20 bg-black/85 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:right-6 sm:w-96">
      <div className="border-b border-white/10 bg-purple-300/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-300/10 text-purple-100">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{copy.title}</h3>
              <span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-2 py-0.5 text-[10px] font-semibold text-purple-100">BOT</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-white/50">{copy.desc}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="m-4 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-xs text-red-100">
          {error}
        </div>
      )}

      <div className="space-y-3 p-4 pt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/45">
          Lobby #{lobby.id} · {lobby.map_key || "Core Clash"}
        </div>
        <button
          type="button"
          onClick={playWithBot}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" /> {loading ? copy.loading : copy.action}
        </button>
      </div>
    </aside>
  );
}
