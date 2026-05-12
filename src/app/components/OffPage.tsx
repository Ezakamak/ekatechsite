import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Shield, Sparkles, Trophy } from "lucide-react";
import { useLanguage } from "../i18n";
import techCoin from "../../imports/ekatech-coin.png";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function OffPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const copy = tr
    ? {
        eyebrow: "Admin özel alanı",
        title: "EkaTech OFF",
        subtitle: "Only for fun. Bu alan sadece admin ve owner hesaplarına görünür.",
        balance: "Tech Coin Bakiyesi",
        balanceValue: "100 TC",
        balanceNote: "Şimdilik demo bakiye. D1 cüzdan sistemi sonraki adımda bağlanacak.",
        coinTitle: "Tech Coin",
        coinDesc: "EkaTech içi eğlence puanı. Gerçek para, ödeme veya transfer sistemi değildir.",
        gameTitle: "EkaMines",
        gameDesc: "Admin-only mini oyun alanı burada başlayacak.",
        comingSoon: "Mini oyun sıradaki adımda eklenecek.",
        accessDeniedTitle: "Yetkili erişimi gerekli",
        accessDeniedDesc: "Bu sayfa sadece admin ve owner hesapları için açık.",
        signIn: "Yetkili giriş",
        home: "Ana sayfa",
        loading: "OFF alanı kontrol ediliyor...",
      }
    : {
        eyebrow: "Admin-only area",
        title: "EkaTech OFF",
        subtitle: "Only for fun. This area is visible only to admin and owner accounts.",
        balance: "Tech Coin Balance",
        balanceValue: "100 TC",
        balanceNote: "Demo balance for now. D1 wallet system will be connected in the next step.",
        coinTitle: "Tech Coin",
        coinDesc: "Internal EkaTech fun points. Not real money, payments, or transfers.",
        gameTitle: "EkaMines",
        gameDesc: "The admin-only mini-game area will start here.",
        comingSoon: "Mini-game will be added in the next step.",
        accessDeniedTitle: "Authorized access required",
        accessDeniedDesc: "This page is available only to admin and owner accounts.",
        signIn: "Authorized login",
        home: "Home",
        loading: "Checking OFF access...",
      };

  useEffect(() => {
    let active = true;

    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.json().catch(() => null))
      .then((data) => {
        if (!active) return;
        setUser(data?.loggedIn ? data.user : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const canAccess = user?.role === "admin" || user?.role === "owner";

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">
          {copy.loading}
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="relative flex min-h-screen items-center overflow-hidden bg-black px-4 py-24 sm:px-6">
        <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center backdrop-blur-xl sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-purple-200/20 bg-purple-200/10 text-purple-100">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-white">{copy.accessDeniedTitle}</h1>
          <p className="mt-4 leading-7 text-white/55">{copy.accessDeniedDesc}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => navigateTo("/signin?authorized=1")} className="rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200">
              {copy.signIn}
            </button>
            <button type="button" onClick={() => navigateTo("/")} className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-medium text-white/80 transition-all hover:bg-white/[0.1]">
              {copy.home}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-purple-200/30 to-transparent" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
        >
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
              {copy.eyebrow}
            </div>
            <div>
              <h1 className="text-5xl font-medium tracking-tight text-white sm:text-7xl">{copy.title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-purple-200/20 bg-purple-200/10 px-4 py-2 text-sm text-purple-100">
              <Sparkles className="h-4 w-4" /> {copy.coinDesc}
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10" />
            <div className="relative mx-auto flex aspect-square max-w-[460px] items-center justify-center rounded-full bg-black/25 p-5">
              <div className="absolute inset-8 rounded-full bg-purple-500/10 blur-2xl" />
              <img src={techCoin} alt="EkaTech Tech Coin" className="relative h-full w-full object-contain drop-shadow-[0_0_40px_rgba(168,85,247,0.22)]" />
            </div>
          </div>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard eyebrow="01" title={copy.balance} value={copy.balanceValue} desc={copy.balanceNote} />
          <InfoCard eyebrow="02" title={copy.coinTitle} value="EKA" desc={copy.coinDesc} />
          <InfoCard eyebrow="03" title={copy.gameTitle} value="OFF" desc={copy.gameDesc} />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-cyan-100/70">Internal mini-game</p>
              <h2 className="mt-2 text-3xl font-medium text-white">{copy.gameTitle}</h2>
              <p className="mt-2 text-white/45">{copy.comingSoon}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-white/70">
              <Trophy className="h-5 w-5 text-purple-100" /> {copy.balanceValue}
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function InfoCard({ eyebrow, title, value, desc }: { eyebrow: string; title: string; value: string; desc: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.22em] text-white/30">{eyebrow}</p>
      <h3 className="mt-3 text-lg font-medium text-white">{title}</h3>
      <p className="mt-3 text-4xl font-medium tracking-tight text-white">{value}</p>
      <p className="mt-3 text-sm leading-6 text-white/45">{desc}</p>
    </div>
  );
}
