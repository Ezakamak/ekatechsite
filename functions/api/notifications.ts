const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const user = await requireUser(context);
  if (!user.ok) return Response.json({ error: user.error }, { status: user.status });

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT id, title, body, link, is_read, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 50
      `)
      .bind(user.user.id)
      .all();

    const unread = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND COALESCE(is_read, 0) = 0")
      .bind(user.user.id)
      .first();

    return Response.json({ notifications: result?.results || [], unread: unread?.count || 0 });
  } catch (error) {
    return Response.json({ error: "Bildirimler alınamadı. notifications tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const user = await requireUser(context);
  if (!user.ok) return Response.json({ error: user.error }, { status: user.status });

  try {
    const body = await context.request.json().catch(() => null);
    const id = Number(body?.id || 0);

    if (id) {
      await context.env.DB
        .prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?")
        .bind(id, user.user.id)
        .run();
    } else {
      await context.env.DB
        .prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?")
        .bind(user.user.id)
        .run();
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Bildirim güncellenemedi." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
