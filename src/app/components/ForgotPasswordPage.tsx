import { FormEvent, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

export function ForgotPasswordPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const copy = tr
    ? {
        eyebrow: "Hesap kurtarma",
        title: "Parolanı sıfırla",
        subtitle: "E-postana 6 haneli doğrulama kodu gönderilir. Kod doğruysa yeni parola belirleyebilirsin.",
        email: "E-posta",
        code: "Doğrulama kodu",
        newPassword: "Yeni parola",
        passwordHint: "En az 8 karakter",
        sendCode: "Sıfırlama kodu gönder",
        resetPassword: "Parolayı güncelle",
        backToLogin: "Giriş sayfasına dön",
        changeEmail: "E-postayı değiştir",
        genericError: "Bir hata oluştu.",
      }
    : {
        eyebrow: "Account recovery",
        title: "Reset your password",
        subtitle: "A 6-digit verification code will be sent to your email. Confirm it to set a new password.",
        email: "Email",
        code: "Verification code",
        newPassword: "New password",
        passwordHint: "At least 8 characters",
        sendCode: "Send reset code",
        resetPassword: "Update password",
        backToLogin: "Back to sign in",
        changeEmail: "Change email",
        genericError: "Something went wrong.",
      };

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

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/request-password-reset", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await readJson(response);
      setStep("code");
      setStatus({ type: "success", message: data?.message || copy.sendCode });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.genericError });
    } finally {
      setLoading(false);
    }
  };

  const completeReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/complete-password-reset", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await readJson(response);
      setCode("");
      setPassword("");
      setStatus({ type: "success", message: data?.message || copy.resetPassword });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.genericError });
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
          <a href="/signin" className="inline-flex text-sm text-white underline underline-offset-4">
            {copy.backToLogin}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-cyan-500/5 backdrop-blur-xl sm:p-6"
        >
          <form onSubmit={step === "email" ? requestCode : completeReset} className="space-y-5 rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
            <label className="block space-y-2">
              <span className="text-sm text-white/55">{copy.email}</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={step === "code"}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40 disabled:opacity-60"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </label>

            {step === "code" && (
              <>
                <label className="block space-y-2">
                  <span className="text-sm text-white/55">{copy.code}</span>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-2xl tracking-[0.35em] text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-white/55">{copy.newPassword}</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
                    placeholder={copy.passwordHint}
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}

            {status && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
                {status.message}
              </div>
            )}

            {step === "code" && (
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setPassword("");
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
              {loading ? "..." : step === "email" ? copy.sendCode : copy.resetPassword}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
