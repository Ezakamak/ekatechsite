import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type Announcement = {
  id: number;
  announcement_type: "message" | "image" | string;
  message?: string;
  image_url?: string;
  expires_at?: string;
  is_active?: number;
  created_at?: string;
};

export function AnnouncementAdmin() {
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementType, setAnnouncementType] = useState<"message" | "image">("message");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const tr = language === "tr";

  const loadAnnouncements = () => {
    fetch("/api/admin/announcements", { credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed");
        return data;
      })
      .then((data) => setAnnouncements(data?.announcements || []))
      .catch((error) => setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Duyurular alınamadı." : "Could not load announcements." }));
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(null);

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: tr ? "Sadece görsel dosyası seçebilirsin." : "Choose an image file only." });
      return;
    }

    try {
      const compressed = await compressImage(file);
      setImageUrl(compressed);
      setAnnouncementType("image");
    } catch (error) {
      setStatus({ type: "error", message: tr ? "Resim işlenemedi." : "Image could not be processed." });
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_type: announcementType,
          message: announcementType === "message" ? message : "",
          image_url: announcementType === "image" ? imageUrl : "",
          expires_at: expiresAt,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (tr ? "Duyuru oluşturulamadı." : "Could not create announcement."));

      setStatus({ type: "success", message: data?.message || (tr ? "Duyuru oluşturuldu." : "Announcement created.") });
      setMessage("");
      setImageUrl("");
      setExpiresAt("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadAnnouncements();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Duyuru oluşturulamadı." : "Could not create announcement." });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    setStatus(null);

    try {
      const response = await fetch("/api/admin/announcements", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: isActive }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (tr ? "Duyuru güncellenemedi." : "Could not update announcement."));

      setStatus({ type: "success", message: tr ? "Duyuru güncellendi." : "Announcement updated." });
      loadAnnouncements();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Duyuru güncellenemedi." : "Could not update announcement." });
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
      className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-purple-100/70">{tr ? "Site duyuruları" : "Site announcements"}</p>
          <h3 className="mt-2 text-3xl font-medium text-white">{tr ? "Süreli duyuru yayınla" : "Publish timed announcement"}</h3>
          <p className="mt-2 text-sm text-white/45">
            {tr ? "Kullanıcı siteye girince büyük ekranda görünür. Çarpıya basınca kapanır." : "Shown as a large popup when users visit. They can close it with X."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadAnnouncements}
          className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1]"
        >
          Refresh
        </button>
      </div>

      {status && (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <label className="block space-y-2">
            <span className="text-sm text-white/55">{tr ? "Duyuru tipi" : "Announcement type"}</span>
            <select
              value={announcementType}
              onChange={(event) => setAnnouncementType(event.target.value as "message" | "image")}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
            >
              <option value="message">{tr ? "Sadece mesaj" : "Message only"}</option>
              <option value="image">{tr ? "Sadece resim" : "Image only"}</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-white/55">{tr ? "Geçerlilik bitişi" : "Valid until"}</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
            />
          </label>

          {announcementType === "message" ? (
            <label className="block space-y-2">
              <span className="text-sm text-white/55">{tr ? "Duyuru mesajı" : "Announcement message"}</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
                placeholder={tr ? "Örn: Yeni AI otomasyon paketimiz yayında." : "Example: Our new AI automation package is live."}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200"
              >
                {imageUrl ? (tr ? "Resmi değiştir" : "Change image") : tr ? "Resim seç" : "Choose image"}
              </button>
              {imageUrl && <p className="text-sm text-emerald-100/80">{tr ? "Resim hazır." : "Image ready."}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "..." : tr ? "Duyuruyu yayınla" : "Publish announcement"}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="mb-3 text-sm text-white/55">{tr ? "Önizleme" : "Preview"}</p>
          <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black p-4 text-center">
            {announcementType === "image" && imageUrl ? (
              <img src={imageUrl} alt="Preview" className="max-h-80 rounded-2xl object-contain" />
            ) : (
              <h4 className="whitespace-pre-wrap text-3xl font-medium text-white">
                {message || (tr ? "Duyuru mesajı burada görünür." : "Announcement message appears here.")}
              </h4>
            )}
          </div>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        <h4 className="text-xl font-medium text-white">{tr ? "Son duyurular" : "Recent announcements"}</h4>
        {announcements.length === 0 && <p className="text-white/45">{tr ? "Henüz duyuru yok." : "No announcements yet."}</p>}
        {announcements.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">{item.announcement_type}</p>
                <p className="mt-1 truncate text-white">{item.announcement_type === "image" ? (tr ? "Resim duyurusu" : "Image announcement") : item.message}</p>
                <p className="mt-1 text-sm text-white/45">{tr ? "Bitiş" : "Expires"}: {item.expires_at}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(item.id, !item.is_active)}
                className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1]"
              >
                {item.is_active ? (tr ? "Pasifleştir" : "Disable") : tr ? "Aktifleştir" : "Enable"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("File could not be read."));

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 900;
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Image could not be processed."));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };

    image.onerror = () => reject(new Error("Image could not be loaded."));
    reader.readAsDataURL(file);
  });
}
