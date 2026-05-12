const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const ROLES = ["owner", "admin", "client", "blocked"];

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const users = await context.env.DB
      .prepare(`
        SELECT
          id,
          name,
          email,
          CASE
            WHEN lower(email) = ? THEN 'owner'
            ELSE COALESCE(role, 'client')
          END AS role,
          avatar_url,
          CASE
            WHEN lower(email) = ? THEN 1
            ELSE COALESCE(avatar_approved, 0)
          END AS avatar_approved,
          created_at
        FROM users
        ORDER BY id DESC
        LIMIT 100
      `)
      .bind(OWNER_EMAIL, OWNER_EMAIL)
      .all();

    return Response.json({ users: users?.results || [] });
  } catch (error) {
    return Response.json({ error: "Kullanıcı listesi alınamadı. users tablosunda avatar_url ve avatar_approved kolonlarını kontrol et." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  if (!canMutateAdminData(admin.user)) {
    return Response.json({ error: "Admin işlemleri için profil fotoğrafı yüklemeli ve owner onayı almalısın. Şimdilik paneli sadece görüntüleyebilirsin." }, { status: 403 });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);
    const hasRoleChange = body?.role !== undefined;
    const hasAvatarApprovalChange = body?.avatar_approved !== undefined;

    if (!userId) {
      return Response.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
    }

    if (hasRoleChange && hasAvatarApprovalChange) {
      return Response.json({ error: "Rol ve profil onayı ayrı işlemler olarak güncellenmeli." }, { status: 400 });
    }

    const target = await context.env.DB
      .prepare(`
        SELECT
          id,
          name,
          email,
          avatar_url,
          CASE
            WHEN lower(email) = ? THEN 'owner'
            ELSE COALESCE(role, 'client')
          END AS role,
          CASE
            WHEN lower(email) = ? THEN 1
            ELSE COALESCE(avatar_approved, 0)
          END AS avatar_approved
        FROM users
        WHERE id = ?
      `)
      .bind(OWNER_EMAIL, OWNER_EMAIL, userId)
      .first();

    if (!target) {
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    if (hasAvatarApprovalChange) {
      if (admin.user.role !== "owner") {
        return Response.json({ error: "Profil fotoğrafı onayı sadece owner tarafından değiştirilebilir." }, { status: 403 });
      }

      if (target.role !== "admin") {
        return Response.json({ error: "Profil fotoğrafı onayı sadece admin hesapları için kullanılır." }, { status: 400 });
      }

      const approved = Number(body.avatar_approved) ? 1 : 0;

      if (approved && !target.avatar_url) {
        return Response.json({ error: "Fotoğrafı olmayan admin onaylanamaz." }, { status: 400 });
      }

      await context.env.DB
        .prepare("UPDATE users SET avatar_approved = ? WHERE id = ?")
        .bind(approved, userId)
        .run();

      return Response.json({ success: true, message: approved ? "Admin profil fotoğrafı onaylandı." : "Admin profil fotoğrafı onayı kaldırıldı." });
    }

    const role = String(body?.role || "");

    if (!hasRoleChange || !ROLES.includes(role)) {
      return Response.json({ error: "Geçersiz rol." }, { status: 400 });
    }

    if (String(target.email).toLowerCase() === OWNER_EMAIL) {
      return Response.json({ error: "Owner hesabının rolü değiştirilemez veya engellenemez." }, { status: 403 });
    }

    if (role === "owner") {
      return Response.json({ error: "Owner rolü sadece emirkaganaksu02@gmail.com hesabına aittir ve başka hesaba verilemez." }, { status: 403 });
    }

    if (admin.user.role !== "owner") {
      if (target.role === "admin" || target.role === "owner") {
        return Response.json({ error: "Adminler başka adminlere veya owner hesabına dokunamaz." }, { status: 403 });
      }

      if (role === "admin") {
        return Response.json({ error: "Admin rolü verme yetkisi sadece owner hesabındadır." }, { status: 403 });
      }
    }

    if (userId === admin.user.id) {
      return Response.json({ error: "Kendi rolünü bu ekrandan değiştiremezsin." }, { status: 400 });
    }

    const nextAvatarApproved = role === "admin" ? 0 : 1;

    await context.env.DB
      .prepare("UPDATE users SET role = ?, avatar_approved = ? WHERE id = ?")
      .bind(role, nextAvatarApproved, userId)
      .run();

    if (role === "blocked") {
      await context.env.DB
        .prepare("DELETE FROM sessions WHERE user_id = ?")
        .bind(userId)
        .run();
    }

    return Response.json({ success: true, message: role === "admin" ? "Rol admin yapıldı. Sipariş yönetimi için profil fotoğrafı owner tarafından onaylanmalı." : "Rol güncellendi." });
  } catch (error) {
    return Response.json({ error: "Rol veya profil fotoğrafı onayı güncellenemedi." }, { status: 500 });
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

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
