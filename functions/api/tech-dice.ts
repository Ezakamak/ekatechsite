import { awardGameExp, expForGame } from "../_levels";
import { creditWallet, debitWalletAtomic, ensureWallet, getWallet, insertCoinTransaction } from "../_coinWallet";
import { createClientSeed, createNonce, createServerSeed, generateDiceRoll, sha256 } from "../../src/lib/provablyFair";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const TARGET_MIN = 0.01;
const TARGET_MAX = 99.99;
const AMOUNT_LIMITS = { min: 1, max: 10_000 };
const RTP = 0.96;

type DiceMode = "over" | "under";

type JsonResponseInit = ResponseInit & { status?: number };

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureDiceTables(context);
    await ensureWallet(context, auth.user.id);
    return json(await buildState(context, auth.user.id));
  } catch (error) {
    return json(
      { error: "Tech Dice verisi alınamadı.", detail: readableError(error) },
      { status: 500 },
    );
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  try {
    await ensureDiceTables(context);
    await ensureWallet(context, auth.user.id);

    const body = await context.request.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount || 0));
    const target = clampTarget(Number(body?.target ?? 50));
    const mode = parseMode(body?.mode);
    const clientSeed = sanitizeSeed(body?.clientSeed) || createClientSeed();
    const commitment = await consumeDiceCommitment(context, auth.user.id, body?.commitmentId);
    const nonce = commitment.nonce;
    const serverSeed = commitment.serverSeed;
    const serverHash = commitment.serverHash;

    if (!Number.isFinite(amount) || amount < AMOUNT_LIMITS.min)
      throw new Error("Tech Coin amount must be at least 1.");
    if (amount > AMOUNT_LIMITS.max)
      throw new Error(`Tech Coin amount must be ${AMOUNT_LIMITS.max} or less.`);

    const math = diceMath(mode, target);
    const potentialReward = rewardForAmount(amount, math.multiplier);
    const beforeWallet = await getWallet(context, auth.user.id);

    const debitOk = await debitWalletAtomic(context, auth.user.id, amount, `Tech Dice play: ${mode} ${target}`);

    if (!debitOk) {
      return json(
        {
          error: "Not enough Tech Coin.",
          wallet: beforeWallet,
          limits: AMOUNT_LIMITS,
        },
        { status: 402 },
      );
    }

    const diceOutcome = await generateDiceRoll(serverSeed, clientSeed, nonce);
    const rolledNumber = diceOutcome.roll;
    const won = mode === "over" ? rolledNumber > target : rolledNumber < target;
    const net = won ? potentialReward - amount : -amount;

    if (won) await creditWallet(context, auth.user.id, potentialReward, "Tech Dice reward");

    await d1Prepare(context,
      `
        INSERT INTO tech_dice_rolls
          (user_id, mode, target_number, rolled_number, amount, multiplier, win_chance, reward_amount, net_amount, result, server_seed, server_hash, client_seed, nonce, result_hmac, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
    )
      .bind(
        auth.user.id,
        mode,
        target,
        rolledNumber,
        amount,
        math.multiplier,
        math.winChance,
        won ? potentialReward : 0,
        net,
        won ? "win" : "loss",
        serverSeed,
        serverHash,
        clientSeed,
        nonce,
        diceOutcome.resultHmac,
      )
      .run();

    await awardGameExp(
      context,
      auth.user.id,
      expForGame(math.winChance <= 0.2 ? "hard" : math.winChance <= 0.5 ? "medium" : "easy", 8),
      `Tech Dice ${won ? "win" : "roll"}`,
      mode,
    );

    return json({
      ...(await buildState(context, auth.user.id)),
      result: {
        mode,
        target,
        rolledNumber,
        won,
        amount,
        multiplier: math.multiplier,
        winChance: math.winChance,
        rewardAmount: won ? potentialReward : 0,
        lossAmount: won ? 0 : amount,
        net,
        message: won ? "Successful Roll" : "Missed Roll",
        fairness: {
          algorithm: "SHA-256 / HMAC-SHA256 Provably Fair",
          clientSeed,
          nonce,
          serverHash,
          revealedServerSeed: serverSeed,
          resultHmac: diceOutcome.resultHmac,
        },
      },
    });
  } catch (error) {
    return json({ error: readableError(error) }, { status: 400 });
  }
}

async function buildState(context: any, userId: number) {
  const wallet = await getWallet(context, userId);
  const recent = await d1Prepare(context,
    `
      SELECT mode, target_number, rolled_number, amount, multiplier, win_chance, reward_amount, net_amount, result, created_at
      FROM tech_dice_rolls
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 20
    `,
  )
    .bind(userId)
    .all();

  const pendingFairness = await getOrCreateDiceCommitment(context, userId);
  return {
    ok: true,
    wallet,
    limits: AMOUNT_LIMITS,
    targetRange: { min: TARGET_MIN, max: TARGET_MAX },
    recent: recent?.results || [],
    pendingFairness: {
      algorithm: "SHA-256 / HMAC-SHA256 Provably Fair",
      commitmentId: pendingFairness.id,
      clientSeed: createClientSeed(),
      nonce: pendingFairness.nonce,
      serverHash: pendingFairness.serverHash,
    },
  };
}

function sanitizeSeed(value: unknown) {
  return String(value || "").trim().slice(0, 128);
}

function diceMath(mode: DiceMode, target: number) {
  const safeTarget = clampTarget(target);
  const rawChance = mode === "over" ? (100 - safeTarget) / 100 : safeTarget / 100;
  const winChance = Math.max(0.0001, Math.min(0.9999, rawChance));
  const multiplier = Number(Math.max(0.01, Math.min(9600, RTP / winChance)).toFixed(2));
  return { winChance: Number(winChance.toFixed(4)), multiplier };
}

function rewardForAmount(amount: number, multiplier: number) {
  return Math.max(1, Math.floor(amount * multiplier));
}

function clampTarget(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Number(Math.min(TARGET_MAX, Math.max(TARGET_MIN, value)).toFixed(2));
}

function parseMode(value: any): DiceMode {
  return String(value || "over").toLowerCase() === "under" ? "under" : "over";
}

async function ensureDiceTables(context: any) {
  await d1Prepare(context,
    `
    CREATE TABLE IF NOT EXISTS tech_fair_commitments (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game_key TEXT NOT NULL,
      server_seed TEXT NOT NULL,
      server_hash TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await d1Prepare(context,
    `
    CREATE TABLE IF NOT EXISTS tech_dice_rolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      target_number REAL NOT NULL,
      rolled_number REAL NOT NULL,
      amount INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      win_chance REAL NOT NULL,
      reward_amount INTEGER DEFAULT 0,
      net_amount INTEGER DEFAULT 0,
      result TEXT NOT NULL,
      server_seed TEXT,
      server_hash TEXT,
      client_seed TEXT,
      nonce INTEGER,
      result_hmac TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
}

type FairCommitment = { id: string; serverSeed: string; serverHash: string; nonce: number };

async function getOrCreateDiceCommitment(context: any, userId: number): Promise<FairCommitment> {
  const existing = await d1Prepare(context,
    `SELECT id, server_seed AS serverSeed, server_hash AS serverHash, nonce FROM tech_fair_commitments WHERE user_id = ? AND game_key = 'tech-dice' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
  ).bind(userId).first();
  if (existing?.id && existing?.serverSeed && existing?.serverHash) {
    return { id: String(existing.id), serverSeed: String(existing.serverSeed), serverHash: String(existing.serverHash), nonce: Number(existing.nonce) };
  }
  const serverSeed = createServerSeed();
  const serverHash = await sha256(serverSeed);
  const nonce = createNonce();
  const idColumn = await getTableColumn(context, "tech_fair_commitments", "id");
  if (isIntegerPrimaryKey(idColumn)) {
    const insert = await d1Prepare(context,
      `INSERT INTO tech_fair_commitments (user_id, game_key, server_seed, server_hash, nonce, created_at) VALUES (?, 'tech-dice', ?, ?, ?, datetime('now'))`,
    ).bind(userId, serverSeed, serverHash, nonce).run();
    const rowId = insert?.meta?.last_row_id ?? null;
    const row = await d1Prepare(context,
      `SELECT id FROM tech_fair_commitments WHERE user_id = ? AND game_key = 'tech-dice' AND server_hash = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(userId, serverHash).first();
    return { id: String(row?.id ?? rowId ?? ""), serverSeed, serverHash, nonce };
  }

  const id = `dice-${Date.now()}-${crypto.randomUUID?.() || nonce}`;
  await d1Prepare(context,
    `INSERT INTO tech_fair_commitments (id, user_id, game_key, server_seed, server_hash, nonce, created_at) VALUES (?, ?, 'tech-dice', ?, ?, ?, datetime('now'))`,
  ).bind(id, userId, serverSeed, serverHash, nonce).run();
  return { id, serverSeed, serverHash, nonce };
}

async function consumeDiceCommitment(context: any, userId: number, commitmentId: unknown): Promise<FairCommitment> {
  const idColumn = await getTableColumn(context, "tech_fair_commitments", "id");
  const id = normalizeCommitmentIdForSchema(commitmentId, idColumn);
  const existing = id !== null ? await d1Prepare(context,
    `SELECT id, server_seed AS serverSeed, server_hash AS serverHash, nonce FROM tech_fair_commitments WHERE id = ? AND user_id = ? AND game_key = 'tech-dice' AND used_at IS NULL`,
  ).bind(id, userId).first() : null;
  const commitment = existing?.id ? { id: String(existing.id), serverSeed: String(existing.serverSeed), serverHash: String(existing.serverHash), nonce: Number(existing.nonce) } : await getOrCreateDiceCommitment(context, userId);
  await d1Prepare(context, `UPDATE tech_fair_commitments SET used_at = datetime('now') WHERE id = ?`).bind(normalizeCommitmentIdForSchema(commitment.id, idColumn) ?? commitment.id).run();
  return commitment;
}

type D1ColumnInfo = { name: string; type: string; notnull: number; dflt_value: unknown; pk: number };

const DEBUG_D1 = String((globalThis as any)?.process?.env?.DEBUG_D1 || "") === "1";

function d1Prepare(context: any, sql: string) {
  const statement = context.env.DB.prepare(sql);
  const execute = async (method: "run" | "first" | "all", values: unknown[] = []) => {
    const safeValues = values.map(normalizeD1BindValue);
    if (DEBUG_D1) {
      logD1Query(sql, safeValues);
      await logD1ColumnComparison(context, sql, safeValues);
    }
    try {
      const bound = safeValues.length ? statement.bind(...safeValues) : statement;
      return await bound[method]();
    } catch (error) {
      if (DEBUG_D1) console.error("[D1_DEBUG] D1 query failed", {
        sql: compactSql(sql),
        method,
        params: describeD1BindValues(safeValues),
        error: readableError(error),
      });
      throw error;
    }
  };

  return {
    bind: (...values: unknown[]) => ({
      run: () => execute("run", values),
      first: () => execute("first", values),
      all: () => execute("all", values),
    }),
    run: () => execute("run"),
    first: () => execute("first"),
    all: () => execute("all"),
  };
}

function normalizeD1BindValue(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value) || (value && typeof value === "object")) return JSON.stringify(value);
  return value;
}

function logD1Query(sql: string, values: unknown[]) {
  console.info("[D1_DEBUG] query", {
    sql: compactSql(sql),
    params: describeD1BindValues(values),
  });
}

function describeD1BindValues(values: unknown[]) {
  return values.map((value, index) => ({
    index: index + 1,
    type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
    value: redactD1Value(value),
  }));
}

function redactD1Value(value: unknown) {
  if (typeof value !== "string") return value;
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

async function logD1ColumnComparison(context: any, sql: string, values: unknown[]) {
  const insert = parseInsert(sql);
  if (insert) {
    await logTableInfo(context, insert.table);
    const columns = await getTableColumns(context, insert.table);
    console.info("[D1_DEBUG] insert bind/column comparison", {
      table: insert.table,
      comparison: insert.bindColumns.map(({ column, bindIndex }) => describeColumnBind(column, columns.get(column), values[bindIndex])),
    });
    return;
  }

  const update = parseUpdate(sql);
  if (update) {
    await logTableInfo(context, update.table);
    const columns = await getTableColumns(context, update.table);
    console.info("[D1_DEBUG] update bind/column comparison", {
      table: update.table,
      comparison: update.bindColumns.map(({ column, bindIndex }) => describeColumnBind(column, columns.get(column), values[bindIndex])),
    });
  }
}

function describeColumnBind(column: string, info: D1ColumnInfo | undefined, value: unknown) {
  return {
    column,
    columnType: info?.type || "UNKNOWN",
    primaryKey: Number(info?.pk || 0) > 0,
    bindType: value === null ? "null" : typeof value,
    bindValue: redactD1Value(value),
    compatible: info ? isD1TypeCompatible(info.type, value) : false,
  };
}

function isD1TypeCompatible(type: string, value: unknown) {
  if (value === null) return true;
  const normalized = String(type || "").toUpperCase();
  if (normalized.includes("INT")) return typeof value === "number" && Number.isInteger(value);
  if (normalized.includes("REAL") || normalized.includes("FLOA") || normalized.includes("DOUB")) return typeof value === "number" && Number.isFinite(value);
  if (normalized.includes("TEXT") || normalized.includes("CHAR") || normalized.includes("CLOB")) return typeof value === "string";
  if (normalized.includes("BLOB")) return value instanceof ArrayBuffer || ArrayBuffer.isView(value as any);
  return ["string", "number"].includes(typeof value);
}

function parseInsert(sql: string) {
  const normalized = compactSql(sql);
  const match = normalized.match(/^INSERT(?:\s+OR\s+\w+)?\s+INTO\s+(["`\w]+)\s*\(([^)]+)\)\s+VALUES\s*\((.+)\)/i);
  if (!match) return null;
  const columns = splitSqlList(match[2]).map(cleanIdent);
  const valueExpressions = splitSqlList(match[3]);
  let bindIndex = 0;
  const bindColumns = columns.flatMap((column, index) => {
    const expression = valueExpressions[index] || "";
    const placeholders = (expression.match(/\?/g) || []).length;
    if (!placeholders) return [];
    const current = bindIndex;
    bindIndex += placeholders;
    return [{ column, bindIndex: current }];
  });
  return { table: cleanIdent(match[1]), bindColumns };
}

