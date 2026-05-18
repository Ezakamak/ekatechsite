import { requireOffUser } from "../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const rows = await context.env.DB.prepare(
    `SELECT f.id, f.requester_id, f.addressee_id, f.updated_at,
            u.id as friend_id, u.name, u.avatar_url, COALESCE(l.level, 1) as level
     FROM off_friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
     ORDER BY f.updated_at DESC`
  ).bind(uid, uid, uid).all();

  return Response.json({ ok: true, friends: rows.results || [] });
}
