const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const owner = await requireOwner(context);

  if (!owner.ok) {
    return Response.json({ error: owner.error }, { status: owner.status });
  }

  try {
    const url = new URL(context.request.url);
    const type = String(url.searchParams.get("type") || "admin").toLowerCase();
    const safeType = ["admin", "user", "all"].includes(type) ? type : "admin";

    const roleWhere =
      safeType === "admin"
        ? "AND COALESCE(role, 'client') = 'admin'"
        : safeType === "user"
          ? "AND COALESCE(role, 'client') NOT IN ('admin', 'owner', 'blocked')"
          : "AND COALESCE(role, 'client') != 'blocked'";

    const result = await context.env.DB
      .prepare(`
        SELECT
          id,
          name,
          email,
          COALESCE(role, 'client') AS role,
          avatar_url,
          COALESCE(avatar_approved, 0) AS avatar_approved,
          created_at
        FROM users
        WHERE
          lower(email) != ?
          ${roleWhere}
          AND COALESCE(avatar_url, '') != ''
          AND COALESCE(avatar_approved, 0) = 0
        ORDER BY id DESC
        LIMIT 150
      `)
      .bind(OWNER_EMAIL)
      .all();

    return Response.json({ avatars: result?.results || [], admins: result?.results || [] });
  } catch (error) {
    return Response.json({ error: "Profil fotoğrafları alınamadı. avatar_url ve avatar_approved kolonlarını kontrol et." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const owner = await requireOwner(context);

  if (!owner.ok) {
    return Response.json({ error: owner.error }, { status: owner.status });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);
    const action = String(body?.action || "").trim();

    if (!userId) {
      return Response.json({ error: "Kullanıcı ID gerekli." }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return Response.json({ error: "Geçersiz işlem. action approve veya reject olmalı." }, { status: 400 });
    }

    const target = await context.env.DB
      .prepare(`
        SELECT id, name, email, COALESCE(role, 'client') AS role, avatar_url
        FROM users
        WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!target) {
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    if (String(target.email).toLowerCase() === OWNER_EMAIL) {
      return Response.json({ error: "Owner hesabı zaten otomatik onaylıdır." }, { status: 403 });
    }

    if (target.role === "blocked") {
      return Response.json({ error: "Engellenmiş hesabın fotoğrafı onaylanamaz." }, { status: 400 });
    }

    const isAdmin = target.role === "admin";

    if (action === "approve") {
      if (!target.avatar_url) {
        return Response.json({ error: "Profil fotoğrafı yüklemeyen kullanıcı onaylanamaz." }, { status: 400 });
      }

      await context.env.DB
        .prepare("UPDATE users SET avatar_approved = 1 WHERE id = ?")
        .bind(userId)
        .run();

      await writeAuditLog(context, {
        actorUserId: owner.user.id,
        action: isAdmin ? "admin_avatar_approved" : "user_avatar_approved",
        targetType: "user",
        targetId: userId,
        targetLabel: `${target.name} <${target.email}>`,
        details: isAdmin
          ? "Owner admin profil fotoğrafını onayladı. Admin sipariş yönetebilir."
          : "Owner kullanıcı profil fotoğrafını onayladı. Fotoğraf herkese açık alanlarda gösterilebilir.",
      });

      await notify(
        context,
        userId,
        "Profil fotoğrafın onaylandı",
        isAdmin ? "Artık admin panelinde sipariş yönetebilirsin." : "Profil fotoğrafın onaylandı ve görünür hale geldi.",
        isAdmin ? "/admin" : "/account"
      );

      return Response.json({ success: true, message: isAdmin ? "Admin profil fotoğrafı onaylandı." : "Kullanıcı profil fotoğrafı onaylandı." });
    }

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = '', avatar_approved = 0 WHERE id = ?")
      .bind(userId)
      .run();

    await writeAuditLog(context, {
      actorUserId: owner.user.id,
      action: isAdmin ? "admin_avatar_rejected" : "user_avatar_rejected",
      targetType: "user",
      targetId: userId,
      targetLabel: `${target.name} <${target.email}>`,
      details: isAdmin
        ? "Owner admin profil fotoğrafını reddetti. Fotoğraf silindi."
        : "Owner kullanıcı profil fotoğrafını reddetti. Fotoğraf silindi.",
    });

    await notify(
      context,
      userId,
      "Profil fotoğrafın reddedildi",
      isAdmin ? "Sipariş yönetebilmek için yeni bir profil fotoğrafı yüklemelisin." : "Yeni bir profil fotoğrafı yükleyebilirsin.",
      "/account"
    );

    return Response.json({ success: true, message: isAdmin ? "Admin profil fotoğrafı reddedildi." : "Kullanıcı profil fotoğrafı reddedildi." });
  } catch (error) {
    return Response.json({ error: "Profil fotoğrafı onayı güncellenemedi." }, { status: 500 });
  }
}

async function requireOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  if (String(user.email).toLowerCase() !== OWNER_EMAIL) {
    return { ok: false, status: 403, error: "Bu işlem sadece owner tarafından yapılabilir." };
  }

  return { ok: true, user };
}

async function notify(context: any, userId: number, title: string, body: string, link: string) {
  try {
    await context.env.DB
      .prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)")
      .bind(userId, title, body, link)
      .run();
  } catch {
    // Bildirim tablosu yoksa ana işlem bozulmasın.
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
