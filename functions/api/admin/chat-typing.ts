const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT
          users.id,
          users.name,
          users.email,
          COALESCE(users.avatar_url, '') AS avatar_url,
          CASE
            WHEN lower(users.email) = ? THEN 'owner'
            ELSE COALESCE(users.role, 'admin')
          END AS role
        FROM admin_chat_typing
        JOIN users ON admin_chat_typing.user_id = users.id
        WHERE admin_chat_typing.expires_at > datetime('now')
          AND users.id != ?
          AND COALESCE(users.role, 'client') != 'blocked'
        ORDER BY admin_chat_typing.updated_at DESC
        LIMIT 5
      `)
      .bind(OWNER_EMAIL, admin.user.id)
      .all();

    return Response.json({ typing: result?.results || [] });
  } catch (error) {
    return Response.json({ typing: [] });
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const expiresAt = new Date(Date.now() + 5000).toISOString();

    await context.env.DB
      .prepare(`
        INSERT INTO admin_chat_typing (user_id, updated_at, expires_at)
        VALUES (?, datetime('now'), ?)
        ON CONFLICT(user_id) DO UPDATE SET
          updated_at = datetime('now'),
          expires_at = excluded.expires_at
      `)
      .bind(admin.user.id, expiresAt)
      .run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: true });
  }
}

export async function onRequestDelete(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    await context.env.DB
      .prepare("DELETE FROM admin_chat_typing WHERE user_id = ?")
      .bind(admin.user.id)
      .run();
  } catch {
    // ignore
  }

  return Response.json({ success: true });
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        CASE
          WHEN lower(users.email) = ? THEN 'owner'
          ELSE COALESCE(users.role, 'client')
        END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  if (user.role === "blocked") {
    return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  }

  if (user.role !== "admin" && user.role !== "owner") {
    return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  }

  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
