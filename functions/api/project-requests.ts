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

    const insertResult = await context.env.DB
      .prepare(`
        INSERT INTO project_requests (user_id, project_name, project_type, budget_range, deadline, target_date, priority, description, status)
        VALUES (?, ?, ?, ?, ?, ?, 'normal', ?, 'received')
      `)
      .bind(user.user.id, projectName, projectType, budgetRange, deadline, deadline, description)
      .run();

    const projectId = insertResult?.meta?.last_row_id || null;

    await writeAuditLog(context, {
      actorUserId: user.user.id,
      action: "project_request_created",
      targetType: "project_request",
      targetId: projectId,
      targetLabel: projectName,
      details: `${user.user.name} yeni proje talebi oluşturdu. Tür: ${projectType}${budgetRange ? `, Bütçe: ${budgetRange}` : ""}${deadline ? `, Hedef: ${deadline}` : ""}`,
    });

    await notifyAdmins(context, "Yeni proje talebi", `${user.user.name} yeni proje talebi oluşturdu: ${projectName}`, "/admin");

    return Response.json({ success: true, message: "Proje talebi alındı." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Proje talebi kaydedilemedi: ${detail}` }, { status: 500 });
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

async function notifyAdmins(context: any, title: string, body: string, link: string) {
  try {
    const admins = await context.env.DB.prepare("SELECT id FROM users WHERE role IN ('admin', 'owner')").all();
    for (const admin of admins?.results || []) {
      await context.env.DB.prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)").bind(admin.id, title, body, link).run();
    }
  } catch {
    // Bildirim tablosu yoksa proje talebi bozulmasın.
  }
}

async function writeAuditLog(context: any, entry: any) {
  try {
    await context.env.DB
      .prepare(`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, target_label, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(entry.actorUserId, entry.action, entry.targetType, entry.targetId, entry.targetLabel, entry.details)
      .run();
  } catch {
    // Log yazılamazsa ana işlem bozulmasın.
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
