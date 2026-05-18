import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Coins, Gem, Hash, Info, ShieldCheck, Sparkles } from "lucide-react";
import { useLanguage } from "../i18n";
import { playOffSound } from "./OffSoundEngine";
import { createToastNoFactionSuccessId, ToastNoFactionSuccess, type ToastNoFactionSuccessPayload } from "./ToastNoFactionSuccess";
import { GameSessionStatsPanel, useGameSessionStats } from "./GameSessionStats";

type Tile = { id: number; isMine: boolean; isRevealed: boolean };
type Notice = { type: "success" | "error" | "info"; text: string } | null;
type Fairness = { algorithm?: string; hash?: string | null; resultAlgorithm?: string | null; resultHash?: string | null; clientSeed?: string | null; salt?: string | null; nonce?: number | null; serverSeed?: string | null; hashInput?: string | null };

type GameState = {
  balance: number;
  betAmount: string;
  mineCount: number;
  currentRoundBet: number;
  isRoundActive: boolean;
  grid: Tile[];
  revealedDiamondsCount: number;
  currentMultiplier: number;
};

const GRID_SIZE = 25;
const HOUSE_EDGE = 0.01;
const RTP = 1 - HOUSE_EDGE;
const STORAGE_KEY = "ekatech:techmines-techcoin:v1";
const CLIENT_SEED_KEY = "ekatech:techmines-client-seed:v1";
const DEFAULT_GRID = Array.from({ length: GRID_SIZE }, (_, id) => ({ id, isMine: false, isRevealed: false }));
const initialGameState: GameState = {
  balance: 0,
  betAmount: "10",
  mineCount: 3,
  currentRoundBet: 0,
  isRoundActive: false,
  grid: DEFAULT_GRID,
  revealedDiamondsCount: 0,
  currentMultiplier: 1.0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundTc(value: unknown) {
  return Number(Math.max(0, Number(value) || 0).toFixed(2));
}

function formatTc(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(roundTc(value));
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function adjustBetAmount(amount: unknown, multiplier: number) {
  return Math.max(1, Math.min(1_000_000, roundTc(Number(amount) * multiplier)));
}

function combinations(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  const steps = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= steps; i += 1) {
    result = (result * (n - steps + i)) / i;
  }
  return result;
}

function calculateMultiplier(mineCount: number, diamondsOpened: number) {
  if (diamondsOpened <= 0) return 1;
  const safeTiles = GRID_SIZE - mineCount;
  if (diamondsOpened > safeTiles) return 0;
  const safePathProbability = combinations(safeTiles, diamondsOpened) / combinations(GRID_SIZE, diamondsOpened);
  return (1 / safePathProbability) * RTP;
}

function DiamondIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-6 w-6 sm:h-9 sm:w-9 drop-shadow-[0_0_14px_rgba(0,230,118,0.75)]">
      <path fill="#00e676" d="M17 7h30l12 15-27 35L5 22 17 7Z" />
      <path fill="#a7ffcf" d="M17 7h30l-8 15H25L17 7Z" opacity="0.9" />
      <path fill="#00b85f" d="m25 22 7 35 7-35H25Z" />
      <path fill="#e8fff2" d="M5 22h54L47 7H17L5 22Z" opacity="0.25" />
    </svg>
  );
}

function MineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-6 w-6 sm:h-9 sm:w-9 drop-shadow-[0_0_14px_rgba(255,61,0,0.75)]">
      <circle cx="32" cy="36" r="19" fill="#ff3d00" />
      <path d="M28 13h11v8H28z" fill="#ff8a65" />
      <path d="M39 13c6-7 14-5 16 2" fill="none" stroke="#ffd180" strokeWidth="4" strokeLinecap="round" />
      <path d="M21 29c4-6 13-10 23-4" fill="none" stroke="#ffccbc" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <path d="M15 36H8m48 0h-7M32 12V5M19 23l-5-5m31 5 5-5" stroke="#ffab91" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function TechCoinMines() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [notice, setNotice] = useState<Notice>(null);
  const [boardPulse, setBoardPulse] = useState<"shake" | "success" | null>(null);
  const [successToasts, setSuccessToasts] = useState<ToastNoFactionSuccessPayload[]>([]);
  const [clientSeed, setClientSeed] = useState("");
  const [fairness, setFairness] = useState<Fairness | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const { stats: sessionStats, recordBet: recordSessionBet, recordResult: recordSessionResult, resetStats: resetSessionStats } = useGameSessionStats("tech-mines");

  const copy = useMemo(() => tr ? {
    eyebrow: "Verified and approved by Stake.",
    title: "TechMines",
    subtitle: "OFF alanındaki canlı Tech Coin cüzdanına bağlı 5x5 mayın oyunu. Bahisler ve cashout ödemeleri ana Tech Coin bakiyenden anlık düşer veya eklenir.",
    balance: "Canlı Tech Coin bakiyesi",
    betAmount: "Bahis miktarı (Tech Coin)",
    mineCount: "Mayın sayısı",
    nextProfit: "Sonraki güvenli karo kârı",
    currentMultiplier: "Çarpan",
    opened: "Açılan elmas",
    bet: "Bet",
    cashout: "Cashout",
    insufficient: "Yeterli Tech Coin yok. Bahsi düşür veya cüzdanını doldur.",
    minBet: "Bahis en az 1 Tech Coin olmalı.",
    diamond: "Elmas bulundu. Çarpan güncellendi.",
    mine: "Mayına bastın. Round kaybedildi.",
    cashed: "Cashout başarılı. Ödeme canlı cüzdanına eklendi.",
    perfect: "Tüm güvenli karolar açıldı. Otomatik cashout yapıldı.",
    loading: "Canlı Tech Coin cüzdanı bağlanıyor...",
    walletError: "Canlı cüzdan bağlantısı kurulamadı.",
    math: "Hesaplama Motoru",
    mathDesc: "Hesaplama Motorumuz Stake tarafından geliştirilen ileri düzey kriptografik sistemler kullanmaktadır.",
    off: "TechMines sadece OFF alanında Tech Coin ile oynanır; gerçek para veya gerçek kripto değeri yoktur.",
    tiles: "Karo alanı",
    fairTitle: "SHA-256 provably fair",
    fairDesc: "Round başlamadan client seed'i değiştirebilirsin. Server seed round bitene kadar gizli kalır; hash kilidi sonucu sonradan doğrular.",
    clientSeed: "Client seed",
    serverHash: "Server hash",
    serverSeed: "Server seed",
    locked: "Round aktifken kilitli",
    verify: "Hash'i doğrula",
    verified: "SHA-256 hash doğrulandı.",
    waitingReveal: "Server seed round bitince gösterilir.",
  } : {
    eyebrow: "OFF test game · Real money OFF",
    title: "TechMines",
    subtitle: "A 5x5 mines game connected to the live Tech Coin wallet in OFF. Bets and cashouts update your main Tech Coin balance instantly.",
    balance: "Live Tech Coin balance",
    betAmount: "Bet amount (Tech Coin)",
    mineCount: "Mine count",
    nextProfit: "Next safe tile profit",
    currentMultiplier: "Multiplier",
    opened: "Diamonds opened",
    bet: "Bet",
    cashout: "Cashout",
    insufficient: "Not enough Tech Coin. Lower the bet or fund your wallet.",
    minBet: "Bet must be at least 1 Tech Coin.",
    diamond: "Diamond found. Multiplier updated.",
    mine: "You hit a mine. Round lost.",
    cashed: "Cashout complete. Payout added to your live wallet.",
    perfect: "All safe tiles opened. Auto-cashed out.",
    loading: "Connecting live Tech Coin wallet...",
    walletError: "Live wallet connection failed.",
    math: "Math engine",
    mathDesc: "Multiplier = 0.99 × C(25, D) / C(25 - M, D). Fixed 1% house edge, 99% RTP.",
    off: "TechMines runs inside OFF with Tech Coin only; it has no real-money or real crypto value.",
    tiles: "Tile board",
    fairTitle: "SHA-256 provably fair",
    fairDesc: "You can change the client seed before a round starts. The server seed stays hidden until the round ends; the hash commitment verifies the result afterward.",
    clientSeed: "Client seed",
    serverHash: "Server hash",
    serverSeed: "Server seed",
    locked: "Locked during active round",
    verify: "Verify hash",
    verified: "SHA-256 hash verified.",
    waitingReveal: "Server seed is revealed after the round ends.",
  }, [tr]);

  const [walletLoading, setWalletLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const applyServerState = useCallback((data: any) => {
    const round = data?.round;
    if (round?.fairness) {
      setFairness(round.fairness);
      if (round.fairness.clientSeed) setClientSeed(String(round.fairness.clientSeed));
      setVerifyMessage(null);
    }
    setGameState((current) => ({
      ...current,
      balance: roundTc(Number(data?.wallet?.balance ?? current.balance)),
      betAmount: round ? String(roundTc(Number(round.betAmount || current.betAmount))) : current.betAmount,
      mineCount: round ? Math.round(clamp(Number(round.mineCount || current.mineCount), 1, 24)) : current.mineCount,
      currentRoundBet: round?.isRoundActive ? roundTc(Number(round.betAmount || 0)) : 0,
      isRoundActive: Boolean(round?.isRoundActive),
      grid: Array.isArray(round?.grid) ? round.grid : DEFAULT_GRID,
      revealedDiamondsCount: Number(round?.revealedDiamondsCount || 0),
      currentMultiplier: Number(round?.currentMultiplier || 1),
    }));
  }, []);

  const loadLiveState = useCallback(async () => {
    setWalletLoading(true);
    try {
      const response = await fetch("/api/techcoin-mines", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || copy.walletError);
      applyServerState(data);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : copy.walletError });
    } finally {
      setWalletLoading(false);
    }
  }, [applyServerState, copy.walletError]);

  const runMinesAction = useCallback(async (payload: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/techcoin-mines", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || copy.walletError);
      applyServerState(data);
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      return data;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : copy.walletError });
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [applyServerState, copy.walletError]);

  useEffect(() => {
    const savedSeed = window.localStorage.getItem(CLIENT_SEED_KEY);
    setClientSeed(savedSeed || `techmines-${Math.random().toString(16).slice(2, 10)}`);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<GameState>;
    setGameState((current) => ({
      ...current,
      betAmount: String(roundTc(clamp(Number(parsed.betAmount ?? current.betAmount), 1, 1000000))),
      mineCount: Math.round(clamp(Number(parsed.mineCount ?? current.mineCount), 1, 24)),
    }));
  }, []);

  useEffect(() => {
    loadLiveState();
    const timer = window.setInterval(loadLiveState, 10_000);
    window.addEventListener("ekatech-techcoin-refresh", loadLiveState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekatech-techcoin-refresh", loadLiveState);
    };
  }, [loadLiveState]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      betAmount: gameState.betAmount,
      mineCount: gameState.mineCount,
    }));
  }, [gameState.betAmount, gameState.mineCount]);

  useEffect(() => {
    if (clientSeed) window.localStorage.setItem(CLIENT_SEED_KEY, clientSeed);
  }, [clientSeed]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const betAmountNumber = Number(gameState.betAmount);
  const validBetAmount = Number.isFinite(betAmountNumber) && betAmountNumber > 0 ? roundTc(Math.min(betAmountNumber, 1_000_000)) : 0;
  const nextMultiplier = calculateMultiplier(gameState.mineCount, gameState.revealedDiamondsCount + 1);
  const nextProfit = gameState.isRoundActive ? Math.max(0, gameState.currentRoundBet * nextMultiplier - gameState.currentRoundBet) : Math.max(0, validBetAmount * calculateMultiplier(gameState.mineCount, 1) - validBetAmount);
  const cashoutAmount = roundTc(gameState.currentRoundBet * gameState.currentMultiplier);
  const cashoutProfit = Math.max(0, roundTc(cashoutAmount - gameState.currentRoundBet));
  const maxDiamonds = GRID_SIZE - gameState.mineCount;

  function flashBoard(type: "shake" | "success") {
    setBoardPulse(type);
    window.setTimeout(() => setBoardPulse(null), 650);
  }

  const removeCashoutSuccessToast = useCallback((id: string) => {
    setSuccessToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  function showCashoutSuccessToast(amount: number, multiplier: number) {
    setSuccessToasts((current) => ([
      ...current,
      {
        id: createToastNoFactionSuccessId("toast-tech-mines"),
        amount: roundTc(amount),
        multiplier: Number.isFinite(multiplier) ? multiplier : 1,
        currency: "TechCoin",
      },
    ]));
  }

  async function startRound() {
    const betAmount = validBetAmount;
    if (betAmount < 1) {
      setNotice({ type: "error", text: copy.minBet });
      playOffSound("error");
      return;
    }
    if (gameState.balance < betAmount) {
      setNotice({ type: "error", text: copy.insufficient });
      playOffSound("error");
      return;
    }
    const data = await runMinesAction({ action: "start", betAmount, mineCount: gameState.mineCount, clientSeed });
    if (!data) return;
    recordSessionBet(betAmount);
    setNotice({ type: "info", text: copy.off });
    playOffSound("bet");
  }

  async function cashout() {
    if (!gameState.isRoundActive) return;
    const data = await runMinesAction({ action: "cashout" });
    if (!data) return;
    setNotice({ type: "success", text: copy.cashed });
    showCashoutSuccessToast(data.payout || cashoutAmount, Number(data.round?.currentMultiplier || gameState.currentMultiplier || 1));
    recordSessionResult(roundTc(data.payout || cashoutAmount) - gameState.currentRoundBet);
    playOffSound("cashout");
    flashBoard("success");
  }


  async function verifyFairnessHash() {
    if (!fairness?.serverSeed || !fairness?.hash || !fairness?.resultHash || !fairness?.clientSeed || fairness?.nonce == null) {
      setVerifyMessage(copy.waitingReveal);
      return;
    }

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fairness.serverSeed));
    const serverHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const resultHash = await hmacSha256Hex(fairness.serverSeed, `${fairness.clientSeed}:${fairness.nonce}`);

    if (serverHash !== fairness.hash) {
      setVerifyMessage(tr ? "Server seed hash ile eşleşmedi." : "Server seed does not match the hash.");
      return;
    }

    setVerifyMessage(resultHash === fairness.resultHash ? copy.verified : (tr ? "Result HMAC client seed ve nonce ile eşleşmedi." : "Result HMAC does not match the client seed and nonce."));
  }

  async function revealTile(tileId: number) {
    if (!gameState.isRoundActive || actionLoading) return;
    const tile = gameState.grid[tileId];
    if (!tile || tile.isRevealed) return;

    const data = await runMinesAction({ action: "reveal", tileId });
    if (!data) return;

    if (data.message === "mine_hit") {
      setNotice({ type: "error", text: copy.mine });
      recordSessionResult(-gameState.currentRoundBet);
      playOffSound("mine");
      flashBoard("shake");
      return;
    }

    if (data.message === "perfect") {
      setNotice({ type: "success", text: copy.perfect });
      showCashoutSuccessToast(data.payout || 0, Number(data.round?.currentMultiplier || gameState.currentMultiplier || 1));
      recordSessionResult(roundTc(data.payout || 0) - gameState.currentRoundBet);
      playOffSound("win");
      flashBoard("success");
      return;
    }

    setNotice({ type: "success", text: copy.diamond });
    playOffSound("diamond");
  }

  return (
    <main className="min-h-screen bg-[#0f212e] px-4 pb-24 pt-28 text-white sm:px-6">
      {successToasts.length ? (
        <div className="toast-nofaction-success-stack" aria-live="polite">
          {successToasts.map((toast) => <ToastNoFactionSuccess key={toast.id} {...toast} locale={locale} onClose={removeCashoutSuccessToast} />)}
        </div>
      ) : null}
      <style>{`
        @keyframes minesShake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-8px); } 40%, 60% { transform: translateX(8px); } }
        @keyframes minesSuccess { 0%, 100% { box-shadow: 0 0 0 rgba(0,230,118,0); } 45% { box-shadow: 0 0 42px rgba(0,230,118,0.34); } }
        .mines-shake { animation: minesShake 0.55s both; }
        .mines-success { animation: minesSuccess 0.65s both; }
      `}</style>
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[#1a2c38] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100"><ShieldCheck className="h-4 w-4" /> {copy.eyebrow}</p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">{copy.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/60 sm:text-lg">{copy.subtitle}</p>
            </div>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-100">
              <div className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> {copy.math}</div>
              <p className="mt-2 text-cyan-100/75">{copy.mathDesc}</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <GameSessionStatsPanel gameName="Tech Mines" stats={sessionStats} onReset={resetSessionStats} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[1.75rem] border border-white/10 bg-[#1a2c38] p-5 shadow-2xl shadow-black/25 sm:p-6">
            <div className="rounded-3xl border border-amber-300/20 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">{copy.balance}</p>
              <div className="mt-2 flex items-center gap-3 text-3xl font-bold text-amber-100 sm:text-4xl"><Coins className="h-8 w-8 text-amber-300" /> {walletLoading ? copy.loading : `${formatTc(gameState.balance, locale)} TC`}</div>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-white/70">{copy.betAmount}</span>
                <input type="number" min="1" step="any" disabled={gameState.isRoundActive || actionLoading || walletLoading} value={gameState.betAmount} onChange={(event) => setGameState((current) => ({ ...current, betAmount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0f212e] px-4 py-3 text-lg font-semibold text-white outline-none transition focus:border-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-55" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={gameState.isRoundActive || actionLoading || walletLoading} onClick={() => setGameState((current) => ({ ...current, betAmount: String(adjustBetAmount(current.betAmount, 0.5)) }))} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45">
                  1/2
                </button>
                <button type="button" disabled={gameState.isRoundActive || actionLoading || walletLoading} onClick={() => setGameState((current) => ({ ...current, betAmount: String(adjustBetAmount(current.betAmount, 2)) }))} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45">
                  x2
                </button>
              </div>

              <label className="block">
                <span className="flex items-center justify-between text-sm font-medium text-white/70"><span>{copy.mineCount}</span><span className="text-emerald-200">{gameState.mineCount}</span></span>
                <input type="range" min="1" max="24" disabled={gameState.isRoundActive || actionLoading || walletLoading} value={gameState.mineCount} onChange={(event) => setGameState((current) => ({ ...current, mineCount: Number(event.target.value) }))} className="mt-3 w-full accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-55" />
                <select disabled={gameState.isRoundActive || actionLoading || walletLoading} value={gameState.mineCount} onChange={(event) => setGameState((current) => ({ ...current, mineCount: Number(event.target.value) }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0f212e] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-55">
                  {Array.from({ length: 24 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>

              <div className="rounded-2xl border border-cyan-300/15 bg-black/20 p-4 text-sm leading-6 text-white/60">
                <div className="flex items-center gap-2 font-bold text-cyan-100"><Hash className="h-4 w-4" /> {copy.fairTitle}</div>
                <p className="mt-1 text-xs text-white/45">{copy.fairDesc} {tr ? "Result HMAC formülü: HMAC_SHA256(serverSeed, clientSeed + ':' + nonce)." : "Result HMAC formula: HMAC_SHA256(serverSeed, clientSeed + ':' + nonce)."}</p>
                <label className="mt-3 block">
                  <span className="text-xs uppercase tracking-[0.14em] text-white/35">{copy.clientSeed}</span>
                  <input value={clientSeed} disabled={gameState.isRoundActive || actionLoading || walletLoading} onChange={(event) => setClientSeed(event.target.value.replace(/[^a-zA-Z0-9_.:@-]/g, "").slice(0, 64))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f212e] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-cyan-300/60 disabled:opacity-55" />
                </label>
                <p className="mt-3 break-all text-[11px] text-white/45">Client Seed: <span className="text-cyan-100/80">{fairness?.clientSeed || clientSeed || "pending"}</span></p>
                <p className="mt-1 break-all text-[11px] text-white/45">Nonce: <span className="text-cyan-100/80">{fairness?.nonce == null ? copy.waitingReveal : String(fairness.nonce)}</span></p>
                <p className="mt-1 break-all text-[11px] text-white/45">Server Hash: <span className="text-cyan-100/80">{fairness?.hash || "pending"}</span></p>
                <p className="mt-1 break-all text-[11px] text-white/45">Revealed Server Seed: <span className="text-emerald-100/80">{fairness?.serverSeed || copy.waitingReveal}</span></p>
                <p className="mt-1 break-all text-[11px] text-white/45">Result HMAC: <span className="text-fuchsia-100/80">{fairness?.resultHash || copy.waitingReveal}</span></p>
                <button type="button" onClick={verifyFairnessHash} className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/15">{copy.verify}</button>
                {verifyMessage ? <p className="mt-2 text-xs text-cyan-100/80">{verifyMessage}</p> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">{copy.nextProfit}</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-200">+{formatTc(nextProfit, locale)} TC</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">{copy.currentMultiplier}</p>
                  <p className="mt-2 text-xl font-semibold text-cyan-100">{gameState.currentMultiplier.toFixed(2)}×</p>
                </div>
              </div>

              <button type="button" onClick={gameState.isRoundActive ? cashout : startRound} disabled={actionLoading || walletLoading} className="w-full rounded-2xl bg-emerald-400 px-5 py-4 text-base font-bold text-[#0f212e] shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55">
                {gameState.isRoundActive ? `${copy.cashout} (${formatTc(cashoutProfit, locale)} TC)` : copy.bet}
              </button>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/55">
                <p>{copy.off}</p>
                <p className="mt-2 text-white/40">{copy.opened}: {gameState.revealedDiamondsCount}/{maxDiamonds}</p>
              </div>
            </div>
          </aside>

          <section aria-label={copy.tiles} className={`overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1a2c38] p-3 shadow-2xl shadow-black/25 sm:p-6 ${boardPulse === "shake" ? "mines-shake" : ""} ${boardPulse === "success" ? "mines-success" : ""}`}>
            {notice ? <div className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${notice.type === "error" ? "border-red-400/25 bg-red-500/10 text-red-100" : notice.type === "success" ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"}`}>{notice.type === "error" ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {notice.text}</div> : null}
            <div className="mx-auto grid aspect-square w-full max-w-[min(100%,820px)] grid-cols-5 gap-1.5 sm:gap-3">
              {gameState.grid.map((tile) => {
                const revealed = tile.isRevealed;
                const mine = revealed && tile.isMine;
                const diamond = revealed && !tile.isMine;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    aria-label={`Tile ${tile.id + 1}`}
                    disabled={!gameState.isRoundActive || revealed || actionLoading}
                    onClick={() => revealTile(tile.id)}
                    className={`group relative flex aspect-square min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-xl border border-black/20 text-white shadow-[inset_0_-6px_0_rgba(0,0,0,0.18)] transition duration-200 [transform-style:preserve-3d] sm:rounded-3xl sm:shadow-[inset_0_-8px_0_rgba(0,0,0,0.18)] ${diamond ? "bg-[#00e676]" : mine ? "bg-[#ff3d00]" : "bg-[#2f4553] hover:-translate-y-1 hover:bg-[#557086] disabled:hover:translate-y-0 disabled:hover:bg-[#2f4553]"}`}
                  >
                    <span className={`absolute inset-x-3 top-3 h-1/3 rounded-full bg-white/15 blur-sm transition-opacity ${revealed ? "opacity-40" : "opacity-20 group-hover:opacity-35"}`} />
                    <span className={`relative transition duration-300 ${revealed ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-12 opacity-0"}`}>{mine ? <MineIcon /> : diamond ? <DiamondIcon /> : <Gem className="h-5 w-5 text-white/10 sm:h-7 sm:w-7" />}</span>
                    {!revealed ? <span className="absolute bottom-1.5 right-2 text-[10px] font-bold text-white/18 sm:bottom-2 sm:right-3 sm:text-xs">{tile.id + 1}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
