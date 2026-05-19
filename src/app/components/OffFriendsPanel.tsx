import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Item = { id: number; userId?: number; friendshipId?: number; displayName: string; avatarUrl?: string | null; level?: number; xp?: number; selectedTitle?: string | null; status?: string; friendshipStatus?: string; secondaryLabel?: string | null; isOnline?: boolean; lastSeenAt?: string | null };

const btn = "rounded-full px-3 py-1.5 text-xs font-medium transition border";
const ONLINE_REFRESH_MS = 30000;

export function OffFriendsPanel() {
  const [friends, setFriends] = useState<Item[]>([]);
  const [incoming, setIncoming] = useState<Item[]>([]);
  const [outgoing, setOutgoing] = useState<Item[]>([]);
  const [addableUsers, setAddableUsers] = useState<Item[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const loadCore = async () => {
    try {
      const [f, r] = await Promise.all([fetch("/api/off/friends"), fetch("/api/off/friends/requests")]);
      if (!f.ok || !r.ok) throw new Error("OFF arkadaş verileri alınamadı");
      setFriends((await f.json()).friends || []);
      const req = await r.json();
      setIncoming(req.incoming || []);
      setOutgoing(req.outgoing || []);
    } catch (error: any) {
      toast.error(error?.message || "OFF panel yüklenemedi");
    }
  };

  const pingPresence = async () => {
    await fetch("/api/off/presence/ping", { method: "POST" }).catch(() => null);
  };

  const loadAddableUsers = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) setLoadingUsers(true);
      setUsersError(null);
      await pingPresence();
      const res = await fetch("/api/off/users/online");
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("Kullanıcı listesi geçersiz formatta geldi.");
      }
      if (!res.ok) throw new Error(data?.error || `Kullanıcı listesi yüklenemedi (HTTP ${res.status})`);
      setAddableUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (_error: any) {
      const message = _error?.message || "Kullanıcı listesi yüklenemedi.";
      setUsersError(message);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadCore();
    void loadAddableUsers();
    const id = window.setInterval(() => {
      void loadAddableUsers({ silent: true });
    }, ONLINE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const sendRequest = async (userId: number) => { const res = await fetch("/api/off/friends/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); const data = await res.json().catch(() => ({})); if (!res.ok) return toast.error(data.error || "Hata"); toast.success("İstek gönderildi"); loadCore(); loadAddableUsers({ silent: true }); };
  const respond = async (friendshipId: number, action: "accept"|"reject") => { const res = await fetch("/api/off/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendshipId, action }) }); const data = await res.json(); if (!res.ok) return toast.error(data.error || "Hata"); toast.success(action === "accept" ? "İstek kabul edildi" : "İstek reddedildi"); loadCore(); loadAddableUsers({ silent: true }); };
  const removeFriend = async (userId: number) => { const res = await fetch("/api/off/friends/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); if (res.ok) { toast.success("Arkadaş silindi"); loadCore(); loadAddableUsers({ silent: true }); } else toast.error("Hata"); };

  const userRow = (u: Item, action?: ReactNode) => <div key={`${u.id}-${u.friendshipId || "x"}`} className="rounded-2xl border border-white/15 bg-white/[0.05] px-3 py-2 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className="relative shrink-0">{u.avatarUrl ? <img src={u.avatarUrl} alt={u.displayName} className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40" />}{u.isOnline ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-black/40 bg-emerald-400" /> : null}</div> <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{u.displayName}</p><p className="text-xs text-white/65">{u.secondaryLabel || `Lvl ${u.level || 1}${u.selectedTitle ? ` · ${u.selectedTitle}` : ""}`}</p></div></div>{action}</div>;

  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6 text-white space-y-5">
    <h3 className="text-xl font-semibold">Arkadaşlar</h3>
    <div>
      <div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm text-white/70">Kullanıcılar</p><button onClick={() => loadAddableUsers()} disabled={loadingUsers} className={`${btn} border-cyan-300/40 bg-cyan-500/20 disabled:opacity-60`}>{loadingUsers ? "Yenileniyor..." : "Yenile"}</button></div>
      {usersError ? <p className="text-sm text-rose-200/90">{usersError}</p> : addableUsers.length === 0 ? <p className="text-sm text-white/60">Eklenebilecek kullanıcı yok.</p> : <div className="grid gap-2 md:grid-cols-2">{addableUsers.map((u)=> userRow(u, <button onClick={()=>sendRequest(u.id)} className={`${btn} border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25 text-cyan-100`}>Arkadaş ekle</button>))}</div>}
    </div>
    <div><p className="text-sm text-white/70 mb-2">Gelen İstekler</p>{incoming.length ? incoming.map((r)=> userRow(r, <div className="flex gap-2"><button onClick={()=>respond(Number(r.friendshipId),"accept")} className={`${btn} border-emerald-300/45 bg-gradient-to-r from-emerald-400/30 to-cyan-400/20 text-emerald-50 hover:shadow-[0_0_16px_rgba(52,211,153,0.35)]`}>Kabul et</button><button onClick={()=>respond(Number(r.friendshipId),"reject")} className={`${btn} border-rose-300/40 bg-gradient-to-r from-rose-500/20 to-fuchsia-500/20 text-rose-50 hover:shadow-[0_0_16px_rgba(244,63,94,0.35)]`}>Reddet</button></div>)) : <p className="text-sm text-white/60">Bekleyen istek yok.</p>}</div>
    <div><p className="text-sm text-white/70 mb-2">Gönderilen İstekler</p>{outgoing.map((r)=> userRow(r, <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">Bekliyor</span>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Arkadaş Listesi</p>{friends.map((f)=> userRow(f, <div className="space-x-2"><button onClick={()=>removeFriend(Number(f.id))} className={`${btn} border-rose-300/40 bg-rose-500/10 text-rose-100`}>Arkadaşlıktan çıkar</button><button className={`${btn} border-cyan-300/30 bg-cyan-500/10 text-cyan-100`}>Oyuna davet et</button></div>))}</div>
  </section>;
}
