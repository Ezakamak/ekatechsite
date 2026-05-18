import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

type Item = { id: number; userId?: number; friendshipId?: number; displayName: string; avatarUrl?: string | null; level?: number; xp?: number; selectedTitle?: string | null; status?: string };

type OffProfile = { displayName: string; avatarUrl?: string | null; bannerUrl?: string | null; bio?: string | null; selectedTitle?: string | null; selectedBadge?: string | null };

const btn = "rounded-full px-3 py-1.5 text-xs font-medium transition border";

export function OffFriendsPanel() {
  const [q, setQ] = useState(""); const [search, setSearch] = useState<Item[]>([]); const [friends, setFriends] = useState<Item[]>([]); const [incoming, setIncoming] = useState<Item[]>([]); const [outgoing, setOutgoing] = useState<Item[]>([]);
  const [profile, setProfile] = useState<OffProfile>({ displayName: "" });

  const load = async () => {
    const [f, r, p] = await Promise.all([fetch("/api/off/friends"), fetch("/api/off/friends/requests"), fetch("/api/off/profile")]);
    setFriends((await f.json()).friends || []); const req = await r.json(); setIncoming(req.incoming || []); setOutgoing(req.outgoing || []); setProfile((await p.json()).profile || { displayName: "" });
  };
  useEffect(() => { void load(); }, []);
  const searchUsers = async () => { const res = await fetch(`/api/off/users/search?q=${encodeURIComponent(q)}`); setSearch((await res.json()).users || []); };
  const sendRequest = async (userId: number) => { const res = await fetch("/api/off/friends/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); const data = await res.json(); if (!res.ok) return toast.error(data.error || "Hata"); toast.success("İstek gönderildi"); load(); };
  const respond = async (friendshipId: number, action: "accept"|"reject") => { const res = await fetch("/api/off/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendshipId, action }) }); const data = await res.json(); if (!res.ok) return toast.error(data.error || "Hata"); toast.success(action === "accept" ? "İstek kabul edildi" : "İstek reddedildi"); load(); };
  const removeFriend = async (userId: number) => { const res = await fetch("/api/off/friends/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); if (res.ok) { toast.success("Arkadaş silindi"); load(); } else toast.error("Hata"); };
  const saveProfile = async () => {
    const payload = {
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      banner_url: profile.bannerUrl,
      bio: profile.bio,
      selected_title: profile.selectedTitle,
      selected_badge: profile.selectedBadge,
    };
    const res = await fetch("/api/off/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error || "Profil kaydedilemedi");
    setProfile(data.profile || { displayName: "" });
    toast.success("OFF profil güncellendi");
  };

  const userRow = (u: Item, action?: ReactNode) => <div key={`${u.id}-${u.friendshipId || "x"}`} className="rounded-2xl border border-white/15 bg-white/[0.05] px-3 py-2 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0">{u.avatarUrl ? <img src={u.avatarUrl} alt={u.displayName} className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40" />} <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{u.displayName}</p><p className="text-xs text-white/65">Lvl {u.level || 1}{u.selectedTitle ? ` · ${u.selectedTitle}` : ""}</p></div></div>{action}</div>;

  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6 text-white space-y-5">
    <h3 className="text-xl font-semibold">Arkadaşlar</h3>
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2"><p className="text-sm font-medium">OFF Profilim</p><div className="grid gap-2 md:grid-cols-2"><input value={profile.displayName || ""} onChange={(e)=>setProfile((s)=>({ ...s, displayName: e.target.value.slice(0,24) }))} placeholder="OFF görünen ad" className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/><input value={profile.avatarUrl || ""} onChange={(e)=>setProfile((s)=>({ ...s, avatarUrl: e.target.value }))} placeholder="Avatar URL" className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/><input value={profile.bannerUrl || ""} onChange={(e)=>setProfile((s)=>({ ...s, bannerUrl: e.target.value }))} placeholder="Banner URL" className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/><input value={profile.selectedTitle || ""} onChange={(e)=>setProfile((s)=>({ ...s, selectedTitle: e.target.value }))} placeholder="Seçili title" className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/></div><textarea value={profile.bio || ""} onChange={(e)=>setProfile((s)=>({ ...s, bio: e.target.value.slice(0,160) }))} placeholder="Bio" className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/><button onClick={saveProfile} className={`${btn} border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25 hover:shadow-[0_0_18px_rgba(34,211,238,0.35)]`}>Kaydet</button></div>
    <div className="flex gap-2"><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Kullanıcı ara" className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2"/><button onClick={searchUsers} className={`${btn} border-cyan-300/40 bg-cyan-500/20`}>Ara</button></div>
    <div className="grid gap-2 md:grid-cols-2">{search.map((u)=> userRow(u, <button onClick={()=>sendRequest(u.id)} className={`${btn} border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25 text-cyan-100`}>Arkadaş ekle</button>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Gelen İstekler</p>{incoming.map((r)=> userRow(r, <div className="space-x-2"><button onClick={()=>respond(Number(r.friendshipId),"accept")} className={`${btn} border-emerald-300/40 bg-emerald-400/20 text-emerald-100`}>Kabul et</button><button onClick={()=>respond(Number(r.friendshipId),"reject")} className={`${btn} border-rose-300/40 bg-rose-500/10 text-rose-100`}>Reddet</button></div>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Gönderilen İstekler</p>{outgoing.map((r)=> userRow(r, <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">Bekliyor</span>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Arkadaş Listesi</p>{friends.map((f)=> userRow(f, <div className="space-x-2"><button onClick={()=>removeFriend(Number(f.id))} className={`${btn} border-rose-300/40 bg-rose-500/10 text-rose-100`}>Arkadaşlıktan çıkar</button><button className={`${btn} border-cyan-300/30 bg-cyan-500/10 text-cyan-100`}>Oyuna davet et</button></div>))}</div>
  </section>;
}
