import { creditTechCoins } from "./_coinWallet";
import { awardGameExp } from "./_levels";
import { ensureOffTables } from "./_offMigrations";
import { unlockBadge } from "./_offAchievements";

export type OffQuestEvent = {
  type: "play_game" | "win_game" | "earn_xp" | "use_feature" | "daily_login";
  gameKey?: string;
  amount?: number;
};

export function getTurkeyDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}.${values.month}.${values.day}`;
}

export function getIsoWeekKey(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodKeyForQuest(type: string) {
  if (type === "weekly") return getIsoWeekKey();
  if (type === "seasonal") return "seasonal";
  if (type === "event") return "event";
  return getTurkeyDayKey();
}

export async function advanceQuestProgress(context: any, userId: number, event: OffQuestEvent) {
  await ensureOffTables(context);
  const quests = await context.env.DB.prepare(
    `SELECT * FROM off_quests WHERE is_active = 1 AND target_type = ? AND (target_game IS NULL OR target_game = ?)`
  ).bind(event.type, event.gameKey || null).all();
  const updates: any[] = [];
  const increment = Math.max(1, Math.floor(Number(event.amount || 1)));
  for (const quest of quests?.results || []) {
    const periodKey = periodKeyForQuest(String(quest.type || "daily"));
    await context.env.DB.prepare(
      `INSERT OR IGNORE INTO off_user_quest_progress (user_id, quest_slug, period_key, current_count, target_count, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, datetime('now'), datetime('now'))`
    ).bind(userId, quest.slug, periodKey, Number(quest.target_count || 1)).run();
    const before: any = await context.env.DB.prepare(
      `SELECT current_count, target_count, completed_at, claimed_at FROM off_user_quest_progress WHERE user_id = ? AND quest_slug = ? AND period_key = ?`
    ).bind(userId, quest.slug, periodKey).first();
    if (before?.completed_at) {
      updates.push({ questSlug: quest.slug, currentCount: Number(before.current_count || 0), targetCount: Number(before.target_count || quest.target_count || 1), completed: true, claimed: Boolean(before.claimed_at) });
      continue;
    }
    const nextCount = Math.min(Number(before?.target_count || quest.target_count || 1), Number(before?.current_count || 0) + increment);
    const completed = nextCount >= Number(before?.target_count || quest.target_count || 1);
    await context.env.DB.prepare(
      `UPDATE off_user_quest_progress SET current_count = ?, completed_at = CASE WHEN ? THEN COALESCE(completed_at, datetime('now')) ELSE completed_at END, updated_at = datetime('now')
       WHERE user_id = ? AND quest_slug = ? AND period_key = ?`
    ).bind(nextCount, completed ? 1 : 0, userId, quest.slug, periodKey).run();
    updates.push({ questSlug: quest.slug, title: quest.title_tr, currentCount: nextCount, targetCount: Number(quest.target_count || 1), completed, claimed: false });
  }
  return updates;
}

export async function claimQuest(context: any, userId: number, questSlug: string, periodKey?: string) {
  await ensureOffTables(context);
  const quest: any = await context.env.DB.prepare(`SELECT * FROM off_quests WHERE slug = ? AND is_active = 1`).bind(questSlug).first();
  if (!quest) throw new Error("Görev bulunamadı.");
  const key = periodKey || periodKeyForQuest(String(quest.type || "daily"));
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO off_user_quest_progress (user_id, quest_slug, period_key, current_count, target_count, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, NULL, datetime('now'), datetime('now'))`
  ).bind(userId, questSlug, key, Number(quest.target_count || 1)).run();
  const progress: any = await context.env.DB.prepare(`SELECT * FROM off_user_quest_progress WHERE user_id = ? AND quest_slug = ? AND period_key = ?`).bind(userId, questSlug, key).first();
  if (!progress?.completed_at && Number(progress?.current_count || 0) < Number(progress?.target_count || quest.target_count || 1)) throw new Error("Görev henüz tamamlanmadı.");
  if (progress?.claimed_at) throw new Error("Bu görev ödülü zaten claim edildi.");
  const claim = await context.env.DB.prepare(
    `UPDATE off_user_quest_progress SET claimed_at = datetime('now'), updated_at = datetime('now')
     WHERE user_id = ? AND quest_slug = ? AND period_key = ? AND claimed_at IS NULL`
  ).bind(userId, questSlug, key).run();
  if ((claim.meta?.changes || 0) < 1) throw new Error("Bu görev ödülü zaten claim edildi.");
  const level = Number(quest.reward_exp || 0) > 0 ? await awardGameExp(context, userId, Number(quest.reward_exp || 0), `OFF Quest: ${questSlug}`, "quest") : null;
  const wallet = Number(quest.reward_points || 0) > 0 ? await creditTechCoins(context, userId, Number(quest.reward_points || 0), `OFF Quest: ${questSlug}`) : null;
  const badges = quest.reward_badge_slug ? [await unlockBadge(context, userId, String(quest.reward_badge_slug), "quest")].filter(Boolean) : [];
  return { questSlug, periodKey: key, level, wallet, unlockedBadges: badges };
}
