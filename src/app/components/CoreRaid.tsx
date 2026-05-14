import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { CheckCircle2, ShieldAlert, Sparkles, Target } from "lucide-react";
import { useLanguage } from "../i18n";

type RaidTask = {
  key: string;
  label: string;
  description: string;
  damage: number;
  scope: "daily" | "event";
  completed: boolean;
  claimed: boolean;
  progress: number;
  target: number;
};

type RaidState = {
  event: {
    id: number;
    boss_name: string;
    max_hp: number;
    current_hp: number;
    status: string;
    defeated_at?: string | null;
  };
  actions: RaidTask[];
  tasks?: RaidTask[];
  my_damage: number;
  daily_damage: number;
  daily_damage_cap: number;
  max_daily_tasks?: number;
  reward_pool?: number;
  regen_per_day?: number;
  visit_streak?: number;
  leaderboard: Array<{ user_id: number; damage: number; name: string; email: string; avatar_url?: string | null }>;
};

const codeRows = [
  "ERR_CORE_0x7F",
  "BREACH::ACTIVE",
  "TASK_DAMAGE_PROTOCOL",
  "RESTORE_PROTOCOL",
  "GLITCH TITAN",
  "TRACE_FAILED",
  "CORE_SHIELD_SYNC",
  "BUTTON_ANCHOR_LOST",
  "UI_LAYER_CORRUPTED",
];

const flying = [
  ["while(core.breach){damage++}", "6%", 0.1, 9],
  ["ERR_NAV_404::FALLING_BUTTON", "18%", 1.4, 11],
  ["<button data-broken />", "31%", 0.7, 8],
  ["spark.emit(0xC0DE)", "45%", 2.2, 10],
  ["GLITCH_TITAN.inject()", "57%", 0.4, 12],
  ["core.hp -= task.damage", "71%", 1.1, 9],
  ["restore.signal = pending", "83%", 2.8, 11],
  ["0xDEAD_UI 0xBEEF_CORE", "93%", 1.9, 10],
] as const;

const sparks = [
  ["8%", "22%", 0.2],
  ["22%", "76%", 1.5],
  ["38%", "34%", 0.8],
  ["61%", "18%", 2.1],
  ["74%", "69%", 1],
  ["91%", "42%", 2.6],
] as const;

const sparkLines = [
  { x: 34, y: -12, rotate: -18 },
  { x: -26, y: -20, rotate: 210 },
  { x: 30, y: 22, rotate: 32 },
  { x: -34, y: 13, rotate: 155 },
  { x: 8, y: -36, rotate: -82 },
  { x: -6, y: 34, rotate: 92 },
  { x: 46, y: 2, rotate: 0 },
  { x: -44, y: -2, rotate: 180 },
];

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "?";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function Avatar({ name, email, url }: { name?: string | null; email?: string | null; url?: string | null }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-semibold text-black">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name, email)}
    </span>
  );
}

