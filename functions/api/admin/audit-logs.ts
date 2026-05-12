const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const url = new URL(context.request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 80), 1), 200);

    const result = await context.env.DB
      .prepare(`
        SELECT
          audit_logs.id,
          audit_logs.actor_user_id,
          actor.name AS actor_name,
          actor.email AS actor_email,
          CASE
            WHEN lower(actor.email) = ? THEN 'owner'
            ELSE COALESCE(actor.role, 'system')
          END AS actor_role,
          audit_logs.action,
          audit_logs.target_type,
          audit_logs.target_id,
          audit_logs.target_label,
          audit_logs.details,
          audit_logs.created_at
        FROM audit_logs
        LEFT JOIN users AS actor ON audit_logs.actor_user_id = actor.id
        ORDER BY audit_logs.id DESC
        LIMIT ?
      `)
      .bind(OWNER_EMAIL, limit)
      .all();

    return Response.json({ logs: result?.results || [] });
  } catch (error) {
    return Response.json({ error: "Log kayıtları alınamadı. audit_logs tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
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
