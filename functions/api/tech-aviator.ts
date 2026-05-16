const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

type AviatorAction = "place-bet" | "cash-out" | "record-round" | "settle-crash";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureAviatorTables(context);
    await ensureWallet(context, auth.user.id);
    return Response.json(await buildState(context, auth.user));
  } catch (error) {
    return Response.json({ error: "Tech Aviator canlı cüzdan durumu yüklenemedi." }, { status: 500 });
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

    if (action === "place-bet") return placeBet(context, auth.user, body);
    if (action === "cash-out") return cashOut(context, auth.user, body);
    if (action === "record-round") return recordRound(context, auth.user, body);
    if (action === "settle-crash") return settleCrash(context, auth.user, body);

    return Response.json({ error: "Bilinmeyen Tech Aviator aksiyonu." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tech Aviator işlemi tamamlanamadı." }, { status: 500 });
  }
}

async function placeBet(context: any, user: any, body: any) {
  const roundId = normalizeText(body.roundId, 96);
  const panelId = normalizeText(body.panelId || "main", 48);
  const amount = roundTc(Number(body.amount));

  if (!roundId) return Response.json({ error: "Round bilgisi eksik." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Geçerli bir bahis miktarı girin." }, { status: 400 });

  const existing = await context.env.DB.prepare(`SELECT id FROM tech_aviator_bets WHERE user_id = ? AND round_id = ? AND panel_id = ?`).bind(user.id, roundId, panelId).first();
  if (existing) return Response.json({ error: "Bu panel için round bahsi zaten kilitlendi." }, { status: 409 });

  const debit = await context.env.DB
    .prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`)
    .bind(amount, user.id, amount)
    .run();

  if ((debit.meta?.changes || 0) < 1) return Response.json({ error: "Yetersiz Tech Coin bakiyesi." }, { status: 402 });

  await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(user.id, -amount, `Tech Aviator bahis (${panelId})`).run();
  await context.env.DB.prepare(`INSERT INTO tech_aviator_bets (user_id, round_id, panel_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`).bind(user.id, roundId, panelId, amount).run();

  return Response.json({ ok: true, bet: { roundId, panelId, amount }, ...(await buildState(context, user)) });
}

async function cashOut(context: any, user: any, body: any) {
  const roundId = normalizeText(body.roundId, 96);
  const panelId = normalizeText(body.panelId || "main", 48);
  const multiplier = roundMultiplier(Number(body.multiplier));

  if (!roundId) return Response.json({ error: "Round bilgisi eksik." }, { status: 400 });
  if (!Number.isFinite(multiplier) || multiplier < 1) return Response.json({ error: "Geçersiz çarpan." }, { status: 400 });

  const bet = await context.env.DB.prepare(`SELECT id, amount, status FROM tech_aviator_bets WHERE user_id = ? AND round_id = ? AND panel_id = ?`).bind(user.id, roundId, panelId).first();
  if (!bet || bet.status !== "active") return Response.json({ error: "Aktif bahis bulunamadı." }, { status: 409 });

  const payout = roundTc(Number(bet.amount || 0) * multiplier);
  const updateBet = await context.env.DB
    .prepare(`UPDATE tech_aviator_bets SET status = 'cashed_out', cashout_multiplier = ?, payout = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'`)
    .bind(multiplier, payout, bet.id)
    .run();

  if ((updateBet.meta?.changes || 0) < 1) return Response.json({ error: "Bu bahis daha önce kapatıldı." }, { status: 409 });

  await creditWallet(context, user.id, payout, `Tech Aviator cashout @ ${multiplier.toFixed(2)}x`);
  return Response.json({ ok: true, payout, multiplier, ...(await buildState(context, user)) });
}

async function recordRound(context: any, user: any, body: any) {
  const roundId = normalizeText(body.roundId, 96);
  const crashPoint = roundMultiplier(Number(body.crashPoint));
  const hash = normalizeText(body.hash || "", 128);

  if (!roundId || !Number.isFinite(crashPoint) || crashPoint < 1) return Response.json({ error: "Round sonucu geçersiz." }, { status: 400 });

  await context.env.DB.prepare(`INSERT OR IGNORE INTO tech_aviator_rounds (round_id, crash_point, hash, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(roundId, crashPoint, hash).run();
  await context.env.DB.prepare(`UPDATE tech_aviator_bets SET status = 'lost', updated_at = datetime('now') WHERE user_id = ? AND round_id = ? AND status = 'active'`).bind(user.id, roundId).run();

  return Response.json({ ok: true, ...(await buildState(context, user)) });
}

async function settleCrash(context: any, user: any, body: any) {
  const roundId = normalizeText(body.roundId, 96);
  if (!roundId) return Response.json({ error: "Round bilgisi eksik." }, { status: 400 });
  await context.env.DB.prepare(`UPDATE tech_aviator_bets SET status = 'lost', updated_at = datetime('now') WHERE user_id = ? AND round_id = ? AND status = 'active'`).bind(user.id, roundId).run();
  return Response.json({ ok: true, ...(await buildState(context, user)) });
}

async function buildState(context: any, user: any) {
  const wallet = await context.env.DB.prepare(`SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`).bind(user.id).first();
  const transactions = await context.env.DB.prepare(`SELECT id, amount, reason, created_at FROM coin_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 10`).bind(user.id).all();
  const rounds = await context.env.DB.prepare(`SELECT round_id, crash_point, hash, created_at FROM tech_aviator_rounds ORDER BY id DESC LIMIT 10`).all();

  return {
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

async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`).bind(amount, Math.max(0, amount), userId).run();
  await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(userId, amount, reason).run();
}

async function ensureAviatorTables(context: any) {
  await ensureCoinTables(context);
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS tech_aviator_rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id TEXT UNIQUE NOT NULL, crash_point REAL NOT NULL, hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS tech_aviator_bets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, round_id TEXT NOT NULL, panel_id TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'active', cashout_multiplier REAL, payout REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, round_id, panel_id))`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_aviator_rounds_created ON tech_aviator_rounds(created_at)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_aviator_bets_user_round ON tech_aviator_bets(user_id, round_id)`).run();
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

function roundTc(value: number) {
  return Number(Number(value || 0).toFixed(2));
}

function roundMultiplier(value: number) {
  return Number(Number(value || 0).toFixed(2));
}
