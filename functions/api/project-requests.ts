export async function onRequestPost(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    const body = await context.request.json().catch(() => null);
    const projectName = String(body?.projectName || "").trim();
    const projectType = String(body?.projectType || "").trim();
    const budgetRange = String(body?.budgetRange || "").trim();
    const deadline = String(body?.deadline || "").trim();
    const description = String(body?.description || "").trim();

    if (!projectName || !projectType || !description) {
      return Response.json({ error: "Proje adı, türü ve açıklama gerekli." }, { status: 400 });
    }

    await context.env.DB
      .prepare(`
        INSERT INTO project_requests (user_id, project_name, project_type, budget_range, deadline, description, status)
        VALUES (?, ?, ?, ?, ?, ?, 'new')
      `)
      .bind(user.user.id, projectName, projectType, budgetRange, deadline, description)
      .run();

    return Response.json({ success: true, message: "Proje talebi alındı." });
  } catch (error) {
    return Response.json({ error: "Proje talebi kaydedilemedi. D1'de project_requests tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Proje talebi için giriş yapmalısın." };
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
    return { ok: false, status: 403, error: "Bu hesap engellendiği için proje talebi gönderemez." };
  }

  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
