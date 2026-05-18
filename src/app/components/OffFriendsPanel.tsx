import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { toast } from "sonner";

type Item = { id: number; userId?: number; friendshipId?: number; displayName: string; avatarUrl?: string | null; level?: number; xp?: number; selectedTitle?: string | null; status?: string; friendshipStatus?: string };
type OffProfile = { displayName: string; avatarUrl?: string | null; bannerUrl?: string | null; bio?: string | null; selectedTitle?: string | null; selectedBadge?: string | null };
type OffTitle = { code: string; name: string; description?: string | null; rarity?: string | null };

const btn = "rounded-full px-3 py-1.5 text-xs font-medium transition border";

export function OffFriendsPanel() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [friends, setFriends] = useState<Item[]>([]);
  const [incoming, setIncoming] = useState<Item[]>([]);
  const [outgoing, setOutgoing] = useState<Item[]>([]);
  const [profile, setProfile] = useState<OffProfile>({ displayName: "" });
  const [titles, setTitles] = useState<OffTitle[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const load = async () => {
    try {
      const [f, r, p, t] = await Promise.all([fetch("/api/off/friends"), fetch("/api/off/friends/requests"), fetch("/api/off/profile"), fetch("/api/off/titles")]);
      if (!f.ok || !r.ok || !p.ok || !t.ok) throw new Error("OFF verileri alınamadı");
      setFriends((await f.json()).friends || []);
      const req = await r.json();
      setIncoming(req.incoming || []);
      setOutgoing(req.outgoing || []);
      setProfile((await p.json()).profile || { displayName: "" });
      setTitles((await t.json()).titles || []);
    } catch (error: any) {
      toast.error(error?.message || "OFF panel yüklenemedi");
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [avatarPreview, bannerPreview]);

  const pickFile = (kind: "avatar" | "banner") => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Sadece PNG, JPEG veya WEBP yükleyebilirsin");
    const maxSize = kind === "avatar" ? 300 * 1024 : 700 * 1024;
    if (file.size > maxSize) return toast.error(kind === "avatar" ? "Avatar en fazla 300KB olabilir" : "Banner en fazla 700KB olabilir");

    const objectUrl = URL.createObjectURL(file);
    if (kind === "avatar") {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(objectUrl);
      setAvatarFile(file);
    } else {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview(objectUrl);
      setBannerFile(file);
    }
  };



  const compressImage = async (file: File, kind: "avatar" | "banner") => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Görsel okunamadı"));
      };
      image.src = url;
    });

    const maxWidth = kind === "avatar" ? 512 : 1400;
    const maxHeight = kind === "avatar" ? 512 : 520;
    const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Görsel işlenemedi");
    ctx.drawImage(img, 0, 0, width, height);

    const targetSize = kind === "avatar" ? 300 * 1024 : 700 * 1024;
    let quality = 0.9;
    let blob: Blob | null = null;
    while (quality >= 0.45) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= targetSize) break;
      quality -= 0.1;
    }
    if (!blob) throw new Error("Görsel sıkıştırılamadı");
    if (blob.size > targetSize) throw new Error(kind === "avatar" ? "Avatar en fazla 300KB olmalı" : "Banner en fazla 700KB olmalı");

    return new File([blob], `${kind}.webp`, { type: "image/webp" });
  };

  const fileToDataUrl = async (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Görsel okunamadı"));
    reader.readAsDataURL(file);
  });

  const saveProfile = async () => {
    if (savingProfile) return;
    try {
      setSavingProfile(true);
      const unlockedTitleCodes = new Set(titles.map((title) => title.code));
      const nextSelectedTitle = profile.selectedTitle && unlockedTitleCodes.has(profile.selectedTitle) ? profile.selectedTitle : null;
      const payload: Record<string, unknown> = {
        display_name: profile.displayName,
        bio: profile.bio,
        selected_title: nextSelectedTitle,
        selected_badge: profile.selectedBadge,
      };
      if (avatarFile) payload.avatar_data = await fileToDataUrl(await compressImage(avatarFile, "avatar"));
      if (bannerFile) payload.banner_data = await fileToDataUrl(await compressImage(bannerFile, "banner"));
      const res = await fetch("/api/off/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Profil kaydedilemedi");
      setProfile(data.profile || { displayName: "" });
      setAvatarFile(null);
      setBannerFile(null);
      toast.success("OFF profil kaydedildi");
    } catch (error: any) {
      toast.error(error?.message || "Profil kaydedilemedi");
    } finally {
      setSavingProfile(false);
    }
  };

  const searchUsers = async () => {
    const query = q.trim();
    if (query.length < 2) return toast.error("Arama için en az 2 karakter gir");
    try {
      setSearching(true);
      setHasSearched(true);
      const res = await fetch(`/api/off/users/search?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Arama yapılamadı");
      setSearch(data.users || []);
    } catch (error: any) {
      toast.error(error?.message || "Arama başarısız");
    } finally { setSearching(false); }
  };

  const sendRequest = async (userId: number) => { const res = await fetch("/api/off/friends/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); const data = await res.json(); if (!res.ok) return toast.error(data.error || "Hata"); toast.success("İstek gönderildi"); load(); };
  const respond = async (friendshipId: number, action: "accept"|"reject") => { const res = await fetch("/api/off/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendshipId, action }) }); const data = await res.json(); if (!res.ok) return toast.error(data.error || "Hata"); toast.success(action === "accept" ? "İstek kabul edildi" : "İstek reddedildi"); load(); };
  const removeFriend = async (userId: number) => { const res = await fetch("/api/off/friends/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); if (res.ok) { toast.success("Arkadaş silindi"); load(); } else toast.error("Hata"); };

  const titleSelectLabel = useMemo(() => titles.length ? "Lakap seç" : "Henüz lakap kazanmadın", [titles.length]);

  const userRow = (u: Item, action?: ReactNode) => <div key={`${u.id}-${u.friendshipId || "x"}`} className="rounded-2xl border border-white/15 bg-white/[0.05] px-3 py-2 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0">{u.avatarUrl ? <img src={u.avatarUrl} alt={u.displayName} className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40" />} <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{u.displayName}</p><p className="text-xs text-white/65">Lvl {u.level || 1}{u.selectedTitle ? ` · ${u.selectedTitle}` : ""}</p></div></div>{action}</div>;

  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6 text-white space-y-5">
    <h3 className="text-xl font-semibold">Arkadaşlar</h3>
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3"><p className="text-sm font-medium">OFF Profilim</p>
      {(bannerPreview || profile.bannerUrl) ? <img src={bannerPreview || profile.bannerUrl || ""} alt="Banner preview" className="h-24 w-full rounded-2xl object-cover border border-white/20" /> : null}
      <div className="flex items-center gap-3">{(avatarPreview || profile.avatarUrl) ? <img src={avatarPreview || profile.avatarUrl || ""} alt="Avatar preview" className="h-16 w-16 rounded-full object-cover border border-cyan-300/40 shadow-[0_0_18px_rgba(34,211,238,0.35)]" /> : <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40" />}<div className="flex gap-2"><label className={`${btn} cursor-pointer border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25`}>Avatar yükle<input type="file" accept="image/*" className="hidden" onChange={pickFile("avatar")} /></label><label className={`${btn} cursor-pointer border-cyan-300/30 bg-cyan-500/10`}>Banner yükle<input type="file" accept="image/*" className="hidden" onChange={pickFile("banner")} /></label></div></div>
      <div className="grid gap-2 md:grid-cols-2"><input value={profile.displayName || ""} onChange={(e)=>setProfile((s)=>({ ...s, displayName: e.target.value.slice(0,24) }))} placeholder="OFF görünen ad" className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/><select value={profile.selectedTitle || ""} onChange={(e)=>setProfile((s)=>({ ...s, selectedTitle: e.target.value || null }))} disabled={!titles.length} className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm disabled:opacity-60"><option value="">{titleSelectLabel}</option>{titles.map((t)=><option key={t.code} value={t.code}>{t.name}</option>)}</select></div><textarea value={profile.bio || ""} onChange={(e)=>setProfile((s)=>({ ...s, bio: e.target.value.slice(0,160) }))} placeholder="Bio" className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm"/><button type="button" onClick={saveProfile} disabled={savingProfile} className={`${btn} border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25 hover:shadow-[0_0_18px_rgba(34,211,238,0.35)] disabled:opacity-60`}>{savingProfile ? "Kaydediliyor..." : "Kaydet"}</button></div>
    <div className="flex gap-2"><input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>{ if (e.key === "Enter") void searchUsers(); }} placeholder="Kullanıcı ara (en az 2 karakter)" className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2"/><button onClick={searchUsers} disabled={searching} className={`${btn} border-cyan-300/40 bg-cyan-500/20 disabled:opacity-60`}>{searching ? "Aranıyor..." : "Ara"}</button></div>
    <div className="grid gap-2 md:grid-cols-2">{search.map((u)=> userRow(u, <button onClick={()=>sendRequest(u.id)} className={`${btn} border-cyan-300/40 bg-gradient-to-r from-cyan-400/25 to-purple-500/25 text-cyan-100`}>Arkadaş ekle</button>))}</div>
    {hasSearched && !searching && search.length === 0 ? <p className="text-sm text-white/70">Kullanıcı bulunamadı</p> : null}
    <div><p className="text-sm text-white/70 mb-2">Gelen İstekler</p>{incoming.map((r)=> userRow(r, <div className="space-x-2"><button onClick={()=>respond(Number(r.friendshipId),"accept")} className={`${btn} border-emerald-300/40 bg-emerald-400/20 text-emerald-100`}>Kabul et</button><button onClick={()=>respond(Number(r.friendshipId),"reject")} className={`${btn} border-rose-300/40 bg-rose-500/10 text-rose-100`}>Reddet</button></div>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Gönderilen İstekler</p>{outgoing.map((r)=> userRow(r, <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">Bekliyor</span>))}</div>
    <div><p className="text-sm text-white/70 mb-2">Arkadaş Listesi</p>{friends.map((f)=> userRow(f, <div className="space-x-2"><button onClick={()=>removeFriend(Number(f.id))} className={`${btn} border-rose-300/40 bg-rose-500/10 text-rose-100`}>Arkadaşlıktan çıkar</button><button className={`${btn} border-cyan-300/30 bg-cyan-500/10 text-cyan-100`}>Oyuna davet et</button></div>))}</div>
  </section>;
}
