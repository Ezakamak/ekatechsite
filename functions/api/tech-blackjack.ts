import { awardGameExp, expForGame } from "../_levels";
import { recordOffMatch } from "../_offMatches";
import { createClientSeed, createNonce, createServerSeed, generateBlackjackDeck, sha256 } from "../../src/lib/provablyFair";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const AMOUNT_LIMITS = { min: 1, max: 100_000 };

type JsonResponseInit = ResponseInit & { status?: number };

type TableColumn = {
  cid?: number;
  name: string;
  type?: string | null;
  notnull?: number;
  dflt_value?: unknown;
  pk?: number;
};

type BlackjackLogBody = {
  roundId?: string;
  usedDeck?: unknown;
  resultType?: string;
  playerScore?: number;
  dealerScore?: number;
  betAmount?: number;
  netAmount?: number;
  payoutAmount?: number;
};

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureBlackjackTables(context);
    await ensureWallet(context, auth.user.id);
    return json(await buildState(context, auth.user.id));
  } catch (error) {
    return json({ error: "Tech Blackjack data could not be loaded.", detail: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureBlackjackTables(context);
    await ensureWallet(context, auth.user.id);

    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "start-round") {
      const amount = sanitizeAmount(body?.amount);
      const clientSeed = sanitizeSeed(body?.clientSeed) || createClientSeed();
      const serverSeed = createServerSeed();
      const serverHash = await sha256(serverSeed);
      const nonce = createNonce();
      const { deck, deckHmac } = await generateBlackjackDeck(serverSeed, clientSeed, nonce);
      await debitWallet(context, auth.user.id, amount, "Tech Blackjack bet");
      await awardGameExp(context, auth.user.id, expForGame("easy", 6), "Tech Blackjack bet", "blackjack");
      const idColumn = await getTableColumn(context, "tech_blackjack_rounds", "id");
      console.log(`[D1_BLACKJACK_SCHEMA] tech_blackjack_rounds id column = ${formatTableColumnForLog(idColumn)}`);
      const usesIntegerId = isIntegerPrimaryKey(idColumn);
      console.log(`[D1_BLACKJACK_INSERT_MODE] ${usesIntegerId ? "integer-id" : "text-id"}`);

      const deckOrder = JSON.stringify(deck.map((card) => card.code));
      let roundId: string;

      if (usesIntegerId) {
        const insert = await context.env.DB.prepare(
          `INSERT INTO tech_blackjack_rounds (user_id, server_seed, server_hash, client_seed, nonce, deck_hmac, deck_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        ).bind(auth.user.id, serverSeed, serverHash, clientSeed, nonce, deckHmac, deckOrder).run();
        const lastRowId = insert?.meta?.last_row_id;
        if (!Number.isInteger(Number(lastRowId))) throw new Error("Tech Blackjack round id could not be created.");
        roundId = String(lastRowId);
      } else {
        roundId = `bj-${Date.now()}-${crypto.randomUUID?.() || nonce}`;
        await context.env.DB.prepare(
          `INSERT INTO tech_blackjack_rounds (id, user_id, server_seed, server_hash, client_seed, nonce, deck_hmac, deck_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        ).bind(roundId, auth.user.id, serverSeed, serverHash, clientSeed, nonce, deckHmac, deckOrder).run();
      }

      return json({
        ...(await buildState(context, auth.user.id)),
        round: {
          roundId,
          deck,
          fairness: { algorithm: "SHA-256 / HMAC-SHA256 Provably Fair", clientSeed, nonce, serverHash, deckHmac },
        },
      });
    }

    if (action === "debit") {
      const amount = sanitizeAmount(body?.amount);
      await debitWallet(context, auth.user.id, amount, String(body?.reason || "Tech Blackjack bet"));
      await awardGameExp(context, auth.user.id, expForGame("easy", 6), "Tech Blackjack bet", "blackjack");
      return json(await buildState(context, auth.user.id));
    }

    if (action === "credit") {
      const amount = sanitizeAmount(body?.amount);
      await creditWallet(context, auth.user.id, amount, String(body?.reason || "Tech Blackjack payout"));
      return json(await buildState(context, auth.user.id));
    }

    if (action === "log") {
      await insertBlackjackLog(context, auth.user.id, body || {});
      return json(await buildState(context, auth.user.id));
    }

    if (action === "settle") {
      const payoutAmount = sanitizePayoutAmount(body);
      if (payoutAmount > 0) await creditWallet(context, auth.user.id, payoutAmount, "Tech Blackjack payout");
      await insertBlackjackLog(context, auth.user.id, { ...(body || {}), payoutAmount });
      const settledFairness = await settleBlackjackRound(context, auth.user.id, body);
      const resultType = String(body?.resultType || "completed");
      const offSummary = await recordOffMatch(context, auth.user.id, {
        gameKey: "blackjack",
        result: ["win", "blackjack"].includes(resultType) ? "win" : resultType === "lose" || resultType === "loss" ? "loss" : "completed",
        score: Number(body?.netAmount ?? payoutAmount ?? 0),
        expAmount: 0,
        pointsEarned: payoutAmount,
        metadata: { resultType, betAmount: body?.betAmount, payoutAmount },
      });
      return json({ ...(await buildState(context, auth.user.id)), fairness: settledFairness, ...offSummary });
    }

    return json({ error: "Invalid Tech Blackjack action." }, { status: 400 });
  } catch (error) {
    return json({ error: readableError(error) }, { status: 400 });
  }
}

async function buildState(context: any, userId: number) {
  const wallet = await getWallet(context, userId);
  const recent = await context.env.DB.prepare(
    `
      SELECT result_type, player_score, dealer_score, bet_amount, net_amount, payout_amount, created_at
      FROM tech_blackjack_hands
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 40
    `,
  )
    .bind(userId)
    .all();

  return { ok: true, wallet, limits: AMOUNT_LIMITS, recent: recent?.results || [] };
}

function sanitizeAmount(value: unknown) {
  const amount = Math.floor(Number(value || 0));
  if (!Number.isFinite(amount) || amount < AMOUNT_LIMITS.min) throw new Error("Tech Coin amount must be at least 1.");
  if (amount > AMOUNT_LIMITS.max) throw new Error(`Tech Coin amount must be ${AMOUNT_LIMITS.max} or less.`);
  return amount;
}

function sanitizePayoutAmount(body: BlackjackLogBody & { creditAmount?: number }) {
  const payoutInput = body?.payoutAmount ?? body?.creditAmount ?? calculateBlackjackPayout(body?.resultType, body?.betAmount || 0);
  const payoutAmount = Math.max(0, Math.floor(Number(payoutInput || 0)));
  if (!Number.isFinite(payoutAmount)) throw new Error("Invalid Tech Blackjack payout.");
  if (payoutAmount > AMOUNT_LIMITS.max * 3) throw new Error(`Tech Blackjack payout must be ${AMOUNT_LIMITS.max * 3} or less.`);
  return payoutAmount;
}

function calculateBlackjackPayout(result: string | undefined, betAmount: number) {
  const bet = Math.max(0, Math.floor(Number(betAmount || 0)));
  if (result === "blackjack") return Math.floor(bet * 2.5);
  if (result === "win") return bet * 2;
  if (result === "push") return bet;
  if (result === "surrender") return Math.floor(bet / 2);
  return 0;
}

async function debitWallet(context: any, userId: number, amount: number, reason: string) {
  const debit = await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
  )
    .bind(amount, userId, amount)
    .run();

  if ((debit.meta?.changes || 0) < 1) throw new Error("Not enough Tech Coin.");

  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
    .bind(userId, -amount, reason)
    .run();
}

