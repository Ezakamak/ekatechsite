const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const BETTING_SECONDS = 8;
const CRASHED_SECONDS = 3;
const ROUND_GRACE_MS = CRASHED_SECONDS * 1000;
const MIN_CRASH = 1.0;
const MAX_CRASH = 100.0;
const SCORE_EDGE = 0.03;
const INSTANT_CRASH_MODULO = 33;
const MULTIPLIER_GROWTH = 0.28;
const HASH_SLICE_HEX_CHARS = 13;
const UINT_52_RANGE = 2 ** 52;

type AviatorAction = "join-flight" | "stop-flight" | "place-bet" | "cash-out" | "record-round" | "settle-crash";
type AviatorStatus = "STATUS_BETTING" | "STATUS_FLYING" | "STATUS_CRASHED";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureAviatorTables(context);
    await ensureWallet(context, auth.user.id);
    return Response.json(await buildState(context, auth.user));
  } catch (error) {
    return Response.json({ error: "Tech Aviator canlı SQL round durumu yüklenemedi." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const action = String(body.action || "") as AviatorAction;

  try {
    await ensureAviatorTables(context);
    await ensureWallet(context, auth.user.id);

    if (action === "join-flight" || action === "place-bet") return joinFlight(context, auth.user, body);
    if (action === "stop-flight" || action === "cash-out") return stopFlight(context, auth.user, body);
    if (action === "record-round" || action === "settle-crash") return settleCrashInternal(context, auth.user, body);

    return Response.json({ error: "Bilinmeyen Tech Aviator aksiyonu." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tech Aviator işlemi tamamlanamadı." }, { status: 500 });
  }
}

async function joinFlight(context: any, user: any, body: any) {
  const requestedRoundId = normalizeText(body.roundId, 96);
  const panelId = normalizeText(body.panelId || "main", 48);
  const amount = roundTc(Number(body.amount));
  const now = Date.now();
  const round = await getSharedRound(context, now);
  const runtime = getRoundRuntime(round, now);

  if (!requestedRoundId || requestedRoundId !== round.round_id) return Response.json({ error: "Bu round artık aktif değil; SQL canlı roundu yenilendi." }, { status: 409 });
  if (runtime.status !== "STATUS_BETTING") return Response.json({ error: "Uçuşa katılım süresi kapandı." }, { status: 409 });
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Geçerli bir Tech Coin katılım puanı girin." }, { status: 400 });

  const existing = await context.env.DB.prepare(`SELECT id FROM tech_aviator_bets WHERE user_id = ? AND round_id = ? AND panel_id = ?`).bind(user.id, round.round_id, panelId).first();
  if (existing) return Response.json({ error: "Bu panel için round katılımı zaten kilitlendi." }, { status: 409 });

  const debit = await context.env.DB
    .prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`)
    .bind(amount, user.id, amount)
    .run();

  if ((debit.meta?.changes || 0) < 1) return Response.json({ error: "Yetersiz Tech Coin bakiyesi." }, { status: 402 });

  await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(user.id, -amount, `Tech Aviator uçuş katılımı (${panelId})`).run();
  const insertEntry = await context.env.DB
    .prepare(`INSERT OR IGNORE INTO tech_aviator_bets (user_id, round_id, panel_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`)
    .bind(user.id, round.round_id, panelId, amount)
    .run();

  if ((insertEntry.meta?.changes || 0) < 1) {
    await creditWallet(context, user.id, amount, `Tech Aviator tekrar eden katılım iadesi (${panelId})`);
    return Response.json({ error: "Bu panel için round katılımı zaten kilitlendi." }, { status: 409 });
  }

  return Response.json({ ok: true, entry: { roundId: round.round_id, panelId, amount }, ...(await buildState(context, user)) });
}

async function stopFlight(context: any, user: any, body: any) {
  const requestedRoundId = normalizeText(body.roundId, 96);
  const panelId = normalizeText(body.panelId || "main", 48);
  const now = Date.now();
  const round = await getSharedRound(context, now);
  const runtime = getRoundRuntime(round, now);

  if (!requestedRoundId || requestedRoundId !== round.round_id) return Response.json({ error: "Bu round artık aktif değil; SQL canlı roundu yenilendi." }, { status: 409 });
  if (runtime.status !== "STATUS_FLYING" || runtime.currentMultiplier >= Number(round.crash_point)) return Response.json({ error: "Uçuşu durdurma şu anda uygun değil." }, { status: 409 });

  const bet = await context.env.DB.prepare(`SELECT id, amount, status FROM tech_aviator_bets WHERE user_id = ? AND round_id = ? AND panel_id = ?`).bind(user.id, round.round_id, panelId).first();
  if (!bet || bet.status !== "active") return Response.json({ error: "Aktif uçuş katılımı bulunamadı." }, { status: 409 });

  const payout = roundTc(Number(bet.amount || 0) * runtime.currentMultiplier);
  const updateBet = await context.env.DB
    .prepare(`UPDATE tech_aviator_bets SET status = 'cashed_out', cashout_multiplier = ?, payout = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'`)
    .bind(runtime.currentMultiplier, payout, bet.id)
    .run();

  if ((updateBet.meta?.changes || 0) < 1) return Response.json({ error: "Bu uçuş katılımı daha önce kapatıldı." }, { status: 409 });

  await creditWallet(context, user.id, payout, `Tech Aviator round puanı @ ${runtime.currentMultiplier.toFixed(2)}x`);
  return Response.json({ ok: true, lockedScore: payout, payout, multiplier: runtime.currentMultiplier, ...(await buildState(context, user)) });
}

async function settleCrashInternal(context: any, user: any, body: any) {
  const configuredSecret = String(context.env.TECH_AVIATOR_INTERNAL_SECRET || context.env.TECH_AVIATOR_ADMIN_SECRET || "");
  const providedSecret = String(context.request.headers.get("x-tech-aviator-internal-secret") || body.internalSecret || "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return Response.json({ error: "Bu aksiyon public client üzerinden çalıştırılamaz." }, { status: 403 });
  }

  const requestedRoundId = normalizeText(body.roundId, 96);
  const now = Date.now();
  const round = await getSharedRound(context, now);
  const targetRoundId = requestedRoundId || round.round_id;
  await settleActiveBetsForRound(context, targetRoundId);
  return Response.json({ ok: true, ...(await buildState(context, user)) });
}

async function buildState(context: any, user: any) {
  const now = Date.now();
  const round = await getSharedRound(context, now);
  const runtime = getRoundRuntime(round, now);
  if (runtime.status === "STATUS_CRASHED") await settleActiveBetsForRound(context, round.round_id);

  const wallet = await context.env.DB.prepare(`SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`).bind(user.id).first();
  const transactions = await context.env.DB.prepare(`SELECT id, amount, reason, created_at FROM coin_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 10`).bind(user.id).all();
  const rounds = await context.env.DB.prepare(`SELECT round_id, crash_point, hash, created_at FROM tech_aviator_rounds WHERE crashed_at <= ? ORDER BY betting_started_at DESC LIMIT 10`).bind(now).all();

  return {
    gameState: {
      roundId: round.round_id,
      status: runtime.status,
      salt: runtime.status === "STATUS_CRASHED" ? (round.salt || undefined) : undefined,
      nonce: runtime.status === "STATUS_CRASHED" ? Number(round.nonce || 0) : undefined,
      hash: round.hash || "pending",
      hashInput: runtime.status === "STATUS_CRASHED" && round.server_seed && round.salt ? `${round.server_seed}:${round.salt}:${Number(round.nonce || 0)}` : undefined,
      serverSeed: runtime.status === "STATUS_CRASHED" ? round.server_seed : undefined,
      crashPoint: runtime.status === "STATUS_CRASHED" ? Number(round.crash_point || 1) : undefined,
      currentMultiplier: runtime.currentMultiplier,
      startedAt: Number(round.betting_started_at || now),
      bettingStartedAt: Number(round.betting_started_at || now),
      flightStartedAt: Number(round.flight_started_at || now),
      bettingSeconds: BETTING_SECONDS,
      serverNow: now,
    },
    wallet: {
      userId: String(user.id),
      userName: user.name || "Tech Pilot",
      techCoinBalance: Number(wallet?.balance || 0),
      lifetimeEarned: Number(wallet?.lifetime_earned || 0),
      updatedAt: wallet?.updated_at || null,
      transactionHistory: (transactions?.results || []).map((row: any) => ({
        id: String(row.id),
        type: Number(row.amount || 0) < 0 ? "DEDUCT_BET" : "ADD_WINNING",
        amount: Number(row.amount || 0),
        balanceAfter: Number(wallet?.balance || 0),
        description: row.reason || "Tech Coin işlemi",
        createdAt: row.created_at,
      })),
    },
    recentMultipliers: (rounds?.results || []).map((row: any) => ({
      roundId: row.round_id,
      crashPoint: Number(row.crash_point || 0),
      hash: row.hash || "",
      createdAt: row.created_at,
    })),
  };
}

async function getSharedRound(context: any, now: number): Promise<any> {
  const latest = await context.env.DB.prepare(`SELECT * FROM tech_aviator_rounds ORDER BY betting_started_at DESC, id DESC LIMIT 1`).first();
  if (latest && now < Number(latest.crashed_at || 0) + ROUND_GRACE_MS) return latest;

  if (latest) await settleActiveBetsForRound(context, latest.round_id);
  const created = await createSharedRound(context, latest, now);
  return created || await context.env.DB.prepare(`SELECT * FROM tech_aviator_rounds ORDER BY betting_started_at DESC, id DESC LIMIT 1`).first();
}

async function createSharedRound(context: any, latest: any, now: number) {
  const seed = randomHex(32);
  const salt = randomHex(16);
  const nonce = await createRoundNonce(context, now);
  const hash = await sha256Hex(`${seed}:${salt}:${nonce}`);
  const crashPoint = createCrashPointFromHash(hash);
  const roundId = `sql_${nonce}_${hash.slice(0, 10)}`;
  const bettingStartedAt = Math.max(now, Number(latest?.crashed_at || 0) + ROUND_GRACE_MS);
  const flightStartedAt = bettingStartedAt + BETTING_SECONDS * 1000;
  const crashedAt = flightStartedAt + getFlightDurationMs(crashPoint);

  await context.env.DB.prepare(`INSERT OR IGNORE INTO tech_aviator_rounds (round_id, crash_point, hash, server_seed, salt, nonce, betting_started_at, flight_started_at, crashed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .bind(roundId, crashPoint, hash, seed, salt, nonce, bettingStartedAt, flightStartedAt, crashedAt)
    .run();

  return context.env.DB.prepare(`SELECT * FROM tech_aviator_rounds WHERE round_id = ?`).bind(roundId).first();
}

function getRoundRuntime(round: any, now: number): { status: AviatorStatus; currentMultiplier: number } {
  const flightStartedAt = Number(round.flight_started_at || now + BETTING_SECONDS * 1000);
  const crashedAt = Number(round.crashed_at || flightStartedAt);
  const crashPoint = Number(round.crash_point || 1);

  if (now < flightStartedAt) return { status: "STATUS_BETTING", currentMultiplier: 1 };
  if (now >= crashedAt) return { status: "STATUS_CRASHED", currentMultiplier: roundMultiplier(crashPoint) };

  const elapsedSeconds = Math.max(0, (now - flightStartedAt) / 1000);
  return { status: "STATUS_FLYING", currentMultiplier: roundMultiplier(Math.min(crashPoint, Math.exp(MULTIPLIER_GROWTH * elapsedSeconds))) };
}

function getFlightDurationMs(crashPoint: number) {
  return Math.max(250, Math.ceil((Math.log(Math.max(1.01, crashPoint)) / MULTIPLIER_GROWTH) * 1000));
}

function createCrashPointFromHash(hash: string) {
  const slice = hash.slice(0, HASH_SLICE_HEX_CHARS).padEnd(HASH_SLICE_HEX_CHARS, "0");
  const h = parseInt(slice, 16);
  if (!Number.isFinite(h)) return MIN_CRASH;
  if (h % INSTANT_CRASH_MODULO === 0) return MIN_CRASH;

  const unit = Math.min(0.999999999999999, Math.max(0, h / UINT_52_RANGE));
  const scoreReturn = 1 - SCORE_EDGE;
  const rawMultiplier = scoreReturn / Math.max(1 - unit, 1 / (MAX_CRASH * 100));
  const capped = Math.min(MAX_CRASH, Math.max(MIN_CRASH + 0.01, rawMultiplier));
  return roundMultiplier(capped);
}

async function createRoundNonce(context: any, now: number) {
  const latestId = await context.env.DB.prepare(`SELECT COALESCE(MAX(id), 0) AS max_id FROM tech_aviator_rounds`).first();
  return now * 1000 + Number(latestId?.max_id || 0) + 1;
}

async function settleActiveBetsForRound(context: any, roundId: string) {
  if (!roundId) return;
  await context.env.DB.prepare(`UPDATE tech_aviator_bets SET status = 'lost', updated_at = datetime('now') WHERE round_id = ? AND status = 'active'`).bind(roundId).run();
}

async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`).bind(amount, Math.max(0, amount), userId).run();
  await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(userId, amount, reason).run();
}

async function ensureAviatorTables(context: any) {
  await ensureCoinTables(context);
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS tech_aviator_rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id TEXT UNIQUE NOT NULL, crash_point REAL NOT NULL, hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS tech_aviator_bets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, round_id TEXT NOT NULL, panel_id TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'active', cashout_multiplier REAL, payout REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, round_id, panel_id))`).run();
  await ensureColumn(context, "tech_aviator_rounds", "server_seed", "TEXT");
  await ensureColumn(context, "tech_aviator_rounds", "salt", "TEXT");
  await ensureColumn(context, "tech_aviator_rounds", "nonce", "INTEGER");
  await ensureColumn(context, "tech_aviator_rounds", "betting_started_at", "INTEGER");
  await ensureColumn(context, "tech_aviator_rounds", "flight_started_at", "INTEGER");
  await ensureColumn(context, "tech_aviator_rounds", "crashed_at", "INTEGER");
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_aviator_rounds_timing ON tech_aviator_rounds(betting_started_at, crashed_at)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_aviator_rounds_created ON tech_aviator_rounds(created_at)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_aviator_bets_user_round ON tech_aviator_bets(user_id, round_id)`).run();
}

async function ensureColumn(context: any, table: string, column: string, definition: string) {
  try {
    await context.env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  } catch {
    // Column already exists on deployed D1 databases.
  }
}

async function ensureCoinTables(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance REAL DEFAULT 100, lifetime_earned REAL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`).bind(userId).run();
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!["off", "admin", "owner"].includes(user.role)) return { ok: false, status: 403, error: "OFF erişimi gerekli." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, maxLength);
}

function randomHex(bytes: number) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function roundTc(value: number) {
  return Number(Number(value || 0).toFixed(2));
}

function roundMultiplier(value: number) {
  return Number(Number(value || 0).toFixed(2));
}
