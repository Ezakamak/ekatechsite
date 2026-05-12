const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

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
          project_requests.assigned_admin_id,
          users.name AS user_name,
          users.email AS user_email,
          assigned_admin.name AS assigned_admin_name,
          assigned_admin.email AS assigned_admin_email,
          assigned_admin.avatar_url AS assigned_admin_avatar_url
        FROM project_requests
        JOIN users ON project_requests.user_id = users.id
        LEFT JOIN users AS assigned_admin ON project_requests.assigned_admin_id = assigned_admin.id
        WHERE project_requests.assigned_admin_id IS NULL OR project_requests.assigned_admin_id = ? OR ? = 'owner'
        ORDER BY project_requests.id DESC
        LIMIT 100
      `)
      .bind(admin.user.id, admin.user.role)
      .all();

    return Response.json({ requests: requests?.results || [] });
  } catch (error) {
    return Response.json({ error: "Proje talepleri alınamadı. project_requests tablosunu ve assigned_admin_id kolonunu kontrol et." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  if (!canMutateAdminData(admin.user)) {
    return Response.json({ error: "Sipariş yönetmek için profil fotoğrafı yüklemeli ve owner onayı almalısın. Şimdilik paneli sadece görüntüleyebilirsin." }, { status: 403 });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const requestId = Number(body?.requestId);
    const status = String(body?.status || "");
    const allowed = [
      "received",
      "reviewing",
      "offer_ready",
      "waiting_approval",
      "development_started",
      "revision",
      "delivered",
      "completed",
      "rejected",
      "new",
      "reviewed",
      "contacted",
      "accepted",
    ];

    if (!requestId || !allowed.includes(status)) {
      return Response.json({ error: "Geçersiz talep veya durum." }, { status: 400 });
    }

    const current = await context.env.DB
      .prepare("SELECT id, project_name, status, assigned_admin_id FROM project_requests WHERE id = ?")
      .bind(requestId)
      .first();

    if (!current) {
      return Response.json({ error: "Proje talebi bulunamadı." }, { status: 404 });
    }

    if (admin.user.role !== "owner" && current.assigned_admin_id && Number(current.assigned_admin_id) !== Number(admin.user.id)) {
      return Response.json({ error: "Bu proje başka bir admin tarafından alınmış." }, { status: 409 });
    }

    const firstStageStatuses = ["received", "new"];
    const shouldRelease = firstStageStatuses.includes(status);
    const nextAssignedAdminId = shouldRelease ? null : current.assigned_admin_id || admin.user.id;

    const updateResult = await context.env.DB
      .prepare(`
        UPDATE project_requests
        SET status = ?, assigned_admin_id = ?
        WHERE id = ?
          AND (? = 'owner' OR assigned_admin_id IS NULL OR assigned_admin_id = ?)
      `)
      .bind(status, nextAssignedAdminId, requestId, admin.user.role, admin.user.id)
      .run();

    if (updateResult?.meta?.changes === 0) {
      return Response.json({ error: "Bu proje aynı anda başka bir admin tarafından alınmış veya artık sana atanmış değil." }, { status: 409 });
    }

    await writeAuditLog(context, {
      actorUserId: admin.user.id,
      action: "project_status_updated",
      targetType: "project_request",
      targetId: requestId,
      targetLabel: current.project_name || `Project #${requestId}`,
      details: `${admin.user.name} proje durumunu ${current.status} → ${status} olarak değiştirdi.${nextAssignedAdminId ? " Proje sorumlu admine atandı." : " Proje tekrar tüm adminlere açıldı."}`,
    });

    return Response.json({
      success: true,
      message: nextAssignedAdminId
        ? "Talep durumu güncellendi ve proje sorumlu admin hesabına atandı."
        : "Talep ilk aşamaya alındı ve tüm adminlere açıldı.",
    });
  } catch (error) {
    return Response.json({ error: "Talep güncellenemedi. assigned_admin_id ve avatar_approved kolonlarını kontrol et." }, { status: 500 });
  }
}

function canMutateAdminData(user: any) {
  if (user.role === "owner") return true;
  if (user.role !== "admin") return false;
  return Boolean(user.avatar_url) && Number(user.avatar_approved || 0) === 1;
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        users.avatar_url,
        CASE
          WHEN lower(users.email) = ? THEN 1
          ELSE COALESCE(users.avatar_approved, 0)
        END AS avatar_approved,
        CASE
          WHEN lower(users.email) = ? THEN 'owner'
          ELSE COALESCE(users.role, 'client')
        END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, OWNER_EMAIL, token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  if (user.role === "blocked") {
    return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  }

  if (user.role !== "admin" && user.role !== "owner") {
    return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  }

  return { ok: true, user };
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
