import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

export function AccountPage() {
  const { language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    setStatus(null);

    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
      setUser(null);
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

      <div className="relative mx-auto max-w-4xl">
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

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a href="/" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center font-medium text-white/80 transition-all hover:bg-white/[0.07]">
              {tr ? "Ana sayfaya dön" : "Back to home"}
            </a>
            <a href="/admin" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center font-medium text-white/80 transition-all hover:bg-white/[0.07]">
              {tr ? "Admin paneli" : "Admin panel"}
            </a>
          </div>
        </motion.div>
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
