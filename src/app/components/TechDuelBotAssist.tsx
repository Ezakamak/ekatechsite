import { useEffect, useMemo, useState } from "react";
import { Bot, Sparkles, RefreshCcw } from "lucide-react";
import { useLanguage } from "../i18n";

type Lobby = {
  id: number;
  creator_user_id: number;
  opponent_user_id?: number | null;
  status: string;
  mode?: string;
  round_count?: number;
};

type User = {
  id: number;
  name: string;
};

export function TechDuelBotAssist() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () => tr
      ? {
          title: "Player 2 boş",
          desc: "Rakip beklemek istemiyorsan BOT rakip çağırabilirsin. BOT rozeti görünür; ödül daha düşüktür.",
          action: "Botla Oyna",
          loading: "Kontrol ediliyor...",
          noLobby: "Bot için açık lobby yok.",
          success: "BOT Player 2 olarak bağlandı.",
          refresh: "Yenile",
        }
      : {
          title: "Player 2 is empty",
          desc: "Call a BOT opponent if you do not want to wait. The BOT badge is visible and the reward is lower.",
          action: "Play with Bot",
          loading: "Checking...",
          noLobby: "No open lobby for bot.",
          success: "BOT connected as Player 2.",
          refresh: "Refresh",
        },
    [tr]
  );

  const [user, setUser] = useState<User | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadState();
    const timer = window.setInterval(() => loadState(false), 1600);
    return () => window.clearInterval(timer);
  }, []);

  async function loadState(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/duels", { credentials: "same-origin", cache: "no-store" });
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
    } catch (error) {
      if (showLoading) setStatus({ type: "error", text: error instanceof Error ? error.message : copy.noLobby });
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function playWithBot() {
    if (!lobby) return;
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/duels/bot", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobby_id: lobby.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.noLobby);
      setStatus({ type: "success", text: data?.message || copy.success });
      await loadState(false);
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : copy.noLobby });
    } finally {
      setLoading(false);
    }
  }

  if (!user || (!lobby && !status)) return null;

  return (
    <aside className="fixed bottom-24 right-5 z-[120] w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-black/85 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:right-6 sm:w-96">
      <div className="border-b border-white/10 bg-cyan-300/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{copy.title}</h3>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">BOT</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-white/50">{copy.desc}</p>
          </div>
        </div>
      </div>

      {status && (
        <div className={`m-4 rounded-2xl border px-4 py-3 text-xs ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {status.text}
        </div>
      )}

      {lobby ? (
        <div className="space-y-3 p-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/45">
            Lobby #{lobby.id} · {lobby.mode || "classic"} · Best of {lobby.round_count || 5}
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
      ) : (
        <div className="p-4 pt-0">
          <button type="button" onClick={() => loadState()} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.1]">
            <RefreshCcw className="h-4 w-4" /> {copy.refresh}
          </button>
        </div>
      )}
    </aside>
  );
}
