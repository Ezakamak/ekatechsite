import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { BadgeDollarSign, Club, Layers, Wallet } from "lucide-react";
import { GameSessionStatsPanel, useGameSessionStats } from "./GameSessionStats";
import { createToastNoFactionSuccessId, ToastNoFactionSuccess, type ToastNoFactionSuccessPayload } from "./ToastNoFactionSuccess";
import { playOffSound } from "./OffSoundEngine";

type Suit = "C" | "D" | "H" | "S";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Card = { suit: Suit; rank: Rank; code: string; id: string };
type HandStatus = "playing" | "stood" | "bust" | "blackjack" | "win" | "loss" | "push";
type PlayerHand = { id: string; cards: Card[]; bet: number; status: HandStatus; natural?: boolean; doubled?: boolean; resultNet?: number };
type Phase = "betting" | "playing" | "dealer" | "settled";
type WalletState = { balance: number; currency: string; symbol: string; lifetime_earned?: number };
type ResultHistory = { id: string; resultType: string; playerScore: number; dealerScore: number; betAmount: number; netAmount: number };
type BlackjackToast = ToastNoFactionSuccessPayload & { displayAmount?: string; variant?: "success" | "danger" | "neutral" };

const SUITS: Suit[] = ["C", "D", "H", "S"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const STORAGE_KEY = "ekatech:tech-blackjack:v1";
const DEFAULT_BET = 25;
const EKA_LOGO_SRC = "/og-image.svg";
const DEBUG_BLACKJACK = Boolean(import.meta.env?.DEV);

export function TechBlackjack() {
  const mountedRef = useRef(true);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  const [deck, setDeck] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [hideDealerHole, setHideDealerHole] = useState(true);
  const [hands, setHands] = useState<PlayerHand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("betting");
  const [message, setMessage] = useState("Place a Tech Coin bet to start.");
  const [history, setHistory] = useState<ResultHistory[]>([]);
  const [toasts, setToasts] = useState<BlackjackToast[]>([]);
  const { stats: sessionStats, recordBet: recordSessionBet, recordResult: recordSessionResult, resetStats: resetSessionStats } = useGameSessionStats("tech-blackjack");

  const balance = Math.max(0, Math.floor(Number(wallet?.balance || 0)));
  const safeBet = useMemo(() => sanitizeBet(betAmount ?? DEFAULT_BET, Math.max(1, balance || 1)), [betAmount, balance]);
  const safeDeck = useMemo(() => safeCards(deck), [deck]);
  const dealerHand = useMemo(() => safeCards(dealerCards), [dealerCards]);
  const playerHands = useMemo(() => sanitizeHands(hands), [hands]);
  const activeHandIndexSafe = Math.min(Math.max(0, activeHandIndex || 0), Math.max(0, playerHands.length - 1));
  const activeHand = playerHands[activeHandIndexSafe];
  const dealerVisibleCards = hideDealerHole && dealerHand.length > 1 ? dealerHand.slice(0, 1) : dealerHand;
  const dealerScore = handValue(dealerVisibleCards).total;
  const dealerActualScore = handValue(dealerHand).total;
  const canPlay = phase === "playing" && Boolean(activeHand) && activeHand.status === "playing" && !actionLoading;
  const isFirstDecision = canPlay && safeCards(activeHand?.cards).length === 2 && !activeHand?.doubled;
  const canDouble = isFirstDecision && balance >= safeAmount(activeHand?.bet, DEFAULT_BET);
  const canSplit = isFirstDecision && cardValue(activeHand?.cards?.[0]) === cardValue(activeHand?.cards?.[1]) && balance >= safeAmount(activeHand?.bet, DEFAULT_BET) && playerHands.length < 2;
  const dealerShowsAce = phase === "playing" && dealerHand[0]?.rank === "A";

  const loadState = useCallback(async () => {
    setWalletLoading(true);
    try {
      const response = await fetch("/api/tech-blackjack", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Wallet unavailable");
      if (!mountedRef.current) return;
      setWallet(sanitizeWallet(data.wallet));
      if (Array.isArray(data.recent)) setHistory(sanitizeServerHistory(data.recent));
    } catch (error) {
      debugBlackjack("caught error", { message: error instanceof Error ? error.message : String(error) });
      if (mountedRef.current) setMessage(error instanceof Error ? error.message : "Tech Blackjack wallet unavailable.");
    } finally {
      if (mountedRef.current) setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as { betAmount?: number };
        setBetAmount(sanitizeBet(parsed.betAmount, 1_000_000));
      }
    } catch {
      setBetAmount(DEFAULT_BET);
    }
    loadState();
    window.addEventListener("ekatech-techcoin-refresh", loadState);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("ekatech-techcoin-refresh", loadState);
    };
  }, [loadState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ betAmount: safeBet || DEFAULT_BET }));
    } catch {
      debugBlackjack("local storage unavailable", { key: STORAGE_KEY });
    }
  }, [safeBet]);

  async function runWalletAction(payload: Record<string, unknown>) {
    setActionLoading(true);
    try {
      const response = await fetch("/api/tech-blackjack", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Tech Blackjack action failed.");
      if (mountedRef.current && data.wallet) setWallet(sanitizeWallet(data.wallet));
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      return data;
    } catch (error) {
      debugBlackjack("caught error", { message: error instanceof Error ? error.message : String(error) });
      if (mountedRef.current) setMessage(error instanceof Error ? error.message : "Tech Blackjack action failed.");
      playOffSound("error");
      return null;
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }

  async function startRound() {
    const amount = sanitizeBet(betAmount ?? DEFAULT_BET, balance);
    debugBlackjack("round start", { amount, balance, phase, deckLength: safeDeck.length, playerHandLength: activeHand?.cards?.length || 0, dealerHandLength: dealerHand.length });
    if (phase !== "betting" && phase !== "settled") return;
    if (amount < 1 || amount > balance) {
      setMessage("Enter a valid Tech Coin bet within your wallet balance.");
      playOffSound("error");
      return;
    }

    const debited = await runWalletAction({ action: "debit", amount, reason: "Tech Blackjack bet" });
    if (!debited) return;

    const nextDeck = shuffleDeck(createDeck());
    const deal = drawCards(nextDeck, 4);
    const playerCards = safeCards([deal.cards[0], deal.cards[2]]);
    const nextDealerCards = safeCards([deal.cards[1], deal.cards[3]]);
    const openingStatus = isBlackjack(playerCards) ? "blackjack" : "playing";

    setDeck(deal.deck);
    setDealerCards(nextDealerCards);
    setHideDealerHole(true);
    setHands([{ id: uniqueId("hand"), cards: playerCards, bet: amount, status: openingStatus, natural: openingStatus === "blackjack" }]);
    setActiveHandIndex(0);
    setPhase(openingStatus === "blackjack" ? "dealer" : "playing");
    setMessage(openingStatus === "blackjack" ? "Blackjack! Dealer reveals." : "Choose Hit, Stand, Double or Split.");
    recordSessionBet(amount);
    playOffSound("bet");

    if (openingStatus === "blackjack") {
      window.setTimeout(() => {
        if (mountedRef.current) settleDealer([{ id: uniqueId("hand"), cards: playerCards, bet: amount, status: openingStatus, natural: openingStatus === "blackjack" }], deal.deck, nextDealerCards);
      }, 450);
    }
  }

  function hit() {
    if (!canPlay) return;
    debugBlackjack("current action", { action: "hit", activeHandIndex: activeHandIndexSafe, deckLength: safeDeck.length });
    const drawn = drawCards(safeDeck, 1);
    const card = drawn.cards[0];
    if (!card) return;
    const nextHands = playerHands.map((hand, index) => {
      if (index !== activeHandIndexSafe) return hand;
      const cards = [...safeCards(hand.cards), card];
      return { ...hand, cards, status: handValue(cards).total > 21 ? "bust" : hand.status };
    });
    setDeck(drawn.deck);
    setHands(nextHands);
    playOffSound("card");
    const nextHand = nextHands[activeHandIndexSafe];
    if (nextHand?.status === "bust") advanceOrSettle(nextHands, drawn.deck, dealerHand, `Bust -${formatTc(nextHand.bet)} TC`);
  }

  function stand() {
    if (!canPlay) return;
    debugBlackjack("current action", { action: "stand", activeHandIndex: activeHandIndexSafe });
    const nextHands = playerHands.map((hand, index) => (index === activeHandIndexSafe ? { ...hand, cards: safeCards(hand.cards), status: "stood" as HandStatus } : hand));
    playOffSound("click");
    advanceOrSettle(nextHands, safeDeck, dealerHand, "Standing.");
  }

  async function doubleDown() {
    if (!canDouble || !activeHand) return;
    const activeBet = safeAmount(activeHand.bet, DEFAULT_BET);
    debugBlackjack("current action", { action: "double", activeHandIndex: activeHandIndexSafe, activeBet });
    const debited = await runWalletAction({ action: "debit", amount: activeBet, reason: "Tech Blackjack double" });
    if (!debited) return;
    recordSessionBet(activeBet);
    const drawn = drawCards(safeDeck, 1);
    const card = drawn.cards[0];
    if (!card) return;
    const nextHands = playerHands.map((hand, index) => {
      if (index !== activeHandIndexSafe) return hand;
      const cards = [...safeCards(hand.cards), card];
      const nextBet = safeAmount(hand.bet, activeBet) * 2;
      return { ...hand, cards, bet: nextBet, doubled: true, status: handValue(cards).total > 21 ? "bust" : "stood" };
    });
    setDeck(drawn.deck);
    setHands(nextHands);
    playOffSound("bet");
    advanceOrSettle(nextHands, drawn.deck, dealerHand, "Double locked. One card dealt.");
  }

  async function split() {
    if (!canSplit || !activeHand) return;
    const activeBet = safeAmount(activeHand.bet, DEFAULT_BET);
    debugBlackjack("current action", { action: "split", activeHandIndex: activeHandIndexSafe, activeBet });
    const debited = await runWalletAction({ action: "debit", amount: activeBet, reason: "Tech Blackjack split" });
    if (!debited) return;
    recordSessionBet(activeBet);
    const drawn = drawCards(safeDeck, 2);
    if (drawn.cards.length < 2) return;
    const [first, second] = safeCards(activeHand.cards);
    if (!first || !second) return;
    const nextHands: PlayerHand[] = [
      { id: uniqueId("split-a"), cards: safeCards([first, drawn.cards[0]]), bet: activeBet, status: "playing" },
      { id: uniqueId("split-b"), cards: safeCards([second, drawn.cards[1]]), bet: activeBet, status: "playing" },
    ];
    setDeck(drawn.deck);
    setHands(nextHands);
    setActiveHandIndex(0);
    setMessage("Split active. Play hand 1 first.");
    playOffSound("card");
  }

  function advanceOrSettle(nextHands: PlayerHand[], nextDeck: Card[], nextDealerCards: Card[], nextMessage: string) {
    const safeNextHands = sanitizeHands(nextHands);
    debugBlackjack("current action", { action: "advance-or-settle", activeHandIndex: activeHandIndexSafe, handLengths: safeNextHands.map((hand) => hand.cards.length) });
    setHands(safeNextHands);
    const nextIndex = safeNextHands.findIndex((hand, index) => index > activeHandIndexSafe && hand.status === "playing");
    if (nextIndex >= 0) {
      setActiveHandIndex(nextIndex);
      setMessage("Next split hand is active.");
      return;
    }
    const anyLiveHand = safeNextHands.some((hand) => hand.status !== "bust");
    setMessage(anyLiveHand ? nextMessage : "All hands busted.");
    settleDealer(safeNextHands, nextDeck, nextDealerCards);
  }

  async function settleDealer(roundHands: PlayerHand[], currentDeck: Card[], currentDealerCards: Card[]) {
    setPhase("dealer");
    setHideDealerHole(false);
    const safeRoundHands = sanitizeHands(roundHands);
    debugBlackjack("round end", { status: "dealer-settle-start", playerHandLength: safeRoundHands.map((hand) => hand.cards.length), dealerHandLength: safeCards(currentDealerCards).length, deckLength: safeCards(currentDeck).length });
    let finalDeck = safeCards(currentDeck);
    let finalDealerCards = safeCards(currentDealerCards);
    const needsDealerDraw = safeRoundHands.some((hand) => hand.status !== "bust");
    if (needsDealerDraw) {
      while (handValue(finalDealerCards).total < 17) {
        const drawn = drawCards(finalDeck, 1);
        const card = drawn.cards[0];
        if (!card) break;
        finalDeck = drawn.deck;
        finalDealerCards = [...finalDealerCards, card];
      }
    }

    const dealerTotal = handValue(finalDealerCards).total;
    const dealerBj = isBlackjack(finalDealerCards);
    const settled = safeRoundHands.map((hand) => settleHand(hand, dealerTotal, dealerBj));
    const totalCredit = settled.reduce((sum, hand) => sum + payoutForHand(hand), 0);
    const totalNet = settled.reduce((sum, hand) => sum + Math.round(hand.resultNet || 0), 0);
    const primary = settled[0] || safeRoundHands[0];
    const resultLabel = toastLabel(settled, totalNet);

    setDeck(finalDeck);
    setDealerCards(finalDealerCards);
    setHands(settled);
    setPhase("settled");
    setActiveHandIndex(0);
    setMessage(resultLabel);
    settled.forEach((hand) => recordSessionResult(Math.round(hand.resultNet || 0)));
    pushToast(resultLabel, totalNet);
    setHistory((current) => [
      ...settled.map((hand) => ({ id: uniqueId("result"), resultType: hand.status, playerScore: handValue(hand.cards).total, dealerScore: dealerTotal, betAmount: hand.bet, netAmount: Math.round(hand.resultNet || 0) })),
      ...current,
    ].slice(0, 20));

    await runWalletAction({
      action: "settle",
      creditAmount: totalCredit,
      resultType: primary?.status || "settled",
      playerScore: handValue(primary?.cards || []).total,
      dealerScore: dealerTotal,
      betAmount: settled.reduce((sum, hand) => sum + hand.bet, 0),
      netAmount: totalNet,
      payoutAmount: totalCredit,
    });
    debugBlackjack("round end", { status: "settled", totalNet, totalCredit, playerHandLength: settled.map((hand) => hand.cards.length), dealerHandLength: finalDealerCards.length, deckLength: finalDeck.length });
    playOffSound(totalNet >= 0 ? "success" : "error");
  }

  function adjustBet(multiplier: number) {
    setBetAmount((current) => sanitizeBet(Math.floor(sanitizeBet(current, Math.max(balance, 1)) * multiplier), Math.max(balance, 1)));
  }

  const removeToast = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  function pushToast(label: string, net: number) {
    setToasts([{ id: createToastNoFactionSuccessId("toast-tech-blackjack"), amount: Math.abs(Math.round(net)), multiplier: 1, currency: "TC", title: label, displayAmount: net === 0 ? "Bet Returned" : `${net > 0 ? "+" : "-"}${formatTc(Math.abs(net))} TC`, variant: net > 0 ? "success" : net < 0 ? "danger" : "neutral" }]);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="toast-nofaction-success-stack" aria-live="polite">
        {toasts.map((toast) => <ToastNoFactionSuccess key={toast.id} {...toast} locale="en-US" onClose={removeToast} />)}
      </div>
      <div className="absolute left-1/2 top-24 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-72 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(4,12,20,0.98),rgba(3,34,28,0.82))] p-5 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100"><Club className="h-4 w-4" /> OFF Hub Casino</div>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Tech Blackjack</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Standard blackjack with live Tech Coin wagers, 3:2 blackjack payouts, split hands, double down and shared OFF session stats.</p>
            </div>
            <div className="rounded-3xl border border-amber-300/25 bg-black/35 p-4 text-right shadow-xl shadow-amber-500/10">
              <p className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/55"><Wallet className="h-4 w-4" /> Tech Coin Balance</p>
              <p className="mt-2 text-3xl font-black text-white">{walletLoading ? "..." : `${formatTc(balance)} TC`}</p>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(4,16,18,0.96),rgba(2,8,12,0.98))] p-4 shadow-2xl shadow-black/40 sm:p-6">
            <div className="absolute right-5 top-5 grid place-items-center rounded-2xl border border-white/10 bg-black/45 p-3 text-cyan-100 shadow-xl"><Layers className="h-8 w-8" /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Deck {safeDeck.length || 52}</span></div>
            <div className="min-h-[11rem] pt-2">
              <ScoreBadge label="Dealer" score={dealerScore} hidden={hideDealerHole && dealerHand.length > 1} />
              <CardFan cards={dealerHand} hideSecond={hideDealerHole} />
            </div>
            <div className="my-3 flex flex-wrap items-center justify-center gap-3 text-center">
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-amber-100">Blackjack pays 3 to 2</span>
              {dealerShowsAce ? <button type="button" className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Insurance</button> : null}
            </div>
            <div className="min-h-[13rem]">
              {playerHands.map((hand, index) => (
                <div key={hand.id} className={`mb-3 rounded-[1.5rem] border p-3 transition ${index === activeHandIndexSafe && phase === "playing" ? "border-emerald-300/35 bg-emerald-300/[0.06]" : "border-white/10 bg-white/[0.025]"}`}>
                  <ScoreBadge label={playerHands.length > 1 ? `Player hand ${index + 1}` : "Player"} score={handValue(hand.cards).total} status={hand.status} />
                  <CardFan cards={hand.cards} />
                </div>
              ))}
              {!playerHands.length ? <div className="grid min-h-[10rem] place-items-center rounded-[1.5rem] border border-dashed border-white/10 text-sm text-white/35">Cards appear here after betting.</div> : null}
            </div>
            <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">{message}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <ActionButton onClick={hit} disabled={!canPlay}>Hit</ActionButton>
              <ActionButton onClick={stand} disabled={!canPlay}>Stand</ActionButton>
              <ActionButton onClick={split} disabled={!canSplit}>Split</ActionButton>
              <ActionButton onClick={doubleDown} disabled={!canDouble}>Double</ActionButton>
            </div>

            <div className="mt-4 grid gap-3 rounded-[1.6rem] border border-white/10 bg-black/30 p-3 md:grid-cols-[1fr_auto_auto_1.2fr]">
              <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Bet Amount</span><input type="number" min={1} max={Math.max(1, balance)} value={safeBet} disabled={phase === "playing" || phase === "dealer"} onChange={(event) => setBetAmount(sanitizeBet(event.target.value, Math.max(balance, 1)))} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-lg font-black text-white outline-none focus:border-emerald-300/40" /></label>
              <button type="button" disabled={phase === "playing" || phase === "dealer"} onClick={() => adjustBet(0.5)} className="self-end rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 font-black transition hover:bg-white/10 disabled:opacity-45">1/2</button>
              <button type="button" disabled={phase === "playing" || phase === "dealer"} onClick={() => adjustBet(2)} className="self-end rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 font-black transition hover:bg-white/10 disabled:opacity-45">2x</button>
              <button type="button" disabled={walletLoading || actionLoading || safeBet < 1 || safeBet > balance || phase === "playing" || phase === "dealer"} onClick={startRound} className="self-end rounded-2xl bg-gradient-to-r from-emerald-300 to-lime-300 px-6 py-4 text-lg font-black uppercase tracking-[0.18em] text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100">Bet</button>
            </div>
          </div>

          <aside className="space-y-5">
            <GameSessionStatsPanel gameName="Tech Blackjack" stats={sessionStats} onReset={resetSessionStats} />
            <section className="rounded-[1.7rem] border border-white/10 bg-[#07111a]/92 p-4 shadow-2xl shadow-black/35">
              <h2 className="flex items-center gap-2 text-xl font-black"><BadgeDollarSign className="h-5 w-5 text-emerald-300" /> Result History</h2>
              <div className="mt-4 space-y-2">
                {history.slice(0, 8).map((item) => <HistoryRow key={item.id} item={item} />)}
                {!history.length ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/40">No completed hands yet.</p> : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
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
          key={card.id || `${card.code}-${index}`}
          initial={{ opacity: 0, y: -18, rotateY: hideSecond && index === 1 ? 180 : 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 0.36, delay: index * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
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

function HistoryRow({ item }: { item: ResultHistory }) {
  const positive = item.netAmount > 0;
  const neutral = item.netAmount === 0;
  return <div className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm"><div><p className="font-black capitalize text-white">{item.resultType}</p><p className="mt-1 text-xs text-white/40">Player {item.playerScore} · Dealer {item.dealerScore} · Bet {formatTc(item.betAmount)} TC</p></div><p className={`font-black ${positive ? "text-emerald-200" : neutral ? "text-white/60" : "text-red-200"}`}>{neutral ? "±" : positive ? "+" : "-"}{formatTc(Math.abs(item.netAmount))}</p></div>;
}

function isCard(value: unknown): value is Card {
  const card = value as Partial<Card> | null | undefined;
  return Boolean(card && SUITS.includes(card.suit as Suit) && RANKS.includes(card.rank as Rank) && typeof card.code === "string");
}

function safeCards(cards?: Array<Card | null | undefined> | null): Card[] {
  return Array.isArray(cards) ? cards.filter(isCard) : [];
}

function safeAmount(value: unknown, fallback = 0) {
  const amount = Math.floor(Number(value));
  return Number.isFinite(amount) ? Math.max(0, amount) : fallback;
}

function sanitizeHands(value?: Array<PlayerHand | null | undefined> | null): PlayerHand[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((hand, index) => ({
    id: typeof hand?.id === "string" && hand.id ? hand.id : uniqueId(`hand-${index}`),
    cards: safeCards(hand?.cards),
    bet: safeAmount(hand?.bet, DEFAULT_BET) || DEFAULT_BET,
    status: isHandStatus(hand?.status) ? hand.status : "playing",
    natural: Boolean(hand?.natural),
    doubled: Boolean(hand?.doubled),
    resultNet: Number.isFinite(Number(hand?.resultNet)) ? Math.round(Number(hand?.resultNet)) : undefined,
  }));
}

function isHandStatus(value: unknown): value is HandStatus {
  return ["playing", "stood", "bust", "blackjack", "win", "loss", "push"].includes(String(value));
}

function debugBlackjack(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_BLACKJACK) return;
  console.debug(`[TechBlackjack] ${message}`, payload || {});
}

function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank, code: `${rank}${suit}`, id: uniqueId(`${rank}${suit}`) })));
}
function shuffleDeck(cards: Card[]) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}
function drawCards(currentDeck: Card[] | null | undefined, count: number) {
  const requestedCount = Math.max(0, Math.floor(Number(count) || 0));
  const safeCurrentDeck = safeCards(currentDeck);
  const source = safeCurrentDeck.length >= requestedCount ? [...safeCurrentDeck] : shuffleDeck(createDeck());
  return { cards: safeCards(source.slice(0, requestedCount)), deck: safeCards(source.slice(requestedCount)) };
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
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return { total, soft: aces > 0 };
}
function isBlackjack(cards?: Card[] | null) { return safeCards(cards).length === 2 && handValue(cards).total === 21; }
function settleHand(hand: PlayerHand, dealerTotal: number, dealerBj: boolean): PlayerHand {
  const safeHand = sanitizeHands([hand])[0] || { ...hand, cards: [], bet: DEFAULT_BET, status: "loss" as HandStatus };
  const bet = safeAmount(safeHand.bet, DEFAULT_BET);
  const playerTotal = handValue(safeHand.cards).total;
  if (playerTotal > 21) return { ...safeHand, status: "loss", resultNet: -bet };
  if (safeHand.natural && !dealerBj) return { ...safeHand, status: "blackjack", resultNet: Math.floor(bet * 1.5) };
  if (dealerBj && !safeHand.natural) return { ...safeHand, status: "loss", resultNet: -bet };
  if (dealerTotal > 21 || playerTotal > dealerTotal) return { ...safeHand, status: "win", resultNet: bet };
  if (playerTotal === dealerTotal) return { ...safeHand, status: "push", resultNet: 0 };
  return { ...safeHand, status: "loss", resultNet: -bet };
}
function payoutForHand(hand: PlayerHand) { return Math.max(0, safeAmount(hand?.bet, DEFAULT_BET) + Math.round(Number(hand?.resultNet || 0))); }
function toastLabel(hands: PlayerHand[], totalNet: number) {
  const safeHands = sanitizeHands(hands);
  if (safeHands.length === 1 && safeHands[0]?.status === "blackjack") return `Blackjack! +${formatTc(Math.max(0, totalNet))} TC`;
  if (totalNet > 0) return `You Win +${formatTc(totalNet)} TC`;
  if (totalNet === 0) return "Push — Bet Returned";
  return safeHands.some((hand) => hand.status === "loss" && handValue(hand.cards).total > 21) ? `Bust -${formatTc(Math.abs(totalNet))} TC` : `Dealer Wins -${formatTc(Math.abs(totalNet))} TC`;
}
function sanitizeBet(value: unknown, max: number) {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 1) return 1;
  return Math.max(1, Math.min(Math.max(1, Math.floor(Number(max) || 1)), amount));
}
function sanitizeWallet(value: any): WalletState { return { currency: "Tech Coin", symbol: "TC", balance: Math.max(0, Math.floor(Number(value?.balance || 0))), lifetime_earned: Math.max(0, Math.floor(Number(value?.lifetime_earned || 0))) }; }
function sanitizeServerHistory(value: any[]): ResultHistory[] { return value.slice(0, 20).map((item) => ({ id: uniqueId("server-result"), resultType: String(item?.result_type || "settled"), playerScore: Math.max(0, Math.floor(Number(item?.player_score || 0))), dealerScore: Math.max(0, Math.floor(Number(item?.dealer_score || 0))), betAmount: Math.max(0, Math.floor(Number(item?.bet_amount || 0))), netAmount: Math.round(Number(item?.net_amount || 0)) })); }
function formatTc(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0)); }
function uniqueId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function cardImage(card: Card) { return `/cards/${card.code}.png`; }
function cardAlt(card: Card) { return `${card.rank} of ${suitName(card.suit)}`; }
function suitName(suit: Suit) { return suit === "C" ? "Clubs" : suit === "D" ? "Diamonds" : suit === "H" ? "Hearts" : "Spades"; }
function cardSvg(card: Card) { return makeCardSvg(card.rank, ["D", "H"].includes(card.suit) ? "#ef4444" : "#111827", card.suit); }
function makeCardSvg(rank: string, color: string, suit: string) {
  const suitChar = suit === "C" ? "♣" : suit === "D" ? "♦" : suit === "H" ? "♥" : suit === "S" ? "♠" : suit;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 200"><rect width="144" height="200" rx="16" fill="#f8fafc"/><rect x="6" y="6" width="132" height="188" rx="12" fill="none" stroke="#d1d5db" stroke-width="3"/><text x="18" y="36" font-family="Arial" font-size="26" font-weight="900" fill="${color}">${rank}</text><text x="18" y="64" font-family="Arial" font-size="26" fill="${color}">${suitChar}</text><text x="72" y="116" text-anchor="middle" font-family="Arial" font-size="64" fill="${color}">${suitChar}</text><text x="126" y="164" text-anchor="end" font-family="Arial" font-size="26" fill="${color}">${suitChar}</text><text x="126" y="192" text-anchor="end" font-family="Arial" font-size="26" font-weight="900" fill="${color}">${rank}</text></svg>`)}`;
}
