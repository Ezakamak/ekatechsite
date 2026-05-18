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
  await ensureOffProfile(context, Number(user.id));
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

export function resolveDisplayName(row: any) {
  const profileName = String(row?.off_display_name || "").trim();
  const username = String(row?.username || "").trim();
  const displayName = String(row?.display_name || "").trim();
  const name = String(row?.name || "").trim();
  if (profileName) return profileName;
  if (username) return username;
  if (displayName) return displayName;
  if (name) return name;
  return `Player #${Number(row?.id || row?.user_id || 0)}`;
}

export async function ensureOffProfile(context: any, userId: number) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS off_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      display_name TEXT,
      avatar_url TEXT,
      banner_url TEXT,
      bio TEXT,
      selected_title TEXT,
      selected_badge TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(
    `INSERT INTO off_profiles (user_id) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM off_profiles WHERE user_id=?)`
  ).bind(userId, userId).run();
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
