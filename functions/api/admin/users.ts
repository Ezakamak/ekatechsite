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
          created_at
        FROM users
        ORDER BY id DESC
        LIMIT 100
      `)
      .bind(OWNER_EMAIL)
      .all();

    return Response.json({ users: users?.results || [] });
  } catch (error) {
    return Response.json({ error: "Kullanıcı listesi alınamadı." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);
    const role = String(body?.role || "");

    if (!userId || !ROLES.includes(role)) {
      return Response.json({ error: "Geçersiz kullanıcı veya rol." }, { status: 400 });
    }

    const target = await context.env.DB
      .prepare(`
        SELECT
          id,
          name,
          email,
          CASE
            WHEN lower(email) = ? THEN 'owner'
            ELSE COALESCE(role, 'client')
          END AS role
        FROM users
        WHERE id = ?
      `)
      .bind(OWNER_EMAIL, userId)
      .first();

    if (!target) {
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
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

    await context.env.DB
      .prepare("UPDATE users SET role = ? WHERE id = ?")
      .bind(role, userId)
      .run();

    if (role === "blocked") {
      await context.env.DB
        .prepare("DELETE FROM sessions WHERE user_id = ?")
        .bind(userId)
        .run();
    }

    return Response.json({ success: true, message: "Rol güncellendi." });
  } catch (error) {
    return Response.json({ error: "Rol güncellenemedi." }, { status: 500 });
  }
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
