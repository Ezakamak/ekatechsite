const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureTechCoinTables(context);
    await ensureWallet(context, auth.user.id);
    await migrateLegacyCoinWalletIfNeeded(context, auth.user.id);

    const wallet = await getWallet(context, auth.user.id);
    const recent = await context.env.DB
      .prepare(`
        SELECT amount, event_type AS reason, details, created_at
        FROM tech_coin_events
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 5
      `)
      .bind(auth.user.id)
      .all();

    return Response.json({
      currency: "Tech Coin",
      symbol: "TC",
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      lifetime_spent: Number(wallet?.lifetime_spent || 0),
      best_round: Number(wallet?.best_round || 0),
      perfect_clears: Number(wallet?.perfect_clears || 0),
      total_rounds: Number(wallet?.total_rounds || 0),
      updated_at: wallet?.updated_at || null,
      recent: recent?.results || [],
      source: "tech_coin_wallets",
    });
  } catch (error) {
    return Response.json({
      currency: "Tech Coin",
      symbol: "TC",
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      updated_at: null,
      recent: [],
      error: error instanceof Error ? error.message : "Tech Coin cüzdanı okunamadı.",
    }, { status: 500 });
  }
}

async function ensureTechCoinTables(context: any) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS tech_coin_wallets (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 100,
      lifetime_earned INTEGER DEFAULT 0,
      lifetime_spent INTEGER DEFAULT 0,
      best_round INTEGER DEFAULT 0,
      perfect_clears INTEGER DEFAULT 0,
      total_rounds INTEGER DEFAULT 0,
      updated_at TEXT
    )
  `).run();

  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS tech_coin_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      round_gain INTEGER DEFAULT 0,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await addColumnIfMissing(context, "tech_coin_wallets", "balance", "INTEGER DEFAULT 100");
  await addColumnIfMissing(context, "tech_coin_wallets", "lifetime_earned", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "lifetime_spent", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "best_round", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "perfect_clears", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "total_rounds", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "updated_at", "TEXT");

  await addColumnIfMissing(context, "tech_coin_events", "event_type", "TEXT DEFAULT ''");
  await addColumnIfMissing(context, "tech_coin_events", "amount", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_events", "balance_after", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_events", "round_gain", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_events", "details", "TEXT");
  await addColumnIfMissing(context, "tech_coin_events", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(`
    INSERT OR IGNORE INTO tech_coin_wallets (user_id, balance, lifetime_earned, lifetime_spent, best_round, perfect_clears, total_rounds, updated_at)
    VALUES (?, 100, 0, 0, 0, 0, 0, datetime('now'))
  `).bind(userId).run();

  await context.env.DB.prepare(`
    UPDATE tech_coin_wallets
    SET
      balance = COALESCE(balance, 100),
      lifetime_earned = COALESCE(lifetime_earned, 0),
      lifetime_spent = COALESCE(lifetime_spent, 0),
      best_round = COALESCE(best_round, 0),
      perfect_clears = COALESCE(perfect_clears, 0),
      total_rounds = COALESCE(total_rounds, 0),
      updated_at = COALESCE(updated_at, datetime('now'))
    WHERE user_id = ?
  `).bind(userId).run();
}

async function migrateLegacyCoinWalletIfNeeded(context: any, userId: number) {
  try {
    const legacy = await context.env.DB.prepare(`
      SELECT COALESCE(balance, 0) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, updated_at
      FROM coin_wallets
      WHERE user_id = ?
    `).bind(userId).first();

    if (!legacy) return;

    const current = await getWallet(context, userId);
    const currentBalance = Number(current?.balance || 0);
    const currentEarned = Number(current?.lifetime_earned || 0);
    const currentSpent = Number(current?.lifetime_spent || 0);
    const legacyBalance = Number(legacy.balance || 0);
    const legacyEarned = Number(legacy.lifetime_earned || 0);

    const looksUnusedDefault = currentBalance === 100 && currentEarned === 0 && currentSpent === 0;
    const shouldImportLegacy = looksUnusedDefault && legacyBalance !== 0;

    if (!shouldImportLegacy) return;

    await context.env.DB.prepare(`
      UPDATE tech_coin_wallets
      SET balance = ?, lifetime_earned = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(legacyBalance, legacyEarned, userId).run();

    await context.env.DB.prepare(`
      INSERT INTO tech_coin_events (user_id, event_type, amount, balance_after, round_gain, details)
      VALUES (?, 'legacy_coin_wallet_import', 0, ?, 0, 'Imported old coin_wallets balance into canonical Tech Coin wallet')
    `).bind(userId, legacyBalance).run();
  } catch {
    // Legacy coin_wallets may not exist. Canonical wallet is tech_coin_wallets.
  }
}

async function getWallet(context: any, userId: number) {
  return await context.env.DB.prepare(`
    SELECT
      user_id,
      COALESCE(balance, 100) AS balance,
      COALESCE(lifetime_earned, 0) AS lifetime_earned,
      COALESCE(lifetime_spent, 0) AS lifetime_spent,
      COALESCE(best_round, 0) AS best_round,
      COALESCE(perfect_clears, 0) AS perfect_clears,
      COALESCE(total_rounds, 0) AS total_rounds,
      updated_at
    FROM tech_coin_wallets
    WHERE user_id = ?
  `).bind(userId).first();
}

async function addColumnIfMissing(context: any, table: string, column: string, definition: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  const exists = (rows?.results || []).some((row: any) => String(row.name || "") === column);
  if (!exists) await context.env.DB.prepare(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`).run();
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
