import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";
import { ProjectStageWheel } from "./ProjectStageWheel";
import { CustomerProjectDetails } from "./CustomerProjectDetails";

type User = {
  id: number;
  name: string;
  displayName?: string;
  email: string;
  role?: string;
  avatar_url?: string;
};

type ProjectRequest = {
  id: number;
  project_name: string;
  project_type: string;
  budget_range?: string;
  deadline?: string;
  target_date?: string;
  priority?: string;
  description: string;
  status: string;
  created_at?: string;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  assigned_admin_email?: string | null;
  assigned_admin_avatar_url?: string | null;
  feedback_rating?: number | null;
  feedback_comment?: string | null;
};

export function AccountPage() {
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const tr = language === "tr";
  const canUseAdmin = user?.role === "admin" || user?.role === "owner";

  const publicDisplayName = useMemo(() => {
    const normalized = String(displayName || "").trim();
    if (normalized) return normalized;
    if (user?.id) return `Guest ${user.id}`;
    return "Guest";
  }, [displayName, user?.id]);

  const initials = useMemo(() => {
    const source = publicDisplayName || user?.email || "E";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E";
  }, [publicDisplayName, user?.email]);

  const loadRequests = () => {
    return fetch("/api/my-project-requests", { credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Request failed");
        return data;
      })
      .then((data) => {
        setRequests(data?.requests || []);
        setRequestError("");
        setLastUpdated(new Date().toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      })
      .catch((error) => setRequestError(error instanceof Error ? error.message : tr ? "Proje durumları alınamadı." : "Could not load project status."));
  };

  const loadUser = () => {
    return fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then(async (data) => {
        const nextUser = data?.user || null;
        setUser(nextUser);
        if (nextUser) {
          setDisplayName(String(nextUser.displayName || ""));
          await loadRequests();
          const profileRes = await fetch("/api/account/profile", { credentials: "same-origin", cache: "no-store" });
          const profile = await profileRes.json().catch(() => null);
          setNickname(String(profile?.nickname || ""));
          setDisplayName(String(profile?.displayName || ""));
        }
        else setRequests([]);
      })
      .catch(() => {
        setUser(null);
        setRequests([]);
      });
  };

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const refreshAfterAuthChange = () => {
      setLoading(true);
      setStatus(null);
      loadUser().finally(() => {
        setLoading(false);
        window.dispatchEvent(new Event("ekatech-transition-end"));
      });
    };

    window.addEventListener("ekatech-auth-change", refreshAfterAuthChange);
    window.addEventListener("ekatech-account-switched", refreshAfterAuthChange);

    return () => {
      window.removeEventListener("ekatech-auth-change", refreshAfterAuthChange);
      window.removeEventListener("ekatech-account-switched", refreshAfterAuthChange);
    };
  }, [language]);

  useEffect(() => {
    if (!user) return;

    const timer = window.setInterval(loadRequests, 10000);
    return () => window.clearInterval(timer);
  }, [user, language]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(null);

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: tr ? "Sadece görsel dosyası seçebilirsin." : "Choose an image file only." });
      return;
    }

    setAvatarLoading(true);

    try {
      const avatarUrl = await compressImage(file);

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (tr ? "Fotoğraf kaydedilemedi." : "Could not save photo."));

      setUser((current) => (current ? { ...current, avatar_url: data.avatar_url || avatarUrl } : current));
      window.dispatchEvent(new Event("ekatech-auth-change"));
      setStatus({ type: "success", message: tr ? "Profil fotoğrafı güncellendi." : "Profile photo updated." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Fotoğraf yüklenemedi." : "Could not upload photo." });
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setStatus(null);
    setAvatarLoading(true);

    try {
      const response = await fetch("/api/account/avatar", {
        method: "DELETE",
        credentials: "same-origin",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (tr ? "Fotoğraf kaldırılamadı." : "Could not remove photo."));

      setUser((current) => (current ? { ...current, avatar_url: "" } : current));
      window.dispatchEvent(new Event("ekatech-auth-change"));
      setStatus({ type: "success", message: tr ? "Profil fotoğrafı kaldırıldı." : "Profile photo removed." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Fotoğraf kaldırılamadı." : "Could not remove photo." });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleLogout = async () => {
    setStatus(null);

    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
      setUser(null);
      setRequests([]);
      window.dispatchEvent(new Event("ekatech-auth-change"));
      setStatus({ type: "success", message: tr ? "Çıkış yapıldı." : "Logged out." });
    } catch {
      setStatus({ type: "error", message: tr ? "Çıkış yapılamadı." : "Could not log out." });
    }
  };



  const saveNickname = async () => {
    setStatus(null);
    setNicknameSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || (tr ? "Nickname kaydedilemedi." : "Nickname could not be saved."));
      setNickname(String(data.nickname || ""));
      setDisplayName(String(data.displayName || ""));
      setStatus({ type: "success", message: tr ? "Nickname güncellendi." : "Nickname updated." });
      window.dispatchEvent(new Event("ekatech-auth-change"));
      await loadUser();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Nickname kaydedilemedi." : "Nickname could not be saved." });
    } finally {
      setNicknameSaving(false);
    }
  };
  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">
          {tr ? "Hesap bilgileri yükleniyor..." : "Loading account..."}
        </div>
      </main>
    );
  }

  if (!loading && !user) {
    return (
      <main className="relative flex min-h-screen items-center overflow-hidden bg-black px-4 py-24 sm:px-6">
        <div className="relative mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center backdrop-blur-xl sm:p-8">
          <h1 className="text-4xl font-medium tracking-tight text-white">
            {tr ? "Hesap bilgileri için giriş yap" : "Sign in to view your account"}
          </h1>
          <p className="mt-4 text-white/55">
            {tr ? "Bu sayfa sadece giriş yapan kullanıcılar içindir." : "This page is only available for signed-in users."}
          </p>
          <a href="/signin" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-medium text-black transition-all hover:bg-gray-200">
            {tr ? "Giriş yap" : "Sign in"}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-20 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-52 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-6">
        <motion.div
          key={user?.id || "guest"}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-full bg-white text-black ring-1 ring-white/20">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-semibold">{initials}</div>
                )}
              </div>

              <div>
                <p className="text-sm text-cyan-100/70">{tr ? "Hesap profili" : "Account profile"}</p>
                <h1 className="mt-1 text-3xl font-medium text-white sm:text-4xl">{publicDisplayName}</h1>
                <p className="mt-2 text-white/45">{user?.email}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarLoading}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {avatarLoading ? "..." : tr ? "Profil fotoğrafı ekle" : "Add profile photo"}
                  </button>
                  {user?.avatar_url && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={avatarLoading}
                      className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {tr ? "Fotoğrafı kaldır" : "Remove photo"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-medium text-white transition-all hover:bg-white/[0.1]"
            >
              {tr ? "Çıkış yap" : "Log out"}
            </button>
          </div>

          {status && (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
              {status.message}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-white/60">{tr ? "Herkese görünen ad" : "Public display name"}</p>
            <p className="mt-1 text-lg font-medium text-white">{publicDisplayName}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                minLength={3}
                maxLength={24}
                placeholder={`${publicDisplayName} gibi görüneceksin`}
                className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-cyan-300/40 focus:outline-none"
              />
              <button type="button" onClick={saveNickname} disabled={nicknameSaving} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-60">
                {nicknameSaving ? "..." : tr ? "Nickname kaydet" : "Save nickname"}
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <InfoCard label={tr ? "Kullanıcı ID" : "User ID"} value={user?.id ? String(user.id) : "-"} />
            <InfoCard label={tr ? "Rol" : "Role"} value={user?.role || "client"} />
            <InfoCard label={tr ? "Oturum" : "Session"} value={user ? (tr ? "Aktif" : "Active") : "-"} />
          </div>

          <div className={`mt-8 grid gap-3 ${canUseAdmin ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            <a href="/" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center font-medium text-white/80 transition-all hover:bg-white/[0.07]">
              {tr ? "Ana sayfaya dön" : "Back to home"}
            </a>
            {canUseAdmin && (
              <a href="/admin" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center font-medium text-white/80 transition-all hover:bg-white/[0.07]">
                {tr ? "Admin paneli" : "Admin panel"}
              </a>
            )}
          </div>
        </motion.div>

        <motion.section
          key={`projects-${user?.id || "guest"}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-cyan-100/70">{tr ? "Canlı proje takibi" : "Live project tracking"}</p>
              <h2 className="mt-2 text-3xl font-medium text-white">{tr ? "Proje aşamaları" : "Project stages"}</h2>
              <p className="mt-2 text-sm text-white/45">
                {lastUpdated ? `${tr ? "Son güncelleme" : "Last update"}: ${lastUpdated}` : tr ? "10 saniyede bir otomatik yenilenir." : "Auto-refreshes every 10 seconds."}
              </p>
            </div>
            <button
              type="button"
              onClick={loadRequests}
              className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1]"
            >
              Refresh
            </button>
          </div>

          {requestError && (
            <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
              {requestError}
            </div>
          )}

          <div className="mt-6 space-y-5">
            {requests.length === 0 && !requestError && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/55">
                {tr ? "Henüz proje talebin yok. Ana sayfadaki proje talebi formundan yeni talep gönderebilirsin." : "You do not have any project requests yet. Submit one from the project request form on the home page."}
              </div>
            )}

            {requests.map((request) => (
              <div key={request.id} className="rounded-[2rem] border border-white/10 bg-black/20 p-4">
                <ProjectStageWheel request={request} />
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45">
                  <span className="rounded-full bg-white/[0.06] px-3 py-1">Öncelik: {request.priority || "normal"}</span>
                  {(request.target_date || request.deadline) && <span className="rounded-full bg-white/[0.06] px-3 py-1">Hedef: {request.target_date || request.deadline}</span>}
                </div>
                <CustomerProjectDetails projectId={request.id} status={request.status} />
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
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
      const maxSize = 320;
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
