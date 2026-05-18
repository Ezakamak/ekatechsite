import { ensureOffTables, requireOffUser } from "../_offMigrations";
import { recordOffMatch } from "../_offMatches";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const rows = await context.env.DB.prepare(`SELECT m.public_id, m.game_key, m.status, m.ended_at, p.result, p.score, p.exp_earned, p.points_earned, p.stats_json FROM off_match_players p JOIN off_matches m ON m.id = p.match_id WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 50`).bind(auth.user.id).all();
  return Response.json({ ok: true, matches: rows?.results || [] });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  return Response.json({ ok: true, ...(await recordOffMatch(context, auth.user.id, body)) });
}
