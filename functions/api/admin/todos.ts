const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT admin_todos.id, admin_todos.title, admin_todos.is_done, admin_todos.created_at,
          admin_todos.assigned_admin_id, users.name AS assigned_admin_name
        FROM admin_todos
        LEFT JOIN users ON admin_todos.assigned_admin_id = users.id
        WHERE ? = 'owner' OR admin_todos.assigned_admin_id IS NULL OR admin_todos.assigned_admin_id = ?
        ORDER BY admin_todos.is_done ASC, admin_todos.id DESC
        LIMIT 100
      `)
      .bind(admin.user.role, admin.user.id)
      .all();

    return Response.json({ todos: result?.results || [] });
  } catch {
    return Response.json({ error: "Todo listesi alınamadı. admin_todos tablosunu oluştur." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    const body = await context.request.json().catch(() => null);
    const title = String(body?.title || "").trim();
    const assignedAdminId = body?.assignedAdminId ? Number(body.assignedAdminId) : admin.user.id;
    if (!title) return Response.json({ error: "Görev başlığı gerekli." }, { status: 400 });

    await context.env.DB
      .prepare("INSERT INTO admin_todos (title, assigned_admin_id, created_by_user_id) VALUES (?, ?, ?)")
      .bind(title, assignedAdminId || null, admin.user.id)
      .run();

    if (assignedAdminId) await notify(context, assignedAdminId, "Yeni admin görevi", title, "/admin");
    return Response.json({ success: true, message: "Görev eklendi." });
  } catch {
    return Response.json({ error: "Görev eklenemedi." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    const body = await context.request.json().catch(() => null);
    const id = Number(body?.id);
    const isDone = body?.is_done ? 1 : 0;
    if (!id) return Response.json({ error: "Görev id gerekli." }, { status: 400 });

    const result = await context.env.DB
      .prepare(`
        UPDATE admin_todos SET is_done = ?
        WHERE id = ? AND (? = 'owner' OR assigned_admin_id IS NULL OR assigned_admin_id = ?)
      `)
      .bind(isDone, id, admin.user.role, admin.user.id)
      .run();

    if (result?.meta?.changes === 0) return Response.json({ error: "Bu görevi güncelleme yetkin yok." }, { status: 403 });
    return Response.json({ success: true, message: "Görev güncellendi." });
  } catch {
    return Response.json({ error: "Görev güncellenemedi." }, { status: 500 });
  }
}

async function notify(context: any, userId: number, title: string, body: string, link: string) {
  try {
    await context.env.DB.prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)").bind(userId, title, body, link).run();
  } catch {}
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