async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`,
  )
    .bind(amount, amount, userId)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
    .bind(userId, amount, reason)
    .run();
}

async function settleBlackjackRound(context: any, userId: number, body: BlackjackLogBody & { roundId?: string; usedDeck?: unknown }) {
  const roundId = String(body?.roundId || "");
  if (!roundId) return null;

  const idColumn = await getTableColumn(context, "tech_blackjack_rounds", "id");
  const normalizedRoundId = normalizeRoundId(roundId, idColumn);
  if (normalizedRoundId === null) return null;

  const row = await context.env.DB.prepare(
    `SELECT id, server_seed AS serverSeed, server_hash AS serverHash, client_seed AS clientSeed, nonce, deck_hmac AS deckHmac, deck_order AS deckOrder FROM tech_blackjack_rounds WHERE id = ? AND user_id = ?`,
  ).bind(normalizedRoundId, userId).first();
  if (!row?.id) return null;
  const usedDeck = Array.isArray(body?.usedDeck) ? body.usedDeck.map((card: any) => String(card?.code || card)).filter(Boolean) : [];
  await context.env.DB.prepare(
    `UPDATE tech_blackjack_rounds SET used_deck = ?, settled_at = datetime('now') WHERE id = ? AND user_id = ?`,
  ).bind(JSON.stringify(usedDeck), normalizedRoundId, userId).run();
  return {
    algorithm: "SHA-256 / HMAC-SHA256 Provably Fair",
    roundId: String(row.id),
    clientSeed: String(row.clientSeed),
    nonce: Number(row.nonce),
    serverHash: String(row.serverHash),
    revealedServerSeed: String(row.serverSeed),
    deckHmac: String(row.deckHmac),
    deckOrder: safeJsonArray(row.deckOrder),
    usedDeck,
  };
}

async function insertBlackjackLog(context: any, userId: number, body: BlackjackLogBody) {
  const betAmount = Math.max(0, Math.floor(Number(body?.betAmount || 0)));
  const netAmount = Math.round(Number(body?.netAmount || 0));
  const payoutAmount = Math.max(0, Math.floor(Number(body?.payoutAmount || 0)));
  await context.env.DB.prepare(
    `
      INSERT INTO tech_blackjack_hands
        (user_id, result_type, player_score, dealer_score, bet_amount, net_amount, payout_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
  )
    .bind(
      userId,
      String(body?.resultType || "settled").slice(0, 32),
      Math.max(0, Math.floor(Number(body?.playerScore || 0))),
      Math.max(0, Math.floor(Number(body?.dealerScore || 0))),
      betAmount,
      netAmount,
      payoutAmount,
    )
    .run();
}

