import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../i18n";

type Announcement = {
  id: number;
  announcement_type: "message" | "image" | string;
  message?: string;
  image_url?: string;
  expires_at?: string;
};

export function AnnouncementPopup() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    fetch("/api/announcements")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        const item = data?.announcements?.[0];
        if (!item) return;

        const hiddenKey = `ekatech-announcement-dismissed-${item.id}`;
        if (window.sessionStorage.getItem(hiddenKey) === "true") return;

        setAnnouncement(item);
      })
      .catch(() => undefined);
  }, []);

  if (!announcement) return null;

  const close = () => {
    window.sessionStorage.setItem(`ekatech-announcement-dismissed-${announcement.id}`, "true");
    setAnnouncement(null);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-md">
      <div className="relative max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808] shadow-2xl shadow-cyan-500/10">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white transition-all hover:bg-white hover:text-black"
          aria-label={tr ? "Duyuruyu kapat" : "Close announcement"}
        >
          <X className="h-5 w-5" />
        </button>

        {announcement.announcement_type === "image" && announcement.image_url ? (
          <div className="bg-black p-3">
            <img src={announcement.image_url} alt={tr ? "Duyuru" : "Announcement"} className="max-h-[78vh] w-full rounded-[1.5rem] object-contain" />
          </div>
        ) : (
          <div className="relative overflow-hidden px-6 py-14 text-center sm:px-10 sm:py-16">
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-sm uppercase tracking-[0.26em] text-cyan-100/60">{tr ? "EkaTech Duyuru" : "EkaTech Announcement"}</p>
              <h2 className="mt-5 whitespace-pre-wrap text-3xl font-medium leading-tight tracking-tight text-white sm:text-5xl">
                {announcement.message}
              </h2>
              {announcement.expires_at && (
                <p className="mt-6 text-sm text-white/40">{tr ? "Geçerlilik" : "Valid until"} {new Date(announcement.expires_at).toLocaleString(language === "tr" ? "tr-TR" : "en-US")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
