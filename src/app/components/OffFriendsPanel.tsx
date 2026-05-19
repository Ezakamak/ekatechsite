import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Item = { id: number; userId?: number; friendshipId?: number; displayName: string; avatarUrl?: string | null; level?: number; xp?: number; selectedTitle?: string | null; status?: string; friendshipStatus?: string; secondaryLabel?: string | null; isOnline?: boolean; lastSeenAt?: string | null };
type InviteGameKey = "tech_duel" | "cipher_break" | "core_clash";
type InviteGameMode = "classic" | "best_focus" | "what_the_hold";
type InviteMapKey = "firewall_city" | "glitch_ruins" | "overclock_core" | "data_archive";
type InviteState = { friend: Item; gameKey: InviteGameKey; gameMode: InviteGameMode; roundCount: 3 | 5 | 7; mapKey: InviteMapKey; message: string };

const btn = "rounded-full px-3 py-1.5 text-xs font-medium transition border";
const ONLINE_REFRESH_MS = 300000;

export function OffFriendsPanel() {
  const [friends, setFriends] = useState<Item[]>([]);
  const [incoming, setIncoming] = useState<Item[]>([]);
  const [outgoing, setOutgoing] = useState<Item[]>([]);
  const [addableUsers, setAddableUsers] = useState<Item[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<InviteState | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [outgoingInvites, setOutgoingInvites] = useState<any[]>([]);
  const [watchingInviteIds, setWatchingInviteIds] = useState<number[]>([]);
  const [sentFlagByUser, setSentFlagByUser] = useState<Record<number, boolean>>({});

  const loadCore = async () => {
    try {
      const [f, r] = await Promise.all([fetch("/api/off/friends"), fetch("/api/off/friends/requests")]);
      if (!f.ok || !r.ok) throw new Error("OFF arkadaş verileri alınamadı");
      setFriends((await f.json()).friends || []);
      const req = await r.json();
      setIncoming(req.incoming || []);
      setOutgoing(req.outgoing || []);
      const invRes = await fetch("/api/off/game-invites");
      const invData = await invRes.json().catch(() => ({}));
      if (invRes.ok) {
        setOutgoingInvites(invData?.outgoing || []);
        const activeWatchedIds = (invData?.outgoing || []).map((i: any) => Number(i.inviteId)).filter((id: number) => Number.isFinite(id));
        setWatchingInviteIds((prev) => prev.filter((id) => activeWatchedIds.includes(id)));
      }
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
      const res = await fetch("/api/off/users/online");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error("Kullanıcı listesi JSON yerine HTML/hata sayfası döndürdü.");
      }
      if (!data || typeof data !== "object") throw new Error("Kullanıcı listesi geçersiz formatta geldi.");
      if (data?.error) throw new Error(String(data.error));
      if (!res.ok) throw new Error(data?.error || `Kullanıcı listesi yüklenemedi (HTTP ${res.status})`);
      if (!Array.isArray(data?.users)) throw new Error("Kullanıcı listesi geçersiz formatta geldi.");
      setAddableUsers(data.users);
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
    const handleFriendsRefresh = () => {
      void loadCore();
      void loadAddableUsers({ silent: true });
    };
    const id = window.setInterval(() => {
      void loadAddableUsers({ silent: true });
    }, ONLINE_REFRESH_MS);
    window.addEventListener("ekatech-off-friends-refresh", handleFriendsRefresh);
    window.addEventListener("ekatech-off-invites-refresh", handleFriendsRefresh);
    window.addEventListener("ekatech-tech-duel-refresh", handleFriendsRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("ekatech-off-friends-refresh", handleFriendsRefresh);
      window.removeEventListener("ekatech-off-invites-refresh", handleFriendsRefresh);
      window.removeEventListener("ekatech-tech-duel-refresh", handleFriendsRefresh);
    };
  }, []);

  const sendRequest = async (userId: number) => { const res = await fetch("/api/off/friends/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); const data = await res.json().catch(() => ({})); if (!res.ok) return toast.error(data.error || "Hata"); toast.success("İstek gönderildi"); loadCore(); loadAddableUsers({ silent: true }); };
  const respond = async (friendshipId: number, action: "accept"|"reject") => { const res = await fetch("/api/off/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendshipId, action }) }); const data = await res.json(); if (!res.ok) return toast.error(data.error || "Hata"); toast.success(action === "accept" ? "İstek kabul edildi" : "İstek reddedildi"); loadCore(); loadAddableUsers({ silent: true }); };
  const removeFriend = async (userId: number) => { const res = await fetch("/api/off/friends/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); if (res.ok) { toast.success("Arkadaş silindi"); loadCore(); loadAddableUsers({ silent: true }); } else toast.error("Hata"); };

  const sendInvite = async () => {
    if (!inviteState) return;
    setInviteSending(true);
    try {
      const bodyByGame: Record<InviteGameKey, Record<string, unknown>> = {
        tech_duel: { friendId: inviteState.friend.id, gameKey: "tech_duel", gameMode: inviteState.gameMode, roundCount: inviteState.roundCount, message: inviteState.message },
        cipher_break: { friendId: inviteState.friend.id, gameKey: "cipher_break", message: inviteState.message },
        core_clash: { friendId: inviteState.friend.id, gameKey: "core_clash", mapKey: inviteState.mapKey, message: inviteState.message },
      };
      const gameLabelByKey: Record<InviteGameKey, string> = { tech_duel: "Tech Duel", cipher_break: "Cipher Break", core_clash: "Core Clash" };
      const res = await fetch("/api/off/game-invites/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyByGame[inviteState.gameKey]) });
      const data = await res.json().catch(() => ({}));
      console.log("[off-game-invite:create]", { status: res.status, body: data });
      if (!res.ok) {
        const backendError = data?.error || data?.details || `HTTP ${res.status}`;
        return toast.error(`Davet gönderilemedi: ${backendError}`);
      }
      setInviteState(null);
      const inviteId = data?.inviteId;
      if (inviteId) {
        console.log("[off-game-invite:create:success] inviteId", inviteId);
        setWatchingInviteIds((prev) => prev.includes(Number(inviteId)) ? prev : [...prev, Number(inviteId)]);
      }
      if (data?.notificationError) {
        toast.warning(`Davet oluştu ama bildirim gönderilemedi: ${data.notificationError}`);
      }
      const successLabel = data?.gameLabel || gameLabelByKey[inviteState.gameKey];
      toast.success(inviteId ? `${successLabel} daveti gönderildi (ID: ${inviteId})` : `${successLabel} daveti gönderildi`);
      setSentFlagByUser((p) => ({ ...p, [inviteState.friend.id]: true }));
      window.setTimeout(() => setSentFlagByUser((p) => ({ ...p, [inviteState.friend.id]: false })), 2800);
      window.dispatchEvent(new Event("ekatech-off-invites-refresh"));
      void loadCore();
    } catch (error: any) {
      toast.error(`Davet gönderilemedi: ${error?.message || "Bilinmeyen hata"}`);
    } finally {
      setInviteSending(false);
    }
  };

  useEffect(() => {
    if (!watchingInviteIds.length) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/off/game-invites");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const outgoingRows = Array.isArray(data?.outgoing) ? data.outgoing : [];
        const outgoingRecent = Array.isArray(data?.outgoingRecent) ? data.outgoingRecent : [];
        const pendingById = new Map(outgoingRows.map((row: any) => [Number(row.inviteId), row]));
        setWatchingInviteIds((prev) => prev.filter((inviteId) => {
          const recent = outgoingRecent.find((row: any) => Number(row.inviteId) === inviteId);
          if (recent?.status === "accepted") {
            const handledKey = `handledOutgoingInvite:${inviteId}`;
            if (!sessionStorage.getItem(handledKey) && typeof recent.redirectTo === "string" && recent.redirectTo) {
              sessionStorage.setItem(handledKey, "1");
              toast.success("Davet kabul edildi, oyuna giriliyor...");
              window.history.pushState({}, "", recent.redirectTo);
              window.dispatchEvent(new Event("ekatech-route-change"));
              window.dispatchEvent(new Event("ekatech-off-invites-refresh"));
              if (recent.gameKey === "tech_duel") window.dispatchEvent(new Event("ekatech-tech-duel-refresh"));
              if (recent.gameKey === "cipher_break") window.dispatchEvent(new Event("ekatech-cipher-refresh"));
              if (recent.gameKey === "core_clash") window.dispatchEvent(new Event("ekatech-core-clash-refresh"));
            }
            return false;
          }
          if (recent?.status === "rejected") { toast.info("Davet reddedildi"); return false; }
          if (recent?.status === "expired") { toast.info("Davetin süresi doldu"); return false; }
          const pending = pendingById.get(inviteId);
          if (!pending) return false;
          if (String(pending.expiresAt || "") <= new Date().toISOString().slice(0, 19).replace("T", " ")) {
            toast.info("Davetin süresi doldu");
            return false;
          }
          return true;
        }));
      } catch {
        // ignore polling errors
      }
    };
    void run();
    const id = window.setInterval(() => { void run(); }, 3000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [watchingInviteIds]);

  const hasPendingFor = (userId: number, gameKey: InviteGameKey) => outgoingInvites.some((i: any) => i.invitee?.id === userId && i.status === "pending" && i.gameKey === gameKey);
  const userRow = (u: Item, action?: ReactNode) => <div key={`${u.id}-${u.friendshipId || "x"}`} className="rounded-2xl border border-white/15 bg-white/[0.05] px-3 py-2 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className="relative shrink-0">{u.avatarUrl ? <img src={u.avatarUrl} alt={u.displayName} className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40" />}{u.isOnline ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-black/40 bg-emerald-400" /> : null}</div> <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{u.displayName}</p><p className="text-xs text-white/65">{u.secondaryLabel || (u.level ? `Lvl ${u.level}${u.selectedTitle ? ` · ${u.selectedTitle}` : ""}` : "Kullanıcı")}</p></div></div>{action}</div>;
  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6 text-white space-y-5">
    <h3 className="text-xl font-semibold">Arkadaşlar</h3>
    <div>
      <div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm text-white/70">Kullanıcılar</p><button onClick={() => loadAddableUsers()} disabled={loadingUsers} className={`${btn} border-cyan-300/40 bg-cyan-500/20 disabled:opacity-60`}>{loadingUsers ? "Yenileniyor..." : "Yenile"}</button></div>
      {usersError ? <p className="text-sm text-rose-200/90">{usersError}</p> : addableUsers.length === 0 ? <p className="text-sm text-white/60">Eklenebilecek kullanıcı yok.</p> : <div className="grid gap-2 md:grid-cols-2">{addableUsers.map((u)=> userRow(u, <button onClick={()=>sendRequest(u.id)} className={`${btn} border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25 text-cyan-100`}>Arkadaş ekle</button>))}</div>}
    </div>
    <div><p className="text-sm text-white/70 mb-2">Gelen İstekler</p>{incoming.length ? incoming.map((r)=> userRow(r, <div className="flex gap-2"><button onClick={()=>respond(Number(r.friendshipId),"accept")} className={`${btn} border-emerald-300/45 bg-gradient-to-r from-emerald-400/30 to-cyan-400/20 text-emerald-50 hover:shadow-[0_0_16px_rgba(52,211,153,0.35)]`}>Kabul et</button><button onClick={()=>respond(Number(r.friendshipId),"reject")} className={`${btn} border-rose-300/40 bg-gradient-to-r from-rose-500/20 to-fuchsia-500/20 text-rose-50 hover:shadow-[0_0_16px_rgba(244,63,94,0.35)]`}>Reddet</button></div>)) : <p className="text-sm text-white/60">Bekleyen istek yok.</p>}</div>
    <div><p className="text-sm text-white/70 mb-2">Gönderilen İstekler</p>{outgoing.map((r)=> userRow(r, <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">Bekliyor</span>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Arkadaş Listesi</p>{friends.map((f)=> userRow(f, <div className="space-x-2"><button onClick={()=>removeFriend(Number(f.id))} className={`${btn} border-rose-300/40 bg-rose-500/10 text-rose-100`}>Arkadaşlıktan çıkar</button><button onClick={()=>setInviteState({ friend: f, gameKey: "tech_duel", gameMode: "classic", roundCount: 5, mapKey: "firewall_city", message: "" })} className={`${btn} border-cyan-300/30 bg-cyan-500/10 text-cyan-100`}>Oyuna davet et</button>{sentFlagByUser[Number(f.id)] ? <span className="text-xs text-emerald-200">Davet gönderildi</span> : null}</div>))}</div>
    {inviteState ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#060b14] p-5"><h4 className="text-lg font-semibold">{inviteState.friend.displayName} kişisini oyuna davet et</h4><div className="mt-3 space-y-3 text-sm"><div><p>Oyun seçimi</p><select className="mt-1 w-full rounded-xl bg-black/30 p-2" value={inviteState.gameKey} onChange={(e)=>setInviteState({ ...inviteState, gameKey: e.target.value as InviteGameKey })}><option value="tech_duel">Tech Duel</option><option value="cipher_break">Cipher Break</option><option value="core_clash">Core Clash</option></select>{hasPendingFor(Number(inviteState.friend.id), inviteState.gameKey) ? <p className="mt-1 text-xs text-amber-200">Bu oyun için aktif davet var.</p> : null}</div>{inviteState.gameKey === "tech_duel" ? <><div><p>Mod seçimi</p><select className="mt-1 w-full rounded-xl bg-black/30 p-2" value={inviteState.gameMode} onChange={(e)=>setInviteState({ ...inviteState, gameMode: e.target.value as InviteGameMode })}><option value="classic">Classic Mode</option><option value="best_focus">Best Focus</option><option value="what_the_hold">What The Hold</option></select></div><div><p>Round</p><select className="mt-1 w-full rounded-xl bg-black/30 p-2" value={inviteState.roundCount} onChange={(e)=>setInviteState({ ...inviteState, roundCount: Number(e.target.value) as 3 | 5 | 7 })}><option value={3}>Best of 3</option><option value={5}>Best of 5</option><option value={7}>Best of 7</option></select></div></> : null}{inviteState.gameKey === "cipher_break" ? <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/85">Cipher Break: 3 parça kod kilitleme VS modu.</p> : null}{inviteState.gameKey === "core_clash" ? <><div><p>Harita seçimi</p><select className="mt-1 w-full rounded-xl bg-black/30 p-2" value={inviteState.mapKey} onChange={(e)=>setInviteState({ ...inviteState, mapKey: e.target.value as InviteMapKey })}><option value="firewall_city">Firewall City</option><option value="glitch_ruins">Glitch Ruins</option><option value="overclock_core">Overclock Core</option><option value="data_archive">Data Archive</option></select></div><p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/85">Core Clash: aynı anda kart seçme strateji düellosu.</p></> : null}<textarea value={inviteState.message} onChange={(e)=>setInviteState({ ...inviteState, message: e.target.value.slice(0,160) })} placeholder="Mesaj (opsiyonel)" className="w-full rounded-xl bg-black/30 p-2" /></div><div className="mt-4 flex justify-end gap-2"><button className={`${btn} border-white/20`} onClick={()=>setInviteState(null)}>İptal</button><button disabled={inviteSending || hasPendingFor(Number(inviteState.friend.id), inviteState.gameKey)} className={`${btn} border-cyan-300/40 bg-cyan-500/20 disabled:opacity-60`} onClick={sendInvite}>{inviteSending ? "Gönderiliyor..." : "Davet gönder"}</button></div></div></div> : null}
  </section>;
}
