import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

type ProjectRequest = {
  id: number;
  project_name: string;
  project_type: string;
  budget_range?: string;
  deadline?: string;
  description: string;
  status: string;
  created_at?: string;
};

const statusLabels: Record<string, { tr: string; en: string }> = {
  new: { tr: "Yeni alındı", en: "Received" },
  reviewed: { tr: "İncelendi", en: "Reviewed" },
  contacted: { tr: "İletişime geçildi", en: "Contacted" },
  accepted: { tr: "Onaylandı", en: "Accepted" },
  rejected: { tr: "Reddedildi", en: "Rejected" },
};

export function AccountPage() {
  const { language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const tr = language === "tr";

  const initials = useMemo(() => {
    const source = user?.name || user?.email || "E";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E";
  }, [user]);

  const loadRequests = () => {
    fetch("/api/my-project-requests", { credentials: "same-origin" })
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

  useEffect(() => {
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        const nextUser = data?.user || null;
        setUser(nextUser);
        if (nextUser) loadRequests();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;

    const timer = window.setInterval(loadRequests, 10000);
    return () => window.clearInterval(timer);
  }, [user, language]);

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

      <div className="relative mx-auto max-w-5xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-semibold text-black">
                {initials}
              </div>
              <div>
                <p className="text-sm text-cyan-100/70">{tr ? "Hesap profili" : "Account profile"}</p>
                <h1 className="mt-1 text-3xl font-medium text-white sm:text-4xl">{user?.name || "EkaTech User"}</h1>
                <p className="mt-2 text-white/45">{user?.email}</p>
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

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <InfoCard label={tr ? "Kullanıcı ID" : "User ID"} value={user?.id ? String(user.id) : "-"} />
            <InfoCard label={tr ? "Rol" : "Role"} value={user?.role || "client"} />
            <InfoCard label={tr ? "Oturum" : "Session"} value={user ? (tr ? "Aktif" : "Active") : "-"} />
          </div>

          <div className={`mt-8 grid gap-3 ${user?.role === "admin" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            <a href="/" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center font-medium text-white/80 transition-all hover:bg-white/[0.07]">
              {tr ? "Ana sayfaya dön" : "Back to home"}
            </a>
            {user?.role === "admin" && (
              <a href="/admin" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center font-medium text-white/80 transition-all hover:bg-white/[0.07]">
                {tr ? "Admin paneli" : "Admin panel"}
              </a>
            )}
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-cyan-100/70">{tr ? "Canlı proje takibi" : "Live project tracking"}</p>
              <h2 className="mt-2 text-3xl font-medium text-white">{tr ? "Müşteri proje durumları" : "Client project status"}</h2>
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

          <div className="mt-6 space-y-3">
            {requests.length === 0 && !requestError && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/55">
                {tr ? "Henüz proje talebin yok. Ana sayfadaki proje talebi formundan yeni talep gönderebilirsin." : "You do not have any project requests yet. Submit one from the project request form on the home page."}
              </div>
            )}

            {requests.map((request) => {
              const label = statusLabels[request.status]?.[tr ? "tr" : "en"] || request.status;

              return (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/35">{request.project_type}</p>
                      <h3 className="text-xl font-medium text-white">{request.project_name}</h3>
                      <p className="text-sm leading-6 text-white/55">{request.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-white/45">
                        {request.budget_range && <span className="rounded-full bg-white/[0.06] px-3 py-1">{tr ? "Bütçe" : "Budget"}: {request.budget_range}</span>}
                        {request.deadline && <span className="rounded-full bg-white/[0.06] px-3 py-1">{tr ? "Hedef" : "Target"}: {request.deadline}</span>}
                        {request.created_at && <span className="rounded-full bg-white/[0.06] px-3 py-1">{request.created_at}</span>}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black">
                      {label}
                    </div>
                  </div>
                </div>
              );
            })}
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
