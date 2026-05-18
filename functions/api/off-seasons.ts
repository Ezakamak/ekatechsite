import { ensureOffTables, requireAdminUser, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const active: any = await context.env.DB.prepare(`SELECT * FROM off_seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1`).first();
  const seasonXp = active ? await context.env.DB.prepare(`SELECT COALESCE(SUM(amount), 0) AS xp FROM user_exp_events WHERE user_id = ? AND created_at BETWEEN ? AND ?`).bind(auth.user.id, active.starts_at, active.ends_at).first() : { xp: 0 };
  const rankRows = active ? await context.env.DB.prepare(`SELECT user_id, SUM(amount) AS xp FROM user_exp_events WHERE created_at BETWEEN ? AND ? GROUP BY user_id ORDER BY xp DESC`).bind(active.starts_at, active.ends_at).all() : { results: [] };
  const rank = (rankRows?.results || []).findIndex((row: any) => Number(row.user_id) === Number(auth.user.id)) + 1;
  return Response.json({ ok: true, activeSeason: active || null, userSeasonXp: Number(seasonXp?.xp || 0), userRank: rank || null });
}

export async function onRequestPost(context: any) {
  const auth = await requireAdminUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  await ensureOffTables(context);
  if (body?.activateSlug) {
    await context.env.DB.prepare(`UPDATE off_seasons SET is_active = 0, updated_at = datetime('now')`).run();
    await context.env.DB.prepare(`UPDATE off_seasons SET is_active = 1, updated_at = datetime('now') WHERE slug = ?`).bind(body.activateSlug).run();
    return Response.json({ ok: true });
  }
  await context.env.DB.prepare(`INSERT INTO off_seasons (slug, name_tr, name_en, starts_at, ends_at, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
    .bind(body.slug, body.name_tr, body.name_en || body.name_tr, body.starts_at, body.ends_at, body.is_active ? 1 : 0).run();
  return Response.json({ ok: true });
}
