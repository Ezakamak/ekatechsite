import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Shield, Sparkles, Trophy, Gamepad2, Coins } from "lucide-react";
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

function TechCoinIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };

  return (
    <span className={`${sizes[size]} inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-purple-200/25 shadow-[0_0_18px_rgba(168,85,247,0.35)]`}>
      <img src={techCoin} alt="Tech Coin" className="h-full w-full object-cover" />
    </span>
  );
}

function CoinAmount({ amount, size = "large" }: { amount: number; size?: "small" | "large" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-medium tracking-tight text-white ${size === "large" ? "text-5xl" : "text-lg"}`}>
      <span>{amount}</span>
      <TechCoinIcon size={size === "large" ? "lg" : "sm"} />
    </span>
  );
}

export function OffPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const balance = 100;

  const copy = tr
    ? {
        eyebrow: "Admin özel alanı",
        title: "EkaTech OFF",
        subtitle: "Only for fun. Bu alan sadece admin ve owner hesaplarına görünür.",
        balance: "Tech Coin Bakiyesi",
        balanceNote: "Şimdilik demo puan. D1 cüzdan sistemi sonraki adımda bağlanacak.",
        coinDesc: "EkaTech içi eğlence puanı.",
        gameTitle: "EkaMines",
        comingSoon: "Mini oyun sıradaki adımda eklenecek.",
        bestRound: "En iyi tur",
        perfectClear: "Perfect clear",
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
        balanceNote: "Demo points for now. The D1 wallet system will be connected in the next step.",
        coinDesc: "Internal EkaTech fun points.",
        gameTitle: "EkaMines",
        comingSoon: "Mini-game will be added in the next step.",
        bestRound: "Best round",
        perfectClear: "Perfect clear",
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
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
                <TechCoinIcon size="sm" /> {copy.eyebrow}
              </div>
              <div>
                <h1 className="text-5xl font-medium tracking-tight text-white sm:text-7xl">{copy.title}</h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
              </div>
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-200/20 bg-purple-200/10 px-4 py-2 text-sm text-purple-100">
                <Sparkles className="h-4 w-4" /> {copy.coinDesc}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/35 p-6">
              <p className="text-sm text-white/45">{copy.balance}</p>
              <div className="mt-4">
                <CoinAmount amount={balance} />
              </div>
              <p className="mt-4 text-sm leading-6 text-white/40">{copy.balanceNote}</p>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 md:grid-cols-3">
          <StatCard icon={<Coins className="h-5 w-5" />} title={copy.balance} value={<CoinAmount amount={balance} size="small" />} desc={copy.balanceNote} />
          <StatCard icon={<Trophy className="h-5 w-5" />} title={copy.bestRound} value={<CoinAmount amount={0} size="small" />} desc={tr ? "Henüz tur oynanmadı." : "No round played yet."} />
          <StatCard icon={<Sparkles className="h-5 w-5" />} title={copy.perfectClear} value="0" desc={tr ? "Tam temizleme sayısı." : "Number of perfect clears."} />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm text-cyan-100/70"><Gamepad2 className="h-4 w-4" /> Internal mini-game</p>
              <h2 className="mt-2 text-3xl font-medium text-white">{copy.gameTitle}</h2>
              <p className="mt-2 text-white/45">{copy.comingSoon}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-white/70">
              <CoinAmount amount={balance} size="small" />
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function StatCard({ icon, title, value, desc }: { icon: React.ReactNode; title: string; value: React.ReactNode; desc: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-200/15 bg-purple-200/10 text-purple-100">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-medium text-white">{title}</h3>
      <div className="mt-3">{value}</div>
      <p className="mt-3 text-sm leading-6 text-white/45">{desc}</p>
    </div>
  );
}
