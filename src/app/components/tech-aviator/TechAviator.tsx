import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Hash, ListRestart, ServerCog } from "lucide-react";
import { BetControls } from "./BetControls";
import { TechCanvas } from "./TechCanvas";
import { TechWalletPanel } from "./TechWalletPanel";
import { connectTechAviatorSocket } from "./socketClient";
import type { AviatorRoundResult, BetPanelState, GameState, SocketLike, TechCoinWallet } from "./types";

const BETTING_SECONDS = 8;
const CRASHED_SECONDS = 3;

const initialPanels: BetPanelState[] = [
  { id: "panel-a", amount: 100, autoBet: false, autoCashout: true, autoCashoutMultiplier: 2, isBetAccepted: false, hasCashedOut: false },
  { id: "panel-b", amount: 250, autoBet: false, autoCashout: false, autoCashoutMultiplier: 3, isBetAccepted: false, hasCashedOut: false },
];

const initialGameState: GameState = {
  roundId: "booting",
  status: "STATUS_BETTING",
  salt: "pending",
  hash: "pending",
  currentMultiplier: 1,
  startedAt: Date.now(),
  bettingSeconds: BETTING_SECONDS,
};

interface DemoRound {
  roundId: string;
  crashPoint: number;
  startedAt: number;
}

export function TechAviator() {
  const [wallet, setWallet] = useState<TechCoinWallet>();
  const [recentMultipliers, setRecentMultipliers] = useState<AviatorRoundResult[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [panels, setPanels] = useState<BetPanelState[]>(initialPanels);
  const [countdown, setCountdown] = useState(BETTING_SECONDS);
  const [connected, setConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [connectionNotice, setConnectionNotice] = useState<string>();
  const socketRef = useRef<SocketLike>();
  const autoBetRoundRef = useRef<string>("");
  const demoModeRef = useRef(false);
  const demoRoundRef = useRef<DemoRound>();
  const demoTimersRef = useRef<number[]>([]);

  const user = useMemo(() => ({ userId: "demo-pilot", userName: "Tech Pilot" }), []);

  const clearDemoTimers = useCallback(() => {
    demoTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    demoTimersRef.current = [];
  }, []);

  const updatePanel = useCallback((panelId: string, patch: Partial<BetPanelState>) => {
    setPanels((current) => current.map((panel) => (panel.id === panelId ? { ...panel, ...patch } : panel)));
  }, []);

  const applyLiveState = useCallback((data: any) => {
    if (data?.wallet) setWallet(data.wallet);
    if (Array.isArray(data?.recentMultipliers)) setRecentMultipliers(data.recentMultipliers);
  }, []);

  const loadLiveState = useCallback(async () => {
    const response = await fetch("/api/tech-aviator", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || "Canlı OFF Tech Coin cüzdanı yüklenemedi.");
    applyLiveState(data);
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

  const enterDemoMode = useCallback((notice = "Canlı Tech Aviator sunucusu bulunamadı; bahisler tarayıcı içi demo motorunda çalışıyor.") => {
    if (demoModeRef.current) return;

    demoModeRef.current = true;
    setDemoMode(true);
    setConnected(false);
    setErrorMessage(undefined);
    setConnectionNotice(notice);
    socketRef.current?.disconnect();
    socketRef.current = undefined;
  }, []);

  const startDemoRound = useCallback(() => {
    if (!demoModeRef.current) return;

    clearDemoTimers();
    const round: DemoRound = {
      roundId: `demo_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      crashPoint: createDemoCrashPoint(),
      startedAt: Date.now(),
    };
    demoRoundRef.current = round;
    setCountdown(BETTING_SECONDS);
    setErrorMessage(undefined);
    setGameState(createDemoGameState(round, "STATUS_BETTING", 1));
    setPanels((current) => current.map((panel) => ({ ...panel, isBetAccepted: false, hasCashedOut: false, activeBetAmount: undefined })));

    const countdownTimer = window.setInterval(() => {
      const secondsLeft = Math.max(0, BETTING_SECONDS - Math.floor((Date.now() - round.startedAt) / 1000));
      setCountdown(secondsLeft);
    }, 250);
    demoTimersRef.current.push(countdownTimer);

    const flightTimer = window.setTimeout(() => {
      window.clearInterval(countdownTimer);
      round.startedAt = Date.now();
      setCountdown(0);
      setGameState(createDemoGameState(round, "STATUS_FLYING", 1));

      const tickTimer = window.setInterval(() => {
        const elapsedSeconds = (Date.now() - round.startedAt) / 1000;
        const nextMultiplier = roundMultiplier(Math.exp(0.28 * elapsedSeconds));

        if (nextMultiplier >= round.crashPoint) {
          window.clearInterval(tickTimer);
          setGameState(createDemoGameState(round, "STATUS_CRASHED", round.crashPoint, true));
          void postLiveAction({ action: "record-round", roundId: round.roundId, crashPoint: round.crashPoint, hash: `demo-${round.roundId}` }).catch(() => undefined);
          demoTimersRef.current.push(window.setTimeout(startDemoRound, CRASHED_SECONDS * 1000));
          return;
        }

        setGameState(createDemoGameState(round, "STATUS_FLYING", nextMultiplier));
      }, 50);
      demoTimersRef.current.push(tickTimer);
    }, BETTING_SECONDS * 1000);
    demoTimersRef.current.push(flightTimer);
  }, [clearDemoTimers, postLiveAction]);

  const placeDemoBet = useCallback(async (panel: BetPanelState) => {
    if (gameState.status !== "STATUS_BETTING") {
      setErrorMessage("BETTING_CLOSED");
      return;
    }

    const amount = roundMoney(Number(panel.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Geçerli bir bahis miktarı girin.");
      return;
    }

    if ((wallet?.techCoinBalance ?? 0) < amount) {
      setErrorMessage("Yetersiz Tech Coin bakiyesi.");
      return;
    }

    try {
      await postLiveAction({ action: "place-bet", roundId: gameState.roundId, panelId: panel.id, amount });
      updatePanel(panel.id, {
        isBetAccepted: true,
        hasCashedOut: false,
        activeBetAmount: amount,
      });
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bahis reddedildi.");
    }
  }, [gameState.roundId, gameState.status, postLiveAction, updatePanel, wallet?.techCoinBalance]);

  const cashOutDemoBet = useCallback(async (panel: BetPanelState) => {
    if (gameState.status !== "STATUS_FLYING" || !panel.isBetAccepted || panel.hasCashedOut) {
      setErrorMessage("Nakit çekim şu anda uygun değil.");
      return;
    }

    try {
      await postLiveAction({ action: "cash-out", roundId: gameState.roundId, panelId: panel.id, multiplier: gameState.currentMultiplier });
      updatePanel(panel.id, { hasCashedOut: true });
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nakit çekim reddedildi.");
    }
  }, [gameState.currentMultiplier, gameState.roundId, gameState.status, postLiveAction, updatePanel]);

  const placeBet = useCallback((panel: BetPanelState) => {
    void placeDemoBet(panel);
  }, [placeDemoBet]);

  const cashOut = useCallback((panel: BetPanelState) => {
    void cashOutDemoBet(panel);
  }, [cashOutDemoBet]);

  useEffect(() => {
    let disposed = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!disposed && !socketRef.current?.connected) enterDemoMode();
    }, 3200);

    connectTechAviatorSocket(user.userId, user.userName)
      .then((socket) => {
        if (disposed || demoModeRef.current) {
          socket.disconnect();
          return;
        }

        socketRef.current = socket;

        socket.on("connect", () => {
          window.clearTimeout(fallbackTimer);
          setConnected(true);
          setDemoMode(false);
          demoModeRef.current = false;
          setConnectionNotice(undefined);
          setErrorMessage(undefined);
        });
        socket.on("disconnect", () => setConnected(false));
        socket.on("connect_error", () => enterDemoMode());
        socket.on("wallet-update", () => { void loadLiveState().catch(() => undefined); });
        socket.on("game-state", (nextState: GameState) => {
          setGameState(nextState);
          if (nextState.status === "STATUS_BETTING") {
            const secondsLeft = Math.max(0, nextState.bettingSeconds - Math.floor((Date.now() - nextState.startedAt) / 1000));
            setCountdown(secondsLeft);
          }
        });
        socket.on("round-start", (nextState: GameState) => {
          setGameState(nextState);
          setCountdown(nextState.bettingSeconds);
          setErrorMessage(undefined);
          setPanels((current) => current.map((panel) => ({ ...panel, isBetAccepted: false, hasCashedOut: false, activeBetAmount: undefined })));
        });
        socket.on("betting-countdown", (payload: { secondsLeft: number }) => setCountdown(payload.secondsLeft));
        socket.on("flight-start", (nextState: GameState) => setGameState(nextState));
        socket.on("multiplier-update", (payload: { currentMultiplier: number }) => {
          setGameState((current) => ({ ...current, status: "STATUS_FLYING", currentMultiplier: payload.currentMultiplier }));
        });
        socket.on("round-crashed", (nextState: GameState) => {
          setGameState(nextState);
          void postLiveAction({ action: "record-round", roundId: nextState.roundId, crashPoint: nextState.crashPoint, hash: nextState.hash }).catch(() => undefined);
        });
        socket.on("cash-out-success", (payload: { panelId: string }) => updatePanel(payload.panelId, { hasCashedOut: true }));
        socket.on("game-error", (payload: { code: string }) => {
          setErrorMessage(payload.code === "INSUFFICIENT_TECH_COIN" ? "Yetersiz Tech Coin bakiyesi." : payload.code);
        });
      })
      .catch(() => {
        if (!disposed) enterDemoMode();
      });

    return () => {
      disposed = true;
      window.clearTimeout(fallbackTimer);
      clearDemoTimers();
      setConnected(false);
      socketRef.current?.disconnect();
    };
  }, [clearDemoTimers, enterDemoMode, loadLiveState, postLiveAction, updatePanel, user]);

  useEffect(() => {
    let active = true;
    const refresh = () => loadLiveState().catch((error) => {
      if (active) setErrorMessage(error instanceof Error ? error.message : "Canlı OFF Tech Coin cüzdanı yüklenemedi.");
    });

    refresh();
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("ekatech-techcoin-refresh", refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ekatech-techcoin-refresh", refresh);
    };
  }, [loadLiveState]);

  useEffect(() => {
    if (demoMode) startDemoRound();
  }, [demoMode, startDemoRound]);

  useEffect(() => {
    if (gameState.status !== "STATUS_BETTING" || autoBetRoundRef.current === gameState.roundId) return;

    autoBetRoundRef.current = gameState.roundId;
    panels.filter((panel) => panel.autoBet && !panel.isBetAccepted).forEach((panel) => window.setTimeout(() => placeBet(panel), 250));
  }, [gameState.roundId, gameState.status, panels, placeBet]);

  useEffect(() => {
    if (gameState.status !== "STATUS_FLYING") return;

    panels.forEach((panel) => {
      if (panel.autoCashout && panel.isBetAccepted && !panel.hasCashedOut && gameState.currentMultiplier >= panel.autoCashoutMultiplier) {
        cashOut(panel);
      }
    });
  }, [cashOut, gameState.currentMultiplier, gameState.status, panels]);

  return (
    <main className="min-h-screen bg-black px-4 pb-16 pt-28 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.55em] text-emerald-300">Crash / Tech Aviator</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              Tech Coin <span className="text-emerald-300 drop-shadow-[0_0_18px_rgba(16,185,129,0.8)]">Aviator</span>
            </h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Canlı OFF Hub Tech Coin cüzdanına bağlı bahisler, son 10 round çarpanı ve SHA-256 provably-fair crash noktası ile siberpunk uçuş deneyimi.
            </p>
          </div>
          <TechWalletPanel wallet={wallet} connected={Boolean(wallet)} />
        </div>

        {connectionNotice ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-100">
            <ServerCog className="h-5 w-5" /> {connectionNotice}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            <AlertTriangle className="h-5 w-5" /> {errorMessage}
          </div>
        ) : null}

        <TechCanvas multiplier={gameState.currentMultiplier} status={gameState.status} countdown={countdown} crashPoint={gameState.crashPoint} />

        <div className="my-5 grid gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-400 md:grid-cols-3">
          <span className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-cyan-300" /> Tur: {gameState.roundId}</span>
          <span className="flex items-center gap-2"><Hash className="h-4 w-4 text-emerald-300" /> Hash: {gameState.hash.slice(0, 24)}...</span>
          <span>Status: <strong className="text-white">{demoMode ? "DEMO MOTOR / " : ""}{gameState.status}</strong></span>
        </div>

        <RecentMultipliers rounds={recentMultipliers} />

        <BetControls panels={panels} status={gameState.status} currentMultiplier={gameState.currentMultiplier} onPanelChange={updatePanel} onPlaceBet={placeBet} onCashOut={cashOut} />
      </div>
    </main>
  );
}

function RecentMultipliers({ rounds }: { rounds: AviatorRoundResult[] }) {
  return (
    <section className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-amber-100/80">
        <ListRestart className="h-4 w-4" /> Son 10 round çarpanları
      </div>
      <div className="flex flex-wrap gap-2">
        {rounds.length ? rounds.map((round) => (
          <span key={round.roundId} className={`rounded-full border px-3 py-1.5 font-mono text-sm font-black ${round.crashPoint >= 2 ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-red-300/25 bg-red-300/10 text-red-200"}`}>
            {round.crashPoint.toFixed(2)}x
          </span>
        )) : <span className="text-sm text-amber-100/55">Henüz kayıtlı round yok; ilk crash sonrası liste dolacak.</span>}
      </div>
    </section>
  );
}

function createDemoGameState(round: DemoRound, status: GameState["status"], currentMultiplier: number, revealCrashPoint = false): GameState {
  return {
    roundId: round.roundId,
    status,
    salt: "demo-local-salt",
    hash: `demo-${round.roundId}`,
    crashPoint: revealCrashPoint ? round.crashPoint : undefined,
    currentMultiplier: roundMultiplier(currentMultiplier),
    startedAt: round.startedAt,
    bettingSeconds: BETTING_SECONDS,
  };
}

function createDemoCrashPoint(): number {
  const randomUnit = Math.random();
  const rawMultiplier = 1 + 0.25 / Math.max(1 - randomUnit, 0.05);
  return roundMultiplier(Math.min(8, Math.max(1.05, rawMultiplier)));
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function roundMultiplier(value: number): number {
  return Number(value.toFixed(2));
}
