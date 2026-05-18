import { ensureOffTables, requireAdminUser } from "../../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireAdminUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const [profiles, matches, quests, badges, cosmetics, events, seasons] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_user_profiles`).first(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_matches`).first(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_quests WHERE is_active = 1`).first(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_badges WHERE is_active = 1`).first(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_cosmetics WHERE is_active = 1`).first(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_events WHERE is_active = 1`).first(),
    context.env.DB.prepare(`SELECT * FROM off_seasons ORDER BY id DESC LIMIT 10`).all(),
  ]);
  const suspicious = await context.env.DB.prepare(`SELECT m.public_id, m.game_key, p.user_id, p.score, p.points_earned, p.created_at FROM off_match_players p JOIN off_matches m ON m.id = p.match_id WHERE p.score > 100000 OR p.points_earned > 100000 ORDER BY p.created_at DESC LIMIT 25`).all();
  const recentMatches = await context.env.DB.prepare(`SELECT m.public_id, m.game_key, p.user_id, p.result, p.score, p.exp_earned, p.points_earned, p.created_at FROM off_match_players p JOIN off_matches m ON m.id = p.match_id ORDER BY p.id DESC LIMIT 25`).all();
  return Response.json({ ok: true, stats: { profiles: Number(profiles?.count || 0), matches: Number(matches?.count || 0), quests: Number(quests?.count || 0), badges: Number(badges?.count || 0), cosmetics: Number(cosmetics?.count || 0), events: Number(events?.count || 0) }, seasons: seasons?.results || [], recentMatches: recentMatches?.results || [], suspiciousScores: suspicious?.results || [] });
}

export async function onRequestPost(context: any) {
  const auth = await requireAdminUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  await ensureOffTables(context);
  if (body?.type === "toggle") {
    const table = { quest: "off_quests", badge: "off_badges", cosmetic: "off_cosmetics", event: "off_events" }[String(body.kind)] as string | undefined;
    if (!table) return Response.json({ error: "Geçersiz OFF içerik türü." }, { status: 400 });
    await context.env.DB.prepare(`UPDATE ${table} SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE slug = ?`).bind(body.slug).run();
    return Response.json({ ok: true });
  }
  return Response.json({ ok: true });
}