function parseUpdate(sql: string) {
  const normalized = compactSql(sql);
  const match = normalized.match(/^UPDATE\s+(["`\w]+)\s+SET\s+(.+?)\s+WHERE\s+/i) || normalized.match(/^UPDATE\s+(["`\w]+)\s+SET\s+(.+)$/i);
  if (!match) return null;
  let bindIndex = 0;
  const bindColumns = splitSqlList(match[2]).flatMap((part) => {
    const [rawColumn, expression = ""] = part.split("=");
    const column = cleanIdent(rawColumn || "");
    const placeholders = (expression.match(/\?/g) || []).length;
    if (!column || !placeholders || /^[A-Z_]+\(/i.test(column)) {
      bindIndex += placeholders;
      return [];
    }
    const current = bindIndex;
    bindIndex += placeholders;
    return [{ column, bindIndex: current }];
  });
  return { table: cleanIdent(match[1]), bindColumns };
}

function splitSqlList(value: string) {
  const items: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (const character of value) {
    if ((character === "'" || character === '"') && !quote) quote = character;
    else if (character === quote) quote = null;
    else if (!quote && character === "(") depth += 1;
    else if (!quote && character === ")") depth -= 1;
    if (!quote && depth === 0 && character === ",") {
      items.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function cleanIdent(value: string) {
  return value.trim().replace(/^["`]|["`]$/g, "");
}

async function logTableInfo(context: any, table: string) {
  const columns = await getTableColumns(context, table);
  console.info("[D1_DEBUG] PRAGMA table_info", {
    table,
    sql: `PRAGMA table_info(${quoteIdent(table)})`,
    columns: Array.from(columns.values()),
  });
}

const tableInfoCache = new WeakMap<object, Map<string, Map<string, D1ColumnInfo>>>();

async function getTableColumns(context: any, table: string): Promise<Map<string, D1ColumnInfo>> {
  let databaseCache = tableInfoCache.get(context.env.DB);
  if (!databaseCache) {
    databaseCache = new Map();
    tableInfoCache.set(context.env.DB, databaseCache);
  }
  const cached = databaseCache.get(table);
  if (cached) return cached;

  if (!DEBUG_D1) return new Map<string, D1ColumnInfo>();
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  const columns = new Map<string, D1ColumnInfo>();
  for (const row of rows?.results || []) {
    columns.set(String(row.name || ""), {
      name: String(row.name || ""),
      type: String(row.type || ""),
      notnull: Number(row.notnull || 0),
      dflt_value: row.dflt_value,
      pk: Number(row.pk || 0),
    });
  }
  databaseCache.set(table, columns);
  return columns;
}

async function getTableColumn(context: any, table: string, column: string) {
  return (await getTableColumns(context, table)).get(column);
}

function isIntegerPrimaryKey(column: D1ColumnInfo | undefined) {
  return Boolean(column && column.pk > 0 && String(column.type || "").toUpperCase().includes("INT"));
}

function normalizeCommitmentIdForSchema(value: unknown, idColumn: D1ColumnInfo | undefined) {
  if (value === undefined || value === null || value === "") return null;
  if (!isIntegerPrimaryKey(idColumn)) return String(value);
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Sign in required." };

  const user = await d1Prepare(context,
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
  if (!["off", "admin", "owner"].includes(String(user.role)))
    return { ok: false, status: 403, error: "OFF Hub access required." };
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
  return error instanceof Error ? error.message : "Unknown Tech Dice error.";
}
