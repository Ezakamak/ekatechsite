import { ensureOffTables, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const url = new URL(context.request.url);
  const metric = url.searchParams.get("metric") || "level";
  const rows = metric === "matches"
    ? await context.env.DB.prepare(`SELECT p.user_id, COALESCE(u.name, p.display_name, 'OFF Player') AS name, p.total_matches AS value, p.wins, p.losses FROM off_user_profiles p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.total_matches DESC, p.wins DESC LIMIT 50`).all()
    : metric === "wins"
      ? await context.env.DB.prepare(`SELECT p.user_id, COALESCE(u.name, p.display_name, 'OFF Player') AS name, p.wins AS value, p.total_matches FROM off_user_profiles p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.wins DESC, p.total_matches DESC LIMIT 50`).all()
      : metric === "season_xp"
        ? await context.env.DB.prepare(`SELECT e.user_id, COALESCE(u.name, 'OFF Player') AS name, SUM(e.amount) AS value FROM user_exp_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.created_at >= COALESCE((SELECT starts_at FROM off_seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1), '1970-01-01') GROUP BY e.user_id ORDER BY value DESC LIMIT 50`).all()
        : metric === "total_xp"
          ? await context.env.DB.prepare(`SELECT l.user_id, COALESCE(u.name, 'OFF Player') AS name, l.exp AS value, l.level FROM user_levels l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.exp DESC LIMIT 50`).all()
          : await context.env.DB.prepare(`SELECT l.user_id, COALESCE(u.name, 'OFF Player') AS name, l.level AS value, l.exp FROM user_levels l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.level DESC, l.exp DESC LIMIT 50`).all();
  const list = rows?.results || [];
  const mineIndex = list.findIndex((row: any) => Number(row.user_id) === Number(auth.user.id));
  return Response.json({ ok: true, metric, leaders: list, me: mineIndex >= 0 ? { rank: mineIndex + 1, ...list[mineIndex] } : null });
}
