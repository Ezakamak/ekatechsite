import { requireOffSocialUser, resolveDisplayName, touchOffPresence } from "../../../_offFriends";

const PAGE_SIZE = 20;

export async function onRequestGet(context: any) {
  try {
    const auth = await requireOffSocialUser(context);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const uid = Number(auth.user.id);

    if (context.request.headers.get("x-off-presence-ping") === "1") {
      await touchOffPresence(context, uid);
    }

    const page = Math.max(1, Number(new URL(context.request.url).searchParams.get("page") || "1"));
    const offset = (page - 1) * PAGE_SIZE;

    const rows = await context.env.DB.prepare(
      `SELECT u.id, u.name, u.nickname,
              op.display_name AS off_display_name,
              COALESCE(op.avatar_url, u.avatar_url) AS avatar_url,
              op.selected_title,
              p.last_seen_at
      FROM users u
      LEFT JOIN off_user_presence p ON p.user_id = u.id
      LEFT JOIN off_profiles op ON op.user_id = u.id
      LEFT JOIN off_friendships f1 ON f1.requester_id=? AND f1.addressee_id=u.id
      LEFT JOIN off_friendships f2 ON f2.addressee_id=? AND f2.requester_id=u.id
      WHERE u.id != ?
        AND COALESCE(lower(u.role), 'client') != 'blocked'
        AND lower(COALESCE(u.email, '')) NOT LIKE '%@ekatech.local'
        AND upper(COALESCE(u.name, '')) NOT LIKE '%BOT%'
        AND COALESCE(lower(u.role), 'client') NOT IN ('bot', 'system', 'test')
        AND COALESCE(f1.status, f2.status, 'none') NOT IN ('accepted', 'pending', 'blocked')
      ORDER BY COALESCE(op.display_name, u.nickname, u.name, CAST(u.id AS TEXT)) ASC
      LIMIT ? OFFSET ?`
    ).bind(uid, uid, uid, PAGE_SIZE, offset).all<any>();
    const meta:any=(rows as any).meta||{};
    if (typeof meta.rows_read === "number" && meta.rows_read > 200) console.warn("[D1][off/users/online] high rows_read", meta.rows_read);

    const users = (rows.results || []).map((row: any) => ({
      id: Number(row.id),
      displayName: resolveDisplayName(row) || `Kullanıcı #${Number(row.id)}`,
      avatarUrl: row.avatar_url || null,
      level: 1,
      xp: 0,
      selectedTitle: row.selected_title || null,
      friendshipStatus: "none",
      secondaryLabel: null,
      lastSeenAt: row.last_seen_at || null,
      isOnline: Boolean(row.last_seen_at),
    }));

    return json({ ok: true, users, listMode: "all-addable-users", requiresActivePresence: false, page, pageSize: PAGE_SIZE });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Kullanıcı listesi yüklenemedi." }, 500);
  }
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
