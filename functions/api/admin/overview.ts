export async function onRequestGet(context: any) {
  const admin = await requireAdmin(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const totalUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users")
      .first();

    const adminUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .first();

    const clientUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'client' OR role IS NULL")
      .first();

    const recentUsers = await context.env.DB
      .prepare("SELECT id, name, email, COALESCE(role, 'client') AS role, created_at FROM users ORDER BY id DESC LIMIT 6")
      .all();

    const activeSessions = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM sessions WHERE expires_at > datetime('now')")
      .first();

    return Response.json({
      admin: admin.user,
      stats: {
        totalUsers: totalUsers?.count || 0,
        adminUsers: adminUsers?.count || 0,
        clientUsers: clientUsers?.count || 0,
        activeSessions: activeSessions?.count || 0,
      },
      recentUsers: recentUsers?.results || [],
    });
  } catch (error) {
    return Response.json({ error: "Admin verileri alınamadı. users tablosunda role kolonu olduğundan emin ol." }, { status: 500 });
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
