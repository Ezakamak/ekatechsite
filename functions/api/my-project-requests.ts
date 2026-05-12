export async function onRequestGet(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    const requests = await context.env.DB
      .prepare(`
        SELECT id, project_name, project_type, budget_range, deadline, description, status, created_at
        FROM project_requests
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 50
      `)
      .bind(user.user.id)
      .all();

    return Response.json({ requests: requests?.results || [] });
  } catch (error) {
    return Response.json({ error: "Proje durumları alınamadı. project_requests tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, COALESCE(users.role, 'client') AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
