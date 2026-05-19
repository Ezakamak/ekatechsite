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
    const shouldApproveImmediately = isOwner;
    const isAdmin = user.user.role === "admin";

    const match = avatarUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return Response.json({ error: "Geçersiz görsel formatı." }, { status: 400 });
    const mime = match[1].toLowerCase().replace("jpg", "jpeg");
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const quota = await context.env.DB.prepare("SELECT used_bytes, max_bytes FROM storage_quota WHERE id=1").first<any>();
    if (Number(quota?.used_bytes || 0) + bytes.length > Number(quota?.max_bytes || 8000000000)) {
      return Response.json({ error: "Depolama limiti doldu. Yeni dosya yüklenemez." }, { status: 413 });
    }
    const old = await context.env.DB.prepare("SELECT avatar_url FROM users WHERE id=?").bind(user.user.id).first<any>();
    const r2Key = `users/${user.user.id}/avatar/${Date.now()}-${crypto.randomUUID()}`;
    await context.env.UPLOADS_BUCKET.put(r2Key, bytes, { httpMetadata: { contentType: mime } });
    await context.env.DB.prepare(`INSERT INTO uploaded_files (user_id, file_name, file_size, mime_type, r2_key, visibility) VALUES (?, ?, ?, ?, ?, 'private')`).bind(user.user.id, "avatar", bytes.length, mime, r2Key).run();
    await context.env.DB.prepare("UPDATE storage_quota SET used_bytes = used_bytes + ?, updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(bytes.length).run();
    const securedUrl = `/api/files/${encodeURIComponent(r2Key)}`;

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = ?, avatar_approved = ? WHERE id = ?")
      .bind(securedUrl, shouldApproveImmediately ? 1 : 0, user.user.id)
      .run();

    await writeAuditLog(context, {
      actorUserId: user.user.id,
      action: isAdmin ? "admin_avatar_uploaded_pending" : shouldApproveImmediately ? "profile_photo_updated" : "user_avatar_uploaded_pending",
      targetType: "user",
      targetId: user.user.id,
      targetLabel: `${user.user.name} <${user.user.email}>`,
      details: shouldApproveImmediately
        ? "Profil fotoğrafı güncellendi."
        : isAdmin
          ? "Admin profil fotoğrafı yükledi; owner onayı bekliyor."
          : "Kullanıcı profil fotoğrafı yükledi; owner onayı bekliyor.",
    });

    return Response.json({
      success: true,
      message: shouldApproveImmediately
        ? "Profil fotoğrafı güncellendi."
        : isAdmin
          ? "Profil fotoğrafı yüklendi. Sipariş yönetimi için owner onayı bekleniyor."
          : "Profil fotoğrafı yüklendi. Yayımlanması için owner onayı bekleniyor.",
      avatar_url: securedUrl,
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

    const existing = await context.env.DB.prepare("SELECT avatar_url FROM users WHERE id=?").bind(user.user.id).first<any>();
    const prefix = "/api/files/";
    if (String(existing?.avatar_url || "").startsWith(prefix)) {
      const r2Key = decodeURIComponent(String(existing.avatar_url).slice(prefix.length));
      const meta = await context.env.DB.prepare("SELECT file_size FROM uploaded_files WHERE r2_key=? AND deleted_at IS NULL").bind(r2Key).first<any>();
      await context.env.UPLOADS_BUCKET.delete(r2Key);
      await context.env.DB.prepare("UPDATE uploaded_files SET deleted_at=CURRENT_TIMESTAMP WHERE r2_key=?").bind(r2Key).run();
      await context.env.DB.prepare("UPDATE storage_quota SET used_bytes = MAX(0, used_bytes - ?), updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(Number(meta?.file_size || 0)).run();
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
