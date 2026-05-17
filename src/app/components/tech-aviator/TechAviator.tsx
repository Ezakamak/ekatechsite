import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, DatabaseZap, Hash, ListRestart, ServerCog } from "lucide-react";
import { BetControls } from "./BetControls";
import { TechCanvas } from "./TechCanvas";
import { TechWalletPanel } from "./TechWalletPanel";
import { createToastNoFactionSuccessId, ToastNoFactionSuccess, type ToastNoFactionSuccessPayload } from "../ToastNoFactionSuccess";
import { GameSessionStatsPanel, useGameSessionStats } from "../GameSessionStats";
import { useLanguage } from "../../i18n";
import type { AviatorRoundResult, BetPanelState, GameState, TechCoinWallet } from "./types";

const BETTING_SECONDS = 8;

const initialPanels: BetPanelState[] = [
  { id: "panel-a", amount: 100, autoBet: false, autoCashout: true, autoCashoutMultiplier: 2, isBetAccepted: false, hasCashedOut: false },
  { id: "panel-b", amount: 250, autoBet: false, autoCashout: false, autoCashoutMultiplier: 3, isBetAccepted: false, hasCashedOut: false },
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
  const [panels, setPanels] = useState<BetPanelState[]>(initialPanels);
  const [countdown, setCountdown] = useState(BETTING_SECONDS);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [connectionNotice, setConnectionNotice] = useState<string>(tr ? "SQL canlı motoruna bağlanıyor; tüm pilotlar aynı roundu görecek." : "Connecting to the live SQL engine; every pilot will see the same round.");
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
      if (liveRoundRef.current !== data.gameState.roundId) {
        liveRoundRef.current = data.gameState.roundId;
        resetPanelsForRound();
      }
      setGameState(data.gameState);

      if (data.gameState.status === "STATUS_BETTING") {
        const serverNow = Number(data.gameState.serverNow || Date.now());
        const secondsLeft = Math.max(0, Number(data.gameState.bettingSeconds || BETTING_SECONDS) - Math.floor((serverNow - Number(data.gameState.startedAt || serverNow)) / 1000));
        setCountdown(secondsLeft);
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
    setConnectionNotice(tr ? "SQL canlı motoru aktif: round, hash, crash ve çarpan herkes için tek kaynaktan geliyor." : "Live SQL engine active: round, hash, crash and multiplier come from one shared source for everyone.");
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
      setErrorMessage("Bahis süresi kapandı.");
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

    void postLiveAction({ action: "place-bet", roundId: gameState.roundId, panelId: panel.id, amount })
      .then(() => {
        updatePanel(panel.id, { isBetAccepted: true, hasCashedOut: false, activeBetAmount: amount });
        recordSessionBet(amount);
        setErrorMessage(undefined);
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Bahis reddedildi."));
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
    const betLabel = `BAHİS ${panelIndex >= 0 ? panelIndex + 1 : panel.id} - TEBRİKLER!`;

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
      setErrorMessage("Nakit çekim şu anda uygun değil.");
      return;
    }

    const lockKey = `${gameState.roundId}:${panel.id}`;
    if (cashoutLockRef.current.has(lockKey)) return;
    cashoutLockRef.current.add(lockKey);

    void postLiveAction({ action: "cash-out", roundId: gameState.roundId, panelId: panel.id })
      .then((data) => {
        updatePanel(panel.id, { hasCashedOut: true });
        const payout = Number(data.payout || (panel.activeBetAmount ?? panel.amount) * gameState.currentMultiplier);
        showCashoutSuccessToast(panel, payout, Number(data.multiplier || gameState.currentMultiplier || 1));
        recordSessionResult(roundMoney(payout - (panel.activeBetAmount ?? panel.amount)));
        setErrorMessage(undefined);
      })
      .catch((error) => {
        cashoutLockRef.current.delete(lockKey);
        setErrorMessage(error instanceof Error ? error.message : "Nakit çekim reddedildi.");
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
      recordSessionResult(-Number(panel.activeBetAmount ?? panel.amount));
    });
  }, [gameState.roundId, gameState.status, panels, recordSessionResult]);

  useEffect(() => {
    if (gameState.status !== "STATUS_FLYING") return;

    panels.forEach((panel) => {
      if (panel.autoCashout && panel.isBetAccepted && !panel.hasCashedOut && gameState.currentMultiplier >= panel.autoCashoutMultiplier) {
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
            <p className="mb-2 text-sm uppercase tracking-[0.55em] text-emerald-300">Crash / Tech Aviator</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              Tech Coin <span className="text-emerald-300 drop-shadow-[0_0_18px_rgba(16,185,129,0.8)]">Aviator</span>
            </h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              {tr ? "Offline/demo motor kapalı: round, çarpan, crash noktası ve hash SQL üzerinden tek canlı kaynakta tutulur; herkes aynı uçuşu görür." : "Offline/demo engine is disabled: round, multiplier, crash point and hash are kept in one live SQL source, so everyone sees the same flight."}
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

        <TechCanvas multiplier={gameState.currentMultiplier} status={gameState.status} countdown={countdown} crashPoint={gameState.crashPoint} />

        <div className="my-5 grid gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-400 md:grid-cols-3">
          <span className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-cyan-300" /> {tr ? "Tur" : "Round"}: {gameState.roundId}</span>
          <span className="flex items-center gap-2"><Hash className="h-4 w-4 text-emerald-300" /> Hash: {gameState.hash.slice(0, 24)}...</span>
          <span>{tr ? "Durum" : "Status"}: <strong className="text-white">{sqlModeLabel} / {gameState.status}</strong></span>
        </div>

        <RecentMultipliers rounds={recentMultipliers} tr={tr} />

        <div className="mb-5">
          <GameSessionStatsPanel gameName="Tech Aviator" stats={sessionStats} onReset={resetSessionStats} />
        </div>

        <BetControls panels={panels} status={gameState.status} currentMultiplier={gameState.currentMultiplier} onPanelChange={updatePanel} onPlaceBet={placeBet} onCashOut={cashOut} />
      </div>
    </main>
  );
}

function RecentMultipliers({ rounds, tr }: { rounds: AviatorRoundResult[]; tr: boolean }) {
  return (
    <section className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-amber-100/80">
        <ListRestart className="h-4 w-4" /> {tr ? "Son 10 SQL round çarpanları" : "Last 10 SQL round multipliers"}
      </div>
      <div className="flex flex-wrap gap-2">
        {rounds.length ? rounds.map((round) => (
          <span key={round.roundId} className={`rounded-full border px-3 py-1.5 font-mono text-sm font-black ${round.crashPoint >= 2 ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-red-300/25 bg-red-300/10 text-red-200"}`}>
            {round.crashPoint.toFixed(2)}x
          </span>
        )) : <span className="text-sm text-amber-100/55">{tr ? "Henüz SQL'e yazılmış tamamlanan round yok; ilk crash sonrası liste dolacak." : "No completed rounds have been written to SQL yet; the list will populate after the first crash."}</span>}
      </div>
    </section>
  );
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}
