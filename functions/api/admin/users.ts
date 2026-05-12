export async function onRequestGet(context: any) {
  const admin = await requireAdmin(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const users = await context.env.DB
      .prepare("SELECT id, name, email, COALESCE(role, 'client') AS role, created_at FROM users ORDER BY id DESC LIMIT 100")
      .all();

    return Response.json({ users: users?.results || [] });
  } catch (error) {
    return Response.json({ error: "Kullanıcı listesi alınamadı." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdmin(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);
    const role = String(body?.role || "");

    if (!userId || !["admin", "client", "blocked"].includes(role)) {
      return Response.json({ error: "Geçersiz kullanıcı veya rol." }, { status: 400 });
    }

    if (userId === admin.user.id && role !== "admin") {
      return Response.json({ error: "Kendi admin yetkini kaldıramazsın veya kendini engelleyemezsin." }, { status: 400 });
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

async function requireAdmin(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, COALESCE(users.role, 'client') AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  if (user.role === "blocked") {
    return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  }

  if (user.role !== "admin") {
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
