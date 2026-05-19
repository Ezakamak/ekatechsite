import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useLanguage } from "../i18n";

type NotificationItem = {
  id: number;
  type?: string;
  category?: string;
  title: string;
  body?: string;
  link?: string;
  action_label?: string;
  action_payload?: string;
  source_table?: string;
  source_id?: string;
  priority?: string;
  is_read?: number;
  created_at?: string;
  action_status?: string | null;
};

function formatTime(value?: string, tr = true) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(tr ? "tr-TR" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function labelFor(item: NotificationItem, tr: boolean) {
  const byType: Record<string, string> = {
    friend_request: tr ? "Arkadaşlık" : "Friendship",
    friend_accepted: tr ? "Arkadaşlık" : "Friendship",
    game_invite: tr ? "Oyun daveti" : "Game invite",
    special_event: tr ? "Etkinlik" : "Event",
    daily_stock_summary: "Invest",
    miner_ready: "Miner",
    miner_reward: "Miner",
    miner_cooldown: "Miner",
    reward: tr ? "Ödül" : "Reward",
  };
  const byCategory: Record<string, string> = {
    site: tr ? "Site" : "Site",
    off: "OFF",
    invest: "Invest",
    miner: "Miner",
    event: tr ? "Etkinlik" : "Event",
    reward: tr ? "Ödül" : "Reward",
  };
  return byType[item.type || ""] || byCategory[item.category || ""] || (tr ? "Site" : "Site");
}

export function NotificationBell() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [processingById, setProcessingById] = useState<Record<number, "accept" | "reject" | null>>({});
  const [handledById, setHandledById] = useState<Record<number, boolean>>({});

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
    const timer = window.setInterval(load, 45000);
    window.addEventListener("ekatech-auth-change", load);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekatech-auth-change", load);
      window.removeEventListener("focus", load);
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

  const isOffFriendRequest = (item: NotificationItem) => item.type === "friend_request" && item.source_table === "off_friendships";
  const isGameInvite = (item: NotificationItem) => item.type === "game_invite" && item.source_table === "off_game_invites";
  const isPendingAction = (item: NotificationItem) => item.action_status === "pending";
  const gameInviteStatusLabel = (status?: string | null) => {
    if (status === "accepted") return "Kabul edildi";
    if (status === "rejected") return "Reddedildi";
    if (status === "expired") return "Süresi doldu";
    return tr ? "İşlendi" : "Processed";
  };

  const getFriendshipId = (item: NotificationItem) => {
    const id = Number(item.source_id);
    return Number.isFinite(id) && id > 0 ? id : null;
  };

  const handleFriendRequest = async (event: React.MouseEvent, item: NotificationItem, action: "accept" | "reject") => {
    event.stopPropagation();
    const friendshipId = getFriendshipId(item);
    if (!friendshipId) return;
    setProcessingById((prev) => ({ ...prev, [item.id]: action }));
    try {
      const response = await fetch("/api/off/friends/respond", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          toast.error("Bu istek artık geçerli değil");
          await markRead(item.id);
          setHandledById((prev) => ({ ...prev, [item.id]: true }));
          return;
        }
        throw new Error(data?.error || "İşlem başarısız");
      }
      toast.success(action === "accept" ? "Arkadaşlık isteği kabul edildi" : "Arkadaşlık isteği reddedildi");
      await markRead(item.id);
      setHandledById((prev) => ({ ...prev, [item.id]: true }));
      window.dispatchEvent(new Event("ekatech-off-friends-refresh"));
    } catch (error: any) {
      toast.error(error?.message || "İşlem başarısız");
    } finally {
      setProcessingById((prev) => ({ ...prev, [item.id]: null }));
    }
  };
  const handleGameInvite = async (event: React.MouseEvent, item: NotificationItem, action: "accept" | "reject") => {
    event.stopPropagation();
    const inviteId = Number(item.source_id);
    if (!inviteId) return;
    setProcessingById((prev) => ({ ...prev, [item.id]: action }));
    try {
      const response = await fetch("/api/off/game-invites/respond", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId, action }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "İşlem başarısız");
      await markRead(item.id);
      setHandledById((prev) => ({ ...prev, [item.id]: true }));
      if (action === "accept") {
        toast.success("Oyun daveti kabul edildi");
        const redirectTo = typeof data?.redirectTo === "string" && data.redirectTo ? data.redirectTo : "/off";
        window.history.pushState({}, "", redirectTo);
        window.dispatchEvent(new Event("ekatech-route-change"));
        window.dispatchEvent(new CustomEvent("ekatech-tech-duel-open-lobby", { detail: { lobbyId: data?.lobbyId || null } }));
        window.dispatchEvent(new Event("ekatech-off-invites-refresh"));
        window.dispatchEvent(new Event("ekatech-tech-duel-refresh"));
        window.dispatchEvent(new Event("ekatech-cipher-refresh"));
        window.dispatchEvent(new Event("ekatech-core-clash-refresh"));
      } else {
        toast.success("Oyun daveti reddedildi");
        window.dispatchEvent(new Event("ekatech-off-invites-refresh"));
        await load();
      }
    } catch (error: any) {
      toast.error(error?.message || "İşlem başarısız");
    } finally {
      setProcessingById((prev) => ({ ...prev, [item.id]: null }));
    }
  };

  return (
    <div className="relative" data-notification-menu>
      <button type="button" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); load(); }} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/[0.1]" aria-label={tr ? "Bildirimler" : "Notifications"}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-400 px-1 text-[10px] font-semibold text-black">{unread > 9 ? "9+" : unread}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18 }} className="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-black/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="font-medium text-white">{tr ? "Bildirimler" : "Notifications"}</p>
              <button type="button" onClick={() => markRead()} className="text-xs text-white/45 underline underline-offset-4 hover:text-white">{tr ? "Tümünü oku" : "Mark all read"}</button>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-white/45">{tr ? "Bildirim yok." : "No notifications."}</p>}
              {items.map((item) => {
                const isFriendRequest = isOffFriendRequest(item);
                const friendshipId = getFriendshipId(item);
                const processing = processingById[item.id];
                const gameInvite = isGameInvite(item);
                const isHandled = Boolean(handledById[item.id]) || ((isFriendRequest || gameInvite) && !isPendingAction(item));
                return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void navigate(item);
                    }
                  }}
                  className={`w-full cursor-pointer rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06] ${item.priority === "high" ? "border border-amber-300/40 bg-amber-300/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${Number(item.is_read || 0) ? "bg-white/20" : "bg-cyan-300"}`} />
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/65">{labelFor(item, tr)}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{item.body}</p>}
                      {item.action_label && !isFriendRequest && <span className="mt-2 inline-flex rounded-lg border border-cyan-300/40 px-2 py-1 text-[11px] text-cyan-200">{item.action_label}</span>}
                      {isFriendRequest && friendshipId && isPendingAction(item) && !isHandled && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(event) => void handleFriendRequest(event, item, "accept")}
                            disabled={Boolean(processing)}
                            className="rounded-lg border border-emerald-300/45 bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-50 disabled:opacity-60"
                          >
                            {processing === "accept" ? (tr ? "İşleniyor..." : "Processing...") : (tr ? "Kabul et" : "Accept")}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => void handleFriendRequest(event, item, "reject")}
                            disabled={Boolean(processing)}
                            className="rounded-lg border border-rose-300/45 bg-rose-500/20 px-2.5 py-1 text-[11px] text-rose-50 disabled:opacity-60"
                          >
                            {processing === "reject" ? (tr ? "İşleniyor..." : "Processing...") : (tr ? "Reddet" : "Reject")}
                          </button>
                        </div>
                      )}
                      {gameInvite && isPendingAction(item) && !isHandled && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={(event) => void handleGameInvite(event, item, "accept")} disabled={Boolean(processing)} className="rounded-lg border border-emerald-300/45 bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-50 disabled:opacity-60">{processing === "accept" ? "İşleniyor..." : "Kabul et"}</button>
                          <button type="button" onClick={(event) => void handleGameInvite(event, item, "reject")} disabled={Boolean(processing)} className="rounded-lg border border-rose-300/45 bg-rose-500/20 px-2.5 py-1 text-[11px] text-rose-50 disabled:opacity-60">{processing === "reject" ? "İşleniyor..." : "Reddet"}</button>
                        </div>
                      )}
                      {isFriendRequest && (!friendshipId || isHandled) && <span className="mt-2 inline-flex rounded-lg border border-white/20 px-2 py-1 text-[11px] text-white/60">{tr ? "İşlendi" : "Processed"}</span>}
                      {gameInvite && isHandled && <span className="mt-2 inline-flex rounded-lg border border-white/20 px-2 py-1 text-[11px] text-white/60">{gameInviteStatusLabel(item.action_status)}</span>}
                      <p className="mt-1 text-[11px] text-white/30">{formatTime(item.created_at, tr)}</p>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
