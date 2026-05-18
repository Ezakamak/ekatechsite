import { requireOffUser, resolveDisplayName } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const incoming = await context.env.DB.prepare(
    `SELECT f.id, f.requester_id, f.addressee_id, f.created_at, u.id, u.name, u.username, u.display_name, op.display_name AS off_display_name,
            COALESCE(op.avatar_url, u.avatar_url) AS avatar_url, op.selected_title, COALESCE(l.level,1) as level, COALESCE(l.xp,0) as xp
     FROM off_friendships f
     JOIN users u ON u.id = f.requester_id
     LEFT JOIN off_profiles op ON op.user_id = u.id
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE f.status='pending' AND f.addressee_id=? ORDER BY f.created_at DESC`
  ).bind(uid).all();

  const outgoing = await context.env.DB.prepare(
    `SELECT f.id, f.requester_id, f.addressee_id, f.created_at, u.id, u.name, u.username, u.display_name, op.display_name AS off_display_name,
            COALESCE(op.avatar_url, u.avatar_url) AS avatar_url, op.selected_title, COALESCE(l.level,1) as level, COALESCE(l.xp,0) as xp
     FROM off_friendships f
     JOIN users u ON u.id = f.addressee_id
     LEFT JOIN off_profiles op ON op.user_id = u.id
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE f.status='pending' AND f.requester_id=? ORDER BY f.created_at DESC`
  ).bind(uid).all();

  const mapItem = (row: any, status: string) => ({
    id: Number(row.id),
    displayName: resolveDisplayName(row),
    avatarUrl: row.avatar_url || null,
    level: Number(row.level || 1),
    xp: Number(row.xp || 0),
    selectedTitle: row.selected_title || null,
    friendshipId: Number(row.id),
    status,
    userId: Number(status === "incoming" ? row.requester_id : row.addressee_id),
  });
  return Response.json({ ok: true, incoming: (incoming.results || []).map((r: any) => mapItem(r, "incoming")), outgoing: (outgoing.results || []).map((r: any) => mapItem(r, "pending")) });
}
