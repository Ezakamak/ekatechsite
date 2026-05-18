import { requireOffUser } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const q = String(new URL(context.request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ ok: true, users: [] });

  const rows = await context.env.DB.prepare(
    `SELECT u.id, u.name as username, u.avatar_url, COALESCE(l.level, 1) as level
     FROM users u
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE u.id != ? AND lower(u.name) LIKE ?
     ORDER BY u.name ASC
     LIMIT 20`
  ).bind(uid, `%${q.toLowerCase()}%`).all();

  return Response.json({ ok: true, users: rows.results || [] });
}
