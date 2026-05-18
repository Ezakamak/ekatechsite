import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseZap, Hash, ListRestart, ServerCog, ShieldCheck, XCircle } from "lucide-react";
import { BetControls } from "./BetControls";
import { TechCanvas } from "./TechCanvas";
import { TechWalletPanel } from "./TechWalletPanel";
import { createToastNoFactionSuccessId, ToastNoFactionSuccess, type ToastNoFactionSuccessPayload } from "../ToastNoFactionSuccess";
import { GameSessionStatsPanel, useGameSessionStats } from "../GameSessionStats";
import { useLanguage } from "../../i18n";
import type { AviatorRoundResult, BetPanelState, GameState, TechCoinWallet } from "./types";

const BETTING_SECONDS = 8;
const MULTIPLIER_GROWTH = 0.28;

const initialPanels: BetPanelState[] = [
  { id: "panel-a", amount: "100", autoBet: false, autoCashout: true, autoCashoutMultiplier: "2", isBetAccepted: false, hasCashedOut: false },
  { id: "panel-b", amount: "250", autoBet: false, autoCashout: false, autoCashoutMultiplier: "3", isBetAccepted: false, hasCashedOut: false },
];

const initialGameState: GameState = {
  roundId: "sql-booting",
  status: "STATUS_BETTING",
  salt: "pending",
  hash: "pending",
  currentMultiplier: 1,
  startedAt: Date.now(),
  bettingSeconds: BETTING_SECONDS,
};

