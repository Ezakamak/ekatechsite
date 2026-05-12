const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT id, announcement_type, message, image_url, expires_at, is_active, created_at
        FROM announcements
        ORDER BY id DESC
        LIMIT 50
      `)
      .all();

    return Response.json({ announcements: result?.results || [] });
  } catch (error) {
    return Response.json({ error: "Duyurular alınamadı. announcements tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  if (!canMutateAdminData(admin.user)) {
    return Response.json({ error: "Duyuru yönetmek için profil fotoğrafı yüklemeli ve owner onayı almalısın. Şimdilik paneli sadece görüntüleyebilirsin." }, { status: 403 });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const announcementType = String(body?.announcement_type || "").trim();
    const message = String(body?.message || "").trim();
    const imageUrl = String(body?.image_url || "").trim();
    const expiresAt = String(body?.expires_at || "").trim();

    if (!["message", "image"].includes(announcementType)) {
      return Response.json({ error: "Duyuru tipi message veya image olmalı." }, { status: 400 });
    }

    if (announcementType === "message" && !message) {
      return Response.json({ error: "Mesaj duyurusu için mesaj gerekli." }, { status: 400 });
    }

    if (announcementType === "image" && !imageUrl) {
      return Response.json({ error: "Resim duyurusu için resim gerekli." }, { status: 400 });
    }

    if (imageUrl && !imageUrl.startsWith("data:image/")) {
      return Response.json({ error: "Sadece görsel dosyası yükleyebilirsin." }, { status: 400 });
    }

    if (imageUrl.length > 650000) {
      return Response.json({ error: "Resim çok büyük. Daha küçük bir görsel seç." }, { status: 413 });
    }

    if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) {
      return Response.json({ error: "Geçerli bir bitiş zamanı gerekli." }, { status: 400 });
    }

    const insertResult = await context.env.DB
      .prepare(`
        INSERT INTO announcements (announcement_type, message, image_url, expires_at, is_active)
        VALUES (?, ?, ?, ?, 1)
      `)
      .bind(announcementType, message, imageUrl, expiresAt)
      .run();

    await writeAuditLog(context, {
      actorUserId: admin.user.id,
      action: "announcement_created",
      targetType: "announcement",
      targetId: insertResult?.meta?.last_row_id || null,
      targetLabel: announcementType === "message" ? message.slice(0, 80) : "Görsel duyuru",
      details: `${admin.user.name} ${announcementType === "message" ? "mesaj" : "görsel"} duyurusu oluşturdu. Bitiş: ${expiresAt}`,
    });

    return Response.json({ success: true, message: "Duyuru oluşturuldu." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Duyuru oluşturulamadı: ${detail}` }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  if (!canMutateAdminData(admin.user)) {
    return Response.json({ error: "Duyuru yönetmek için profil fotoğrafı yüklemeli ve owner onayı almalısın. Şimdilik paneli sadece görüntüleyebilirsin." }, { status: 403 });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const id = Number(body?.id);
    const isActive = body?.is_active ? 1 : 0;

    if (!id) {
      return Response.json({ error: "Duyuru id gerekli." }, { status: 400 });
    }

    const current = await context.env.DB
      .prepare("SELECT id, announcement_type, message, is_active FROM announcements WHERE id = ?")
      .bind(id)
      .first();

    await context.env.DB
      .prepare("UPDATE announcements SET is_active = ? WHERE id = ?")
      .bind(isActive, id)
      .run();

    await writeAuditLog(context, {
      actorUserId: admin.user.id,
      action: isActive ? "announcement_enabled" : "announcement_disabled",
      targetType: "announcement",
      targetId: id,
      targetLabel: current?.message ? String(current.message).slice(0, 80) : `Duyuru #${id}`,
      details: `${admin.user.name} duyuru durumunu ${isActive ? "aktif" : "pasif"} yaptı.`,
    });

    return Response.json({ success: true, message: "Duyuru güncellendi." });
  } catch (error) {
    return Response.json({ error: "Duyuru güncellenemedi." }, { status: 500 });
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
