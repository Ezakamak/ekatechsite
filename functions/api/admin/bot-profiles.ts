const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const BOT_EMAIL_MARKER = ".bot@ekatech.local";
const MAX_AVATAR_DATA_URL_LENGTH = 700_000;

type BotProfile = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  role?: string | null;
  avatar_approved?: number | null;
};

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    await ensureKnownBots(context);
    const columns = await columnsOf(context, "users");
    const avatarSelect = columns.has("avatar_url") ? "avatar_url" : "NULL AS avatar_url";
    const roleSelect = columns.has("role") ? "role" : "NULL AS role";
    const avatarApprovedSelect = columns.has("avatar_approved") ? "avatar_approved" : "NULL AS avatar_approved";

    const rows = await context.env.DB.prepare(`
      SELECT id, name, email, ${avatarSelect}, ${roleSelect}, ${avatarApprovedSelect}
      FROM users
      WHERE lower(email) LIKE ? OR upper(name) LIKE '%BOT%'
      ORDER BY name ASC
    `).bind(`%${BOT_EMAIL_MARKER}`).all();

    return Response.json({ bots: rows?.results || [] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Bot profilleri alınamadı." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    const body = await context.request.json().catch(() => ({}));
    const botId = Number(body?.bot_id || 0);
    const avatarUrl = String(body?.avatar_url || "").trim();
    const displayName = String(body?.name || "").trim();

    if (!botId) return Response.json({ error: "Bot seçilmedi." }, { status: 400 });
    if (avatarUrl && !isSafeAvatarUrl(avatarUrl)) {
      return Response.json({ error: "Geçerli bir görsel seç. Cihazdan yüklenen sıkıştırılmış fotoğraf, / ile başlayan site içi yol veya http(s) link kabul edilir." }, { status: 400 });
    }

    const bot = await context.env.DB.prepare("SELECT id, name, email FROM users WHERE id = ?").bind(botId).first();
    if (!bot) return Response.json({ error: "Bot bulunamadı." }, { status: 404 });
    if (!isBotIdentity(bot.name, bot.email)) return Response.json({ error: "Sadece BOT profilleri düzenlenebilir." }, { status: 403 });

    const columns = await columnsOf(context, "users");
    const assignments: string[] = [];
    const values: any[] = [];

    if (columns.has("avatar_url")) {
      assignments.push("avatar_url = ?");
      values.push(avatarUrl);
    }
    if (columns.has("avatar_approved")) {
      assignments.push("avatar_approved = 1");
    }
    if (columns.has("profile_photo_approved")) {
      assignments.push("profile_photo_approved = 1");
    }
    if (displayName && columns.has("name")) {
      const cleanName = displayName.toUpperCase().includes("BOT") ? displayName : `${displayName} BOT`;
      assignments.push("name = ?");
      values.push(cleanName);
    }
    if (columns.has("updated_at")) {
      assignments.push("updated_at = datetime('now')");
    }

    if (!assignments.length) return Response.json({ error: "users tablosunda düzenlenebilir bot profil kolonu yok." }, { status: 500 });

    values.push(botId);
    await context.env.DB.prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`).bind(...values).run();

    const updated = await readBot(context, botId);
    return Response.json({ success: true, bot: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Bot profili güncellenemedi." }, { status: 500 });
  }
}

async function readBot(context: any, botId: number) {
  const columns = await columnsOf(context, "users");
  const avatarSelect = columns.has("avatar_url") ? "avatar_url" : "NULL AS avatar_url";
  const roleSelect = columns.has("role") ? "role" : "NULL AS role";
  const avatarApprovedSelect = columns.has("avatar_approved") ? "avatar_approved" : "NULL AS avatar_approved";
  return await context.env.DB.prepare(`SELECT id, name, email, ${avatarSelect}, ${roleSelect}, ${avatarApprovedSelect} FROM users WHERE id = ?`).bind(botId).first();
}

async function ensureKnownBots(context: any) {
  const known = [
    { name: "Byte BOT", email: "byte.bot@ekatech.local" },
    { name: "Glitch BOT", email: "glitch.bot@ekatech.local" },
    { name: "Echo BOT", email: "echo.bot@ekatech.local" },
    { name: "Nova BOT", email: "nova.bot@ekatech.local" },
    { name: "Kairo BOT", email: "kairo.bot@ekatech.local" },
  ];

  const columns = await columnsOf(context, "users");
  for (const profile of known) {
    const existing = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(profile.email).first();
    if (existing) continue;
    await createBotUser(context, columns, profile);
  }
}

async function createBotUser(context: any, columns: Set<string>, profile: { name: string; email: string }) {
  const insertColumns: string[] = [];
  const values: any[] = [];
  const systemValue = `bot-user-${profile.email}`;
  const now = new Date().toISOString();

  const info = (await context.env.DB.prepare("PRAGMA table_info(users)").all())?.results || [];
  for (const column of info as any[]) {
    const name = String(column.name || "");
    const lower = name.toLowerCase();
    if (!name || (Number(column.pk || 0) === 1 && lower === "id")) continue;

    const hasDefault = column.dflt_value !== null && column.dflt_value !== undefined;
    const required = Number(column.notnull || 0) === 1 && !hasDefault;
    let include = false;
    let value: any = null;

    if (lower === "name" || lower === "display_name" || lower === "username") { include = true; value = profile.name; }
    else if (lower === "email") { include = true; value = profile.email; }
    else if (lower === "role") { include = true; value = "off"; }
    else if (lower === "password_hash" || lower === "password" || lower === "password_salt" || lower === "salt") { include = true; value = systemValue; }
    else if (lower === "email_verified" || lower === "verified" || lower === "is_verified" || lower === "avatar_approved" || lower === "profile_photo_approved" || lower === "is_bot" || lower === "bot") { include = true; value = 1; }
    else if (lower === "avatar_url" || lower === "profile_photo_url") { include = true; value = ""; }
    else if (lower === "created_at" || lower === "updated_at") { include = true; value = now; }
    else if (lower === "status") { include = true; value = "active"; }
    else if (required) { include = true; value = String(column.type || "").toUpperCase().includes("INT") ? 0 : ""; }

    if (include) {
      insertColumns.push(name);
      values.push(value);
    }
  }

  if (!insertColumns.includes("email") || !insertColumns.includes("name")) return;
  const columnSql = insertColumns.map(quoteIdent).join(", ");
  const placeholders = insertColumns.map(() => "?").join(", ");
  await context.env.DB.prepare(`INSERT OR IGNORE INTO users (${columnSql}) VALUES (${placeholders})`).bind(...values).run();
}

function isSafeAvatarUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/")) return true;
  if (isSafeImageDataUrl(value)) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeImageDataUrl(value: string) {
  if (value.length > MAX_AVATAR_DATA_URL_LENGTH) return false;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value);
}

function isBotIdentity(name?: string | null, email?: string | null) {
  return String(email || "").toLowerCase().includes(BOT_EMAIL_MARKER) || String(name || "").toUpperCase().includes("BOT");
}

async function columnsOf(context: any, table: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  return new Set((rows?.results || []).map((row: any) => String(row.name || "")));
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(`
    SELECT
      users.id,
      users.name,
      users.email,
      users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
