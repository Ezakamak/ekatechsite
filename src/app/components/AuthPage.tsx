import { FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type AuthMode = "login" | "signup";

type User = {
  id: number;
  name: string;
  email: string;
};

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [waitingForCode, setWaitingForCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isSignup = mode === "signup";
  const tr = language === "tr";

  const copy = tr
    ? {
        eyebrow: isSignup ? "Yeni hesap" : "Müşteri girişi",
        title: isSignup ? "EkaTech hesabı oluştur" : "EkaTech hesabına giriş yap",
        subtitle: isSignup
          ? "Önce e-postana doğrulama kodu gönderilir. Kod doğruysa hesap oluşturulur."
          : "Proje taleplerini ve müşteri panelini yönetmek için giriş yap.",
        name: "Ad Soyad",
        email: "E-posta",
        password: "Şifre",
        code: "Doğrulama kodu",
        codeHint: "6 haneli kod",
        passwordHint: "En az 8 karakter",
        sendCode: "Doğrulama kodu gönder",
        completeSignup: "Kodu doğrula ve hesabı oluştur",
        signin: "Giriş yap",
        google: "Google ile devam et",
        forgotPassword: "Parolamı unuttum",
        switchText: isSignup ? "Zaten hesabın var mı?" : "Hesabın yok mu?",
        switchLink: isSignup ? "Giriş yap" : "Kayıt ol",
        dashboard: "Müşteri paneli",
        welcome: "Hoş geldin",
        logout: "Çıkış yap",
        genericError: "Bir hata oluştu.",
        changeEmail: "E-postayı değiştir",
        or: "veya",
      }
    : {
        eyebrow: isSignup ? "New account" : "Client login",
        title: isSignup ? "Create your EkaTech account" : "Sign in to EkaTech",
        subtitle: isSignup
          ? "A verification code is sent first. The account is created only after the code is confirmed."
          : "Sign in to manage project requests and client access.",
        name: "Full Name",
        email: "Email",
        password: "Password",
        code: "Verification code",
        codeHint: "6-digit code",
        passwordHint: "At least 8 characters",
        sendCode: "Send verification code",
        completeSignup: "Verify code and create account",
        signin: "Sign in",
        google: "Continue with Google",
        forgotPassword: "Forgot password?",
        switchText: isSignup ? "Already have an account?" : "Need an account?",
        switchLink: isSignup ? "Sign in" : "Sign up",
        dashboard: "Client dashboard",
        welcome: "Welcome",
        logout: "Log out",
        genericError: "Something went wrong.",
        changeEmail: "Change email",
        or: "or",
      };

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setStatus({ type: "error", message: error });
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.user) setUser(data.user);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const readJson = async (response: Response) => {
    const raw = await response.text();
    let data: any = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const fallback = raw?.slice(0, 160) || copy.genericError;
      throw new Error(data?.error || `HTTP ${response.status}: ${fallback}`);
    }

    return data;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      if (isSignup && waitingForCode) {
        const response = await fetch("/api/complete-signup", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: verificationCode }),
        });

        const data = await readJson(response);
        setUser(data.user);
        setPassword("");
        setVerificationCode("");
        setWaitingForCode(false);
        window.dispatchEvent(new Event("ekatech-auth-change"));
        setStatus({ type: "success", message: data?.message || copy.completeSignup });
        return;
      }

      const endpoint = isSignup ? "/api/signup" : "/api/login";
      const payload = isSignup ? { name, email, password } : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(response);

      if (isSignup && data?.requiresCode) {
        setWaitingForCode(true);
        setStatus({ type: "success", message: data?.message || copy.sendCode });
        return;
      }

      if (data?.user) {
        setUser(data.user);
        window.dispatchEvent(new Event("ekatech-auth-change"));
      }

      setPassword("");
      setStatus({ type: "success", message: data?.message || copy.signin });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.genericError });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setStatus(null);

    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
      setUser(null);
      window.dispatchEvent(new Event("ekatech-auth-change"));
      setStatus({ type: "success", message: tr ? "Çıkış yapıldı." : "Logged out." });
    } catch {
      setStatus({ type: "error", message: copy.genericError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-20 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-52 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="space-y-6"
        >
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-cyan-100/80">
            {copy.eyebrow}
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-medium tracking-tight text-white sm:text-6xl">{copy.title}</h1>
            <p className="text-lg leading-8 text-white/55">{copy.subtitle}</p>
          </div>
          <p className="text-sm text-white/45">
            {copy.switchText} <a href={isSignup ? "/signin" : "/signup"} className="text-white underline underline-offset-4">{copy.switchLink}</a>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-cyan-500/5 backdrop-blur-xl sm:p-6"
        >
          {user ? (
            <div className="space-y-6 rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
              <div>
                <p className="text-sm text-cyan-100/70">{copy.dashboard}</p>
                <h2 className="mt-2 text-3xl font-medium text-white">{copy.welcome}, {user.name}</h2>
                <p className="mt-2 text-white/45">{user.email}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <a href="/" className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-center font-medium text-white/80 transition-all hover:bg-white/[0.1]">
                  Home
                </a>
                <a href="/account" className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-center font-medium text-white/80 transition-all hover:bg-white/[0.1]">
                  Account
                </a>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.logout}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
              <a
                href="/api/auth/google"
                className="flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-base font-bold text-black">G</span>
                {copy.google}
              </a>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-white/30">
                <div className="h-px flex-1 bg-white/10" />
                {copy.or}
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {isSignup && !waitingForCode && (
                <label className="block space-y-2">
                  <span className="text-sm text-white/55">{copy.name}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
                    placeholder={copy.name}
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm text-white/55">{copy.email}</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={waitingForCode}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40 disabled:opacity-60"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </label>

              {!waitingForCode && (
                <label className="block space-y-2">
                  <span className="text-sm text-white/55">{copy.password}</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
                    placeholder={copy.passwordHint}
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                  />
                </label>
              )}

              {!isSignup && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigateTo("/signin?forgot=1")}
                    className="text-sm text-white/55 underline underline-offset-4 transition-colors hover:text-white"
                  >
                    {copy.forgotPassword}
                  </button>
                </div>
              )}

              {isSignup && waitingForCode && (
                <label className="block space-y-2">
                  <span className="text-sm text-white/55">{copy.code}</span>
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-2xl tracking-[0.35em] text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
                    placeholder={copy.codeHint}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
              )}

              {status && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
                  {status.message}
                </div>
              )}

              {isSignup && waitingForCode && (
                <button
                  type="button"
                  onClick={() => {
                    setWaitingForCode(false);
                    setVerificationCode("");
                    setStatus(null);
                  }}
                  className="w-full rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-medium text-white transition-all hover:bg-white/[0.1]"
                >
                  {copy.changeEmail}
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "..." : isSignup ? (waitingForCode ? copy.completeSignup : copy.sendCode) : copy.signin}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}
