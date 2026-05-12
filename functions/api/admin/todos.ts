const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT
          admin_todos.id,
          admin_todos.title,
          COALESCE(admin_todos.is_done, 0) AS is_done,
          admin_todos.created_at,
          admin_todos.assigned_admin_id,
          assigned.name AS assigned_admin_name,
          creator.name AS created_by_name
        FROM admin_todos
        LEFT JOIN users AS assigned ON admin_todos.assigned_admin_id = assigned.id
        LEFT JOIN users AS creator ON admin_todos.created_by_user_id = creator.id
        WHERE ? = 'owner' OR admin_todos.assigned_admin_id IS NULL OR admin_todos.assigned_admin_id = ?
        ORDER BY COALESCE(admin_todos.is_done, 0) ASC, admin_todos.id DESC
        LIMIT 100
      `)
      .bind(admin.user.role, admin.user.id)
      .all();

    return json({ todos: result?.results || [], currentUser: admin.user });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Todo listesi alınamadı: ${detail}` }, 500);
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    const body = await context.request.json().catch(() => null);
    const title = String(body?.title || "").trim();
    const assignedAdminId = normalizeAssignee(body?.assignedAdminId, admin.user);

    if (!title) return json({ error: "Görev başlığı gerekli." }, 400);
    if (title.length > 180) return json({ error: "Görev başlığı en fazla 180 karakter olabilir." }, 413);

    if (assignedAdminId && admin.user.role !== "owner" && Number(assignedAdminId) !== Number(admin.user.id)) {
      return json({ error: "Admin sadece kendine veya ortak görev listesine görev ekleyebilir." }, 403);
    }

    if (assignedAdminId) {
      const target = await context.env.DB
        .prepare(`
          SELECT id,
            CASE WHEN lower(email) = ? THEN 'owner' ELSE COALESCE(role, 'client') END AS role
          FROM users
          WHERE id = ?
        `)
        .bind(OWNER_EMAIL, assignedAdminId)
        .first();

      if (!target || (target.role !== "admin" && target.role !== "owner")) {
        return json({ error: "Görev sadece admin veya owner hesabına atanabilir." }, 400);
      }
    }

    await context.env.DB
      .prepare("INSERT INTO admin_todos (title, assigned_admin_id, created_by_user_id) VALUES (?, ?, ?)")
      .bind(title, assignedAdminId, admin.user.id)
      .run();

    if (assignedAdminId) await notify(context, assignedAdminId, "Yeni admin görevi", title, "/admin");
    return json({ success: true, message: assignedAdminId ? "Görev atandı." : "Ortak görev eklendi." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Görev eklenemedi: ${detail}` }, 500);
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    const body = await context.request.json().catch(() => null);
    const id = Number(body?.id);
    const isDone = body?.is_done ? 1 : 0;
    if (!id) return json({ error: "Görev id gerekli." }, 400);

    const result = await context.env.DB
      .prepare(`
        UPDATE admin_todos
        SET is_done = ?
        WHERE id = ? AND (? = 'owner' OR assigned_admin_id IS NULL OR assigned_admin_id = ?)
      `)
      .bind(isDone, id, admin.user.role, admin.user.id)
      .run();

    if (result?.meta?.changes === 0) return json({ error: "Bu görevi güncelleme yetkin yok." }, 403);
    return json({ success: true, message: "Görev güncellendi." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Görev güncellenemedi: ${detail}` }, 500);
  }
}

export async function onRequestDelete(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    const url = new URL(context.request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return json({ error: "Görev id gerekli." }, 400);

    const result = await context.env.DB
      .prepare(`
        DELETE FROM admin_todos
        WHERE id = ? AND (? = 'owner' OR assigned_admin_id IS NULL OR assigned_admin_id = ? OR created_by_user_id = ?)
      `)
      .bind(id, admin.user.role, admin.user.id, admin.user.id)
      .run();

    if (result?.meta?.changes === 0) return json({ error: "Bu görevi silme yetkin yok." }, 403);
    return json({ success: true, message: "Görev silindi." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Görev silinemedi: ${detail}` }, 500);
  }
}

function normalizeAssignee(value: any, user: any) {
  if (value === undefined || value === null || value === "" || value === "shared") return null;
  if (value === "me") return Number(user.id);
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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
    WHERE sessions.token = ?
      AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
  `).bind(OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  return { ok: true, user };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
