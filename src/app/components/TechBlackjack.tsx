import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Club, History, Layers, ShieldCheck } from "lucide-react";
import { playOffSound } from "./OffSoundEngine";
import { useLanguage } from "../i18n";

type Suit = "C" | "D" | "H" | "S";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Card = { suit: Suit; rank: Rank; code: string; id: string };
type HandStatus = "playing" | "stood" | "bust" | "blackjack" | "win" | "loss" | "push";
type PlayerHand = { id: string; cards: Card[]; status: HandStatus; natural?: boolean; doubled?: boolean };
type AvailableActions = { hit: boolean; stand: boolean; double: boolean; split: boolean; newRound: boolean };
type RoundResult = {
  label: "Player wins" | "Dealer wins" | "Push" | "Bust" | "Blackjack";
  hands: Array<{ status: HandStatus; playerScore: number; dealerScore: number; outcome: "win" | "loss" | "push" | "blackjack" }>;
};
type BlackjackRound = {
  roundId: string;
  status: "playing" | "settled";
  deckHash: string;
  salt: string;
  nonce: number;
  serverSeed?: string;
  dealerCardsVisible: Card[];
  dealerCardsFull?: Card[];
  playerHands: PlayerHand[];
  activeHandIndex: number;
  availableActions: AvailableActions;
  result?: RoundResult | null;
  verification?: { deckHash: string; salt: string; nonce: number; serverSeedRevealed: boolean };
};
type ResultHistory = { id: string; resultType: string; playerScore: number; dealerScore: number; deckHashShort: string; createdAt?: string };
type VerifyState = { status: "idle" | "hidden" | "verified" | "failed" | "error"; message: string; recalculatedHash?: string };