export function TechAviator() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const [wallet, setWallet] = useState<TechCoinWallet>();
  const [recentMultipliers, setRecentMultipliers] = useState<AviatorRoundResult[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [visualMultiplier, setVisualMultiplier] = useState(1);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lastSyncedGameState, setLastSyncedGameState] = useState<GameState>(initialGameState);
  const [panels, setPanels] = useState<BetPanelState[]>(initialPanels);
  const [countdown, setCountdown] = useState(BETTING_SECONDS);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [connectionNotice, setConnectionNotice] = useState<string>(tr ? "SQL canlı motoruna bağlanıyor; tüm pilotlar aynı roundu görecek." : "Connecting to the live SQL engine; every pilot will see the same round.");
  const [verifyMessage, setVerifyMessage] = useState<string>();
  const [verifyOk, setVerifyOk] = useState<boolean>();
  const [successToasts, setSuccessToasts] = useState<ToastNoFactionSuccessPayload[]>([]);
  const [, setCashoutToastTriggers] = useState<Record<string, boolean>>({});
  const { stats: sessionStats, recordBet: recordSessionBet, recordResult: recordSessionResult, resetStats: resetSessionStats } = useGameSessionStats("tech-aviator");
  const autoBetRoundRef = useRef<string>("");
  const liveRoundRef = useRef<string>(initialGameState.roundId);
  const cashoutLockRef = useRef<Set<string>>(new Set());
  const settledCrashLossesRef = useRef<Set<string>>(new Set());

  const updatePanel = useCallback((panelId: string, patch: Partial<BetPanelState>) => {
    setPanels((current) => current.map((panel) => (panel.id === panelId ? { ...panel, ...patch } : panel)));
  }, []);

  const resetPanelsForRound = useCallback(() => {
    cashoutLockRef.current.clear();
    setPanels((current) => current.map((panel) => ({ ...panel, isBetAccepted: false, hasCashedOut: false, activeBetAmount: undefined })));
  }, []);

  const applyLiveState = useCallback((data: any) => {
    if (data?.wallet) setWallet(data.wallet);
    if (Array.isArray(data?.recentMultipliers)) setRecentMultipliers(data.recentMultipliers);
    if (data?.gameState) {
      const nextGameState = data.gameState as GameState;
      const serverNow = Number(nextGameState.serverNow || Date.now());
      const nextServerTimeOffset = serverNow - Date.now();
      const roundChanged = liveRoundRef.current !== nextGameState.roundId;

      if (roundChanged) {
        liveRoundRef.current = nextGameState.roundId;
        resetPanelsForRound();
        setVerifyMessage(undefined);
        setVerifyOk(undefined);
        setVisualMultiplier(1);
      }

      setServerTimeOffset(nextServerTimeOffset);
      setLastSyncedGameState(nextGameState);
      setGameState(nextGameState);

      if (nextGameState.status === "STATUS_BETTING") {
        const bettingStartedAt = Number(nextGameState.bettingStartedAt || nextGameState.startedAt || serverNow);
        const secondsLeft = Math.max(0, Number(nextGameState.bettingSeconds || BETTING_SECONDS) - Math.floor((serverNow - bettingStartedAt) / 1000));
        setVisualMultiplier(1);
        setCountdown(secondsLeft);
      } else if (nextGameState.status === "STATUS_CRASHED") {
        setVisualMultiplier(Math.max(1, Number(nextGameState.crashPoint || nextGameState.currentMultiplier || 1)));
        setCountdown(0);
      } else {
        setCountdown(0);
      }
    }
  }, [resetPanelsForRound]);

  const loadLiveState = useCallback(async () => {
    const response = await fetch("/api/tech-aviator", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || (tr ? "Canlı SQL Tech Aviator roundu yüklenemedi." : "Live SQL Tech Aviator round could not be loaded."));
    applyLiveState(data);
    setConnected(true);
    setConnectionNotice(tr ? "SQL canlı motoru aktif: round, hash, düşüş noktası ve çarpan herkes için tek kaynaktan geliyor." : "Live SQL engine active: round, hash, drop point and multiplier come from one shared source for everyone.");
  }, [applyLiveState]);

  const postLiveAction = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/tech-aviator", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Canlı Tech Coin işlemi tamamlanamadı.");
    applyLiveState(data);
    window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
    return data;
  }, [applyLiveState]);

  const placeBet = useCallback((panel: BetPanelState) => {
    if (gameState.status !== "STATUS_BETTING") {
      setErrorMessage("Uçuşa katılım süresi kapandı.");
      return;
    }

    const amount = roundMoney(Number(panel.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Geçerli bir Tech Coin katılım puanı girin.");
      return;
    }

    if ((wallet?.techCoinBalance ?? 0) < amount) {
      setErrorMessage("Yetersiz Tech Coin bakiyesi.");
      return;
    }

    void postLiveAction({ action: "join-flight", roundId: gameState.roundId, panelId: panel.id, amount })
      .then(() => {
        updatePanel(panel.id, { isBetAccepted: true, hasCashedOut: false, activeBetAmount: amount });
        recordSessionBet(amount);
        setErrorMessage(undefined);
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Uçuş katılımı reddedildi."));
  }, [gameState.roundId, gameState.status, postLiveAction, updatePanel, wallet?.techCoinBalance]);


  const removeCashoutSuccessToast = useCallback((id: string) => {
    setSuccessToasts((current) => {
      const removedToast = current.find((toast) => toast.id === id);
      if (removedToast?.sourceId) {
        setCashoutToastTriggers((triggers) => ({ ...triggers, [removedToast.sourceId as string]: false }));
      }
      return current.filter((toast) => toast.id !== id);
    });
  }, []);

  const showCashoutSuccessToast = useCallback((panel: BetPanelState, amount: number, multiplier: number) => {
    const panelIndex = panels.findIndex((item) => item.id === panel.id);
    const betLabel = `UÇUŞ ${panelIndex >= 0 ? panelIndex + 1 : panel.id} - ROUND PUANI KİLİTLENDİ`;

    setCashoutToastTriggers((current) => ({ ...current, [panel.id]: true }));
    setSuccessToasts((current) => ([
      ...current,
      {
        id: createToastNoFactionSuccessId(`toast-tech-aviator-${panel.id}`),
        sourceId: panel.id,
        title: betLabel,
        amount: roundMoney(amount),
        multiplier: Number.isFinite(multiplier) ? multiplier : 1,
        currency: "TechCoin",
      },
    ]));
  }, [panels]);

  const cashOut = useCallback((panel: BetPanelState) => {
    if (gameState.status !== "STATUS_FLYING" || !panel.isBetAccepted || panel.hasCashedOut) {
      setErrorMessage("Uçuşu durdurma şu anda uygun değil.");
      return;
    }

    const lockKey = `${gameState.roundId}:${panel.id}`;
    if (cashoutLockRef.current.has(lockKey)) return;
    cashoutLockRef.current.add(lockKey);

    void postLiveAction({ action: "stop-flight", roundId: gameState.roundId, panelId: panel.id })
      .then((data) => {
        updatePanel(panel.id, { hasCashedOut: true });
        const backendMultiplier = Number(data.multiplier);
        const backendPayout = Number(data.lockedScore ?? data.payout);
        const fallbackBetAmount = Number(panel.activeBetAmount ?? panel.amount);
        const payout = Number.isFinite(backendPayout) ? backendPayout : Number((Number.isFinite(fallbackBetAmount) ? fallbackBetAmount : 0) * (Number.isFinite(backendMultiplier) ? backendMultiplier : gameState.currentMultiplier));
        showCashoutSuccessToast(panel, payout, Number.isFinite(backendMultiplier) ? backendMultiplier : Number(gameState.currentMultiplier || 1));
        recordSessionResult(roundMoney(payout - (Number.isFinite(fallbackBetAmount) ? fallbackBetAmount : 0)));
        setErrorMessage(undefined);
      })
      .catch((error) => {
        cashoutLockRef.current.delete(lockKey);
        setErrorMessage(error instanceof Error ? error.message : "Uçuşu durdurma reddedildi.");
      });
  }, [gameState.currentMultiplier, gameState.roundId, gameState.status, postLiveAction, showCashoutSuccessToast, updatePanel]);

  useEffect(() => {
    let active = true;
    const refresh = () => loadLiveState().catch((error) => {
      if (!active) return;
      setConnected(false);
      setConnectionNotice(tr ? "SQL canlı motoruna ulaşılamadı; offline/demo round açılmadı, tekrar deneniyor." : "Could not reach the live SQL engine; no offline/demo round was opened, retrying.");
      setErrorMessage(error instanceof Error ? error.message : (tr ? "Canlı SQL Tech Aviator roundu yüklenemedi." : "Live SQL Tech Aviator round could not be loaded."));
    });

    refresh();
    const timer = window.setInterval(refresh, 750);
    window.addEventListener("ekatech-techcoin-refresh", refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ekatech-techcoin-refresh", refresh);
    };
  }, [loadLiveState]);

  useEffect(() => {
    let animationFrame = 0;

    if (lastSyncedGameState.status === "STATUS_BETTING") {
      setVisualMultiplier(1);
      return () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
      };
    }

    if (lastSyncedGameState.status === "STATUS_CRASHED") {
      setVisualMultiplier(Math.max(1, Number(lastSyncedGameState.crashPoint || lastSyncedGameState.currentMultiplier || 1)));
      return () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
      };
    }

    const flightStartedAt = Number(lastSyncedGameState.flightStartedAt);
    if (lastSyncedGameState.status !== "STATUS_FLYING" || !Number.isFinite(flightStartedAt)) {
      return () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
      };
    }

    const tick = () => {
      const syncedNow = Date.now() + serverTimeOffset;
      const elapsedSeconds = Math.max(0, (syncedNow - flightStartedAt) / 1000);
      const rawMultiplier = Math.max(1, Math.exp(MULTIPLIER_GROWTH * elapsedSeconds));
      const knownCrashPoint = Number(lastSyncedGameState.crashPoint);
      const nextMultiplier = Number.isFinite(knownCrashPoint) && knownCrashPoint > 0 ? Math.min(rawMultiplier, knownCrashPoint) : rawMultiplier;

      setVisualMultiplier(nextMultiplier);
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [lastSyncedGameState, serverTimeOffset]);

  useEffect(() => {
    if (gameState.status !== "STATUS_BETTING" || autoBetRoundRef.current === gameState.roundId) return;

    autoBetRoundRef.current = gameState.roundId;
    panels.filter((panel) => panel.autoBet && !panel.isBetAccepted).forEach((panel) => window.setTimeout(() => placeBet(panel), 250));
  }, [gameState.roundId, gameState.status, panels, placeBet]);

  useEffect(() => {
    if (gameState.status !== "STATUS_CRASHED") return;

    panels.forEach((panel) => {
      if (!panel.isBetAccepted || panel.hasCashedOut) return;
      const lossKey = `${gameState.roundId}:${panel.id}`;
      if (settledCrashLossesRef.current.has(lossKey)) return;
      settledCrashLossesRef.current.add(lossKey);
      const settledAmount = Number(panel.activeBetAmount ?? panel.amount);
      recordSessionResult(-Number(Number.isFinite(settledAmount) ? settledAmount : 0));
    });
  }, [gameState.roundId, gameState.status, panels, recordSessionResult]);

  useEffect(() => {
    if (gameState.status !== "STATUS_FLYING") return;

    panels.forEach((panel) => {
      if (panel.autoCashout && panel.isBetAccepted && !panel.hasCashedOut && gameState.currentMultiplier >= Number(panel.autoCashoutMultiplier)) {
        cashOut(panel);
      }
    });
  }, [cashOut, gameState.currentMultiplier, gameState.status, panels]);

  const sqlModeLabel = useMemo(() => (connected ? "SQL ONLINE" : (tr ? "SQL BAĞLANIYOR" : "SQL CONNECTING")), [connected, tr]);

  return (
    <main className="min-h-screen bg-black px-4 pb-16 pt-28 text-white sm:px-6">
      {successToasts.length ? (
        <div className="toast-nofaction-success-stack" aria-live="polite">
          {successToasts.map((toast) => <ToastNoFactionSuccess key={toast.id} {...toast} locale={locale} onClose={removeCashoutSuccessToast} />)}
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.55em] text-emerald-300">Arcade / Tech Aviator</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              Tech Coin <span className="text-emerald-300 drop-shadow-[0_0_18px_rgba(16,185,129,0.8)]">Aviator</span>
            </h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              {tr ? "Offline/demo motor kapalı: round, çarpan, düşüş noktası ve hash SQL üzerinden tek canlı kaynakta tutulur; herkes aynı uçuşu görür. Tech Coin yalnızca OFF Hub sanal puanıdır." : "Offline/demo engine is disabled: round, multiplier, drop point and hash are kept in one live SQL source, so everyone sees the same flight. Tech Coin is only an OFF Hub virtual score."}
            </p>
          </div>
          <TechWalletPanel wallet={wallet} connected={connected && Boolean(wallet)} />
        </div>

        {connectionNotice ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-100">
            <DatabaseZap className="h-5 w-5" /> {connectionNotice}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            <AlertTriangle className="h-5 w-5" /> {errorMessage}
          </div>
        ) : null}

        <TechCanvas multiplier={visualMultiplier} status={gameState.status} countdown={countdown} crashPoint={gameState.crashPoint} />

        <div className="my-5 grid gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-400 md:grid-cols-3">
          <span className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-cyan-300" /> {tr ? "Tur" : "Round"}: {gameState.roundId}</span>
          <span className="flex items-center gap-2"><Hash className="h-4 w-4 text-emerald-300" /> Hash: {gameState.hash.slice(0, 24)}...</span>
          <span>{tr ? "Durum" : "Status"}: <strong className="text-white">{sqlModeLabel} / {gameState.status}</strong></span>
        </div>

        <VerifyRound gameState={gameState} tr={tr} verifyMessage={verifyMessage} verifyOk={verifyOk} onVerify={(message, ok) => { setVerifyMessage(message); setVerifyOk(ok); }} />

        <RecentMultipliers rounds={recentMultipliers} tr={tr} />

        <div className="mb-5">
          <GameSessionStatsPanel gameName="Tech Aviator" stats={sessionStats} onReset={resetSessionStats} />
        </div>

        <BetControls panels={panels} status={gameState.status} visualMultiplier={visualMultiplier} onPanelChange={updatePanel} onPlaceBet={placeBet} onCashOut={cashOut} />
      </div>
    </main>
  );
}


function VerifyRound({ gameState, tr, verifyMessage, verifyOk, onVerify }: { gameState: GameState; tr: boolean; verifyMessage?: string; verifyOk?: boolean; onVerify: (message: string, ok: boolean) => void }) {
  const canVerify = gameState.status === "STATUS_CRASHED" && Boolean(gameState.serverSeed && gameState.salt && gameState.nonce && gameState.hash);

  const verifyRound = async () => {
    if (!canVerify) {
      onVerify(tr ? "Round bitmeden server seed gizli kalır; doğrulama düşüş sonrası yapılabilir." : "The server seed stays hidden until the round ends; verification is available after the drop.", false);
      return;
    }

    const input = `${gameState.serverSeed}:${gameState.salt}:${gameState.nonce}`;
    const computedHash = await sha256Hex(input);
    const ok = computedHash === gameState.hash;
    onVerify(
      ok
        ? (tr ? "Doğrulandı: Bu düşüş değeri round başlamadan önce kilitlenen hash ile uyumlu." : "Verified: this drop value matches the hash locked before the round started.")
        : (tr ? "Doğrulama başarısız: hash uyuşmuyor." : "Verification failed: hash mismatch."),
      ok,
    );
  };

  return (
    <section className="mb-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-cyan-100"><ShieldCheck className="h-5 w-5 text-emerald-300" /> {tr ? "Adalet / Round Doğrulama" : "Fairness / Verify Round"}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {tr ? "Server seed round bitene kadar gizlidir; başlangıçta yalnızca kilitli SHA-256 hash gösterilir." : "The server seed stays hidden until the round ends; only the locked SHA-256 hash is shown at the start."}
          </p>
        </div>
        <button
          type="button"
          onClick={verifyRound}
          disabled={!canVerify}
          className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {tr ? "Bu roundu doğrula" : "Verify this round"}
        </button>
      </div>

      <div className="grid gap-3 text-xs text-zinc-300 md:grid-cols-2 xl:grid-cols-3">
        <FairValue label={tr ? "Round" : "Round"} value={gameState.roundId} />
        <FairValue label={tr ? "Durum" : "Status"} value={gameState.status} />
        <FairValue label={tr ? "Kilitli hash" : "Locked hash"} value={gameState.hash} mono />
        <FairValue label="Server seed" value={gameState.serverSeed || (tr ? "Round bitince açıklanır" : "Revealed after round ends")} mono muted={!gameState.serverSeed} />
        <FairValue label={tr ? "Salt / client seed" : "Salt / client seed"} value={gameState.salt || (tr ? "Round bitince açıklanır" : "Revealed after round ends")} mono muted={!gameState.salt} />
        <FairValue label="Nonce" value={gameState.nonce ? String(gameState.nonce) : (tr ? "Round bitince açıklanır" : "Revealed after round ends")} mono muted={!gameState.nonce} />
        <FairValue label={tr ? "Düşüş noktası" : "Drop point"} value={gameState.crashPoint ? `${gameState.crashPoint.toFixed(2)}x` : (tr ? "Round bitince açıklanır" : "Revealed after round ends")} muted={!gameState.crashPoint} />
        <FairValue label={tr ? "Hash girdisi" : "Hash input"} value={gameState.hashInput || (tr ? "serverSeed:salt:nonce" : "serverSeed:salt:nonce")} mono muted={!gameState.hashInput} />
      </div>

      {verifyMessage ? (
        <p className={`mt-4 flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold ${verifyOk ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-red-300/30 bg-red-300/10 text-red-100"}`}>
          {verifyOk ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />} {verifyMessage}
        </p>
      ) : null}
    </section>
  );
}

function FairValue({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/35 p-3">
      <div className="mb-1 text-[0.65rem] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className={`${mono ? "font-mono" : "font-semibold"} break-all ${muted ? "text-zinc-500" : "text-zinc-100"}`}>{value}</div>
    </div>
  );
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function RecentMultipliers({ rounds, tr }: { rounds: AviatorRoundResult[]; tr: boolean }) {
  return (
    <section className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-amber-100/80">
        <ListRestart className="h-4 w-4" /> {tr ? "Son 10 SQL round çarpanları" : "Last 10 SQL round multipliers"}
      </div>
      <div className="flex flex-wrap gap-2">
        {rounds.length ? rounds.map((round) => (
          <span key={round.roundId} className={`rounded-full border px-3 py-1.5 font-mono text-sm font-black ${round.crashPoint >= 10 ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" : round.crashPoint >= 2 ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-red-300/25 bg-red-300/10 text-red-200"}`}>
            {round.crashPoint.toFixed(2)}x
          </span>
        )) : <span className="text-sm text-amber-100/55">{tr ? "Henüz SQL'e yazılmış tamamlanan round yok; ilk uçuş bitince liste dolacak." : "No completed rounds have been written to SQL yet; the list will populate after the first flight ends."}</span>}
      </div>
    </section>
  );
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}
