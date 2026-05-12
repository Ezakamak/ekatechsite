const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const PRIORITIES = ["low", "normal", "high", "urgent"];

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    const url = new URL(context.request.url);
    const projectId = Number(url.searchParams.get("projectId"));
    if (!projectId) return Response.json({ error: "projectId gerekli." }, { status: 400 });

    const [messages, links] = await Promise.all([
      context.env.DB.prepare(`
        SELECT project_messages.id, project_messages.message, project_messages.created_at,
          users.name AS sender_name, users.email AS sender_email,
          CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS sender_role
        FROM project_messages
        JOIN users ON project_messages.sender_user_id = users.id
        WHERE project_messages.project_request_id = ?
        ORDER BY project_messages.id ASC
        LIMIT 100
      `).bind(OWNER_EMAIL, projectId).all(),
      context.env.DB.prepare(`
        SELECT id, label, url, created_at
        FROM project_links
        WHERE project_request_id = ?
        ORDER BY id DESC
        LIMIT 30
      `).bind(projectId).all(),
    ]);

    return Response.json({ messages: messages?.results || [], links: links?.results || [] });
  } catch (error) {
    return Response.json({ error: "Proje araçları alınamadı. project_messages ve project_links tablolarını kontrol et." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });
  if (!canMutateAdminData(admin.user)) return Response.json({ error: "Bu işlem için profil fotoğrafı owner tarafından onaylanmış admin olmalısın." }, { status: 403 });

  try {
    const body = await context.request.json().catch(() => null);
    const action = String(body?.action || "").trim();
    const projectId = Number(body?.projectId);
    if (!projectId) return Response.json({ error: "projectId gerekli." }, { status: 400 });

    const project = await context.env.DB.prepare("SELECT id, user_id, project_name FROM project_requests WHERE id = ?").bind(projectId).first();
    if (!project) return Response.json({ error: "Proje bulunamadı." }, { status: 404 });

    if (action === "message") {
      const message = String(body?.message || "").trim();
      if (!message) return Response.json({ error: "Mesaj boş olamaz." }, { status: 400 });
      if (message.length > 1200) return Response.json({ error: "Mesaj en fazla 1200 karakter olabilir." }, { status: 413 });

      await context.env.DB.prepare("INSERT INTO project_messages (project_request_id, sender_user_id, message) VALUES (?, ?, ?)").bind(projectId, admin.user.id, message).run();
      await notify(context, project.user_id, "Projene yeni mesaj geldi", `${project.project_name} için admin mesaj gönderdi.`, "/account");
      return Response.json({ success: true, message: "Müşteriye proje mesajı gönderildi." });
    }

    if (action === "link") {
      const label = String(body?.label || "").trim();
      const linkUrl = String(body?.url || "").trim();
      if (!label || !linkUrl) return Response.json({ error: "Link başlığı ve URL gerekli." }, { status: 400 });
      if (!/^https?:\/\//i.test(linkUrl)) return Response.json({ error: "URL http:// veya https:// ile başlamalı." }, { status: 400 });

      await context.env.DB.prepare("INSERT INTO project_links (project_request_id, label, url, created_by_user_id) VALUES (?, ?, ?, ?)").bind(projectId, label, linkUrl, admin.user.id).run();
      await notify(context, project.user_id, "Projene yeni dosya/link eklendi", `${project.project_name} için ${label} bağlantısı eklendi.`, "/account");
      return Response.json({ success: true, message: "Proje linki eklendi." });
    }

    if (action === "meta") {
      const priority = String(body?.priority || "normal").trim();
      const targetDate = String(body?.targetDate || "").trim();
      if (!PRIORITIES.includes(priority)) return Response.json({ error: "Geçersiz öncelik." }, { status: 400 });

      await context.env.DB.prepare("UPDATE project_requests SET priority = ?, target_date = ? WHERE id = ?").bind(priority, targetDate, projectId).run();
      await notify(context, project.user_id, "Proje planı güncellendi", `${project.project_name} için öncelik veya hedef tarih güncellendi.`, "/account");
      return Response.json({ success: true, message: "Proje önceliği/hedef tarihi güncellendi." });
    }

    return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Proje aracı çalışmadı: ${detail}` }, { status: 500 });
  }
}

async function notify(context: any, userId: number, title: string, body: string, link: string) {
  try {
    await context.env.DB.prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)").bind(userId, title, body, link).run();
  } catch {
    // Bildirim tablosu yoksa ana işlem bozulmasın.
  }
}

function canMutateAdminData(user: any) {
  if (user.role === "owner") return true;
  if (user.role !== "admin") return false;
  return Boolean(user.avatar_url) && Number(user.avatar_approved || 0) === 1;
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 1 ELSE COALESCE(users.avatar_approved, 0) END AS avatar_approved,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
