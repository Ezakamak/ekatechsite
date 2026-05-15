import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { BarChart3, Gamepad2, Gift, Lock, Pickaxe, Shield, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";
import { TechDuelSync } from "./TechDuelSyncFixed";
import { TechDuelBotAssist } from "./TechDuelBotAssist";
import { CipherBreak } from "./CipherBreak";
import { CoreRaid } from "./CoreRaid";
import { MarketAcademy } from "./MarketAcademy";
import { TechCoinMiner } from "./TechCoinMiner";
import { DropTech } from "./DropTech";
import { TechCoinWalletBadge } from "./TechCoinWalletBadge";

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

type GameKey = "hub" | "duel" | "cipher" | "raid" | "market" | "miner" | "droptech";

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
        cipherTitle: "Cipher Break",
        cipherDesc: "2 kişilik premium kod kilitleme düellosu. Hedef kodu takip et, doğru kod hizaya geldiğinde ilk kilitleyen round'u alır.",
        clashTitle: "Core Clash",
        clashDesc: "2 kişilik stratejik kart düellosu. 3 kartla başla, harita boostlarını kullan, 20 saniyede en iyi counter hamleyi seç.",
        raidTitle: "Core Raid",
        raidDesc: "Community boss event. Glitch Titan sayfayı bozuyor; görev yap, hasar ver, core'u birlikte restore et.",
        marketTitle: "Eka InvestSim",
        marketDesc: "Gerçek para ve gerçek hisse kullanmadan portföy, risk, haber etkisi ve sanal al-sat mantığını öğreten borsa simülasyonu.",
        minerTitle: "TechCoin Miner",
        minerDesc: "3 miner serverdan birine bağlan. Aynı anda sadece 1 server kullan, dakikada 1 Tech Coin üret, 1 saatin sonunda server otomatik boşalsın.",
        droptechTitle: "DropTech",
        droptechDesc: "Kutu aç, ışıklı şeritte item yakala ve OFF'a özel emoji koleksiyonunu tamamla. Eşyalar kullanılmaz; sadece envanterde görünür.",
        minesRemoved: "EkaMines kaldırıldı. Tech Coin sistemi puan biriktirmek için duruyor.",
        walletTitle: "Tech Coin cüzdanı",
        lifetime: "Toplam kazanılan",
        currency: "Para birimi",
        fixedRewardLabel: "Oyun ödülleri",
        rewardRule: "Ödül kuralı",
      }
    : {
        loading: "Checking OFF access...",
        accessDeniedTitle: "OFF access required",
        accessDeniedDesc: "This page is available to OFF, admin and owner accounts.",
        signIn: "Sign in",
        home: "Home",
        eyebrow: "OFF private game area",
        title: "EkaTech OFF Hub",
        subtitle: "The OFF role is a middle role for hanging out, playing games and collecting score coins.",
        available: "Available game",
        comingSoon: "Coming soon",
        open: "Open",
        backHub: "Back to OFF Hub",
        duelTitle: "Tech Duel",
        duelDesc: "Synchronized rounds, per-round winner reveal, Best of 3/5/7, and safe fixed reward logic.",
        cipherTitle: "Cipher Break",
        cipherDesc: "A premium 1v1 code-lock duel. Track the target code and lock first when the matching code aligns.",
        clashTitle: "Core Clash",
        clashDesc: "A 2-player strategic card duel. Start with 3 cards, use map boosts, and pick the best counter move in 20 seconds.",
        raidTitle: "Core Raid",
        raidDesc: "A community boss event. Glitch Titan corrupts the page; complete tasks, deal damage, and restore the core together.",
        marketTitle: "Eka InvestSim",
        marketDesc: "A stock market simulator that teaches portfolio, risk, news impact and virtual buy/sell logic without real money or real stocks.",
        minerTitle: "TechCoin Miner",
        minerDesc: "Connect to one of 3 miner servers. Use only 1 server at a time, earn 1 Tech Coin per minute, and automatically release the server after 1 hour.",
        droptechTitle: "DropTech",
        droptechDesc: "Open boxes, catch an item on the glowing strip, and complete your OFF-only emoji collection. Items are not usable; they only appear in inventory.",
        minesRemoved: "EkaMines was removed. Tech Coin remains for score progression.",
        walletTitle: "Tech Coin wallet",
        lifetime: "Lifetime earned",
        currency: "Currency",
        fixedRewardLabel: "Game rewards",
        rewardRule: "Reward rule",
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
    const loadWallet = () => {
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
    };

    loadWallet();
    const timer = window.setInterval(loadWallet, 10_000);
    window.addEventListener("ekatech-techcoin-refresh", loadWallet);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ekatech-techcoin-refresh", loadWallet);
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

  if (activeGame !== "hub") {
    return (
      <>
        <div className="fixed right-5 top-24 z-[80] flex flex-col items-end gap-3 px-2 sm:right-6">
          <button
            type="button"
            onClick={() => {
              setActiveGame("hub");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-full border border-cyan-300/20 bg-black/85 px-4 py-2.5 text-xs font-medium text-cyan-100 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all hover:bg-cyan-300/10 sm:px-5 sm:py-3 sm:text-sm"
          >
            ← {copy.backHub}
          </button>
          <TechCoinWalletBadge />
        </div>
        {activeGame === "duel" ? (
          <>
            <TechDuelSync />
            <TechDuelBotAssist />
          </>
        ) : activeGame === "cipher" ? <CipherBreak /> : activeGame === "raid" ? <CoreRaid /> : activeGame === "miner" ? <TechCoinMiner /> : activeGame === "droptech" ? <DropTech /> : <MarketAcademy />}
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
            <p className="text-sm text-white/40">{copy.rewardRule}</p>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-medium text-white">
              <span>{copy.fixedRewardLabel}:</span>
              <CoinAmount amount={50} locale={tr ? "tr-TR" : "en-US"} size="md" tone="cyan" />
              <span className="text-white/35">/</span>
              <CoinAmount amount={40} locale={tr ? "tr-TR" : "en-US"} size="md" tone="amber" />
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/50">{copy.minesRemoved}</p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <GameCard icon={<Swords className="h-6 w-6" />} status={copy.available} title={copy.duelTitle} description={copy.duelDesc} accent="cyan" buttonLabel={copy.open} onClick={() => setActiveGame("duel")} />
          <GameCard icon={<Zap className="h-6 w-6" />} status={copy.available} title={copy.cipherTitle} description={copy.cipherDesc} accent="purple" buttonLabel={copy.open} onClick={() => setActiveGame("cipher")} />
          <GameCard icon={<Gamepad2 className="h-6 w-6" />} status={copy.available} title={copy.clashTitle} description={copy.clashDesc} accent="cyan" buttonLabel={copy.open} onClick={() => navigateTo("/core-clash")} />
          <GameCard icon={<Gift className="h-6 w-6" />} status={copy.available} title={copy.droptechTitle} description={copy.droptechDesc} accent="purple" buttonLabel={copy.open} onClick={() => setActiveGame("droptech")} />
          <GameCard icon={<Trophy className="h-6 w-6" />} status={copy.available} title={copy.raidTitle} description={copy.raidDesc} accent="amber" buttonLabel={copy.open} onClick={() => setActiveGame("raid")} />
          <GameCard icon={<BarChart3 className="h-6 w-6" />} status={copy.available} title={copy.marketTitle} description={copy.marketDesc} accent="purple" buttonLabel={copy.open} onClick={() => setActiveGame("market")} />
          <GameCard icon={<Pickaxe className="h-6 w-6" />} status={copy.available} title={copy.minerTitle} description={copy.minerDesc} accent="amber" buttonLabel={copy.open} onClick={() => setActiveGame("miner")} />
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
        <img src={coinIcon} alt="Tech Coin" className="block h-full w-full rounded-full object-cover" style={{ clipPath: "circle(50% at 50% 50%)" }} />
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
  icon: ReactNode;
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
