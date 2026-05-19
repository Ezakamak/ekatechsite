import { requireOffUser, resolveDisplayName } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const incoming = await context.env.DB.prepare(
    `SELECT f.id AS friendship_id, f.requester_id, f.addressee_id, f.created_at, u.id AS user_id, u.name, u.email, op.display_name AS off_display_name,
            COALESCE(op.avatar_url, u.avatar_url) AS avatar_url, op.selected_title, 1 as level, 0 as xp
     FROM off_friendships f
     JOIN users u ON u.id = f.requester_id
     LEFT JOIN off_profiles op ON op.user_id = u.id
     WHERE f.status='pending' AND f.addressee_id=? ORDER BY f.created_at DESC`
  ).bind(uid).all();
  const incomingMeta: any = (incoming as any).meta || {};
  if (typeof incomingMeta.rows_read === "number" && incomingMeta.rows_read > 200) console.warn("[D1][off/friends/requests incoming] high rows_read", incomingMeta.rows_read);

  const outgoing = await context.env.DB.prepare(
    `SELECT f.id AS friendship_id, f.requester_id, f.addressee_id, f.created_at, u.id AS user_id, u.name, u.email, op.display_name AS off_display_name,
            COALESCE(op.avatar_url, u.avatar_url) AS avatar_url, op.selected_title, 1 as level, 0 as xp
     FROM off_friendships f
     JOIN users u ON u.id = f.addressee_id
     LEFT JOIN off_profiles op ON op.user_id = u.id
     WHERE f.status='pending' AND f.requester_id=? ORDER BY f.created_at DESC`
  ).bind(uid).all();
  const outgoingMeta: any = (outgoing as any).meta || {};
  if (typeof outgoingMeta.rows_read === "number" && outgoingMeta.rows_read > 200) console.warn("[D1][off/friends/requests outgoing] high rows_read", outgoingMeta.rows_read);

  const mapItem = (row: any, status: string) => ({
    id: Number(row.user_id),
    displayName: resolveDisplayName(row),
    avatarUrl: row.avatar_url || null,
    level: Number(row.level || 1),
    xp: Number(row.xp || 0),
    selectedTitle: row.selected_title || null,
    friendshipId: Number(row.friendship_id),
    status,
    userId: Number(row.user_id),
  });
  return Response.json({ ok: true, incoming: (incoming.results || []).map((r: any) => mapItem(r, "incoming")), outgoing: (outgoing.results || []).map((r: any) => mapItem(r, "pending")) });
}
