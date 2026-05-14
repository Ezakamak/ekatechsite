import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Sparkles, Zap } from "lucide-react";
import { useLanguage } from "../i18n";

type RaidAction = {
  key: string;
  label: string;
  damage: number;
  daily_limit: number;
  uses: number;
  remaining: number;
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
  actions: RaidAction[];
  my_damage: number;
  daily_damage: number;
  daily_damage_cap: number;
  leaderboard: Array<{ user_id: number; damage: number; name: string; email: string; avatar_url?: string | null }>;
};

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "?";
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function Avatar({ name, email, url }: { name?: string | null; email?: string | null; url?: string | null }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-semibold text-black">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name, email)}</span>;
}

export function CoreRaid() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [state, setState] = useState<RaidState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const c = useMemo(() => tr ? {
    eyebrow: "Community Event",
    title: "Core Raid",
    subtitle: "Glitch Titan EkaTech core'unu bozuyor. Görev yap, hasar ver, core'u birlikte restore et.",
    hp: "Boss HP",
    corruption: "Corruption",
    restored: "CORE RESTORED",
    active: "SYSTEM BREACH",
    myDamage: "Senin hasarın",
    dailyLimit: "Günlük limit",
    actions: "Raid görevleri",
    leaderboard: "Katkı sıralaması",
    damage: "hasar",
    use: "Çalıştır",
    used: "Bitti",
    refresh: "Yenile",
    empty: "Henüz katkı yok.",
    reward: "Boss düşerse katkı verenlere Tech Coin ödülü dağıtılır.",
  } : {
    eyebrow: "Community Event",
    title: "Core Raid",
    subtitle: "Glitch Titan is corrupting the EkaTech core. Complete tasks, deal damage, and restore the system together.",
    hp: "Boss HP",
    corruption: "Corruption",
    restored: "CORE RESTORED",
    active: "SYSTEM BREACH",
    myDamage: "Your damage",
    dailyLimit: "Daily limit",
    actions: "Raid tasks",
    leaderboard: "Contribution leaderboard",
    damage: "damage",
    use: "Run",
    used: "Used",
    refresh: "Refresh",
    empty: "No contributions yet.",
    reward: "When the boss falls, contributors receive Tech Coin rewards.",
  }, [tr]);

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

  const runAction = async (key: string) => {
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
      if (!response.ok || data?.error) throw new Error(data?.error || "Görev tamamlanamadı.");
      setState(data);
      setNotice({ type: "success", text: `+${data.damage || 0} ${c.damage}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Görev tamamlanamadı." });
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
  const codeRows = ["ERR_CORE_0x7F", "BREACH::ACTIVE", "NULL_PACKET_DROP", "RESTORE_PROTOCOL", "GLITCH TITAN", "TRACE_FAILED", "CORE_SHIELD_SYNC"];

  return <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
    <div className="pointer-events-none absolute inset-0 opacity-30">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      {codeRows.map((row, index) => <div key={row} className="absolute font-mono text-xs tracking-[0.3em] text-cyan-100/20" style={{ top: `${14 + index * 11}%`, left: `${index % 2 === 0 ? 6 : 52}%`, transform: `rotate(${index % 2 === 0 ? -2 : 2}deg)` }}>{row}</div>)}
    </div>
    <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl" />
    <div className="absolute right-0 top-72 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
    <div className="relative mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-red-300/20 bg-white/[0.045] p-6 shadow-2xl shadow-red-500/10 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm text-red-100">
              <ShieldAlert className="h-4 w-4" /> {defeated ? c.restored : c.active}
            </div>
            <p className="mt-5 text-sm uppercase tracking-[0.28em] text-cyan-100/60">{c.eyebrow}</p>
            <h1 className="mt-3 text-5xl font-medium tracking-tight sm:text-7xl">{c.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{c.subtitle}</p>
          </div>
          <button onClick={() => load()} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1]">{c.refresh}</button>
        </div>
        {notice && <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-black/50 p-6 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-white/35">{event?.boss_name || "GLITCH TITAN"}</p>
              <h2 className="mt-2 text-3xl font-medium">{c.hp}</h2>
            </div>
            <div className="rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 font-mono text-red-100">{currentHp.toLocaleString()} / {maxHp.toLocaleString()}</div>
          </div>
          <div className="mt-7 h-6 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${hpPercent}%` }} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Stat label={c.corruption} value={`${corruption}%`} />
            <Stat label={c.myDamage} value={Number(state?.my_damage || 0).toLocaleString()} />
            <Stat label={c.dailyLimit} value={`${dailyDamage}/${dailyCap}`} />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-white/70" style={{ width: `${dailyPercent}%` }} /></div>
          <p className="mt-4 text-sm text-white/45">{c.reward}</p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-cyan-100" /><h2 className="text-2xl font-medium">{c.actions}</h2></div>
          <div className="mt-5 space-y-3">
            {(state?.actions || []).map((action) => <button key={action.key} disabled={busy !== null || defeated || action.remaining <= 0 || dailyDamage >= dailyCap} onClick={() => runAction(action.key)} className="w-full rounded-3xl border border-white/10 bg-black/35 p-4 text-left transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{action.label}</p>
                  <p className="mt-1 text-sm text-white/45">{action.damage} {c.damage} · {action.uses}/{action.daily_limit}</p>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">{busy === action.key ? "..." : action.remaining <= 0 ? c.used : c.use}</span>
              </div>
            </button>)}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-100" /><h2 className="text-2xl font-medium">{c.leaderboard}</h2></div>
        <div className="mt-5 space-y-3">
          {(state?.leaderboard || []).length === 0 && <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{c.empty}</div>}
          {(state?.leaderboard || []).map((row, index) => <div key={row.user_id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-6 text-sm text-white/35">#{index + 1}</span>
              <Avatar name={row.name} email={row.email} url={row.avatar_url} />
              <p className="truncate font-medium">{row.name || row.email}</p>
            </div>
            <p className="font-mono text-sm text-cyan-100">{Number(row.damage || 0).toLocaleString()} DMG</p>
          </div>)}
        </div>
      </section>
    </div>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>;
}
