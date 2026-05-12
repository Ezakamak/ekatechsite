import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLanguage } from "../i18n";

type NotificationItem = {
  id: number;
  title: string;
  body?: string;
  link?: string;
  is_read?: number;
  created_at?: string;
};

function formatTime(value?: string, tr = true) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(tr ? "tr-TR" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationBell() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const response = await fetch("/api/notifications", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        setItems(data?.notifications || []);
        setUnread(Number(data?.unread || 0));
      }
    } catch {
      undefined;
    }
  };

  const markRead = async (id?: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      await load();
    } catch {
      undefined;
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 12000);
    window.addEventListener("ekatech-auth-change", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekatech-auth-change", load);
    };
  }, []);

  const navigate = async (item: NotificationItem) => {
    await markRead(item.id);
    setOpen(false);
    if (item.link) {
      window.history.pushState({}, "", item.link);
      window.dispatchEvent(new Event("ekatech-route-change"));
    }
  };

  return (
    <div className="relative" data-notification-menu>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
          load();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/[0.1]"
        aria-label={tr ? "Bildirimler" : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-400 px-1 text-[10px] font-semibold text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-black/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="font-medium text-white">{tr ? "Bildirimler" : "Notifications"}</p>
              <button type="button" onClick={() => markRead()} className="text-xs text-white/45 underline underline-offset-4 hover:text-white">
                {tr ? "Tümünü oku" : "Mark all read"}
              </button>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-white/45">{tr ? "Bildirim yok." : "No notifications."}</p>}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item)}
                  className="w-full rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${Number(item.is_read || 0) ? "bg-white/20" : "bg-cyan-300"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{item.body}</p>}
                      <p className="mt-1 text-[11px] text-white/30">{formatTime(item.created_at, tr)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
