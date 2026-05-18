import { requireOffUser, resolveDisplayName } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const userId = Number(context.params.userId || 0);
  if (!userId) return Response.json({ error: "Invalid userId" }, { status: 400 });
  const row = await context.env.DB.prepare(`
    SELECT u.id, u.name, u.username, u.display_name, op.display_name AS off_display_name,
           op.avatar_url, op.banner_url, op.avatar_data, op.banner_data, op.bio, op.selected_title, op.selected_badge,
           COALESCE(l.level,1) AS level, COALESCE(l.xp,0) AS xp,
           (SELECT status FROM off_friendships f WHERE (f.requester_id=? AND f.addressee_id=u.id) OR (f.requester_id=u.id AND f.addressee_id=?) ORDER BY f.id DESC LIMIT 1) AS friendship_status
    FROM users u
    LEFT JOIN off_profiles op ON op.user_id=u.id
    LEFT JOIN user_levels l ON l.user_id=u.id
    WHERE u.id=?
  `).bind(uid, uid, userId).first<any>();
  if (!row) return Response.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  return Response.json({ ok: true, profile: {
    userId: Number(row.id), displayName: resolveDisplayName(row), avatarUrl: row.avatar_data || row.avatar_url || null,
    bannerUrl: row.banner_data || row.banner_url || null, bio: row.bio || null, selectedTitle: row.selected_title || null,
    selectedBadge: row.selected_badge || null, level: Number(row.level || 1), xp: Number(row.xp || 0), friendshipStatus: row.friendship_status || "none",
  } });
}
