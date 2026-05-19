import { requireOffSocialUser, resolveDisplayName, ensureOffPresenceTable, touchOffPresence } from "../../../_offFriends";

export async function onRequestGet(context: any) {
  try {
    const auth = await requireOffSocialUser(context);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const uid = Number(auth.user.id);

    await ensureOffPresenceTable(context);
    await touchOffPresence(context, uid);
    await ensureOffProfilesSchema(context);

    const rows = await context.env.DB.prepare(
      `SELECT u.id, u.name, u.display_name, u.email,
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
      ORDER BY COALESCE(op.display_name, u.display_name, u.name, u.email) ASC
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
        secondaryLabel: row.display_name || row.email || null,
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
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Kullanıcı listesi yüklenemedi." }, 500);
  }
}

async function ensureOffProfilesSchema(context: any) {
  const tableExists = await context.env.DB.prepare(
    `SELECT 1 AS exists_flag FROM sqlite_master WHERE type='table' AND name='off_profiles' LIMIT 1`
  ).first<any>();

  if (!tableExists) {
    await context.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS off_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        display_name TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        bio TEXT,
        selected_title TEXT,
        selected_badge TEXT,
        avatar_data TEXT,
        banner_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    return;
  }

  await context.env.DB.prepare(`ALTER TABLE off_profiles ADD COLUMN avatar_data TEXT`).run().catch(() => null);
  await context.env.DB.prepare(`ALTER TABLE off_profiles ADD COLUMN banner_data TEXT`).run().catch(() => null);
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
