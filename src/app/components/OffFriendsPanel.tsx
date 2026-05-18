import { useEffect, useState } from "react";
import { toast } from "sonner";

type Item = { id: number; user_id?: number; friend_id?: number; name: string; avatar_url?: string; level?: number; requester_id?: number; addressee_id?: number };

export function OffFriendsPanel() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<Item[]>([]);
  const [friends, setFriends] = useState<Item[]>([]);
  const [incoming, setIncoming] = useState<Item[]>([]);
  const [outgoing, setOutgoing] = useState<Item[]>([]);

  const load = async () => {
    const [f, r] = await Promise.all([fetch("/api/off/friends"), fetch("/api/off/friends/requests")]);
    const fj = await f.json(); const rj = await r.json();
    setFriends(fj.friends || []); setIncoming(rj.incoming || []); setOutgoing(rj.outgoing || []);
  };

  useEffect(() => { void load(); }, []);

  const searchUsers = async () => {
    const res = await fetch(`/api/off/users/search?q=${encodeURIComponent(q)}`);
    const data = await res.json(); setSearch(data.users || []);
  };

  const sendRequest = async (userId: number) => {
    const res = await fetch("/api/off/friends/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "Hata");
    toast.success("İstek gönderildi"); load();
  };

  const respond = async (friendshipId: number, action: "accept"|"reject") => {
    const res = await fetch("/api/off/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendshipId, action }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "Hata");
    toast.success(action === "accept" ? "İstek kabul edildi" : "İstek reddedildi"); load();
  };

  const removeFriend = async (userId: number) => {
    const res = await fetch("/api/off/friends/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    if (res.ok) { toast.success("Arkadaş silindi"); load(); } else toast.error("Hata");
  };

  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6 text-white space-y-4">
    <h3 className="text-xl font-semibold">Arkadaşlar</h3>
    <div className="flex gap-2"><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Kullanıcı ara" className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2"/><button onClick={searchUsers} className="rounded-xl px-3 py-2 bg-cyan-500/20">Ara</button></div>
    <div className="grid gap-2 md:grid-cols-2">{search.map((u)=> <div key={u.id} className="rounded-xl border border-white/10 p-3 flex items-center justify-between"><div>{u.name} · Lvl {u.level || 1}</div><button onClick={()=>sendRequest(u.id)} className="text-xs rounded-lg px-2 py-1 bg-emerald-500/20">Arkadaş ekle</button></div>)}</div>
    <div><p className="text-sm text-white/70 mb-2">Gelen İstekler</p>{incoming.map((r)=><div key={r.id} className="flex justify-between border-b border-white/10 py-2"><span>{r.name}</span><div className="space-x-2"><button onClick={()=>respond(r.id,"accept")} className="text-emerald-300">Kabul</button><button onClick={()=>respond(r.id,"reject")} className="text-rose-300">Reddet</button></div></div>)}</div>
    <div><p className="text-sm text-white/70 mb-2">Gönderilen İstekler</p>{outgoing.map((r)=><div key={r.id} className="py-1">{r.name} · Bekliyor</div>)}</div>
    <div><p className="text-sm text-white/70 mb-2">Arkadaş Listesi</p>{friends.map((f)=><div key={f.id} className="flex justify-between border-b border-white/10 py-2"><span>{f.name} · Lvl {f.level || 1}</span><div className="space-x-2"><button onClick={()=>removeFriend(Number(f.friend_id))} className="text-rose-300">Arkadaşlıktan çıkar</button><button className="text-cyan-300">Oyuna davet et (yakında)</button></div></div>)}</div>
  </section>;
}
