export async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`,
  ).bind(userId).run();
}

export async function getWallet(context: any, userId: number) {
  const wallet = await context.env.DB.prepare(
    `SELECT COALESCE(balance, 0) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`,
  ).bind(userId).first();

  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Number(wallet?.balance || 0),
    lifetime_earned: Number(wallet?.lifetime_earned || 0),
    updated_at: wallet?.updated_at || null,
  };
}

export async function insertCoinTransaction(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  ).bind(userId, amount, reason).run();
}

export async function debitWalletAtomic(context: any, userId: number, amount: number, reason: string) {
  const debit = await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
  ).bind(amount, userId, amount).run();

  if ((debit.meta?.changes || 0) < 1) return false;
  await insertCoinTransaction(context, userId, -amount, reason);
  return true;
}

export async function creditWallet(context: any, userId: number, amount: number, reason: string) {
  await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`,
  ).bind(amount, amount, userId).run();
  await insertCoinTransaction(context, userId, amount, reason);
}
