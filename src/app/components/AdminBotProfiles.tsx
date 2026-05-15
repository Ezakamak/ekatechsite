import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ImagePlus, RefreshCw, Save, UploadCloud, X } from "lucide-react";
import { useLanguage } from "../i18n";

type BotProfile = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  role?: string | null;
  avatar_approved?: number | null;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const AVATAR_SIZE = 320;

function initials(name?: string | null) {
  return (name || "BOT").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "B";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Görsel okunamadı."));
    image.src = src;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

async function compressAvatar(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Sadece görsel dosyası seçebilirsin.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Fotoğraf çok büyük. En fazla 8 MB seç.");

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi.");

  const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sx = ((image.naturalWidth || image.width) - sourceSize) / 2;
  const sy = ((image.naturalHeight || image.height) - sourceSize) / 2;

  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  let dataUrl = canvas.toDataURL("image/webp", 0.78);
  if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  if (dataUrl.length > 650_000) dataUrl = canvas.toDataURL("image/jpeg", 0.62);
  if (dataUrl.length > 700_000) throw new Error("Fotoğraf sıkıştırılamadı. Daha küçük bir fotoğraf seç.");
  return dataUrl;
}

export function AdminBotProfiles() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copy = useMemo(() => tr ? {
    title: "Bot profil fotoğrafları",
    subtitle: "Tech Duel, Cipher Break ve Core Clash botlarının görünen profil fotoğrafını buradan değiştirebilirsin.",
    refresh: "Yenile",
    save: "Kaydet",
    upload: "Fotoğraflar’dan seç",
    removePhoto: "Fotoğrafı kaldır",
    avatarUrl: "İsteğe bağlı manuel URL",
    name: "Bot adı",
    hint: "Fotoğraf seçersen otomatik kare kırpılır ve sıkıştırılır. URL yazmak zorunda değilsin.",
    manualHint: "İstersen yine /byte-bot.png veya https://... gibi manuel yol da girebilirsin.",
    empty: "Bot profili bulunamadı.",
    saved: "Bot profili güncellendi.",
    processing: "Fotoğraf hazırlanıyor...",
  } : {
    title: "Bot profile photos",
    subtitle: "Change visible bot avatars for Tech Duel, Cipher Break and Core Clash.",
    refresh: "Refresh",
    save: "Save",
    upload: "Choose from Photos",
    removePhoto: "Remove photo",
    avatarUrl: "Optional manual URL",
    name: "Bot name",
    hint: "Selected photos are automatically square-cropped and compressed. You do not need to paste a URL.",
    manualHint: "You can still use a manual path like /byte-bot.png or https://... if needed.",
    empty: "No bot profiles found.",
    saved: "Bot profile updated.",
    processing: "Preparing photo...",
  }, [tr]);

  const [bots, setBots] = useState<BotProfile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [botName, setBotName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    setMessage(null);
    try {
      const dataUrl = await compressAvatar(file);
      setAvatarUrl(dataUrl);
      setMessage({ type: "success", text: tr ? "Fotoğraf hazırlandı. Kaydet’e basınca botta görünecek." : "Photo prepared. Press Save to apply it to the bot." });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Fotoğraf hazırlanamadı." });
    } finally {
      setProcessingImage(false);
      event.target.value = "";
    }
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
        <button onClick={loadBots} disabled={loading || saving || processingImage} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1] disabled:opacity-50">
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
                {processingImage && <p className="mt-3 rounded-full bg-purple-300/10 px-3 py-1 text-xs text-purple-100">{copy.processing}</p>}
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/35">{copy.name}</span>
                  <input value={botName} onChange={(event) => setBotName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                </label>

                <div className="rounded-[1.25rem] border border-purple-300/15 bg-purple-300/5 p-4">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={processingImage || saving} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-300/25 bg-purple-300/10 px-5 py-3 text-sm font-medium text-purple-100 transition hover:bg-purple-300/15 disabled:opacity-50">
                    {processingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {processingImage ? copy.processing : copy.upload}
                  </button>
                  <p className="mt-3 text-xs leading-5 text-white/45">{copy.hint}</p>
                  {avatarUrl && (
                    <button type="button" onClick={() => setAvatarUrl("")} className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-white/65 hover:bg-white/[0.1]">
                      <X className="h-3.5 w-3.5" /> {copy.removePhoto}
                    </button>
                  )}
                </div>

                <details className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
                  <summary className="cursor-pointer text-sm text-white/60">{copy.avatarUrl}</summary>
                  <div className="mt-3 flex gap-2">
                    <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="/byte-bot.png veya https://..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                    <button type="button" onClick={() => setAvatarUrl("")} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white/60 hover:bg-white/[0.1]">Clear</button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/40">{copy.manualHint}</p>
                </details>

                <button onClick={saveBot} disabled={saving || loading || processingImage} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-gray-200 disabled:opacity-50">
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
