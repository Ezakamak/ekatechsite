const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestPost(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    const body = await context.request.json().catch(() => null);
    const avatarUrl = String(body?.avatar_url || "").trim();

    if (!avatarUrl) {
      return Response.json({ error: "Profil fotoğrafı gerekli." }, { status: 400 });
    }

    if (!avatarUrl.startsWith("data:image/")) {
      return Response.json({ error: "Sadece görsel dosyası yükleyebilirsin." }, { status: 400 });
    }

    if (avatarUrl.length > 250000) {
      return Response.json({ error: "Fotoğraf çok büyük. Daha küçük/kırpılmış bir görsel seç." }, { status: 413 });
    }

    const isOwner = String(user.user.email).toLowerCase() === OWNER_EMAIL;
    const shouldApproveImmediately = isOwner || user.user.role === "client";

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = ?, avatar_approved = ? WHERE id = ?")
      .bind(avatarUrl, shouldApproveImmediately ? 1 : 0, user.user.id)
      .run();

    await writeAuditLog(context, {
      actorUserId: user.user.id,
      action: user.user.role === "admin" ? "admin_avatar_uploaded_pending" : "profile_photo_updated",
      targetType: "user",
      targetId: user.user.id,
      targetLabel: `${user.user.name} <${user.user.email}>`,
      details: shouldApproveImmediately
        ? "Profil fotoğrafı güncellendi."
        : "Admin profil fotoğrafı yükledi; owner onayı bekliyor.",
    });

    return Response.json({
      success: true,
      message: shouldApproveImmediately
        ? "Profil fotoğrafı güncellendi."
        : "Profil fotoğrafı yüklendi. Sipariş yönetimi için owner onayı bekleniyor.",
      avatar_url: avatarUrl,
      avatar_approved: shouldApproveImmediately ? 1 : 0,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Profil fotoğrafı kaydedilemedi: ${detail}` }, { status: 500 });
  }
}

export async function onRequestDelete(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = '', avatar_approved = 0 WHERE id = ?")
      .bind(user.user.id)
      .run();

    await writeAuditLog(context, {
      actorUserId: user.user.id,
      action: "profile_photo_removed",
      targetType: "user",
      targetId: user.user.id,
      targetLabel: `${user.user.name} <${user.user.email}>`,
      details: "Profil fotoğrafı kaldırıldı.",
    });

    return Response.json({ success: true, message: "Profil fotoğrafı kaldırıldı." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Profil fotoğrafı kaldırılamadı: ${detail}` }, { status: 500 });
  }
}

async function requireUser(context: any) {
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
        CASE
          WHEN lower(users.email) = ? THEN 'owner'
          ELSE COALESCE(users.role, 'client')
        END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
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
