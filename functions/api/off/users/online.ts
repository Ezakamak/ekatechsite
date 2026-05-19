import { requireOffSocialUser, resolveDisplayName, ensureOffPresenceTable, touchOffPresence } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffSocialUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const uid = Number(auth.user.id);

  await ensureOffPresenceTable(context);
  await touchOffPresence(context, uid);

  const rows = await context.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.display_name, u.email,
            op.display_name AS off_display_name,
            COALESCE(op.avatar_data, op.avatar_url, u.avatar_url) AS avatar_url,
            op.selected_title,
            COALESCE(l.level, 1) as level,
            COALESCE(l.xp, 0) as xp,
            p.last_seen_at,
            (
              SELECT status FROM off_friendships f
              WHERE (f.requester_id=? AND f.addressee_id=u.id) OR (f.requester_id=u.id AND f.addressee_id=?)
              ORDER BY f.id DESC LIMIT 1
            ) AS friendship_status
     FROM users u
     LEFT JOIN off_user_presence p ON p.user_id = u.id
     LEFT JOIN off_profiles op ON op.user_id = u.id
     LEFT JOIN user_levels l ON l.user_id = u.id
     WHERE u.id != ?
       AND COALESCE(lower(u.role), 'client') != 'blocked'
     ORDER BY COALESCE(op.display_name, u.username, u.display_name, u.name, u.email) ASC
     LIMIT 100`
  ).bind(uid, uid, uid).all();

  const allRows = rows.results || [];
  const users = allRows
    .filter((row: any) => !["accepted", "pending", "blocked"].includes(String(row.friendship_status || "none")))
    .map((row: any) => ({
      id: Number(row.id),
      displayName: resolveDisplayName(row),
      avatarUrl: row.avatar_url || null,
      level: Number(row.level || 1),
      xp: Number(row.xp || 0),
      selectedTitle: row.selected_title || null,
      friendshipStatus: row.friendship_status || "none",
      secondaryLabel: row.username || row.email || null,
      lastSeenAt: row.last_seen_at || null,
      isOnline: Boolean(row.last_seen_at),
    }));

  return json({
    ok: true,
    users,
    listMode: "all-addable-users",
    requiresActivePresence: false,
    countBeforeFriendshipFilter: allRows.length,
    countAfterFriendshipFilter: users.length,
  });
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
