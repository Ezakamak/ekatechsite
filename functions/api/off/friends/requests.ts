import { requireOffUser } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const incoming = await context.env.DB.prepare(
    `SELECT f.id, f.requester_id, f.addressee_id, f.created_at, u.name, u.avatar_url, COALESCE(l.level,1) as level
     FROM off_friendships f
     JOIN users u ON u.id = f.requester_id
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE f.status='pending' AND f.addressee_id=? ORDER BY f.created_at DESC`
  ).bind(uid).all();

  const outgoing = await context.env.DB.prepare(
    `SELECT f.id, f.requester_id, f.addressee_id, f.created_at, u.name, u.avatar_url, COALESCE(l.level,1) as level
     FROM off_friendships f
     JOIN users u ON u.id = f.addressee_id
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE f.status='pending' AND f.requester_id=? ORDER BY f.created_at DESC`
  ).bind(uid).all();

  return Response.json({ ok: true, incoming: incoming.results || [], outgoing: outgoing.results || [] });
}
