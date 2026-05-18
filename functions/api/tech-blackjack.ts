const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const WALLET_ACTION_ERROR = "Tech Blackjack Practice does not support wallet actions.";

type JsonResponseInit = ResponseInit & { status?: number };
type Suit = "C" | "D" | "H" | "S";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Card = { suit: Suit; rank: Rank; code: string; id: string };
type HandStatus = "playing" | "stood" | "bust" | "blackjack" | "win" | "loss" | "push";
type RoundStatus = "playing" | "settled";
type PlayerHand = { id: string; cards: Card[]; status: HandStatus; natural?: boolean; doubled?: boolean };
type SettledHand = { status: HandStatus; playerScore: number; dealerScore: number; outcome: "win" | "loss" | "push" | "blackjack" };
type RoundResult = { label: "Player wins" | "Dealer wins" | "Push" | "Bust" | "Blackjack"; hands: SettledHand[] };
type RoundRow = {
  id: number;
  round_id: string;
  user_id: number;
  status: RoundStatus;
  deck_json: string;
  deck_hash: string;
  server_seed: string;
  salt: string;
  nonce: number;
  player_hands_json: string;
  dealer_cards_json: string;
  active_hand_index: number;
  hide_dealer_hole: number;
  result_json?: string | null;
  created_at?: string;
  updated_at?: string;
};

