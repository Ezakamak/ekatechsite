import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Gamepad2, Lock, Shield, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";
import { TechDuelSync } from "./TechDuelSyncFixed";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
};

type Wallet = {
  currency: string;
  symbol: string;
  balance: number;
  lifetime_earned: number;
  updated_at?: string | null;
};

type GameKey = "hub" | "duel";

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function OffPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameKey>("hub");

  const copy = tr
    ? {
        loading: "OFF alanı kontrol ediliyor...",
        accessDeniedTitle: "OFF erişimi gerekli",
        accessDeniedDesc: "Bu sayfa OFF, admin ve owner hesapları için açık.",
        signIn: "Giriş yap",
        home: "Ana sayfa",
        eyebrow: "OFF özel oyun alanı",
        title: "EkaTech OFF Hub",
        subtitle: "OFF rolü arkadaşlarla takılmak, Tech Duel oynamak ve coin puanı biriktirmek için özel ara rol.",
        available: "Aktif oyun",
        comingSoon: "Yakında",
        open: "Aç",
        backHub: "OFF Hub'a dön",
        duelTitle: "Tech Duel",
        duelDesc: "Aynı anda başlayan roundlar, tur kazananı gösterimi, Best of 3/5/7 ve güvenli sabit ödül sistemi.",
        reactionTitle: "Reaction Lab",
        reactionDesc: "Tek kişilik ms ölçme, günlük rekor ve hafif leaderboard modu.",
        bossTitle: "Boss Rush",
        bossDesc: "Coin kaybettirmeyen, görev/enerji tabanlı PvE refleks etkinliği.",
        minesRemoved: "EkaMines kaldırıldı. Tech Coin sistemi puan biriktirmek için duruyor.",
        walletTitle: "Tech Coin cüzdanı",
        balance: "Bakiye",
        lifetime: "Toplam kazanılan",
        currency: "Para birimi",
        fixedRewardLabel: "Tech Duel kazanan ödülü",
      }
    : {
        loading: "Checking OFF access...",
        accessDeniedTitle: "OFF access required",
        accessDeniedDesc: "This page is available to OFF, admin and owner accounts.",
        signIn: "Sign in",
        home: "Home",
        eyebrow: "OFF private game area",
        title: "EkaTech OFF Hub",
        subtitle: "The OFF role is a middle role for hanging out, playing Tech Duel and collecting score coins.",
        available: "Available game",
        comingSoon: "Coming soon",
        open: "Open",
        backHub: "Back to OFF Hub",
        duelTitle: "Tech Duel",
        duelDesc: "Synchronized rounds, per-round winner reveal, Best of 3/5/7, and safe fixed reward logic.",
        reactionTitle: "Reaction Lab",
        reactionDesc: "Single-player ms tracking, daily records and a lightweight leaderboard mode.",
        bossTitle: "Boss Rush",
        bossDesc: "A non-staking PvE reflex event based on tasks/energy instead of coin loss.",
        minesRemoved: "EkaMines was removed. Tech Coin remains for score progression.",
        walletTitle: "Tech Coin wallet",
        balance: "Balance",
        lifetime: "Lifetime earned",
        currency: "Currency",
        fixedRewardLabel: "Tech Duel winner reward",
      };

  useEffect(() => {
    let active = true;
    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.json().catch(() => null))
      .then((data) => {
        if (active) setUser(data?.loggedIn ? data.user : null);
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

  useEffect(() => {
    if (!user) return;

    let active = true;
    fetch("/api/coins", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.json().catch(() => null))
      .then((data) => {
        if (!active || !data) return;
        setWallet({
          currency: data.currency || "Tech Coin",
          symbol: data.symbol || "TC",
          balance: Number(data.balance || 0),
          lifetime_earned: Number(data.lifetime_earned || 0),
          updated_at: data.updated_at || null,
        });
      })
      .catch(() => {
        if (active) setWallet({ currency: "Tech Coin", symbol: "TC", balance: 0, lifetime_earned: 0 });
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const canAccess = user?.role === "off" || user?.role === "admin" || user?.role === "owner";

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

  if (activeGame === "duel") {
    return (
      <>
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 px-4">
          <button
            type="button"
            onClick={() => {
              setActiveGame("hub");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-full border border-white/10 bg-black/80 px-5 py-3 text-sm font-medium text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition-all hover:bg-white/[0.1]"
          >
            ← {copy.backHub}
          </button>
        </div>
        <TechDuelSync />
      </>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
                <Gamepad2 className="h-4 w-4" /> {copy.eyebrow}
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight text-white sm:text-7xl">{copy.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm leading-6 text-emerald-100">
              {copy.minesRemoved}
            </div>
          </div>
        </motion.section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <CoinWalletCard wallet={wallet} copy={copy} locale={tr ? "tr-TR" : "en-US"} />
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <p className="text-sm text-white/40">Reward rule</p>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-medium text-white">
              <span>{copy.fixedRewardLabel}:</span>
              <CoinAmount amount={50} locale={tr ? "tr-TR" : "en-US"} size="md" tone="cyan" />
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/50">{copy.minesRemoved}</p>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <GameCard icon={<Swords className="h-6 w-6" />} status={copy.available} title={copy.duelTitle} description={copy.duelDesc} accent="cyan" buttonLabel={copy.open} onClick={() => setActiveGame("duel")} />
          <GameCard icon={<Zap className="h-6 w-6" />} status={copy.comingSoon} title={copy.reactionTitle} description={copy.reactionDesc} accent="purple" locked />
          <GameCard icon={<Trophy className="h-6 w-6" />} status={copy.comingSoon} title={copy.bossTitle} description={copy.bossDesc} accent="amber" locked />
        </section>
      </div>
    </main>
  );
}

function CoinWalletCard({ wallet, copy, locale }: { wallet: Wallet | null; copy: any; locale: string }) {
  const balance = Number(wallet?.balance || 0);
  const lifetime = Number(wallet?.lifetime_earned || 0);
  const currency = wallet?.currency || "Tech Coin";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.08] p-5 shadow-2xl shadow-amber-500/10 backdrop-blur-xl sm:p-6">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-100/60">{copy.walletTitle}</p>
        <div className="mt-3">
          <CoinAmount amount={balance} locale={locale} size="xl" tone="amber" />
        </div>
        <p className="mt-2 text-sm text-amber-100/80">{currency}</p>
      </div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/35">{copy.currency}</p>
          <p className="mt-2 text-lg font-medium text-white">{currency}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/35">{copy.lifetime}</p>
          <div className="mt-2">
            <CoinAmount amount={lifetime} locale={locale} size="sm" tone="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CoinAmount({ amount, locale, size, tone }: { amount: number; locale: string; size: "sm" | "md" | "xl"; tone: "cyan" | "amber" }) {
  const formatted = new Intl.NumberFormat(locale).format(amount || 0);
  const textSize = size === "xl" ? "text-5xl" : size === "md" ? "text-2xl" : "text-lg";
  const iconSize = size === "xl" ? "sm" : "xs";

  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-white ${textSize}`}>
      <span>{formatted}</span>
      <CoinIcon size={iconSize} tone={tone} />
    </span>
  );
}

function CoinIcon({ size, tone }: { size: "xs" | "sm" | "md" | "lg"; tone: "cyan" | "amber" }) {
  const wrapperSize =
    size === "lg" ? "h-14 w-14" :
    size === "md" ? "h-11 w-11" :
    size === "sm" ? "h-8 w-8" :
    "h-5 w-5";
  const glow = tone === "amber" ? "shadow-amber-500/20" : "shadow-cyan-500/20";
  const ring = tone === "amber" ? "border-amber-300/30" : "border-cyan-300/30";
  const bg = tone === "amber" ? "bg-amber-100/5" : "bg-cyan-100/5";

  return (
    <span className={`inline-flex ${wrapperSize} shrink-0 items-center justify-center overflow-hidden rounded-full border ${ring} ${bg} p-[2px] shadow-xl ${glow}`}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/60">
        <img
          src={coinIcon}
          alt="Tech Coin"
          className="block h-full w-full rounded-full object-cover"
          style={{ clipPath: "circle(50% at 50% 50%)" }}
        />
      </span>
    </span>
  );
}

function GameCard({
  icon,
  status,
  title,
  description,
  accent,
  buttonLabel,
  locked = false,
  onClick,
}: {
  icon: React.ReactNode;
  status: string;
  title: string;
  description: string;
  accent: "cyan" | "purple" | "amber";
  buttonLabel?: string;
  locked?: boolean;
  onClick?: () => void;
}) {
  const accentClasses = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    purple: "border-purple-300/20 bg-purple-300/10 text-purple-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accentClasses[accent]}`}>{icon}</div>
        <span className={`rounded-full border px-3 py-1 text-xs ${locked ? "border-white/10 bg-white/[0.04] text-white/40" : accentClasses[accent]}`}>
          {locked ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> {status}</span> : status}
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-medium text-white">{title}</h2>
      <p className="mt-3 min-h-24 text-sm leading-6 text-white/50">{description}</p>
      {locked ? (
        <button type="button" disabled className="mt-5 w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/35">{status}</button>
      ) : (
        <button type="button" onClick={onClick} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200">
          <Sparkles className="h-4 w-4" /> {buttonLabel}
        </button>
      )}
    </motion.div>
  );
}