async function ensureBlackjackTables(context: any) {
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS coin_wallets (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 100,
      lifetime_earned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_blackjack_rounds (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      server_seed TEXT NOT NULL,
      server_hash TEXT NOT NULL,
      client_seed TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      deck_hmac TEXT NOT NULL,
      deck_order TEXT NOT NULL,
      used_deck TEXT,
      settled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

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

  const walletColumns = [
    ["balance", "INTEGER DEFAULT 100"],
    ["lifetime_earned", "INTEGER DEFAULT 0"],
    ["updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP"],
  ];
  for (const [name, type] of walletColumns) await addColumnIfMissing(context, "coin_wallets", name, type);

  const transactionColumns = [
    ["reason", "TEXT"],
    ["created_at", "TEXT DEFAULT CURRENT_TIMESTAMP"],
  ];
  for (const [name, type] of transactionColumns) await addColumnIfMissing(context, "coin_transactions", name, type);

  const roundColumns = [
    ["server_seed", "TEXT"],
    ["server_hash", "TEXT"],
    ["client_seed", "TEXT"],
    ["nonce", "INTEGER"],
    ["deck_hmac", "TEXT"],
    ["deck_order", "TEXT"],
    ["used_deck", "TEXT"],
    ["settled_at", "TEXT"],
    ["created_at", "TEXT DEFAULT CURRENT_TIMESTAMP"],
  ];
  for (const [name, type] of roundColumns) await addColumnIfMissing(context, "tech_blackjack_rounds", name, type);

  const handColumns = [
    ["player_score", "INTEGER DEFAULT 0"],
    ["dealer_score", "INTEGER DEFAULT 0"],
    ["bet_amount", "INTEGER DEFAULT 0"],
    ["net_amount", "INTEGER DEFAULT 0"],
    ["payout_amount", "INTEGER DEFAULT 0"],
    ["created_at", "TEXT DEFAULT CURRENT_TIMESTAMP"],
  ];
  for (const [name, type] of handColumns) await addColumnIfMissing(context, "tech_blackjack_hands", name, type);
}

async function getTableColumns(context: any, table: string): Promise<TableColumn[]> {
  const result = await context.env.DB.prepare(`PRAGMA table_info(${sqlIdentifier(table)})`).all();
  return (result?.results || []).map((column: any) => ({
    cid: Number(column.cid),
    name: String(column.name || ""),
    type: column.type == null ? null : String(column.type),
    notnull: Number(column.notnull || 0),
    dflt_value: column.dflt_value ?? null,
    pk: Number(column.pk || 0),
  }));
}

async function getTableColumn(context: any, table: string, column: string): Promise<TableColumn | null> {
  const columns = await getTableColumns(context, table);
  return columns.find((entry) => entry.name.toLowerCase() === column.toLowerCase()) || null;
}

function isIntegerPrimaryKey(column: TableColumn | null) {
  return Boolean(column?.pk) && String(column?.type || "").trim().toUpperCase() === "INTEGER";
}

function normalizeRoundId(roundId: string, idColumn: TableColumn | null) {
  if (!isIntegerPrimaryKey(idColumn)) return String(roundId);
  const numericRoundId = Number(roundId);
  if (!Number.isInteger(numericRoundId)) return null;
  return numericRoundId;
}

function formatTableColumnForLog(column: TableColumn | null) {
  if (!column) return "missing";
  return `${column.name} ${String(column.type || "").trim() || "UNKNOWN"} pk=${Number(column.pk || 0)}`;
}

function sqlIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error("Invalid SQL identifier.");
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function addColumnIfMissing(context: any, table: string, column: string, type: string) {
  await context.env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run().catch(() => null);
}

function sanitizeSeed(value: unknown) { return String(value || "").trim().slice(0, 128); }
function safeJsonArray(value: unknown) { try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`,
  )
    .bind(userId)
    .run();
}

async function getWallet(context: any, userId: number) {
  const wallet = await context.env.DB.prepare(
    `SELECT COALESCE(balance, 0) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Number(wallet?.balance || 0),
    lifetime_earned: Number(wallet?.lifetime_earned || 0),
    updated_at: wallet?.updated_at || null,
  };
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
  return error instanceof Error ? error.message : "Unknown Tech Blackjack error.";
}
