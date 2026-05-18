import { checkAndUnlockBadges } from "../_offAchievements";
import { ensureOffTables, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  await checkAndUnlockBadges(context, auth.user.id, { source: "badges-page" });
  const badges = await context.env.DB.prepare(`SELECT b.*, ub.unlocked_at, ub.source FROM off_badges b LEFT JOIN off_user_badges ub ON ub.badge_slug = b.slug AND ub.user_id = ? WHERE b.is_active = 1 ORDER BY CASE b.rarity WHEN 'legendary' THEN 1 WHEN 'epic' THEN 2 WHEN 'rare' THEN 3 ELSE 4 END, b.id`).bind(auth.user.id).all();
  return Response.json({ ok: true, badges: badges?.results || [] });
}
