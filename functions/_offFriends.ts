import { ensureUsersNicknameColumn, resolvePublicDisplayName } from "./_displayName";

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

  await ensureUsersNicknameColumn(context);
  await ensureFriendshipTables(context);
  await ensureOffProfile(context, Number(user.id));
  await ensureOffTitleTables(context);
  await touchOffPresence(context, Number(user.id));
  return { ok: true, user: { id: Number(user.id), name: String(user.name || ""), email: String(user.email || ""), role: isOwner ? "owner" : role } };
}

export async function requireOffSocialUser(context: any) {
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

  const rawRole = String(user.role || "client").toLowerCase();
  const isOwner = String(user.email || "").toLowerCase() === OWNER_EMAIL;
  const role = isOwner ? "owner" : rawRole;
  if (role === "blocked") return { ok: false, status: 403, error: "Bu hesap site erişiminden engellendi." };

  await ensureUsersNicknameColumn(context);
  await ensureFriendshipTables(context);
  await ensureOffProfile(context, Number(user.id));
  await touchOffPresence(context, Number(user.id));

  return {
    ok: true,
    user: {
      id: Number(user.id),
      name: String(user.name || ""),
      email: String(user.email || ""),
      role,
    },
  };
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
  if (profileName) return profileName;
  return resolvePublicDisplayName(row);
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
      avatar_data TEXT,
      banner_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(`ALTER TABLE off_profiles ADD COLUMN avatar_data TEXT`).run().catch(() => null);
  await context.env.DB.prepare(`ALTER TABLE off_profiles ADD COLUMN banner_data TEXT`).run().catch(() => null);
  await ensureFileStorageTables(context);
  await context.env.DB.prepare(
    `INSERT INTO off_profiles (user_id) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM off_profiles WHERE user_id=?)`
  ).bind(userId, userId).run();
}

export async function ensureFileStorageTables(context: any) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      r2_key TEXT NOT NULL UNIQUE,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    )
  `).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id)`).run();
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS storage_quota (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      used_bytes INTEGER NOT NULL DEFAULT 0,
      max_bytes INTEGER NOT NULL DEFAULT 8000000000,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(`
    INSERT INTO storage_quota (id, used_bytes, max_bytes, updated_at)
    VALUES (1, 0, 8000000000, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO NOTHING
  `).run();
}

export async function ensureOffPresenceTable(context: any) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS off_user_presence (
      user_id INTEGER PRIMARY KEY,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_off_user_presence_last_seen_at ON off_user_presence(last_seen_at)`).run();
}

export async function touchOffPresence(context: any, userId: number) {
  await ensureOffPresenceTable(context);
  await context.env.DB.prepare(
    `INSERT INTO off_user_presence (user_id, last_seen_at, updated_at)
     VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       last_seen_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(userId).run();
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function ensureOffTitleTables(context: any) {
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS off_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS off_user_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title_code TEXT NOT NULL,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, title_code)
    )
  `).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_off_user_titles_user_id ON off_user_titles(user_id)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_off_user_titles_title_code ON off_user_titles(title_code)`).run();

  const seeds = [
    ["first_win", "İlk Zafer", "İlk galibiyetini aldın", "common"],
    ["sharp_reflex", "Keskin Refleks", "Hızlı reaksiyon ustası", "rare"],
    ["coin_guardian", "Coin Muhafızı", "Coinlerini iyi korursun", "rare"],
    ["tower_climber", "Kule Tırmanıcısı", "Towers oyununda yükseğe çıktın", "epic"],
    ["mines_survivor", "Mayın Kaçkını", "Mines'ta hayatta kaldın", "epic"],
    ["lucky_core", "Şanslı Çekirdek", "Şans seninle", "legendary"],
    ["off_legend", "OFF Efsanesi", "OFF dünyasının efsanesi", "mythic"],
  ];
  for (const [code, name, description, rarity] of seeds) {
    await context.env.DB.prepare(`INSERT OR IGNORE INTO off_titles (code, name, description, rarity) VALUES (?, ?, ?, ?)`)
      .bind(code, name, description, rarity).run();
  }
}
