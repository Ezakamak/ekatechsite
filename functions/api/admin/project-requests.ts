export async function onRequestGet(context: any) {
  const admin = await requireAdmin(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const requests = await context.env.DB
      .prepare(`
        SELECT
          project_requests.id,
          project_requests.project_name,
          project_requests.project_type,
          project_requests.budget_range,
          project_requests.deadline,
          project_requests.description,
          project_requests.status,
          project_requests.created_at,
          users.name AS user_name,
          users.email AS user_email
        FROM project_requests
        JOIN users ON project_requests.user_id = users.id
        ORDER BY project_requests.id DESC
        LIMIT 100
      `)
      .all();

    return Response.json({ requests: requests?.results || [] });
  } catch (error) {
    return Response.json({ error: "Proje talepleri alınamadı. project_requests tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdmin(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const requestId = Number(body?.requestId);
    const status = String(body?.status || "");
    const allowed = ["new", "reviewed", "contacted", "accepted", "rejected"];

    if (!requestId || !allowed.includes(status)) {
      return Response.json({ error: "Geçersiz talep veya durum." }, { status: 400 });
    }

    await context.env.DB
      .prepare("UPDATE project_requests SET status = ? WHERE id = ?")
      .bind(status, requestId)
      .run();

    return Response.json({ success: true, message: "Talep durumu güncellendi." });
  } catch (error) {
    return Response.json({ error: "Talep güncellenemedi." }, { status: 500 });
  }
}

async function requireAdmin(context: any) {
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

  if (user.role !== "admin") {
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
