export async function ensureCoinTables(context: any) {
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_wallets (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 100,
      lifetime_earned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await addColumnIfMissing(context, "coin_wallets", "balance", "INTEGER DEFAULT 100");
  await addColumnIfMissing(context, "coin_wallets", "lifetime_earned", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "coin_wallets", "updated_at", "TEXT");
  await addColumnIfMissing(context, "coin_transactions", "amount", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "coin_transactions", "reason", "TEXT");
  await addColumnIfMissing(context, "coin_transactions", "created_at", "TEXT");
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created ON coin_transactions(user_id, created_at DESC)`,
  ).run();
}

export async function ensureWallet(context: any, userId: number) {
  await ensureCoinTables(context);
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at)
     VALUES (?, 100, 0, datetime('now'))`,
  )
    .bind(userId)
    .run();
  await context.env.DB.prepare(
    `UPDATE coin_wallets
     SET balance = COALESCE(balance, 100),
         lifetime_earned = COALESCE(lifetime_earned, 0),
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE user_id = ?`,
  )
    .bind(userId)
    .run();
}

export async function getWallet(context: any, userId: number) {
  await ensureWallet(context, userId);
  const wallet = await context.env.DB.prepare(
    `SELECT COALESCE(balance, 0) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, updated_at
     FROM coin_wallets WHERE user_id = ?`,
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

export async function creditTechCoins(context: any, userId: number, amount: number, reason: string) {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  await ensureWallet(context, userId);
  if (safeAmount <= 0) return getWallet(context, userId);
  await context.env.DB.prepare(
    `UPDATE coin_wallets
     SET balance = COALESCE(balance, 0) + ?,
         lifetime_earned = COALESCE(lifetime_earned, 0) + ?,
         updated_at = datetime('now')
     WHERE user_id = ?`,
  )
    .bind(safeAmount, safeAmount, userId)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
    .bind(userId, safeAmount, reason)
    .run();
  return getWallet(context, userId);
}

export async function debitTechCoins(context: any, userId: number, amount: number, reason: string) {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  await ensureWallet(context, userId);
  const debit = await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now')
     WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
  )
    .bind(safeAmount, userId, safeAmount)
    .run();
  if ((debit.meta?.changes || 0) < 1) return { ok: false, wallet: await getWallet(context, userId) };
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
    .bind(userId, -safeAmount, reason)
    .run();
  return { ok: true, wallet: await getWallet(context, userId) };
}

export async function addColumnIfMissing(context: any, table: string, column: string, definition: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  const exists = (rows?.results || []).some((row: any) => String(row.name) === column);
  if (!exists) {
    await context.env.DB.prepare(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`).run();
  }
}

export function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
