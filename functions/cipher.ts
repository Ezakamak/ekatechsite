const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  return Response.json({ user: auth.user, open: [], mine: [] });
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekiyor." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
