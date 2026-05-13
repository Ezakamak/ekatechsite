const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const totalUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users")
      .first();

    const ownerUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE lower(email) = ?")
      .bind(OWNER_EMAIL)
      .first();

    const adminUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND lower(email) != ?")
      .bind(OWNER_EMAIL)
      .first();

    const offUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'off' AND lower(email) != ?")
      .bind(OWNER_EMAIL)
      .first();

    const clientUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE (role = 'client' OR role IS NULL) AND lower(email) != ?")
      .bind(OWNER_EMAIL)
      .first();

    const blockedUsers = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'blocked' AND lower(email) != ?")
      .bind(OWNER_EMAIL)
      .first();

    const recentUsers = await context.env.DB
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
        LIMIT 6
      `)
      .bind(OWNER_EMAIL)
      .all();

    const activeSessions = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM sessions WHERE expires_at > datetime('now')")
      .first();

    let customerRatingSummary = { averageRating: 0, ratedCompletedProjects: 0 };

    try {
      const ratingRow = await context.env.DB
        .prepare(`
          SELECT
            ROUND(AVG(project_feedback.rating), 1) AS average_rating,
            COUNT(project_feedback.id) AS rated_completed_projects
          FROM project_feedback
          JOIN project_requests ON project_feedback.project_request_id = project_requests.id
          WHERE project_requests.status = 'completed'
        `)
        .first();

      customerRatingSummary = {
        averageRating: Number(ratingRow?.average_rating || 0),
        ratedCompletedProjects: Number(ratingRow?.rated_completed_projects || 0),
      };
    } catch {
      // project_feedback tablosu henüz yoksa dashboard tamamen bozulmasın.
    }

    return Response.json({
      admin: admin.user,
      stats: {
        totalUsers: totalUsers?.count || 0,
        ownerUsers: ownerUsers?.count || 0,
        adminUsers: adminUsers?.count || 0,
        offUsers: offUsers?.count || 0,
        clientUsers: clientUsers?.count || 0,
        blockedUsers: blockedUsers?.count || 0,
        activeSessions: activeSessions?.count || 0,
        averageCustomerRating: customerRatingSummary.averageRating,
        ratedCompletedProjects: customerRatingSummary.ratedCompletedProjects,
      },
      recentUsers: recentUsers?.results || [],
    });
  } catch (error) {
    return Response.json({ error: "Admin verileri alınamadı. users tablosunda role kolonu olduğundan emin ol." }, { status: 500 });
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
