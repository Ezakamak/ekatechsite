export async function onRequestGet(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    const requests = await context.env.DB
      .prepare(`
        SELECT
          project_requests.id,
          project_requests.project_name,
          project_requests.project_type,
          project_requests.budget_range,
          project_requests.deadline,
          project_requests.target_date,
          COALESCE(project_requests.priority, 'normal') AS priority,
          project_requests.description,
          project_requests.status,
          project_requests.created_at,
          project_requests.assigned_admin_id,
          assigned_admin.name AS assigned_admin_name,
          assigned_admin.email AS assigned_admin_email,
          assigned_admin.avatar_url AS assigned_admin_avatar_url,
          feedback.rating AS feedback_rating,
          feedback.comment AS feedback_comment
        FROM project_requests
        LEFT JOIN users AS assigned_admin ON project_requests.assigned_admin_id = assigned_admin.id
        LEFT JOIN project_feedback AS feedback ON feedback.project_request_id = project_requests.id AND feedback.user_id = project_requests.user_id
        WHERE project_requests.user_id = ?
        ORDER BY project_requests.id DESC
        LIMIT 50
      `)
      .bind(user.user.id)
      .all();

    return Response.json({ requests: requests?.results || [] });
  } catch (error) {
    return Response.json({ error: "Proje durumları alınamadı. project_requests tablosunda assigned_admin_id, priority, target_date ve project_feedback tablosunu kontrol et." }, { status: 500 });
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

  if (user.role === "blocked") {
    return { ok: false, status: 403, error: "Bu hesap engellendiği için proje durumlarına erişemez." };
  }

  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