const SUITS: Suit[] = ["C", "D", "H", "S"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureBlackjackTables(context);
    return json(await buildState(context, auth.user.id));
  } catch (error) {
    return json({ error: "Tech Blackjack Practice data could not be loaded.", detail: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureBlackjackTables(context);
    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (["debit", "credit", "settle", "log"].includes(action)) {
      return json({ error: WALLET_ACTION_ERROR }, { status: 400 });
    }

    if (action === "start-round") return json(await startRound(context, auth.user.id));
    if (action === "get-state") return json(await buildState(context, auth.user.id));
    if (action === "hit") return json(await playAction(context, auth.user.id, "hit"));
    if (action === "stand") return json(await playAction(context, auth.user.id, "stand"));
    if (action === "double") return json(await playAction(context, auth.user.id, "double"));
    if (action === "split") return json(await playAction(context, auth.user.id, "split"));
    if (action === "verify-round") return json(await verifyRound(context, auth.user.id, String(body?.roundId || "")));

    return json({ error: "Invalid Tech Blackjack Practice action." }, { status: 400 });
  } catch (error) {
    return json({ error: readableError(error) }, { status: 400 });
  }
}

async function startRound(context: any, userId: number) {
  const active = await getActiveRound(context, userId);
  if (active) return buildState(context, userId, active);

  const serverSeed = randomHex(32);
  const salt = randomHex(16);
  const nonce = Date.now();
  const deckHash = await sha256Hex(`${serverSeed}:${salt}:${nonce}`);
  const deck = await shuffleDeckDeterministic(createDeck(), serverSeed, salt, nonce);
  const playerCards = safeCards([deck[0], deck[2]]);
  const dealerCards = safeCards([deck[1], deck[3]]);
  if (playerCards.length < 2 || dealerCards.length < 2) throw new Error("Deck could not be dealt safely.");

  const playerHand: PlayerHand = { id: "hand-1", cards: playerCards, status: isBlackjack(playerCards) ? "blackjack" : "playing", natural: isBlackjack(playerCards) };
  let status: RoundStatus = "playing";
  let activeHandIndex = 0;
  let hideDealerHole = 1;
  let result: RoundResult | null = null;

  if (playerHand.natural) {
    status = "settled";
    hideDealerHole = 0;
    result = settleHands([playerHand], dealerCards);
    playerHand.status = result.hands[0]?.status || "blackjack";
    activeHandIndex = 0;
  }

  const roundId = `tbj-${randomHex(10)}`;
  await context.env.DB.prepare(
    `
      INSERT INTO tech_blackjack_rounds
        (round_id, user_id, status, deck_json, deck_hash, server_seed, salt, nonce, player_hands_json, dealer_cards_json, active_hand_index, hide_dealer_hole, result_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
  )
    .bind(roundId, userId, status, JSON.stringify(deck), deckHash, serverSeed, salt, nonce, JSON.stringify([playerHand]), JSON.stringify(dealerCards), activeHandIndex, hideDealerHole, result ? JSON.stringify(result) : null)
    .run();

  const row = await getRoundById(context, userId, roundId);
  if (!row) throw new Error("Round could not be created.");
  if (status === "settled") await insertPracticeHistory(context, userId, row);
  return buildState(context, userId, row);
}

async function playAction(context: any, userId: number, action: "hit" | "stand" | "double" | "split") {
  const row = await getActiveRound(context, userId);
  if (!row) throw new Error("No active Tech Blackjack Practice round.");
  if (row.status !== "playing") throw new Error("This round is already settled.");

  const deck = parseCards(row.deck_json);
  const dealerCards = parseCards(row.dealer_cards_json);
  const hands = parseHands(row.player_hands_json);
  const activeIndex = clampIndex(row.active_hand_index, hands.length);
  const activeHand = hands[activeIndex];
  if (!activeHand || activeHand.status !== "playing") throw new Error("No playable hand is active.");

  let nextActiveIndex = activeIndex;
  let hideDealerHole = 1;
  let status: RoundStatus = "playing";
  let result: RoundResult | null = null;
  let nextDealerCards = dealerCards;

  if (action === "hit") {
    const card = drawNextCard(deck, hands, dealerCards);
    activeHand.cards = [...activeHand.cards, card];
    if (isBust(activeHand.cards)) activeHand.status = "bust";
  }

  if (action === "stand") activeHand.status = "stood";

  if (action === "double") {
    if (activeHand.cards.length !== 2 || activeHand.doubled) throw new Error("Double is available only as the first two-card decision.");
    const card = drawNextCard(deck, hands, dealerCards);
    activeHand.cards = [...activeHand.cards, card];
    activeHand.doubled = true;
    activeHand.status = isBust(activeHand.cards) ? "bust" : "stood";
  }

  if (action === "split") {
    if (hands.length >= 2) throw new Error("Only one split is supported in practice mode.");
    if (activeHand.cards.length !== 2 || activeHand.cards[0]?.rank !== activeHand.cards[1]?.rank) throw new Error("Split requires two cards with the same rank.");
    const usedBeforeSplit = usedCardCount(hands, dealerCards);
    const firstDraw = deck[usedBeforeSplit];
    const secondDraw = deck[usedBeforeSplit + 1];
    if (!firstDraw || !secondDraw) throw new Error("Deck is empty.");
    const [first, second] = activeHand.cards;
    hands.splice(0, hands.length, { id: "split-1", cards: [first, firstDraw], status: "playing", natural: false }, { id: "split-2", cards: [second, secondDraw], status: "playing", natural: false });
    nextActiveIndex = 0;
  }

  if (action !== "split") {
    const nextIndex = hands.findIndex((hand, index) => index > activeIndex && hand.status === "playing");
    if (nextIndex >= 0) nextActiveIndex = nextIndex;
    else {
      const settled = await finishRound(deck, hands, dealerCards);
      status = "settled";
      nextDealerCards = settled.dealerCards;
      hideDealerHole = 0;
      result = settled.result;
      nextActiveIndex = 0;
    }
  }

  await updateRound(context, row.round_id, userId, { status, hands, dealerCards: nextDealerCards, activeHandIndex: nextActiveIndex, hideDealerHole, result });
  const updated = await getRoundById(context, userId, row.round_id);
  if (!updated) throw new Error("Round state could not be loaded.");
  if (status === "settled") await insertPracticeHistory(context, userId, updated);
  return buildState(context, userId, updated);
}

async function finishRound(deck: Card[], hands: PlayerHand[], dealerCards: Card[]) {
  let nextDealerCards = safeCards(dealerCards);
  if (hands.some((hand) => hand.status !== "bust")) nextDealerCards = dealerPlay(deck, hands, nextDealerCards);
  const result = settleHands(hands, nextDealerCards);
  result.hands.forEach((settled, index) => {
    if (hands[index]) hands[index].status = settled.status;
  });
  return { dealerCards: nextDealerCards, result };
}

function dealerPlay(deck: Card[], hands: PlayerHand[], dealerCards: Card[]) {
  const cards = [...dealerCards];
  while (handValue(cards).total < 17) {
    const card = deck[usedCardCount(hands, cards)];
    if (!card) throw new Error("Deck is empty.");
    cards.push(card);
  }
  return cards;
}

function settleHands(hands: PlayerHand[], dealerCards: Card[]): RoundResult {
  const dealerScore = handValue(dealerCards).total;
  const dealerNatural = isBlackjack(dealerCards);
  const dealerBust = dealerScore > 21;
  const settled = hands.map((hand) => settleHand(hand, dealerScore, dealerNatural, dealerBust));
  const label = resultLabel(settled);
  return { label, hands: settled };
}

function settleHand(hand: PlayerHand, dealerScore: number, dealerNatural: boolean, dealerBust: boolean): SettledHand {
  const playerScore = handValue(hand.cards).total;
  const natural = Boolean(hand.natural) && isBlackjack(hand.cards);
  let status: HandStatus = "loss";
  let outcome: SettledHand["outcome"] = "loss";
  if (playerScore > 21) status = "bust";
  else if (natural && !dealerNatural) status = "blackjack";
  else if (dealerNatural && !natural) status = "loss";
  else if (dealerBust || playerScore > dealerScore) status = "win";
  else if (playerScore < dealerScore) status = "loss";
  else status = "push";

  if (status === "blackjack") outcome = "blackjack";
  else if (status === "win") outcome = "win";
  else if (status === "push") outcome = "push";
  else outcome = "loss";
  return { status, playerScore, dealerScore, outcome };
}

function resultLabel(hands: SettledHand[]): RoundResult["label"] {
  if (hands.some((hand) => hand.status === "blackjack")) return "Blackjack";
  if (hands.every((hand) => hand.status === "bust")) return "Bust";
  const wins = hands.filter((hand) => ["win", "blackjack"].includes(hand.status)).length;
  const losses = hands.filter((hand) => ["loss", "bust"].includes(hand.status)).length;
  if (wins > losses) return "Player wins";
  if (losses > wins) return "Dealer wins";
  return "Push";
}

function drawNextCard(deck: Card[], hands: PlayerHand[], dealerCards: Card[]) {
  const card = deck[usedCardCount(hands, dealerCards)];
  if (!card) throw new Error("Deck is empty.");
  return card;
}

function usedCardCount(hands: PlayerHand[], dealerCards: Card[]) {
  return hands.reduce((sum, hand) => sum + safeCards(hand.cards).length, 0) + safeCards(dealerCards).length;
}

async function verifyRound(context: any, userId: number, roundId: string) {
  const row = await getRoundById(context, userId, roundId);
  if (!row) throw new Error("Round not found.");
  const recalculated = await sha256Hex(`${row.server_seed}:${row.salt}:${row.nonce}`);
  const settled = row.status === "settled";
  const payload: any = {
    ok: true,
    round: serializeRound(row),
    verification: {
      roundId: row.round_id,
      deckHash: row.deck_hash,
      salt: row.salt,
      nonce: row.nonce,
      verified: settled ? recalculated === row.deck_hash : undefined,
      status: row.status,
    },
  };
  if (settled) {
    payload.verification.serverSeed = row.server_seed;
    payload.verification.fullDeckOrder = parseCards(row.deck_json);
    payload.verification.initialDeckOrder = parseCards(row.deck_json).slice(0, 4);
    payload.verification.recalculatedHash = recalculated;
  }
  return payload;
}

async function buildState(context: any, userId: number, preferredRound?: RoundRow) {
  const round = preferredRound || (await getLatestRound(context, userId));
  const recent = await context.env.DB.prepare(
    `
      SELECT result_type, player_score, dealer_score, deck_hash_short, created_at
      FROM tech_blackjack_practice_history
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 8
    `,
  )
    .bind(userId)
    .all();

  return { ok: true, round: round ? serializeRound(round) : null, recent: recent?.results || [] };
}

function serializeRound(row: RoundRow) {
  const status = row.status;
  const dealerCards = parseCards(row.dealer_cards_json);
  const playerHands = parseHands(row.player_hands_json);
  const result = parseJson<RoundResult | null>(row.result_json || "null", null);
  return {
    roundId: row.round_id,
    status,
    deckHash: row.deck_hash,
    salt: row.salt,
    nonce: row.nonce,
    serverSeed: status === "settled" ? row.server_seed : undefined,
    dealerCardsVisible: row.hide_dealer_hole && status !== "settled" && dealerCards.length > 1 ? dealerCards.slice(0, 1) : dealerCards,
    dealerCardsFull: status === "settled" ? dealerCards : undefined,
    playerHands,
    activeHandIndex: clampIndex(row.active_hand_index, playerHands.length),
    availableActions: availableActions(status, playerHands, row.active_hand_index),
    result,
    verification: {
      deckHash: row.deck_hash,
      salt: row.salt,
      nonce: row.nonce,
      serverSeedRevealed: status === "settled",
    },
  };
}

function availableActions(status: RoundStatus, hands: PlayerHand[], activeIndex: number) {
  const active = hands[clampIndex(activeIndex, hands.length)];
  const canPlay = status === "playing" && active?.status === "playing";
  const isFirstDecision = canPlay && active.cards.length === 2 && !active.doubled;
  return {
    hit: canPlay,
    stand: canPlay,
    double: Boolean(isFirstDecision),
    split: Boolean(isFirstDecision && hands.length < 2 && active.cards[0]?.rank === active.cards[1]?.rank),
    newRound: status === "settled" || !hands.length,
  };
}

async function updateRound(context: any, roundId: string, userId: number, next: { status: RoundStatus; hands: PlayerHand[]; dealerCards: Card[]; activeHandIndex: number; hideDealerHole: number; result: RoundResult | null }) {
  await context.env.DB.prepare(
    `
      UPDATE tech_blackjack_rounds
      SET status = ?, player_hands_json = ?, dealer_cards_json = ?, active_hand_index = ?, hide_dealer_hole = ?, result_json = ?, updated_at = datetime('now')
      WHERE round_id = ? AND user_id = ?
    `,
  )
    .bind(next.status, JSON.stringify(next.hands), JSON.stringify(next.dealerCards), next.activeHandIndex, next.hideDealerHole, next.result ? JSON.stringify(next.result) : null, roundId, userId)
    .run();
}

async function insertPracticeHistory(context: any, userId: number, row: RoundRow) {
  const result = parseJson<RoundResult | null>(row.result_json || "null", null);
  if (!result?.hands?.length) return;
  const firstHand = result.hands[0];
  await context.env.DB.prepare(
    `
      INSERT INTO tech_blackjack_practice_history (round_id, user_id, result_type, player_score, dealer_score, deck_hash_short, created_at)
      SELECT ?, ?, ?, ?, ?, ?, datetime('now')
      WHERE NOT EXISTS (SELECT 1 FROM tech_blackjack_practice_history WHERE round_id = ? AND user_id = ?)
    `,
  )
    .bind(row.round_id, userId, firstHand.status, firstHand.playerScore, firstHand.dealerScore, row.deck_hash.slice(0, 12), row.round_id, userId)
    .run();
}

async function getActiveRound(context: any, userId: number) {
  return context.env.DB.prepare(
    `SELECT * FROM tech_blackjack_rounds WHERE user_id = ? AND status = 'playing' ORDER BY id DESC LIMIT 1`,
  )
    .bind(userId)
    .first() as Promise<RoundRow | null>;
}

async function getLatestRound(context: any, userId: number) {
  return context.env.DB.prepare(`SELECT * FROM tech_blackjack_rounds WHERE user_id = ? ORDER BY id DESC LIMIT 1`).bind(userId).first() as Promise<RoundRow | null>;
}

async function getRoundById(context: any, userId: number, roundId: string) {
  if (!roundId) return null;
  return context.env.DB.prepare(`SELECT * FROM tech_blackjack_rounds WHERE user_id = ? AND round_id = ? LIMIT 1`).bind(userId, roundId).first() as Promise<RoundRow | null>;
}

async function ensureBlackjackTables(context: any) {
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_blackjack_hands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      result_type TEXT NOT NULL,
      player_score INTEGER DEFAULT 0,
      dealer_score INTEGER DEFAULT 0,
      bet_amount INTEGER DEFAULT 0,
      net_amount INTEGER DEFAULT 0,
      payout_amount INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_blackjack_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      deck_json TEXT NOT NULL,
      deck_hash TEXT NOT NULL,
      server_seed TEXT NOT NULL,
      salt TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      player_hands_json TEXT NOT NULL,
      dealer_cards_json TEXT NOT NULL,
      active_hand_index INTEGER DEFAULT 0,
      hide_dealer_hole INTEGER DEFAULT 1,
      result_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await ensureColumn(context, "tech_blackjack_rounds", "result_json", "TEXT");
  await ensureColumn(context, "tech_blackjack_rounds", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_blackjack_practice_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      result_type TEXT NOT NULL,
      player_score INTEGER DEFAULT 0,
      dealer_score INTEGER DEFAULT 0,
      deck_hash_short TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
  await ensureColumn(context, "tech_blackjack_practice_history", "deck_hash_short", "TEXT");
}

async function ensureColumn(context: any, table: string, column: string, definition: string) {
  const columns = await context.env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const exists = (columns?.results || []).some((row: any) => row?.name === column);
  if (!exists) await context.env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function createDeck(): Card[] {
  let index = 0;
  return SUITS.flatMap((suit) => RANKS.map((rank) => {
    const card = { suit, rank, code: `${rank}${suit}`, id: `${rank}${suit}-${index}` };
    index += 1;
    return card;
  }));
}

async function shuffleDeckDeterministic(deck: Card[], serverSeed: string, salt: string, nonce: number) {
  const shuffled = [...deck];
  let counter = 0;
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const hash = await sha256Hex(`${serverSeed}:${salt}:${nonce}:${counter}`);
    const randomValue = parseInt(hash.slice(0, 13), 16);
    const j = randomValue % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    counter += 1;
  }
  return shuffled;
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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

function isBlackjack(cards?: Card[] | null) {
  return safeCards(cards).length === 2 && handValue(cards).total === 21;
}

function isBust(cards?: Card[] | null) {
  return handValue(cards).total > 21;
}

function isCard(value: unknown): value is Card {
  const card = value as Partial<Card> | null | undefined;
  return Boolean(card && SUITS.includes(card.suit as Suit) && RANKS.includes(card.rank as Rank) && typeof card.code === "string");
}

function safeCards(cards?: Array<Card | null | undefined> | null): Card[] {
  return Array.isArray(cards) ? cards.filter(isCard) : [];
}

function parseCards(value: string | null | undefined) {
  const parsed = parseJson<any[]>(value || "[]", []);
  return safeCards(parsed);
}

function parseHands(value: string | null | undefined): PlayerHand[] {
  const parsed = parseJson<any[]>(value || "[]", []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((hand, index) => ({
    id: typeof hand?.id === "string" ? hand.id : `hand-${index + 1}`,
    cards: safeCards(hand?.cards),
    status: isHandStatus(hand?.status) ? hand.status : "playing",
    natural: Boolean(hand?.natural),
    doubled: Boolean(hand?.doubled),
  }));
}

function isHandStatus(value: unknown): value is HandStatus {
  return ["playing", "stood", "bust", "blackjack", "win", "loss", "push"].includes(String(value));
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clampIndex(index: unknown, length: number) {
  if (length <= 0) return 0;
  const safeIndex = Math.floor(Number(index) || 0);
  return Math.min(Math.max(0, safeIndex), length - 1);
}

async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Sign in required." };

  const user = await context.env.DB.prepare(
    `
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `,
  )
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Session expired." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Account blocked." };
  if (!["off", "admin", "owner"].includes(String(user.role))) return { ok: false, status: 403, error: "OFF Hub access required." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function json(payload: any, init?: JsonResponseInit) {
  return Response.json(payload, init);
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Tech Blackjack Practice error.";
}
