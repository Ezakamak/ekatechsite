import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Dice5, Sparkles, Wallet } from "lucide-react";
import { GameSessionStatsPanel, useGameSessionStats } from "./GameSessionStats";
import { createToastNoFactionSuccessId, ToastNoFactionSuccess, type ToastNoFactionSuccessPayload } from "./ToastNoFactionSuccess";
import { playOffSound } from "./OffSoundEngine";
import { useLanguage } from "../i18n";

type DiceMode = "over" | "under";

type WalletState = {
  currency: string;
  symbol: string;
  balance: number;
  lifetime_earned: number;
};

type DiceResult = {
  mode: DiceMode;
  target: number;
  rolledNumber: number;
  won: boolean;
  amount: number;
  multiplier: number;
  winChance: number;
  rewardAmount: number;
  lossAmount: number;
  net: number;
  message: string;
};

type DiceLog = {
  mode: DiceMode;
  target_number: number;
  rolled_number: number;
  amount: number;
  multiplier: number;
  win_chance: number;
  reward_amount: number;
  net_amount: number;
  result: "win" | "loss";
  created_at: string;
};

const TARGET_MIN = 0.01;
const TARGET_MAX = 99.99;
const RTP = 0.96;
const MAX_RECENT_ROLLS = 60;

export function TechDice() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const mountedRef = useRef(true);
  const landingTimerRef = useRef<number | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [amountInput, setAmountInput] = useState("25");
  const [mode, setMode] = useState<DiceMode>("over");
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [markerPosition, setMarkerPosition] = useState(50);
  const [markerLanded, setMarkerLanded] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [message, setMessage] = useState("");
  const [recent, setRecent] = useState<DiceLog[]>([]);
  const [successToasts, setSuccessToasts] = useState<ToastNoFactionSuccessPayload[]>([]);
  const { stats: sessionStats, recordBet: recordSessionBet, recordResult: recordSessionResult, resetStats: resetSessionStats } = useGameSessionStats("tech-dice");

  const parsedAmount = useMemo(() => Number(amountInput), [amountInput]);
  const safeAmount = useMemo(() => (Number.isFinite(parsedAmount) && parsedAmount > 0 ? clampInteger(parsedAmount, 1, 10_000) : 0), [parsedAmount]);
  const safeTarget = useMemo(() => clampTarget(target), [target]);
  const math = useMemo(() => diceMath(mode, safeTarget), [mode, safeTarget]);
  const potentialReward = Math.max(1, Math.floor(safeAmount * math.multiplier));
  const markerStatus = result ? (result.won ? "win" : "loss") : rolling ? "rolling" : "idle";
  const displayedSessionStats = useMemo(() => ({ ...sessionStats, amount: safeAmount }), [safeAmount, sessionStats]);
  const sliderBackground = buildSliderBackground(mode, safeTarget);

  const loadState = useCallback(() => {
    fetch("/api/tech-dice", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json().catch(() => null))
      .then((data) => {
        if (!mountedRef.current || !data) return;
        if (data.wallet) setWallet(sanitizeWallet(data.wallet));
        if (Array.isArray(data.recent)) setRecent(sanitizeRecent(data.recent));
      })
      .catch(() => {
        if (mountedRef.current) setMessage(tr ? "Tech Dice hazırlanıyor. Birazdan tekrar dene." : "Tech Dice is warming up. Try again in a moment.");
      });
  }, [tr]);

  useEffect(() => {
    mountedRef.current = true;
    loadState();

    return () => {
      mountedRef.current = false;
      if (landingTimerRef.current) window.clearTimeout(landingTimerRef.current);
    };
  }, [loadState]);

  const removeSuccessToast = useCallback((id: string) => {
    setSuccessToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  function pushSuccessToast(rewardAmount: number, multiplier: number) {
    setSuccessToasts((current) => [
      ...current.slice(-2),
      {
        id: createToastNoFactionSuccessId("toast-tech-dice"),
        amount: Math.max(0, Math.round(Number(rewardAmount) || 0)),
        multiplier: sanitizeMultiplier(multiplier),
        currency: "TC",
        title: tr ? "BAŞARILI ZAR" : "SUCCESSFUL ROLL",
      },
    ]);
  }

  async function roll() {
    if (rolling) return;
    const rawAmount = Number(amountInput);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      setMessage(tr ? "Geçerli bir Tech Coin tutarı gir." : "Enter a valid Tech Coin amount.");
      playOffSound("error");
      return;
    }
    const playAmount = clampInteger(rawAmount, 1, 10_000);
    const playTarget = clampTarget(target);

    setAmountInput(String(playAmount));
    setTarget(playTarget);
    setRolling(true);
    setMarkerLanded(false);
    setMessage("");
    setResult(null);
    playOffSound("bet");

    try {
      const response = await fetch("/api/tech-dice", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: playAmount, mode, target: playTarget }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (tr ? "Zar atışı tamamlanamadı." : "Roll could not be completed."));

      const nextResult = sanitizeResult(data?.result, { amount: playAmount, mode, target: playTarget });
      if (!nextResult) throw new Error((tr ? "Zar sonucu güvenli şekilde okunamadı." : "Roll result could not be read safely."));

      if (!mountedRef.current) return;
      setWallet(data?.wallet ? sanitizeWallet(data.wallet) : null);
      setRecent(Array.isArray(data?.recent) ? sanitizeRecent(data.recent) : []);
      setMarkerPosition(nextResult.rolledNumber);
      setResult(nextResult);
      setMessage(nextResult.won ? (tr ? "Başarılı zar" : "Successful Roll") : (tr ? "Kaçan zar" : "Missed Roll"));
      recordSessionBet(nextResult.amount);
      recordSessionResult(nextResult.net);

      if (landingTimerRef.current) window.clearTimeout(landingTimerRef.current);
      landingTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setMarkerLanded(true);
      }, 640);

      if (nextResult.won) {
        playOffSound("success");
        pushSuccessToast(nextResult.rewardAmount, nextResult.multiplier);
      } else {
        playOffSound("error");
      }
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
    } catch (error) {
      if (!mountedRef.current) return;
      setMessage(error instanceof Error ? error.message : (tr ? "Zar atışı tamamlanamadı." : "Roll could not be completed."));
      playOffSound("error");
    } finally {
      if (mountedRef.current) setRolling(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      {successToasts.length ? (
        <div className="toast-nofaction-success-stack" aria-live="polite">
          {successToasts.map((toast) => <ToastNoFactionSuccess key={toast.id} {...toast} locale={locale} onClose={removeSuccessToast} />)}
        </div>
      ) : null}
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                <Dice5 className="h-4 w-4" /> OFF Hub mini-game · Tech Coin support
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight sm:text-7xl">Tech Dice</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
                {tr ? "Üstüne at veya altına at modunu seç, 0–100 hedefini ayarla ve Tech Coin zarını yeşil bölgeye gönder." : "Pick Roll Over or Roll Under, move the 0–100 target, and send a Tech Coin roll toward the green zone."}
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5 text-emerald-100">
              <div className="flex items-center gap-2 text-sm text-emerald-100/75"><Wallet className="h-4 w-4" /> {tr ? "Tech Coin Cüzdanı" : "Tech Coin Wallet"}</div>
              <div className="mt-2 text-4xl font-black">{formatNumber(wallet?.balance || 0, locale)} TC</div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label={tr ? "Seçili mod" : "Selected mode"} value={mode === "over" ? (tr ? "Üstüne at" : "Roll Over") : (tr ? "Altına at" : "Roll Under")} />
              <Stat label={tr ? "Hedef sayı" : "Target number"} value={safeTarget.toFixed(2)} />
              <Stat label={tr ? "Kazanma şansı" : "Win chance"} value={`${(math.winChance * 100).toFixed(2)}%`} />
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/35 p-5 shadow-inner shadow-black/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-white/40">{tr ? "Kazanma alanı" : "Winning area"}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{mode === "over" ? (tr ? "Yeşil bölge hedefin sağında" : "Green zone is right of target") : (tr ? "Yeşil bölge hedefin solunda" : "Green zone is left of target")}</h2>
                </div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] p-1">
                  {(["over", "under"] as DiceMode[]).map((item) => (
                    <button key={item} type="button" onClick={() => { setMode(item); playOffSound("click"); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === item ? "bg-cyan-100 text-black" : "text-white/65 hover:text-white"}`}>
                      {item === "over" ? (tr ? "Üstüne at" : "Roll Over") : (tr ? "Altına at" : "Roll Under")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-12 pt-10">
                <div className="relative pb-2">
                  <div
                    className={`tech-dice-roll-marker tech-dice-roll-marker-${markerStatus} ${markerLanded ? "tech-dice-roll-marker-landed" : ""}`}
                    style={{ left: `${markerPosition}%` }}
                    aria-live="polite"
                  >
                    <span>{result ? result.rolledNumber.toFixed(2) : (tr ? "At" : "Roll")}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.01"
                    value={safeTarget}
                    onChange={(event) => setTarget(clampTarget(Number(event.target.value)))}
                    className="tech-dice-slider w-full"
                    style={{ background: sliderBackground }}
                    aria-label={tr ? "Hedef sayı seçici" : "Target number selector"}
                  />
                </div>
                <div className="mt-3 flex justify-between text-xs uppercase tracking-[0.16em] text-white/35"><span>0</span><span>{tr ? "Hedef" : "Target"} {safeTarget.toFixed(2)}</span><span>100</span></div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <span className="text-xs uppercase tracking-[0.18em] text-white/40">{tr ? "Tech Coin tutarı" : "Tech Coin amount"}</span>
                <input type="text" inputMode="decimal" min="1" max="10000" value={amountInput} onChange={(event) => setAmountInput(normalizeDecimalInput(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-lg font-bold text-white outline-none focus:border-cyan-200/50" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <Stat label={tr ? "Çarpan" : "Multiplier"} value={`${math.multiplier.toFixed(2)}x`} glow />
                <Stat label={tr ? "Ödül" : "Reward"} value={`${formatNumber(potentialReward, locale)} TC`} glow />
              </div>
            </div>

            <button type="button" disabled={rolling || safeAmount <= 0} onClick={roll} className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-cyan-100 via-white to-purple-100 px-6 py-4 text-base font-black text-black shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">
              <Sparkles className="h-5 w-5" /> {rolling ? (tr ? "Atılıyor..." : "Rolling...") : (tr ? "At" : "Roll")}
            </button>

            <div className="mt-5 grid gap-3 text-sm text-white/65 sm:grid-cols-2 lg:grid-cols-4">
              <ResultLine label={tr ? "Sonuç" : "Result"} value={message || (tr ? "Hazır" : "Ready")} />
              <ResultLine label={tr ? "Mod" : "Mode"} value={mode === "over" ? (tr ? "Üstüne at" : "Roll Over") : (tr ? "Altına at" : "Roll Under")} />
              <ResultLine label={tr ? "Hedef" : "Target"} value={safeTarget.toFixed(2)} />
              <ResultLine label={tr ? "Gelen" : "Rolled"} value={result ? result.rolledNumber.toFixed(2) : "--"} />
            </div>
          </div>

          <aside className="space-y-6">
            <GameSessionStatsPanel gameName="Tech Dice" stats={displayedSessionStats} onReset={resetSessionStats} />
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2"><Dice5 className="h-5 w-5 text-cyan-100" /><h2 className="text-xl font-semibold">{tr ? "Son Atışlar" : "Recent Rolls"}</h2></div>
              <div className="mt-4 space-y-2">
                {recent.length ? recent.slice(0, 6).map((item, index) => (
                  <div key={`${item.created_at}-${index}`} className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/65">
                    <span className={item.result === "win" ? "text-emerald-200" : "text-red-200"}>{item.result === "win" ? (tr ? "Kazanç" : "Win") : (tr ? "Kayıp" : "Loss")}</span>
                    <span>{item.mode === "over" ? (tr ? "Üst" : "Over") : (tr ? "Alt" : "Under")}</span>
                    <span>{Number(item.rolled_number || 0).toFixed(2)}</span>
                    <span className="text-right">{formatSignedTc(item.net_amount, locale)}</span>
                  </div>
                )) : <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">{tr ? "Henüz Tech Dice atışı yok. Oturum geçmişin ilk atıştan sonra başlar." : "No Tech Dice rolls yet. Your session history starts after the first roll."}</p>}
              </div>
            </div>
          </aside>
        </section>
      </div>
      <style>{`
        .tech-dice-slider { height: 18px; border-radius: 999px; appearance: none; box-shadow: 0 0 28px rgba(34, 211, 238, 0.18); outline: none; }
        .tech-dice-slider::-webkit-slider-thumb { appearance: none; width: 34px; height: 34px; border-radius: 999px; border: 3px solid white; background: radial-gradient(circle, #67e8f9, #8b5cf6); box-shadow: 0 0 26px rgba(103, 232, 249, 0.65); cursor: pointer; transition: transform .18s ease; }
        .tech-dice-slider::-webkit-slider-thumb:hover { transform: scale(1.08); }
        .tech-dice-slider::-moz-range-thumb { width: 34px; height: 34px; border-radius: 999px; border: 3px solid white; background: #67e8f9; box-shadow: 0 0 26px rgba(103, 232, 249, 0.65); cursor: pointer; }
        .tech-dice-roll-marker { position: absolute; top: -3.15rem; z-index: 5; display: grid; min-width: 3.8rem; height: 2.55rem; transform: translateX(-50%); place-items: center; border-radius: 0.9rem; border: 1px solid rgba(255,255,255,0.26); background: linear-gradient(135deg, rgba(8,14,26,0.96), rgba(33,22,62,0.92)); color: white; font-size: 0.82rem; font-weight: 950; box-shadow: 0 0 26px rgba(34,211,238,0.28); transition: left 620ms cubic-bezier(.16,.9,.22,1.12), box-shadow 220ms ease, background 220ms ease; }
        .tech-dice-roll-marker::after { content: ""; position: absolute; bottom: -0.42rem; width: 0.8rem; height: 0.8rem; transform: rotate(45deg); border-bottom: 1px solid rgba(255,255,255,0.22); border-right: 1px solid rgba(255,255,255,0.22); background: inherit; }
        .tech-dice-roll-marker-win { border-color: rgba(52,211,153,0.72); box-shadow: 0 0 30px rgba(52,211,153,0.62); }
        .tech-dice-roll-marker-loss { border-color: rgba(248,113,113,0.72); box-shadow: 0 0 30px rgba(248,113,113,0.58); }
        .tech-dice-roll-marker-rolling { animation: tech-dice-pulse 760ms ease-in-out infinite alternate; }
        .tech-dice-roll-marker-landed { animation: tech-dice-land 520ms cubic-bezier(.2,1.45,.42,1); }
        @keyframes tech-dice-pulse { from { transform: translateX(-50%) translateY(0) scale(1); } to { transform: translateX(-50%) translateY(-0.2rem) scale(1.04); } }
        @keyframes tech-dice-land { 0% { transform: translateX(-50%) translateY(-0.42rem) scale(0.96); } 55% { transform: translateX(-50%) translateY(0.18rem) scale(1.08); } 100% { transform: translateX(-50%) translateY(0) scale(1); } }
      `}</style>
    </main>
  );
}

function diceMath(mode: DiceMode, target: number) {
  const safeTarget = clampTarget(target);
  const rawChance = mode === "over" ? (100 - safeTarget) / 100 : safeTarget / 100;
  const winChance = clampNumber(rawChance, 0.0001, 0.9999);
  const multiplier = sanitizeMultiplier(RTP / winChance);
  return { winChance: Number(winChance.toFixed(4)), multiplier };
}

function buildSliderBackground(mode: DiceMode, target: number) {
  const stop = clampNumber(target, 0, 100);
  return mode === "over"
    ? `linear-gradient(90deg, rgba(248,113,113,0.9) 0%, rgba(248,113,113,0.9) ${stop}%, rgba(52,211,153,0.95) ${stop}%, rgba(52,211,153,0.95) 100%)`
    : `linear-gradient(90deg, rgba(52,211,153,0.95) 0%, rgba(52,211,153,0.95) ${stop}%, rgba(248,113,113,0.9) ${stop}%, rgba(248,113,113,0.9) 100%)`;
}

function sanitizeResult(value: unknown, fallback: { amount: number; mode: DiceMode; target: number }): DiceResult | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<DiceResult>;
  const rolledNumber = clampNumber(Number(parsed.rolledNumber), 0, 100);
  const mode = parsed.mode === "under" ? "under" : fallback.mode;
  const target = clampTarget(Number(parsed.target ?? fallback.target));
  const won = Boolean(parsed.won);
  const amount = clampInteger(parsed.amount ?? fallback.amount, 1, 10_000);
  const multiplier = sanitizeMultiplier(parsed.multiplier);
  const rewardAmount = Math.max(0, Math.round(Number(parsed.rewardAmount) || 0));
  const lossAmount = Math.max(0, Math.round(Number(parsed.lossAmount) || 0));
  const net = Number.isFinite(Number(parsed.net)) ? Math.round(Number(parsed.net)) : won ? rewardAmount - amount : -amount;

  return {
    mode,
    target,
    rolledNumber,
    won,
    amount,
    multiplier,
    winChance: diceMath(mode, target).winChance,
    rewardAmount,
    lossAmount,
    net,
    message: won ? "Successful Roll" : "Missed Roll",
  };
}

function sanitizeWallet(value: Partial<WalletState>): WalletState {
  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Math.max(0, Math.round(Number(value.balance) || 0)),
    lifetime_earned: Math.max(0, Math.round(Number(value.lifetime_earned) || 0)),
  };
}

function sanitizeRecent(value: unknown[]): DiceLog[] {
  return value.slice(0, MAX_RECENT_ROLLS).map((item) => {
    const parsed = (item || {}) as Partial<DiceLog>;
    return {
      mode: parsed.mode === "under" ? "under" : "over",
      target_number: clampTarget(Number(parsed.target_number ?? 50)),
      rolled_number: clampNumber(Number(parsed.rolled_number), 0, 100),
      amount: Math.max(0, Math.round(Number(parsed.amount) || 0)),
      multiplier: sanitizeMultiplier(parsed.multiplier),
      win_chance: clampNumber(Number(parsed.win_chance), 0.0001, 0.9999),
      reward_amount: Math.max(0, Math.round(Number(parsed.reward_amount) || 0)),
      net_amount: Math.round(Number(parsed.net_amount) || 0),
      result: parsed.result === "win" ? "win" : "loss",
      created_at: String(parsed.created_at || ""),
    };
  });
}

function Stat({ label, value, glow = false }: { label: string; value: string | number; glow?: boolean }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-black/30 p-4 ${glow ? "shadow-xl shadow-cyan-500/10" : ""}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><span>{label}</span><strong className="text-white">{value}</strong></div>;
}

function clampTarget(value: number) {
  return Number(clampNumber(value, TARGET_MIN, TARGET_MAX).toFixed(2));
}

function clampInteger(value: unknown, min: number, max: number) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  return decimalParts.length ? `${normalizedInteger || "0"}.${decimalParts.join("")}` : normalizedInteger;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function sanitizeMultiplier(value: unknown) {
  const multiplier = Number(value);
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 1;
  return Number(Math.max(0.01, Math.min(9600, multiplier)).toFixed(2));
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatSignedTc(value: number, locale: string) {
  const safe = Math.round(Number(value) || 0);
  return `${safe >= 0 ? "+" : ""}${formatNumber(safe, locale)} TC`;
}
