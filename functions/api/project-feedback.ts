export async function onRequestPost(context: any) {
  const user = await requireUser(context);
  if (!user.ok) return Response.json({ error: user.error }, { status: user.status });

  try {
    const body = await context.request.json().catch(() => null);
    const projectId = Number(body?.projectId);
    const rating = Number(body?.rating);
    const comment = String(body?.comment || "").trim();

    if (!projectId || rating < 1 || rating > 5) {
      return Response.json({ error: "Geçerli proje ve 1-5 arası puan gerekli." }, { status: 400 });
    }

    const project = await context.env.DB
      .prepare("SELECT id, user_id, status, project_name FROM project_requests WHERE id = ? AND user_id = ?")
      .bind(projectId, user.user.id)
      .first();

    if (!project) return Response.json({ error: "Proje bulunamadı." }, { status: 404 });
    if (project.status !== "completed") return Response.json({ error: "Puanlama sadece tamamlanan projeler için yapılabilir." }, { status: 400 });

    await context.env.DB
      .prepare(`
        INSERT INTO project_feedback (project_request_id, user_id, rating, comment, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(project_request_id, user_id) DO UPDATE SET
          rating = excluded.rating,
          comment = excluded.comment,
          created_at = datetime('now')
      `)
      .bind(projectId, user.user.id, rating, comment)
      .run();

    await notifyAdmins(context, "Yeni müşteri puanı", `${project.project_name} için ${rating}/5 puan verildi.`, "/admin");
    return Response.json({ success: true, message: "Değerlendirme kaydedildi." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Değerlendirme kaydedilemedi: ${detail}` }, { status: 500 });
  }
}

async function notifyAdmins(context: any, title: string, body: string, link: string) {
  try {
    const admins = await context.env.DB.prepare("SELECT id FROM users WHERE role IN ('admin', 'owner')").all();
    for (const admin of admins?.results || []) {
      await context.env.DB.prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)").bind(admin.id, title, body, link).run();
    }
  } catch {}
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
