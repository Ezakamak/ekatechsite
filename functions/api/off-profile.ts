import { getWallet } from "../_coinWallet";
import { getLevelProgress } from "../_levels";
import { ensureOffTables, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const profile = await context.env.DB.prepare(`SELECT * FROM off_user_profiles WHERE user_id = ?`).bind(auth.user.id).first();
  const recent = await context.env.DB.prepare(`SELECT m.public_id, m.game_key, p.result, p.score, p.exp_earned, p.points_earned, p.created_at FROM off_match_players p JOIN off_matches m ON m.id = p.match_id WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 10`).bind(auth.user.id).all();
  const topGame = await context.env.DB.prepare(`SELECT m.game_key, COUNT(*) AS plays FROM off_match_players p JOIN off_matches m ON m.id = p.match_id WHERE p.user_id = ? GROUP BY m.game_key ORDER BY plays DESC LIMIT 1`).bind(auth.user.id).first();
  const badges = await context.env.DB.prepare(`SELECT b.*, ub.unlocked_at FROM off_user_badges ub JOIN off_badges b ON b.slug = ub.badge_slug WHERE ub.user_id = ? ORDER BY ub.unlocked_at DESC`).bind(auth.user.id).all();
  const cosmetics = await context.env.DB.prepare(`SELECT c.*, uc.equipped, uc.acquired_at FROM off_user_cosmetics uc JOIN off_cosmetics c ON c.slug = uc.cosmetic_slug WHERE uc.user_id = ? ORDER BY uc.equipped DESC, uc.acquired_at DESC`).bind(auth.user.id).all();
  return Response.json({ ok: true, user: { id: auth.user.id, name: auth.user.name, role: auth.user.role, avatar_url: auth.user.avatar_url }, profile: { ...profile, favorite_game: topGame?.game_key || profile?.favorite_game || null }, level: await getLevelProgress(context, auth.user.id), wallet: await getWallet(context, auth.user.id), recentMatches: recent?.results || [], badges: badges?.results || [], cosmetics: cosmetics?.results || [] });
}
