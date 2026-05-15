import { useEffect, useMemo, useState } from "react";
import { Bot, ImagePlus, RefreshCw, Save } from "lucide-react";
import { useLanguage } from "../i18n";

type BotProfile = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  role?: string | null;
  avatar_approved?: number | null;
};

function initials(name?: string | null) {
  return (name || "BOT").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "B";
}

export function AdminBotProfiles() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(() => tr ? {
    title: "Bot profil fotoğrafları",
    subtitle: "Tech Duel, Cipher Break ve Core Clash botlarının görünen profil fotoğrafını buradan değiştirebilirsin.",
    refresh: "Yenile",
    save: "Kaydet",
    avatarUrl: "Profil fotoğrafı URL'si",
    name: "Bot adı",
    hint: "Site içi dosya için /bot-avatar.png gibi yazabilir veya https:// ile başlayan görsel linki girebilirsin.",
    empty: "Bot profili bulunamadı.",
    saved: "Bot profili güncellendi.",
  } : {
    title: "Bot profile photos",
    subtitle: "Change visible bot avatars for Tech Duel, Cipher Break and Core Clash.",
    refresh: "Refresh",
    save: "Save",
    avatarUrl: "Profile photo URL",
    name: "Bot name",
    hint: "Use a site-local path like /bot-avatar.png or an image URL starting with https://.",
    empty: "No bot profiles found.",
    saved: "Bot profile updated.",
  }, [tr]);

  const [bots, setBots] = useState<BotProfile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [botName, setBotName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selected = bots.find((bot) => Number(bot.id) === Number(selectedId)) || null;

  async function loadBots() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/bot-profiles", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Bot profilleri alınamadı.");
      const rows = data?.bots || [];
      setBots(rows);
      const next = rows.find((bot: BotProfile) => Number(bot.id) === Number(selectedId)) || rows[0] || null;
      if (next) {
        setSelectedId(Number(next.id));
        setAvatarUrl(next.avatar_url || "");
        setBotName(next.name || "");
      }
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Bot profilleri alınamadı." });
    } finally {
      setLoading(false);
    }
  }

  function selectBot(bot: BotProfile) {
    setSelectedId(Number(bot.id));
    setAvatarUrl(bot.avatar_url || "");
    setBotName(bot.name || "");
    setMessage(null);
  }

  async function saveBot() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/bot-profiles", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: selected.id, avatar_url: avatarUrl.trim(), name: botName.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Bot profili güncellenemedi.");
      setMessage({ type: "success", text: copy.saved });
      await loadBots();
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Bot profili güncellenemedi." });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadBots();
  }, []);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 text-white backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-xs font-medium text-purple-100">
            <Bot className="h-4 w-4" /> OFF BOT CONTROL
          </div>
          <h2 className="mt-3 text-3xl font-medium tracking-tight">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button onClick={loadBots} disabled={loading || saving} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1] disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> {loading ? "..." : copy.refresh}
        </button>
      </div>

      {message && <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{message.text}</div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
          <div className="space-y-2">
            {bots.map((bot) => {
              const active = Number(bot.id) === Number(selectedId);
              return (
                <button key={bot.id} onClick={() => selectBot(bot)} className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? "border-purple-300/40 bg-purple-300/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white text-sm font-bold text-black">
                      {bot.avatar_url ? <img src={bot.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(bot.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-white">{bot.name}</p>
                        <span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-2 py-0.5 text-[10px] font-semibold text-purple-100">BOT</span>
                      </div>
                      <p className="truncate text-xs text-white/40">{bot.email}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {!bots.length && !loading && <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/45">{copy.empty}</p>}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
          {selected ? (
            <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-center">
                <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-purple-300/30 bg-white text-3xl font-bold text-black shadow-2xl shadow-purple-500/10">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(botName)}
                </div>
                <p className="mt-4 font-medium">{botName || selected.name}</p>
                <p className="mt-1 text-xs text-white/40">{selected.email}</p>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/35">{copy.name}</span>
                  <input value={botName} onChange={(event) => setBotName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/35">{copy.avatarUrl}</span>
                  <div className="flex gap-2">
                    <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="/byte-bot.png veya https://..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                    <button type="button" onClick={() => setAvatarUrl("")} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white/60 hover:bg-white/[0.1]">Clear</button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/40">{copy.hint}</p>
                </label>

                <button onClick={saveBot} disabled={saving || loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-gray-200 disabled:opacity-50">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "..." : copy.save}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-white/40">
              <ImagePlus className="mb-3 h-10 w-10" />
              {copy.empty}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