const SUITS: Suit[] = ["C", "D", "H", "S"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const EKA_LOGO_SRC = "/og-image.svg";
const DEBUG_BLACKJACK = Boolean(import.meta.env?.DEV);

export function TechBlackjack() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const mountedRef = useRef(true);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [history, setHistory] = useState<ResultHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(tr ? "Backend kontrollü pratik round'u başlat." : "Start a backend-controlled practice round.");
  const [verifyState, setVerifyState] = useState<VerifyState>({ status: "idle", message: "" });

  const dealerCards = useMemo(() => safeCards(round?.status === "settled" ? round?.dealerCardsFull || round?.dealerCardsVisible : round?.dealerCardsVisible), [round]);
  const playerHands = useMemo(() => sanitizeHands(round?.playerHands), [round]);
  const activeHandIndex = Math.min(Math.max(0, round?.activeHandIndex || 0), Math.max(0, playerHands.length - 1));
  const dealerHidden = Boolean(round && round.status !== "settled" && dealerCards.length === 1);
  const dealerScore = dealerHidden ? handValue(dealerCards).total : handValue(dealerCards).total;
  const actions = round?.availableActions || { hit: false, stand: false, double: false, split: false, newRound: true };

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tech-blackjack", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Tech Blackjack Practice unavailable.");
      if (!mountedRef.current) return;
      applyServerState(data, tr);
    } catch (error) {
      debugBlackjack("load error", { message: readableError(error) });
      if (mountedRef.current) setMessage(readableError(error));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [tr]);

  function applyServerState(data: any, isTurkish: boolean) {
    const nextRound = sanitizeRound(data?.round);
    setRound(nextRound);
    setHistory(sanitizeServerHistory(data?.recent));
    setVerifyState({ status: "idle", message: "" });
    if (nextRound?.status === "settled" && nextRound.result) setMessage(resultMessage(nextRound.result, isTurkish));
    else if (nextRound?.status === "playing") setMessage(isTurkish ? "Aksiyonlar backend'e gönderilir; kartlar server state'inden gelir." : "Actions are sent to the backend; cards come from server state.");
    else setMessage(isTurkish ? "Yeni Round ile hash kilitli bir deste oluştur." : "Create a hash-locked deck with New Round.");
  }

  useEffect(() => {
    mountedRef.current = true;
    loadState();
    return () => {
      mountedRef.current = false;
    };
  }, [loadState]);

  async function postAction(action: "start-round" | "hit" | "stand" | "double" | "split") {
    setActionLoading(true);
    try {
      const response = await fetch("/api/tech-blackjack", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || (tr ? "Aksiyon başarısız oldu." : "Action failed."));
      if (!mountedRef.current) return;
      applyServerState(data, tr);
      playOffSound(action === "start-round" ? "bet" : data?.round?.status === "settled" ? "success" : "card");
    } catch (error) {
      debugBlackjack("action error", { action, message: readableError(error) });
      if (mountedRef.current) setMessage(readableError(error));
      playOffSound("error");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }

  async function verifyRound() {
    if (!round) return;
    if (round.status !== "settled" || !round.serverSeed) {
      setVerifyState({ status: "hidden", message: tr ? "Server seed round bitince açıklanır." : "Server seed will be revealed after the round." });
      return;
    }
    setActionLoading(true);
    try {
      const [clientHash, response] = await Promise.all([
        sha256HexClient(`${round.serverSeed}:${round.salt}:${round.nonce}`),
        fetch("/api/tech-blackjack", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify-round", roundId: round.roundId }),
        }),
      ]);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Verification failed.");
      const backendVerified = data?.verification?.verified === true;
      const matches = clientHash === round.deckHash && backendVerified;
      setVerifyState({
        status: matches ? "verified" : "failed",
        message: matches ? "Verified: this deck was locked before the round." : "Verification failed: hash mismatch.",
        recalculatedHash: clientHash,
      });
      playOffSound(matches ? "success" : "error");
    } catch (error) {
      setVerifyState({ status: "error", message: readableError(error) });
      playOffSound("error");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-24 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-72 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(4,12,20,0.98),rgba(3,34,28,0.82))] p-5 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100"><Club className="h-4 w-4" /> OFF Card Lab</div>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Tech Blackjack Practice</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
                {tr
                  ? "Backend kontrollü blackjack pratik masası. Tech Coin harcanmaz veya kazanılmaz. Her deste round başlamadan SHA-256 hash ile kilitlenir."
                  : "Backend-controlled blackjack practice table. No Tech Coin is spent or earned. Each deck is locked with SHA-256 before the round starts."}
              </p>
            </div>
            <div className="rounded-3xl border border-cyan-300/25 bg-black/35 p-4 text-right shadow-xl shadow-cyan-500/10">
              <p className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/55"><ShieldCheck className="h-4 w-4" /> {tr ? "Pratik Modu" : "Practice Mode"}</p>
              <p className="mt-2 text-xl font-black text-white">No Tech Coin</p>
              <p className="mt-1 text-xs text-white/40">Dealer stands on soft 17.</p>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(4,16,18,0.96),rgba(2,8,12,0.98))] p-4 shadow-2xl shadow-black/40 sm:p-6">
            <div className="absolute right-5 top-5 grid place-items-center rounded-2xl border border-white/10 bg-black/45 p-3 text-cyan-100 shadow-xl"><Layers className="h-8 w-8" /><span className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">SHA-256</span></div>
            <div className="rounded-[2rem] border border-emerald-200/10 bg-[radial-gradient(circle_at_50%_35%,rgba(20,184,166,0.2),transparent_34%),linear-gradient(145deg,rgba(2,44,34,0.9),rgba(2,8,14,0.92))] p-4 ring-1 ring-white/5 sm:p-7">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div className="space-y-6 text-center">
                  <div>
                    <ScoreBadge label={tr ? "Krupiye" : "Dealer"} score={dealerScore} hidden={dealerHidden} />
                    <CardFan cards={dealerCards} hideSecond={dealerHidden} />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-white/60">{loading ? (tr ? "Yükleniyor..." : "Loading...") : message}</div>
                </div>

                <div className="space-y-4">
                  {playerHands.length ? playerHands.map((hand, index) => (
                    <div key={hand.id || index} className={`rounded-[1.75rem] border p-4 transition ${index === activeHandIndex && round?.status === "playing" ? "border-emerald-300/45 bg-emerald-300/10" : "border-white/10 bg-black/25"}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <ScoreBadge label={`${tr ? "El" : "Hand"} ${index + 1}`} score={handValue(hand.cards).total} status={hand.status} />
                        {hand.doubled ? <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Double</span> : null}
                      </div>
                      <CardFan cards={hand.cards} />
                    </div>
                  )) : (
                    <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-6 text-center text-white/45">{tr ? "Henüz aktif pratik eli yok." : "No active practice hand yet."}</div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <ActionButton disabled={actionLoading || !actions.newRound} onClick={() => postAction("start-round")}>{tr ? "Yeni Round" : "New Round"}</ActionButton>
                <ActionButton disabled={actionLoading || !actions.hit} onClick={() => postAction("hit")}>{tr ? "Kart Çek" : "Hit"}</ActionButton>
                <ActionButton disabled={actionLoading || !actions.stand} onClick={() => postAction("stand")}>{tr ? "Dur" : "Stand"}</ActionButton>
                <ActionButton disabled={actionLoading || !actions.double} onClick={() => postAction("double")}>Double</ActionButton>
                <ActionButton disabled={actionLoading || !actions.split} onClick={() => postAction("split")}>Split</ActionButton>
                <ActionButton disabled={actionLoading || !round} onClick={verifyRound}>{tr ? "Desteyi Doğrula" : "Verify Deck"}</ActionButton>
              </div>
              <p className="mt-3 text-center text-xs text-white/40">{tr ? "Double: bir kart al ve eli kapat." : "Double: take one card and close the hand."}</p>
            </div>
          </div>

          <aside className="space-y-5">
            <InfoPanel round={round} tr={tr} />
            <VerificationPanel round={round} verifyState={verifyState} tr={tr} onVerify={verifyRound} disabled={actionLoading || !round} />
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
              <h2 className="flex items-center gap-2 text-xl font-black"><History className="h-5 w-5 text-emerald-300" /> {tr ? "Pratik Geçmişi" : "Practice History"}</h2>
              <div className="mt-4 space-y-2">
                {history.slice(0, 8).map((item) => <HistoryRow key={item.id} item={item} tr={tr} />)}
                {!history.length ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/40">{tr ? "Henüz tamamlanan round yok." : "No completed rounds yet."}</p> : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function InfoPanel({ round, tr }: { round: BlackjackRound | null; tr: boolean }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-xl font-black"><BadgeCheck className="h-5 w-5 text-cyan-300" /> {tr ? "Round Bilgisi" : "Round Info"}</h2>
      <div className="mt-4 space-y-3 text-sm">
        <InfoRow label="Round ID" value={round?.roundId || "—"} />
        <InfoRow label="Deck Hash" value={round?.deckHash || "—"} mono />
        <InfoRow label={tr ? "Krupiye Kuralı" : "Dealer Rule"} value="Stands on soft 17" />
        <InfoRow label={tr ? "Mod" : "Mode"} value="Practice Mode: No Tech Coin" />
      </div>
    </section>
  );
}

function VerificationPanel({ round, verifyState, tr, onVerify, disabled }: { round: BlackjackRound | null; verifyState: VerifyState; tr: boolean; onVerify: () => void; disabled: boolean }) {
  const settled = round?.status === "settled";
  return (
    <section className="rounded-[2rem] border border-cyan-200/15 bg-cyan-300/[0.04] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-xl font-black"><ShieldCheck className="h-5 w-5 text-cyan-300" /> Deck Verification</h2>
      <div className="mt-4 space-y-3 text-sm">
        <InfoRow label="Deck Hash" value={round?.deckHash || "—"} mono />
        <InfoRow label="Server Seed" value={settled ? round?.serverSeed || "—" : "Server seed will be revealed after the round."} mono={settled} />
        <InfoRow label="Salt" value={round?.salt || "—"} mono />
        <InfoRow label="Nonce" value={round ? String(round.nonce) : "—"} mono />
      </div>
      <button type="button" disabled={disabled || !settled} onClick={onVerify} className="mt-4 w-full rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 font-black uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-35">{tr ? "Desteyi Doğrula" : "Verify Deck"}</button>
      {verifyState.message ? <p className={`mt-3 rounded-2xl border p-3 text-sm ${verifyState.status === "verified" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : verifyState.status === "failed" || verifyState.status === "error" ? "border-red-300/30 bg-red-300/10 text-red-100" : "border-white/10 bg-white/[0.04] text-white/60"}`}>{verifyState.message}</p> : null}
      {verifyState.recalculatedHash ? <p className="mt-2 break-all rounded-2xl bg-black/30 p-3 font-mono text-[11px] text-white/45">{verifyState.recalculatedHash}</p> : null}
    </section>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p><p className={`mt-1 break-all text-white/75 ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</p></div>;
}

function ActionButton({ children, disabled, onClick }: { children: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3 font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-35">{children}</button>;
}

function ScoreBadge({ label, score, hidden, status }: { label: string; score: number; hidden?: boolean; status?: HandStatus }) {
  return <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/70"><span>{label}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-emerald-100">{hidden ? "?" : score}</span>{status ? <span className="text-white/35">{status}</span> : null}</div>;
}

function CardFan({ cards, hideSecond = false }: { cards?: Card[]; hideSecond?: boolean }) {
  const safeHand = safeCards(cards);
  return (
    <div className="flex justify-center pl-8 [perspective:900px]">
      {safeHand.map((card, index) => (
        <motion.div
          key={`${card.id || `${card.code}-${index}`}-${hideSecond && index === 1 ? "back" : "face"}`}
          initial={{ opacity: 0, y: -18, rotateY: hideSecond && index === 1 ? 180 : 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 0.46, delay: index * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative h-32 w-[5.8rem] shrink-0 sm:h-40 sm:w-[7.2rem]"
          style={{ marginLeft: index === 0 ? 0 : "-2rem", zIndex: index + 1 }}
        >
          {hideSecond && index === 1 ? (
            <PremiumCardBack />
          ) : (
            <img
              src={cardImage(card)}
              alt={cardAlt(card)}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = cardSvg(card);
              }}
              className="h-full w-full rounded-xl object-cover shadow-2xl shadow-black/45 ring-1 ring-black/25 transition duration-300 hover:-translate-y-1 sm:rounded-2xl"
            />
          )}
        </motion.div>
      ))}
      {hideSecond && safeHand.length === 1 ? (
        <motion.div
          key="hidden-hole-card"
          initial={{ opacity: 0, y: -18, rotateY: 180, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 0.46, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative h-32 w-[5.8rem] shrink-0 sm:h-40 sm:w-[7.2rem]"
          style={{ marginLeft: "-2rem", zIndex: safeHand.length + 1 }}
        >
          <PremiumCardBack />
        </motion.div>
      ) : null}
      {!safeHand.length ? <div className="grid h-32 w-[5.8rem] place-items-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-xs text-white/30 sm:h-40 sm:w-[7.2rem]">Empty</div> : null}
    </div>
  );
}

function PremiumCardBack() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-xl border border-cyan-200/25 bg-[radial-gradient(circle_at_48%_38%,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_58%_58%,rgba(168,85,247,0.2),transparent_38%),linear-gradient(145deg,#020617,#06111f_52%,#020308)] shadow-2xl shadow-cyan-950/35 ring-1 ring-white/10 backdrop-blur-xl sm:rounded-2xl">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-cyan-300/25 blur-2xl" />
      <div className="absolute -right-10 bottom-8 h-28 w-28 rounded-full bg-purple-500/25 blur-2xl" />
      <div className="absolute inset-[7px] rounded-[0.7rem] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:rounded-[0.9rem]" />
      <div className="absolute left-3 top-3 h-5 w-5 border-l border-t border-cyan-200/45" />
      <div className="absolute right-3 top-3 h-5 w-5 border-r border-t border-purple-200/45" />
      <div className="absolute bottom-3 left-3 h-5 w-5 border-b border-l border-purple-200/40" />
      <div className="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-cyan-200/40" />
      <div className="absolute left-4 right-4 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" />
      <div className="absolute inset-0 translate-x-[-55%] bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-0 transition duration-700 group-hover:translate-x-[55%] group-hover:opacity-100" />
      <div className="relative flex h-full flex-col items-center justify-center px-3 text-center">
        <div className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-white/12 bg-black/25 shadow-2xl shadow-cyan-400/20 sm:h-20 sm:w-20">
          <div className="absolute inset-0 rounded-2xl bg-cyan-300/10 blur-md" />
          {logoFailed ? (
            <span className="relative text-2xl font-black tracking-tighter text-cyan-100 sm:text-3xl">EK</span>
          ) : (
            <img src={EKA_LOGO_SRC} alt="EkaTech logo" className="relative h-full w-full object-cover" onError={() => setLogoFailed(true)} />
          )}
        </div>
        <span className="mt-3 text-[9px] font-black uppercase tracking-[0.34em] text-cyan-100/75 sm:text-[10px]">EkaTech</span>
        <span className="mt-1 h-px w-12 bg-gradient-to-r from-transparent via-purple-200/70 to-transparent" />
      </div>
    </div>
  );
}

function HistoryRow({ item, tr }: { item: ResultHistory; tr: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm"><p className="font-black capitalize text-white">{item.resultType}</p><p className="mt-1 text-xs text-white/40">{tr ? "Oyuncu" : "Player"} {item.playerScore} · {tr ? "Krupiye" : "Dealer"} {item.dealerScore} · Hash {item.deckHashShort || "—"}</p></div>;
}

function sanitizeRound(value: any): BlackjackRound | null {
  if (!value || typeof value !== "object") return null;
  const status = value.status === "settled" ? "settled" : "playing";
  return {
    roundId: String(value.roundId || ""),
    status,
    deckHash: String(value.deckHash || ""),
    salt: String(value.salt || ""),
    nonce: Number(value.nonce || 0),
    serverSeed: typeof value.serverSeed === "string" ? value.serverSeed : undefined,
    dealerCardsVisible: safeCards(value.dealerCardsVisible),
    dealerCardsFull: safeCards(value.dealerCardsFull),
    playerHands: sanitizeHands(value.playerHands),
    activeHandIndex: Math.max(0, Math.floor(Number(value.activeHandIndex || 0))),
    availableActions: sanitizeActions(value.availableActions),
    result: sanitizeResult(value.result),
    verification: value.verification,
  };
}

function sanitizeActions(value: any): AvailableActions {
  return { hit: Boolean(value?.hit), stand: Boolean(value?.stand), double: Boolean(value?.double), split: Boolean(value?.split), newRound: Boolean(value?.newRound) };
}

function sanitizeResult(value: any): RoundResult | null {
  if (!value || typeof value !== "object") return null;
  return { label: String(value.label || "Push") as RoundResult["label"], hands: Array.isArray(value.hands) ? value.hands.map((hand: any) => ({ status: isHandStatus(hand?.status) ? hand.status : "push", playerScore: Math.max(0, Math.floor(Number(hand?.playerScore || 0))), dealerScore: Math.max(0, Math.floor(Number(hand?.dealerScore || 0))), outcome: ["win", "loss", "push", "blackjack"].includes(String(hand?.outcome)) ? hand.outcome : "push" })) : [] };
}

function sanitizeServerHistory(value: any): ResultHistory[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item, index) => ({ id: `${item?.created_at || "history"}-${index}`, resultType: String(item?.result_type || "settled"), playerScore: Math.max(0, Math.floor(Number(item?.player_score || 0))), dealerScore: Math.max(0, Math.floor(Number(item?.dealer_score || 0))), deckHashShort: String(item?.deck_hash_short || ""), createdAt: typeof item?.created_at === "string" ? item.created_at : undefined }));
}

function isCard(value: unknown): value is Card {
  const card = value as Partial<Card> | null | undefined;
  return Boolean(card && SUITS.includes(card.suit as Suit) && RANKS.includes(card.rank as Rank) && typeof card.code === "string");
}

function safeCards(cards?: Array<Card | null | undefined> | null): Card[] {
  return Array.isArray(cards) ? cards.filter(isCard) : [];
}

function sanitizeHands(value?: Array<PlayerHand | null | undefined> | null): PlayerHand[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((hand, index) => ({
    id: typeof hand?.id === "string" && hand.id ? hand.id : `hand-${index}`,
    cards: safeCards(hand?.cards),
    status: isHandStatus(hand?.status) ? hand.status : "playing",
    natural: Boolean(hand?.natural),
    doubled: Boolean(hand?.doubled),
  }));
}

function isHandStatus(value: unknown): value is HandStatus {
  return ["playing", "stood", "bust", "blackjack", "win", "loss", "push"].includes(String(value));
}

function cardValue(card?: Card) {
  if (!card) return 0;
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank) || 0;
}

function handValue(cards?: Card[] | null) {
  const safeHand = safeCards(cards);
  let total = safeHand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = safeHand.filter((card) => card.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

async function sha256HexClient(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resultMessage(result: RoundResult, tr: boolean) {
  if (!tr) return result.label;
  if (result.label === "Player wins") return "Oyuncu kazanır";
  if (result.label === "Dealer wins") return "Krupiye kazanır";
  if (result.label === "Bust") return "Bust";
  if (result.label === "Blackjack") return "Blackjack";
  return "Beraberlik";
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Tech Blackjack Practice error.";
}

function debugBlackjack(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_BLACKJACK) return;
  console.debug(`[TechBlackjack] ${message}`, payload || {});
}

function cardImage(card: Card) { return `/cards/${card.code}.png`; }
function cardAlt(card: Card) { return `${card.rank} of ${suitName(card.suit)}`; }
function suitName(suit: Suit) { return suit === "C" ? "Clubs" : suit === "D" ? "Diamonds" : suit === "H" ? "Hearts" : "Spades"; }
function cardSvg(card: Card) { return makeCardSvg(card.rank, ["D", "H"].includes(card.suit) ? "#ef4444" : "#111827", card.suit); }
function makeCardSvg(rank: string, color: string, suit: string) {
  const suitChar = suit === "C" ? "♣" : suit === "D" ? "♦" : suit === "H" ? "♥" : suit === "S" ? "♠" : suit;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 200"><rect width="144" height="200" rx="16" fill="#f8fafc"/><rect x="6" y="6" width="132" height="188" rx="12" fill="none" stroke="#d1d5db" stroke-width="3"/><text x="18" y="36" font-family="Arial" font-size="26" font-weight="900" fill="${color}">${rank}</text><text x="18" y="64" font-family="Arial" font-size="26" fill="${color}">${suitChar}</text><text x="72" y="116" text-anchor="middle" font-family="Arial" font-size="64" fill="${color}">${suitChar}</text><text x="126" y="164" text-anchor="end" font-family="Arial" font-size="26" fill="${color}">${suitChar}</text><text x="126" y="192" text-anchor="end" font-family="Arial" font-size="26" font-weight="900" fill="${color}">${rank}</text></svg>`)}`;
}
