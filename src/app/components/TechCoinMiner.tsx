import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Cpu, IceCreamBowl, LogOut, Pickaxe, RefreshCcw, Server, Snowflake, Timer, Wallet, Zap } from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";
import { playOffSound } from "./OffSoundEngine";

type MinerSession = {
  id: number;
  serverId: string;
  userId: number;
  isMine: boolean;
  userName: string;
  userAvatarUrl?: string;
  remainingSeconds: number;
  elapsedSeconds: number;
  claimable: number;
  totalClaimed: number;
};

type MinerCooldown = {
  sessionId: number;
  until: string;
  usedSeconds: number;
  cooldownSeconds: number;
  remainingSeconds: number;
};

type MinerServer = {
  id: string;
  nameTr: string;
  nameEn: string;
  accent: "cyan" | "purple" | "amber";
  occupied: boolean;
  cooling?: boolean;
  session?: MinerSession | null;
  cooldown?: MinerCooldown | null;
};

type MinerState = {
  servers: MinerServer[];
  currentSession?: MinerSession | null;
  limits: {
    sessionMinutes: number;
    coinsPerMinute: number;
    maxCoinsPerSession: number;
    dailyServerMinutes?: number;
    dailyUsedSeconds?: number;
    dailyRemainingSeconds?: number;
    cooldownDivisor?: number;
  };
  wallet: {
    balance: number;
    lifetime_earned: number;
  };
  message?: string;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function avatarInitial(name: string) {
  return (name || "U").trim().slice(0, 1).toUpperCase();
}

export function TechCoinMiner() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const copy = useMemo(
    () => tr
      ? {
          eyebrow: "OFF pasif kazanç alanı",
          title: "TechCoin Miner",
          subtitle: "3 miner server var. Her kullanıcı aynı anda sadece 1 server kullanabilir. Günlük toplam 3 saat server hakkın vardır; oturumlar en fazla 1 saat sürer.",
          refresh: "Yenile",
          connect: "Server'a bağlan",
          claim: "Biriken Coinleri Cüzdana Aktar",
          leave: "Serverdan ayrıl",
          occupied: "Kullanılıyor",
          available: "Boşta",
          cooling: "Soğuyor",
          mine: "Sen kullanıyorsun",
          user: "Kullanıcı",
          remaining: "Kalan süre",
          elapsed: "Geçen süre",
          claimable: "Aktarılabilir",
          totalClaimed: "Toplam aktarılan",
          cooldownRemaining: "Soğuma süresi",
          usedTime: "Kullanım süresi",
          cooldownRule: "Soğuma payı",
          cooldownRuleValue: "Kullanım süresinin 1/5'i",
          rate: "Kazanç hızı",
          rateValue: "3 Tech Coin / dakika",
          maxSession: "Günlük / oturum",
          maxSessionValue: "3 saat / 60 dk",
          wallet: "Tech Coin cüzdanı",
          rule: "Günlük maksimum 3 saat server kullanılabilir. Her oturum 1 saatin sonunda veya günlük hakkın bitince otomatik boşalır, ardından kullanım süresinin 1/5’i kadar soğuma moduna girer.",
          empty: "Bu server boşta. Bağlanırsan diğer serverlara aynı anda bağlanamazsın.",
          cooldownText: "Server soğuma modunda. Geri sayım bitince tekrar kullanılabilir.",
          autoClaimNote: "Aktarmazsan coinlerin kaybolmaz; süre sonunda otomatik cüzdana eklenir.",
          loading: "Miner serverlara bağlanılıyor...",
          error: "Miner verisi alınamadı.",
        }
      : {
          eyebrow: "OFF passive earning area",
          title: "TechCoin Miner",
          subtitle: "There are 3 miner servers. Each user can use only 1 server at a time. You have 3 total server hours per day; sessions last up to 1 hour.",
          refresh: "Refresh",
          connect: "Connect to server",
          claim: "Transfer Earned Coins to Wallet",
          leave: "Leave server",
          occupied: "Occupied",
          available: "Available",
          cooling: "Cooling",
          mine: "You are using this",
          user: "User",
          remaining: "Time left",
          elapsed: "Elapsed time",
          claimable: "Claimable",
          totalClaimed: "Total claimed",
          cooldownRemaining: "Cooldown left",
          usedTime: "Used time",
          cooldownRule: "Cooldown rule",
          cooldownRuleValue: "1/5 of used time",
          rate: "Earning rate",
          rateValue: "3 Tech Coin / minute",
          maxSession: "Daily / session",
          maxSessionValue: "3 hours / 60 min",
          wallet: "Tech Coin wallet",
          rule: "Server use is capped at 3 hours per day. Each session is released after 1 hour or when your daily quota ends, then cooldown is 1/5 of used time.",
          empty: "This server is available. If you connect, you cannot use another server at the same time.",
          cooldownText: "Server is cooling down. It can be used again when the countdown ends.",
          autoClaimNote: "Coins are not lost if you do not transfer them; they are automatically added to your wallet when the session ends.",
          loading: "Connecting to miner servers...",
          error: "Could not load miner data.",
        },
    [tr]
  );

  const [state, setState] = useState<MinerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    loadMiner();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => loadMiner(false), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadMiner(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/techcoin-miner", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setState(data);
      if (data?.message) setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function runAction(action: "start" | "claim" | "leave", serverId?: string) {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/techcoin-miner", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, serverId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setState(data);
      if (data?.message) setStatus({ type: "success", message: data.message });
      playOffSound(action === "claim" ? "claim" : action === "start" ? "server" : "success");
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
      playOffSound("error");
    } finally {
      setLoading(false);
    }
  }

  const servers = state?.servers || [];
  const hasCurrentSession = Boolean(state?.currentSession);
  const balance = Number(state?.wallet?.balance || 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-16 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-80 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                <Pickaxe className="h-4 w-4" /> {copy.eyebrow}
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight sm:text-7xl">{copy.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => loadMiner()}
              disabled={loading}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
            >
              <RefreshCcw className="h-4 w-4" /> {loading ? "..." : copy.refresh}
            </button>
          </div>
        </motion.section>

        {status && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
            {status.message}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-4">
          <Metric icon={<Wallet className="h-5 w-5" />} label={copy.wallet} value={<CoinAmount amount={balance} locale={locale} />} />
          <Metric icon={<Zap className="h-5 w-5" />} label={copy.rate} value={copy.rateValue} />
          <Metric icon={<Timer className="h-5 w-5" />} label={copy.maxSession} value={copy.maxSessionValue} />
          <Metric icon={<Snowflake className="h-5 w-5" />} label={copy.cooldownRule} value={copy.cooldownRuleValue} />
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{copy.rule}</p>
          <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{copy.autoClaimNote}</p>
        </div>

        {loading && !state ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">{copy.loading}</div>
        ) : (
          <section className="grid gap-5 lg:grid-cols-3">
            {servers.map((server) => (
              <MinerServerCard
                key={server.id}
                server={server}
                copy={copy}
                locale={locale}
                language={language}
                nowTick={nowTick}
                hasCurrentSession={hasCurrentSession}
                loading={loading}
                onStart={() => runAction("start", server.id)}
                onClaim={() => runAction("claim")}
                onLeave={() => runAction("leave")}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function MinerServerCard({ server, copy, locale, language, nowTick, hasCurrentSession, loading, onStart, onClaim, onLeave }: { server: MinerServer; copy: any; locale: string; language: string; nowTick: number; hasCurrentSession: boolean; loading: boolean; onStart: () => void; onClaim: () => void; onLeave: () => void }) {
  const session = server.session || null;
  const cooldown = server.cooldown || null;
  const isMine = Boolean(session?.isMine);
  const isCooling = Boolean(server.cooling && cooldown);
  const accent = server.accent;
  const accentClasses = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    purple: "border-purple-300/20 bg-purple-300/10 text-purple-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  }[accent];

  const remaining = session ? Math.max(0, session.remainingSeconds - nowTick) : 0;
  const elapsed = session ? Math.min(3600, session.elapsedSeconds + nowTick) : 0;
  const progress = session ? Math.min(100, (elapsed / 3600) * 100) : 0;
  const cooldownRemaining = cooldown ? Math.max(0, cooldown.remainingSeconds - nowTick) : 0;
  const cooldownProgress = cooldown ? Math.max(0, Math.min(100, ((cooldown.cooldownSeconds - cooldownRemaining) / Math.max(1, cooldown.cooldownSeconds)) * 100)) : 0;
  const displayName = language === "tr" ? server.nameTr : server.nameEn;

  return (
    <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`overflow-hidden rounded-[2rem] border p-5 backdrop-blur-xl sm:p-6 ${isCooling ? "border-cyan-200/20 bg-cyan-200/[0.055]" : "border-white/10 bg-white/[0.045]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isCooling ? "border-cyan-200/25 bg-cyan-200/10 text-cyan-100" : accentClasses}`}>
          {isCooling ? <Snowflake className="h-6 w-6 animate-pulse" /> : <Server className="h-6 w-6" />}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${isMine ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : isCooling ? "border-cyan-200/25 bg-cyan-200/10 text-cyan-100" : server.occupied ? "border-red-300/20 bg-red-300/10 text-red-100" : accentClasses}`}>
          {isMine ? copy.mine : isCooling ? copy.cooling : server.occupied ? copy.occupied : copy.available}
        </span>
      </div>

      <h2 className="mt-5 text-2xl font-medium">{displayName}</h2>

      {session ? (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
            {session.userAvatarUrl ? (
              <img src={session.userAvatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">{avatarInitial(session.userName)}</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{session.userName || copy.user}</p>
              <p className="text-xs text-white/35">{copy.user}</p>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SmallStat label={copy.remaining} value={formatTime(remaining)} />
            <SmallStat label={copy.elapsed} value={formatTime(elapsed)} />
            <SmallStat label={copy.claimable} value={<CoinAmount amount={session.claimable} locale={locale} compact />} />
            <SmallStat label={copy.totalClaimed} value={<CoinAmount amount={session.totalClaimed} locale={locale} compact />} />
          </div>

          {isMine ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={onClaim} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40">
                <Cpu className="h-4 w-4" /> {copy.claim}
              </button>
              <button type="button" onClick={onLeave} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm font-medium text-red-100 transition-all hover:bg-red-300/15 disabled:opacity-40">
                <LogOut className="h-4 w-4" /> {copy.leave}
              </button>
            </div>
          ) : null}
        </div>
      ) : isCooling && cooldown ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 p-4 text-cyan-100">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IceCreamBowl className="h-4 w-4" /> {copy.cooldownText}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-100" style={{ width: `${cooldownProgress}%` }} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SmallStat label={copy.cooldownRemaining} value={formatTime(cooldownRemaining)} />
            <SmallStat label={copy.usedTime} value={formatTime(cooldown.usedSeconds)} />
          </div>
          <button type="button" disabled className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-5 py-3 text-sm font-medium text-cyan-100/60">
            <Snowflake className="h-4 w-4" /> {copy.cooling} · {formatTime(cooldownRemaining)}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="min-h-16 text-sm leading-6 text-white/50">{copy.empty}</p>
          <button type="button" onClick={onStart} disabled={loading || hasCurrentSession} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40">
            <Pickaxe className="h-4 w-4" /> {copy.connect}
          </button>
        </div>
      )}
    </motion.article>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-white/45">{icon}<span className="text-sm">{label}</span></div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <div className="mt-2 font-semibold text-white">{value}</div>
    </div>
  );
}

function CoinAmount({ amount, locale, compact = false }: { amount: number; locale: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${compact ? "text-sm" : "text-2xl"}`}>
      <span>{new Intl.NumberFormat(locale).format(Number(amount || 0))}</span>
      <span className={`${compact ? "h-5 w-5" : "h-7 w-7"} inline-flex overflow-hidden rounded-full border border-amber-300/30 bg-black/60 p-[1px]`}>
        <img src={coinIcon} alt="Tech Coin" className="h-full w-full rounded-full object-cover" />
      </span>
    </span>
  );
}