export function CoreRaid() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [state, setState] = useState<RaidState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const c = useMemo(
    () =>
      tr
        ? {
            eyebrow: "Community Event",
            title: "Core Raid",
            subtitle: "Glitch Titan EkaTech core'unu işgal etti. Her gün en fazla 6 görev gelir; görevleri tamamla, hasarı ver, core'u birlikte restore et.",
            hp: "Boss HP",
            corruption: "Corruption",
            restored: "CORE RESTORED",
            active: "SITE OCCUPIED",
            myDamage: "Senin verdiğin hasar",
            dailyLimit: "Günlük hasar limiti",
            dailyTasks: "Günlük görev",
            actions: "Boss görevleri",
            leaderboard: "Katkı sıralaması",
            damage: "hasar",
            claim: "Hasar ver",
            claimed: "Hasar verildi",
            locked: "Tamamlanmadı",
            refresh: "Yenile",
            empty: "Henüz katkı yok.",
            reward: "Tech Coin boss ölmeden verilmez. Boss düşünce ödül havuzu, herkesin verdiği hasar oranına göre dağıtılır.",
            regen: "Boss pasif iyileşir",
            progress: "İlerleme",
            streak: "Streak",
            breach: "SITE BREACH DETECTED",
            unstable: "UI katmanı kararsız: buton bağlantıları kopuyor, core kabloları kıvılcım saçıyor.",
          }
        : {
            eyebrow: "Community Event",
            title: "Core Raid",
            subtitle: "Glitch Titan has occupied the EkaTech core. Each day has at most 6 tasks; complete tasks, deal damage, and restore the system together.",
            hp: "Boss HP",
            corruption: "Corruption",
            restored: "CORE RESTORED",
            active: "SITE OCCUPIED",
            myDamage: "Your dealt damage",
            dailyLimit: "Daily damage limit",
            dailyTasks: "Daily tasks",
            actions: "Boss tasks",
            leaderboard: "Contribution leaderboard",
            damage: "damage",
            claim: "Deal damage",
            claimed: "Damage dealt",
            locked: "Incomplete",
            refresh: "Refresh",
            empty: "No contributions yet.",
            reward: "Tech Coin is not paid before the boss is defeated. When it falls, the reward pool is split by each player's damage share.",
            regen: "Passive boss regen",
            progress: "Progress",
            streak: "Streak",
            breach: "SITE BREACH DETECTED",
            unstable: "UI layer unstable: button anchors are tearing apart, core cables are throwing sparks.",
          },
    [tr],
  );

  const load = async (silent = false) => {
    if (!silent) setNotice(null);
    try {
      const response = await fetch("/core-raid", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) throw new Error(data?.error || "Core Raid yüklenemedi.");
      setState(data);
    } catch (error) {
      if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Core Raid yüklenemedi." });
    }
  };

  const claimTask = async (key: string) => {
    setBusy(key);
    setNotice(null);
    try {
      const response = await fetch("/core-raid", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: key }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) throw new Error(data?.error || "Görev hasarı verilemedi.");
      setState(data);
      setNotice({ type: "success", text: `+${data.damage || 0} ${c.damage} ${tr ? "verildi" : "dealt"}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Görev hasarı verilemedi." });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    load();
    const poll = window.setInterval(() => load(true), 12000);
    return () => window.clearInterval(poll);
  }, [language]);

  const event = state?.event;
  const maxHp = Number(event?.max_hp || 10000);
  const currentHp = Math.max(0, Number(event?.current_hp ?? maxHp));
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
  const corruption = Math.round(hpPercent);
  const defeated = event?.status === "defeated" || currentHp <= 0;
  const dailyDamage = Number(state?.daily_damage || 0);
  const dailyCap = Number(state?.daily_damage_cap || 600);
  const dailyPercent = dailyCap > 0 ? Math.min(100, (dailyDamage / dailyCap) * 100) : 0;
  const tasks = state?.tasks || state?.actions || [];
  const maxDailyTasks = Number(state?.max_daily_tasks || 6);
  const rewardPool = Number(state?.reward_pool || 1000);
  const regenPerDay = Number(state?.regen_per_day || 500);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <CorruptionLayer />
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl" />
      <div className="absolute right-0 top-72 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute -left-28 bottom-16 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <BrokenButton className="left-8 top-40 rotate-[-11deg]" label="NAV_BUTTON::DETACHED" />
      <BrokenButton className="right-8 top-52 rotate-[9deg]" label="CTA_ANCHOR_LOST" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-red-300/20 bg-white/[0.045] p-6 shadow-2xl shadow-red-500/10 backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-300/70 to-transparent" />
          <div className="pointer-events-none absolute right-8 top-0 h-28 w-px bg-gradient-to-b from-cyan-200/50 to-transparent" />
          <SparkBurst className="right-5 top-24" />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm text-red-100 shadow-lg shadow-red-500/10">
                <ShieldAlert className="h-4 w-4" /> {defeated ? c.restored : c.active}
              </div>
              <p className="mt-5 text-sm uppercase tracking-[0.28em] text-cyan-100/60">{c.eyebrow}</p>
              <h1 className="mt-3 text-5xl font-medium tracking-tight sm:text-7xl">
                <GlitchText text={c.title} />
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{c.subtitle}</p>
              <div className="mt-5 max-w-3xl rounded-2xl border border-red-300/15 bg-red-400/[0.06] p-4 font-mono text-xs leading-6 text-red-100/65">
                <span className="text-red-100">{c.breach}</span> — {c.unstable}
              </div>
            </div>
            <button
              onClick={() => load()}
              className="relative rotate-[-2deg] rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white shadow-2xl shadow-black/40 transition-all hover:rotate-0 hover:bg-white/[0.1]"
            >
              <span className="absolute -top-4 left-1/2 h-4 w-px bg-white/20" />
              {c.refresh}
            </button>
          </div>

          {notice && (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
              {notice.text}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 p-6 backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute -right-10 top-8 h-32 w-32 rounded-full bg-red-500/10 blur-2xl" />
            <div className="pointer-events-none absolute left-8 top-0 h-20 w-px bg-gradient-to-b from-red-200/50 to-transparent" />
            <SparkBurst className="left-5 top-16" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-white/35">{event?.boss_name || "GLITCH TITAN"}</p>
                <h2 className="mt-2 text-3xl font-medium">{c.hp}</h2>
              </div>
              <div className="rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 font-mono text-red-100">
                {currentHp.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {maxHp.toLocaleString()}
              </div>
            </div>

            <div className="mt-7 h-6 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-400 to-cyan-200 transition-all duration-500" style={{ width: `${hpPercent}%` }} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              <Stat label={c.corruption} value={`${corruption}%`} />
              <Stat label={c.myDamage} value={Number(state?.my_damage || 0).toLocaleString()} />
              <Stat label={c.dailyLimit} value={`${dailyDamage}/${dailyCap}`} />
              <Stat label={c.dailyTasks} value={`${tasks.length}/${maxDailyTasks}`} />
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-cyan-200/80" style={{ width: `${dailyPercent}%` }} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <RuleCard label={c.regen} value={`+${regenPerDay.toLocaleString()} HP / ${tr ? "gün" : "day"}`} />
              <RuleCard label={tr ? "Ödül havuzu" : "Reward pool"} value={`${rewardPool.toLocaleString()} Tech Coin`} />
            </div>
            <p className="mt-4 text-sm text-white/45">{c.reward}</p>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-16 h-px bg-gradient-to-r from-transparent via-red-300/30 to-transparent" />
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-100" />
              <h2 className="text-2xl font-medium">{c.actions}</h2>
            </div>

            <div className="mt-5 space-y-3">
              {tasks.map((task, index) => {
                const canClaim = task.completed && !task.claimed && !defeated && dailyDamage < dailyCap;
                const label = task.claimed ? c.claimed : task.completed ? c.claim : c.locked;
                return (
                  <button
                    key={task.key}
                    disabled={busy !== null || !canClaim}
                    onClick={() => claimTask(task.key)}
                    className={`group w-full rounded-3xl border border-white/10 bg-black/35 p-4 text-left transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-55 ${index % 2 === 0 ? "rotate-[-0.5deg]" : "rotate-[0.5deg]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white group-hover:text-cyan-100">{task.label}</p>
                          {task.claimed && <CheckCircle2 className="h-4 w-4 text-emerald-200" />}
                        </div>
                        <p className="mt-1 text-sm leading-5 text-white/45">{task.description}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/35">
                          {c.progress}: {Math.min(Number(task.progress || 0), Number(task.target || 1))}/{task.target} · {task.damage} {c.damage}
                        </p>
                      </div>
                      <span className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium ${canClaim ? "bg-white text-black shadow-lg shadow-cyan-300/20" : task.claimed ? "border border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border border-white/10 bg-white/[0.06] text-white/45"}`}>
                        {canClaim && <span className="absolute -top-3 left-1/2 h-3 w-px bg-white/25" />}
                        {busy === task.key ? "..." : label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-gradient-to-r from-red-300/0 via-red-300/20 to-red-300/0" />
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-100" />
            <h2 className="text-2xl font-medium">{c.leaderboard}</h2>
          </div>
          <div className="mt-5 space-y-3">
            {(state?.leaderboard || []).length === 0 && <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{c.empty}</div>}
            {(state?.leaderboard || []).map((row, index) => (
              <div key={row.user_id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-sm text-white/35">#{index + 1}</span>
                  <Avatar name={row.name} email={row.email} url={row.avatar_url} />
                  <p className="truncate font-medium">{row.name || row.email}</p>
                </div>
                <p className="font-mono text-sm text-cyan-100">{Number(row.damage || 0).toLocaleString()} DMG</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function CorruptionLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-90">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(255,255,255,0.045)_50%)] bg-[size:100%_6px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.18),transparent_25%),radial-gradient(circle_at_75%_35%,rgba(34,211,238,0.14),transparent_22%)]" />
      </div>

      {codeRows.map((row, index) => (
        <div
          key={row}
          className="absolute select-none font-mono text-xs tracking-[0.3em] text-cyan-100/20 blur-[0.2px]"
          style={{ top: `${10 + index * 10}%`, left: `${index % 2 === 0 ? 5 : 50}%`, transform: `rotate(${index % 2 === 0 ? -2 : 2}deg)` }}
        >
          {row}
        </div>
      ))}

      {flying.map((item) => (
        <motion.div
          key={item[0]}
          className="absolute -top-16 whitespace-nowrap font-mono text-xs text-cyan-100/25"
          style={{ left: item[1] }}
          initial={{ y: -120, opacity: 0, rotate: -5 }}
          animate={{ y: "115vh", opacity: [0, 0.75, 0.75, 0], rotate: [0, 2, -2, 0] }}
          transition={{ duration: item[3], repeat: Infinity, delay: item[2], ease: "linear" }}
        >
          {item[0]}
        </motion.div>
      ))}

      {sparks.map((spark) => (
        <SparkBurst key={`${spark[0]}-${spark[1]}`} className="" style={{ left: spark[0], top: spark[1] }} delay={spark[2]} />
      ))}

      <div className="absolute left-[12%] top-[62%] h-24 w-px rotate-12 bg-gradient-to-b from-red-200/40 to-transparent" />
      <div className="absolute right-[15%] top-[18%] h-32 w-px -rotate-12 bg-gradient-to-b from-cyan-200/40 to-transparent" />
      <div className="absolute left-[55%] top-[78%] h-px w-40 rotate-6 bg-gradient-to-r from-transparent via-red-200/30 to-transparent" />
    </div>
  );
}

function BrokenButton({ className, label }: { className: string; label: string }) {
  return (
    <div className={`pointer-events-none absolute hidden origin-top rounded-2xl border border-red-300/20 bg-red-950/25 px-5 py-3 font-mono text-xs text-red-100/70 shadow-2xl shadow-red-500/20 backdrop-blur-md lg:block ${className}`}>
      {label}
      <span className="absolute -top-6 left-6 h-6 w-px bg-red-200/25" />
    </div>
  );
}

function SparkBurst({ className, style, delay = 0 }: { className?: string; style?: CSSProperties; delay?: number }) {
  return (
    <div className={`pointer-events-none absolute h-12 w-12 ${className || ""}`} style={style}>
      <motion.span
        className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.95)]"
        animate={{ opacity: [0, 1, 0], scale: [0.2, 1.2, 0.1] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.4, delay }}
      />
      {sparkLines.map((particle, index) => (
        <motion.span
          key={`${particle.rotate}-${index}`}
          className="absolute left-1/2 top-1/2 h-[2px] w-7 origin-left rounded-full bg-gradient-to-r from-cyan-100 via-white to-transparent shadow-[0_0_12px_rgba(34,211,238,0.85)]"
          animate={{
            opacity: [0, 1, 0],
            x: [0, particle.x],
            y: [0, particle.y],
            rotate: [particle.rotate, particle.rotate + 4],
            scaleX: [0.1, 1, 0.15],
          }}
          transition={{ duration: 0.42, repeat: Infinity, repeatDelay: 1.4, delay: delay + index * 0.015 }}
        />
      ))}
    </div>
  );
}

function GlitchText({ text }: { text: string }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{text}</span>
      <span aria-hidden="true" className="absolute left-[2px] top-0 text-red-300/50 blur-[0.4px]">{text}</span>
      <span aria-hidden="true" className="absolute -left-[2px] top-[2px] text-cyan-300/45 blur-[0.4px]">{text}</span>
    </span>
  );
}

function RuleCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 font-mono text-sm text-cyan-100">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
