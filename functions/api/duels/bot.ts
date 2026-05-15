const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const BOT_REWARD_AMOUNT = 25;

const BOT_PROFILES = [
  { name: "Byte BOT", email: "byte.bot@ekatech.local", skill: "normal" },
  { name: "Glitch BOT", email: "glitch.bot@ekatech.local", skill: "hard" },
  { name: "Echo BOT", email: "echo.bot@ekatech.local", skill: "easy" },
  { name: "Nova BOT", email: "nova.bot@ekatech.local", skill: "normal" },
  { name: "Kairo BOT", email: "kairo.bot@ekatech.local", skill: "normal" },
];

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    const body = await context.request.json().catch(() => ({}));
    const lobbyId = Number(body?.lobby_id || 0);
    if (!lobbyId) return json({ error: "Lobby seçilmedi." }, 400);

    const lobby = await context.env.DB.prepare("SELECT * FROM duel_lobbies WHERE id = ?").bind(lobbyId).first();
    if (!lobby) return json({ error: "Lobby bulunamadı." }, 404);
    if (lobby.status !== "open") return json({ error: "Bu lobby artık bot için uygun değil." }, 409);
    if (Number(lobby.creator_user_id) !== Number(auth.user.id)) return json({ error: "Botu sadece lobby sahibi çağırabilir." }, 403);
    if (lobby.opponent_user_id) return json({ error: "Bu lobby'de zaten Player 2 var." }, 409);

    const profile = pickBotProfile(lobbyId, auth.user.id);
    const bot = await ensureBotUser(context, profile);
    if (!bot?.id) return json({ error: "Bot profili hazırlanamadı.", detail: "users tablosuna bot satırı oluşturulamadı." }, 500);

    const update = await context.env.DB
      .prepare("UPDATE duel_lobbies SET opponent_user_id = ?, reward_amount = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL")
      .bind(bot.id, BOT_REWARD_AMOUNT, lobbyId)
      .run();

    if (Number(update?.meta?.changes || 0) === 0) return json({ error: "Bu lobby'ye başka biri katılmış." }, 409);

    return json({ success: true, message: `${profile.name} Player 2 olarak bağlandı.`, lobby_id: lobbyId, bot });
  } catch (error) {
    return json({ error: "Bot rakip bağlanamadı.", detail: readableError(error) }, 500);
  }
}

function pickBotProfile(lobbyId: number, userId: number) {
  const index = Math.abs(hashNumber(`${lobbyId}:${userId}`)) % BOT_PROFILES.length;
  return BOT_PROFILES[index];
}

async function ensureBotUser(context: any, profile: any) {
  const existing = await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
  if (existing) return existing;

  const columns = await getTableColumns(context, "users");
  if (!columns.length) throw new Error("users tablosu okunamadı.");

  const insertColumns: string[] = [];
  const values: any[] = [];

  for (const column of columns) {
    const name = String(column.name || "");
    if (!name) continue;

    const isPrimaryId = Number(column.pk || 0) === 1 && name.toLowerCase() === "id";
    if (isPrimaryId) continue;

    const value = valueForBotColumn(name, column, profile);
    const hasDefault = column.dflt_value !== null && column.dflt_value !== undefined;
    const required = Number(column.notnull || 0) === 1 && !hasDefault;

    if (value.shouldInclude || required) {
      insertColumns.push(name);
      values.push(value.value);
    }
  }

  if (!insertColumns.includes("email")) throw new Error("users.email kolonu bulunamadı.");
  if (!insertColumns.includes("name")) throw new Error("users.name kolonu bulunamadı.");

  const placeholders = insertColumns.map(() => "?").join(", ");
  const columnSql = insertColumns.map((name) => `\"${name.replaceAll('"', '""')}\"`).join(", ");

  await context.env.DB
    .prepare(`INSERT OR IGNORE INTO users (${columnSql}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  const bot = await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
  if (!bot) throw new Error("Bot kullanıcısı insert sonrası bulunamadı.");
  return bot;
}

async function getTableColumns(context: any, table: string) {
  const result = await context.env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (result?.results || []) as any[];
}

function valueForBotColumn(name: string, column: any, profile: any) {
  const lower = name.toLowerCase();
  const systemValue = `bot-user-${profile.email}`;
  const now = new Date().toISOString();

  if (lower === "name" || lower === "display_name" || lower === "username") return include(profile.name);
  if (lower === "email") return include(profile.email);
  if (lower === "role") return include("off");
  if (lower === "password_hash" || lower === "password") return include(systemValue);
  if (lower === "password_salt" || lower === "salt") return include(systemValue);
  if (lower === "email_verified" || lower === "verified" || lower === "is_verified") return include(1);
  if (lower === "avatar_approved" || lower === "profile_photo_approved") return include(1);
  if (lower === "avatar_url" || lower === "profile_photo_url") return include("");
  if (lower === "created_at" || lower === "updated_at") return include(now);
  if (lower === "last_login_at" || lower === "reviewed_at" || lower === "approved_at") return skip(null);
  if (lower === "status") return include("active");
  if (lower === "is_bot" || lower === "bot") return include(1);

  const hasDefault = column.dflt_value !== null && column.dflt_value !== undefined;
  const required = Number(column.notnull || 0) === 1 && !hasDefault;
  if (!required) return skip(null);

  const type = String(column.type || "").toUpperCase();
  if (type.includes("INT") || type.includes("REAL") || type.includes("NUM")) return include(0);
  return include("");
}

function include(value: any) {
  return { shouldInclude: true, value };
}

function skip(value: any) {
  return { shouldInclude: false, value };
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "Tech Duel için OFF, admin veya owner rolü gerekiyor." };
  return { ok: true, user };
}

function hashNumber(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return hash;
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
