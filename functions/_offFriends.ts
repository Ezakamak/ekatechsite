const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const user = await context.env.DB.prepare(
    `SELECT u.id, u.name, u.role, u.email
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?
       AND datetime(replace(substr(s.expires_at, 1, 19), 'T', ' ')) > datetime('now')`,
  ).bind(token).first<any>();

  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const role = String((user.role || "").toLowerCase());
  const isOwner = String(user.email || "").toLowerCase() === OWNER_EMAIL;
  if (!isOwner && role !== "off" && role !== "admin" && role !== "owner") {
    return { ok: false, status: 403, error: "OFF access required" };
  }

  await ensureFriendshipTables(context);
  return { ok: true, user: { id: Number(user.id), name: String(user.name || "") } };
}

export async function ensureFriendshipTables(context: any) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS off_friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      addressee_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, addressee_id)
    )
  `).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_off_friendships_requester_id ON off_friendships(requester_id)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_off_friendships_addressee_id ON off_friendships(addressee_id)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_off_friendships_status ON off_friendships(status)`).run();
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
