export async function onRequestGet(context: any) {
  const user = await requireUser(context);
  if (!user.ok) return Response.json({ error: user.error }, { status: user.status });

  try {
    const url = new URL(context.request.url);
    const projectId = Number(url.searchParams.get("projectId"));
    if (!projectId) return Response.json({ error: "projectId gerekli." }, { status: 400 });

    const project = await context.env.DB
      .prepare("SELECT id, user_id, status FROM project_requests WHERE id = ? AND user_id = ?")
      .bind(projectId, user.user.id)
      .first();

    if (!project) return Response.json({ error: "Proje bulunamadı." }, { status: 404 });

    const [messages, links, feedback] = await Promise.all([
      context.env.DB.prepare(`
        SELECT project_messages.id, project_messages.message, project_messages.created_at,
          users.name AS sender_name, users.email AS sender_email, COALESCE(users.role, 'client') AS sender_role
        FROM project_messages
        JOIN users ON project_messages.sender_user_id = users.id
        WHERE project_messages.project_request_id = ?
        ORDER BY project_messages.id ASC
        LIMIT 100
      `).bind(projectId).all(),
      context.env.DB.prepare("SELECT id, label, url, created_at FROM project_links WHERE project_request_id = ? ORDER BY id DESC LIMIT 30").bind(projectId).all(),
      context.env.DB.prepare("SELECT rating, comment, created_at FROM project_feedback WHERE project_request_id = ? AND user_id = ?").bind(projectId, user.user.id).first(),
    ]);

    return Response.json({
      messages: messages?.results || [],
      links: links?.results || [],
      feedback: feedback || null,
    });
  } catch (error) {
    return Response.json({ error: "Proje detayları alınamadı. project_messages/project_links/project_feedback tablolarını kontrol et." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare("SELECT users.id, users.name, users.email, COALESCE(users.role, 'client') AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')")
    .bind(token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
