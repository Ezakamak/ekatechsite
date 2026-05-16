import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Hash, ServerCog } from "lucide-react";
import { BetControls } from "./BetControls";
import { TechCanvas } from "./TechCanvas";
import { TechWalletPanel } from "./TechWalletPanel";
import { connectTechAviatorSocket } from "./socketClient";
import type { BetPanelState, GameState, SocketLike, TechCoinWallet } from "./types";

const BETTING_SECONDS = 8;
const CRASHED_SECONDS = 3;
const DEFAULT_DEMO_BALANCE = 14_550.25;

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

  const ensureDemoWallet = useCallback(() => {
    setWallet((current) => current ?? createDemoWallet(user.userId, user.userName));
  }, [user.userId, user.userName]);

  const addDemoTransaction = useCallback((type: "DEDUCT_BET" | "ADD_WINNING", amount: number, description: string, multiplier?: number) => {
    const roundId = demoRoundRef.current?.roundId;

    setWallet((current) => {
      const source = current ?? createDemoWallet(user.userId, user.userName);
      const nextBalance = roundMoney(source.techCoinBalance + amount);

      return {
        ...source,
        techCoinBalance: nextBalance,
        transactionHistory: [
          {
            id: `demo_txn_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            type,
            amount: roundMoney(amount),
            balanceAfter: nextBalance,
            description,
            roundId,
            multiplier,
            createdAt: new Date().toISOString(),
          },
          ...source.transactionHistory,
        ].slice(0, 100),
      };
    });
  }, [user.userId, user.userName]);

  const enterDemoMode = useCallback((notice = "Canlı Tech Aviator sunucusu bulunamadı; bahisler tarayıcı içi demo motorunda çalışıyor.") => {
    if (demoModeRef.current) return;

    demoModeRef.current = true;
    setDemoMode(true);
    setConnected(false);
    setErrorMessage(undefined);
    setConnectionNotice(notice);
    socketRef.current?.disconnect();
    socketRef.current = undefined;
    ensureDemoWallet();
  }, [ensureDemoWallet]);

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
          demoTimersRef.current.push(window.setTimeout(startDemoRound, CRASHED_SECONDS * 1000));
          return;
        }

        setGameState(createDemoGameState(round, "STATUS_FLYING", nextMultiplier));
      }, 50);
      demoTimersRef.current.push(tickTimer);
    }, BETTING_SECONDS * 1000);
    demoTimersRef.current.push(flightTimer);
  }, [clearDemoTimers]);

  const placeDemoBet = useCallback((panel: BetPanelState) => {
    if (gameState.status !== "STATUS_BETTING") {
      setErrorMessage("BETTING_CLOSED");
      return;
    }

    const amount = roundMoney(Number(panel.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Geçerli bir bahis miktarı girin.");
      return;
    }

    if ((wallet?.techCoinBalance ?? DEFAULT_DEMO_BALANCE) < amount) {
      setErrorMessage("Yetersiz Tech Coin bakiyesi.");
      return;
    }

    addDemoTransaction("DEDUCT_BET", -amount, "Tech Aviator Demo Bahis");
    updatePanel(panel.id, {
      isBetAccepted: true,
      hasCashedOut: false,
      activeBetAmount: amount,
    });
    setErrorMessage(undefined);
  }, [addDemoTransaction, gameState.status, updatePanel, wallet?.techCoinBalance]);

  const cashOutDemoBet = useCallback((panel: BetPanelState) => {
    if (gameState.status !== "STATUS_FLYING" || !panel.isBetAccepted || panel.hasCashedOut) {
      setErrorMessage("Nakit çekim şu anda uygun değil.");
      return;
    }

    const payout = roundMoney((panel.activeBetAmount ?? panel.amount) * gameState.currentMultiplier);
    addDemoTransaction("ADD_WINNING", payout, `Tech Aviator Demo Nakit Çekim @ ${gameState.currentMultiplier.toFixed(2)}x`, gameState.currentMultiplier);
    updatePanel(panel.id, { hasCashedOut: true });
    setErrorMessage(undefined);
  }, [addDemoTransaction, gameState.currentMultiplier, gameState.status, updatePanel]);

  const placeBet = useCallback((panel: BetPanelState) => {
    if (demoModeRef.current) {
      placeDemoBet(panel);
      return;
    }

    socketRef.current?.emit(
      "place-bet",
      {
        panelId: panel.id,
        amount: panel.amount,
        autoCashoutMultiplier: panel.autoCashout ? panel.autoCashoutMultiplier : undefined,
      },
      (response) => {
        if (!response?.ok) {
          setErrorMessage(response?.code === "INSUFFICIENT_TECH_COIN" ? "Yetersiz Tech Coin bakiyesi." : response?.code || "Bahis reddedildi.");
          return;
        }
        updatePanel(panel.id, {
          isBetAccepted: true,
          hasCashedOut: false,
          activeBetAmount: panel.amount,
        });
        setErrorMessage(undefined);
      },
    );
  }, [placeDemoBet, updatePanel]);

  const cashOut = useCallback((panel: BetPanelState) => {
    if (demoModeRef.current) {
      cashOutDemoBet(panel);
      return;
    }

    socketRef.current?.emit("cash-out", { panelId: panel.id }, (response) => {
      if (!response?.ok) {
        setErrorMessage(response?.code || "Nakit çekim reddedildi.");
        return;
      }
      updatePanel(panel.id, { hasCashedOut: true });
      setErrorMessage(undefined);
    });
  }, [cashOutDemoBet, updatePanel]);

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
        socket.on("wallet-update", (nextWallet: TechCoinWallet) => setWallet(nextWallet));
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
        socket.on("round-crashed", (nextState: GameState) => setGameState(nextState));
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
  }, [clearDemoTimers, enterDemoMode, updatePanel, user]);

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
              Gerçek zamanlı WebSocket oyun döngüsü, dosya tabanlı Tech Coin cüzdanı ve SHA-256 provably-fair crash noktası ile siberpunk uçuş deneyimi.
            </p>
          </div>
          <TechWalletPanel wallet={wallet} connected={connected || demoMode} />
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
          <span>Status: <strong className="text-white">{demoMode ? "DEMO / " : ""}{gameState.status}</strong></span>
        </div>

        <BetControls panels={panels} status={gameState.status} currentMultiplier={gameState.currentMultiplier} onPanelChange={updatePanel} onPlaceBet={placeBet} onCashOut={cashOut} />
      </div>
    </main>
  );
}

function createDemoWallet(userId: string, userName: string): TechCoinWallet {
  return {
    userId,
    userName,
    techCoinBalance: DEFAULT_DEMO_BALANCE,
    transactionHistory: [
      {
        id: `demo_wallet_${Date.now()}`,
        type: "WALLET_CREATED",
        amount: DEFAULT_DEMO_BALANCE,
        balanceAfter: DEFAULT_DEMO_BALANCE,
        description: "Tech Aviator demo cüzdanı oluşturuldu",
        createdAt: new Date().toISOString(),
      },
    ],
  };
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
