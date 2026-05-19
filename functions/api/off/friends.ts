import { requireOffUser, resolveDisplayName } from "../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const rows = await context.env.DB.prepare(
    `SELECT f.id, f.requester_id, f.addressee_id, f.updated_at,
            u.id as friend_id, u.name, u.email, op.display_name AS off_display_name,
            COALESCE(op.avatar_url, u.avatar_url) AS avatar_url,
            op.selected_title,
            1 as level,
            0 as xp
     FROM off_friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     LEFT JOIN off_profiles op ON op.user_id = u.id
          WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
     ORDER BY f.updated_at DESC`
  ).bind(uid, uid, uid).all();
  const meta:any=(rows as any).meta||{};
  if (typeof meta.rows_read === "number" && meta.rows_read > 200) console.warn("[D1][off/friends] high rows_read", meta.rows_read);

  const friends = (rows.results || []).map((row: any) => ({
    id: Number(row.friend_id),
    displayName: resolveDisplayName({ ...row, id: row.friend_id }),
    avatarUrl: row.avatar_url || null,
    level: Number(row.level || 1),
    xp: Number(row.xp || 0),
    selectedTitle: row.selected_title || null,
    friendshipId: Number(row.id),
    status: "accepted",
  }));
  return Response.json({ ok: true, friends });
}
