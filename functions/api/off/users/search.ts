import { requireOffUser, resolveDisplayName } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const q = String(new URL(context.request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ ok: true, users: [] });

  const rows = await context.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.display_name, op.display_name AS off_display_name,
            COALESCE(op.avatar_url, u.avatar_url) AS avatar_url,
            op.selected_title,
            COALESCE(l.level, 1) as level,
            COALESCE(l.xp, 0) as xp,
            (
              SELECT status FROM off_friendships f
              WHERE (f.requester_id=? AND f.addressee_id=u.id) OR (f.requester_id=u.id AND f.addressee_id=?)
              ORDER BY f.id DESC LIMIT 1
            ) AS friendship_status
     FROM users u
     LEFT JOIN off_profiles op ON op.user_id = u.id
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE u.id != ? AND (
       lower(COALESCE(op.display_name, '')) LIKE ? OR
       lower(COALESCE(u.username, '')) LIKE ? OR
       lower(COALESCE(u.display_name, '')) LIKE ? OR
       lower(COALESCE(u.name, '')) LIKE ?
     )
     ORDER BY COALESCE(op.display_name, u.username, u.display_name, u.name) ASC
     LIMIT 20`
  ).bind(uid, uid, uid, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`).all();

  const users = (rows.results || []).map((row: any) => ({
    id: Number(row.id),
    displayName: resolveDisplayName(row),
    avatarUrl: row.avatar_url || null,
    level: Number(row.level || 1),
    xp: Number(row.xp || 0),
    selectedTitle: row.selected_title || null,
    friendshipStatus: row.friendship_status || "none",
  }));

  return Response.json({ ok: true, users });
}
