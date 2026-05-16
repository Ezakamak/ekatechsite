import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Hash, ServerCog } from "lucide-react";
import { BetControls } from "./BetControls";
import { TechCanvas } from "./TechCanvas";
import { TechWalletPanel } from "./TechWalletPanel";
import { connectTechAviatorSocket } from "./socketClient";
import type { BetPanelState, GameState, SocketLike, TechCoinWallet } from "./types";

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
  bettingSeconds: 8,
};

export function TechAviator() {
  const [wallet, setWallet] = useState<TechCoinWallet>();
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [panels, setPanels] = useState<BetPanelState[]>(initialPanels);
  const [countdown, setCountdown] = useState(8);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const socketRef = useRef<SocketLike>();
  const autoBetRoundRef = useRef<string>("");

  const user = useMemo(() => ({ userId: "demo-pilot", userName: "Tech Pilot" }), []);

  const updatePanel = useCallback((panelId: string, patch: Partial<BetPanelState>) => {
    setPanels((current) => current.map((panel) => (panel.id === panelId ? { ...panel, ...patch } : panel)));
  }, []);

  const placeBet = useCallback((panel: BetPanelState) => {
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
      },
    );
  }, [updatePanel]);

  const cashOut = useCallback((panel: BetPanelState) => {
    socketRef.current?.emit("cash-out", { panelId: panel.id }, (response) => {
      if (!response?.ok) {
        setErrorMessage(response?.code || "Nakit çekim reddedildi.");
        return;
      }
      updatePanel(panel.id, { hasCashedOut: true });
    });
  }, [updatePanel]);

  useEffect(() => {
    let disposed = false;

    connectTechAviatorSocket(user.userId, user.userName)
      .then((socket) => {
        if (disposed) {
          socket.disconnect();
          return;
        }

        socketRef.current = socket;
        setConnected(true);

        socket.on("wallet-update", (nextWallet: TechCoinWallet) => setWallet(nextWallet));
        socket.on("game-state", (nextState: GameState) => setGameState(nextState));
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
        if (!disposed) {
          setConnected(false);
          setErrorMessage("Tech Aviator sunucusuna bağlanılamadı. Backend için `npm run dev:tech-aviator-server` çalışmalı.");
        }
      });

    return () => {
      disposed = true;
      setConnected(false);
      socketRef.current?.disconnect();
    };
  }, [updatePanel, user]);

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
          <TechWalletPanel wallet={wallet} connected={connected} />
        </div>

        {errorMessage ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            <AlertTriangle className="h-5 w-5" /> {errorMessage}
          </div>
        ) : null}

        <TechCanvas multiplier={gameState.currentMultiplier} status={gameState.status} countdown={countdown} crashPoint={gameState.crashPoint} />

        <div className="my-5 grid gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-400 md:grid-cols-3">
          <span className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-cyan-300" /> Tur: {gameState.roundId}</span>
          <span className="flex items-center gap-2"><Hash className="h-4 w-4 text-emerald-300" /> Hash: {gameState.hash.slice(0, 24)}...</span>
          <span>Status: <strong className="text-white">{gameState.status}</strong></span>
        </div>

        <BetControls panels={panels} status={gameState.status} currentMultiplier={gameState.currentMultiplier} onPanelChange={updatePanel} onPlaceBet={placeBet} onCashOut={cashOut} />
      </div>
    </main>
  );
}
