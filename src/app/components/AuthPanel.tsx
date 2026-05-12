import { FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type AuthMode = "login" | "signup";

type User = {
  id: number;
  name: string;
  email: string;
};

export function AuthPanel() {
  const { language } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const t =
    language === "tr"
      ? {
          eyebrow: "Müşteri erişimi",
          title: "EkaTech hesabına giriş yap",
          subtitle: "Proje talepleri, teklif süreci ve özel müşteri alanı için temel hesap sistemi.",
          login: "Giriş Yap",
          signup: "Kayıt Ol",
          name: "Ad Soyad",
          email: "E-posta",
          password: "Şifre",
          passwordHint: "En az 8 karakter",
          submitLogin: "Giriş yap",
          submitSignup: "Hesap oluştur",
          logout: "Çıkış yap",
          dashboard: "Müşteri paneli",
          signedIn: "Giriş yapıldı",
          welcome: "Hoş geldin",
          comingSoon: "Buraya proje talebi, teklif takibi ve admin panel bağlayabiliriz.",
          genericError: "Bir hata oluştu.",
        }
      : {
          eyebrow: "Client access",
          title: "Sign in to EkaTech",
          subtitle: "A lightweight account system for project requests, proposal tracking and client access.",
          login: "Sign In",
          signup: "Sign Up",
          name: "Full Name",
          email: "Email",
          password: "Password",
          passwordHint: "At least 8 characters",
          submitLogin: "Sign in",
          submitSignup: "Create account",
          logout: "Log out",
          dashboard: "Client dashboard",
          signedIn: "Signed in",
          welcome: "Welcome",
          comingSoon: "We can connect project requests, proposal tracking and an admin panel here.",
          genericError: "Something went wrong.",
        };

  useEffect(() => {
    let active = true;

    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (active && data?.user) setUser(data.user);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const endpoint = mode === "signup" ? "/api/signup" : "/api/login";
      const payload = mode === "signup" ? { name, email, password } : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || t.genericError);
      }

      setUser(data.user);
      setPassword("");
      setStatus({ type: "success", message: data?.message || t.signedIn });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : t.genericError });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setStatus(null);

    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      setUser(null);
      setStatus({ type: "success", message: language === "tr" ? "Çıkış yapıldı." : "Logged out." });
    } catch {
      setStatus({ type: "error", message: t.genericError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="auth" className="relative overflow-hidden bg-black px-4 py-24 sm:px-6">
      <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55 }}
          className="space-y-6"
        >
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-cyan-100/80">
            {t.eyebrow}
          </div>
          <div className="max-w-2xl space-y-4">
            <h2 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">{t.title}</h2>
            <p className="text-lg leading-8 text-white/55">{t.subtitle}</p>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {["D1", "Pages Functions", "Secure Cookie"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/70">
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-cyan-500/5 backdrop-blur-xl sm:p-6"
        >
          {user ? (
            <div className="space-y-6 rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
              <div>
                <p className="text-sm text-cyan-100/70">{t.dashboard}</p>
                <h3 className="mt-2 text-3xl font-medium text-white">
                  {t.welcome}, {user.name}
                </h3>
                <p className="mt-2 text-white/45">{user.email}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/60">
                {t.comingSoon}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full rounded-full border border-white/10 bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.logout}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
              <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    mode === "login" ? "bg-white text-black" : "text-white/55 hover:text-white"
                  }`}
                >
                  {t.login}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    mode === "signup" ? "bg-white text-black" : "text-white/55 hover:text-white"
                  }`}
                >
                  {t.signup}
                </button>
              </div>

              {mode === "signup" && (
                <label className="block space-y-2">
                  <span className="text-sm text-white/55">{t.name}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition-all placeholder:text-white/25 focus:border-cyan-200/40"
                    placeholder={t.name}
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm text-white/55">{t.email}</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition-all placeholder:text-white/25 focus:border-cyan-200/40"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-white/55">{t.password}</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition-all placeholder:text-white/25 focus:border-cyan-200/40"
                  placeholder={t.passwordHint}
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </label>

              {status && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    status.type === "success"
                      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                      : "border-red-300/20 bg-red-300/10 text-red-100"
                  }`}
                >
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "..." : mode === "signup" ? t.submitSignup : t.submitLogin}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
