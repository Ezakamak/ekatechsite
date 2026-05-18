export type LevelProgress = {
  level: number;
  exp: number;
  currentLevelExp: number;
  nextLevelExp: number;
  expIntoLevel: number;
  expNeededForNext: number;
  verified: boolean;
};

const MAX_LEVEL = 99;
const VERIFIED_LEVEL = 10;

export function expForLevel(level: number) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (safeLevel <= 1) return 0;
  return Math.floor(100 * Math.pow(safeLevel - 1, 1.65) + (safeLevel - 1) * 35);
}

export function levelFromExp(exp: number) {
  const safeExp = Math.max(0, Math.floor(Number(exp) || 0));
  let level = 1;
  while (level < MAX_LEVEL && safeExp >= expForLevel(level + 1)) level += 1;
  return level;
}

export function buildLevelProgress(exp: number): LevelProgress {
  const safeExp = Math.max(0, Math.floor(Number(exp) || 0));
  const level = levelFromExp(safeExp);
  const currentLevelExp = expForLevel(level);
  const nextLevelExp = expForLevel(level + 1);
  return {
    level,
    exp: safeExp,
    currentLevelExp,
    nextLevelExp,
    expIntoLevel: Math.max(0, safeExp - currentLevelExp),
    expNeededForNext: Math.max(0, nextLevelExp - safeExp),
    verified: level >= VERIFIED_LEVEL,
  };
}

export function expForGame(difficulty: string | number = "normal", base = 12) {
  const text = String(difficulty || "normal").toLowerCase();
  const numeric = Number(difficulty);
  let multiplier = 1;
  if (Number.isFinite(numeric) && numeric > 0)
    multiplier = Math.min(3.5, Math.max(0.75, numeric / 8));
  else if (["easy", "low", "kolay"].includes(text)) multiplier = 0.8;
  else if (["medium", "normal", "orta"].includes(text)) multiplier = 1;
  else if (["hard", "high", "zor"].includes(text)) multiplier = 1.45;
  else if (
    ["expert", "insane", "very_hard", "cok_zor", "çok_zor"].includes(text)
  )
    multiplier = 2;
  return Math.max(1, Math.floor(base * multiplier));
}

export async function ensureLevelTables(context: any) {
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS user_levels (
      user_id INTEGER PRIMARY KEY,
      exp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS user_exp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      difficulty TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_user_exp_events_user_created ON user_exp_events(user_id, created_at DESC)`,
  ).run();
}

export async function ensureUserLevel(context: any, userId: number) {
  await ensureLevelTables(context);
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO user_levels (user_id, exp, level, updated_at) VALUES (?, 0, 1, datetime('now'))`,
  )
    .bind(userId)
    .run();
}

export async function getLevelProgress(context: any, userId: number) {
  await ensureUserLevel(context, userId);
  const row: any = await context.env.DB.prepare(
    `SELECT exp, level FROM user_levels WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  const progress = buildLevelProgress(Number(row?.exp || 0));
  if (Number(row?.level || 1) !== progress.level) {
    await context.env.DB.prepare(
      `UPDATE user_levels SET level = ?, updated_at = datetime('now') WHERE user_id = ?`,
    )
      .bind(progress.level, userId)
      .run();
  }
  return progress;
}

export async function awardGameExp(
  context: any,
  userId: number,
  amount: number,
  reason: string,
  difficulty: string | number = "normal",
) {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  await ensureUserLevel(context, userId);
  if (safeAmount <= 0) return getLevelProgress(context, userId);
  const current: any = await context.env.DB.prepare(
    `SELECT exp FROM user_levels WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  const nextExp = Math.max(
    0,
    Math.floor(Number(current?.exp || 0) + safeAmount),
  );
  const nextLevel = levelFromExp(nextExp);
  await context.env.DB.prepare(
    `UPDATE user_levels SET exp = ?, level = ?, updated_at = datetime('now') WHERE user_id = ?`,
  )
    .bind(nextExp, nextLevel, userId)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO user_exp_events (user_id, amount, reason, difficulty, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
  )
    .bind(userId, safeAmount, reason, String(difficulty || "normal"))
    .run();
  return buildLevelProgress(nextExp);
}
