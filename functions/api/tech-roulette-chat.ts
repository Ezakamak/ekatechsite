const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const MAX_MESSAGE_LENGTH = 600;

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureChatTables(context);
    const url = new URL(context.request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 80);
    const result = await context.env.DB
      .prepare(`
        SELECT
          tech_roulette_chat_messages.id,
          tech_roulette_chat_messages.user_id,
          COALESCE(users.name, 'OFF Player') AS user_name,
          COALESCE(users.avatar_url, '') AS user_avatar_url,
          CASE WHEN lower(COALESCE(users.email, '')) = ? THEN 'owner' ELSE COALESCE(users.role, 'off') END AS user_role,
          tech_roulette_chat_messages.message,
          tech_roulette_chat_messages.created_at
        FROM tech_roulette_chat_messages
        LEFT JOIN users ON tech_roulette_chat_messages.user_id = users.id
        ORDER BY tech_roulette_chat_messages.id DESC
        LIMIT ?
      `)
      .bind(OWNER_EMAIL, limit)
      .all();
    return Response.json({ ok: true, messages: [...(result?.results || [])].reverse() });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await context.request.json().catch(() => null);
  const message = String(body?.message || "").trim();
  if (!message) return Response.json({ error: "Mesaj boş olamaz." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) return Response.json({ error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` }, { status: 413 });

  try {
    await ensureChatTables(context);
    const limitResult = await checkSimpleLimit(context, `roulette-chat:${auth.user.id}`, 12, 60);
    if (!limitResult.ok) return Response.json({ error: "Çok hızlı mesaj gönderiyorsun. Biraz bekle." }, { status: 429 });

    await context.env.DB
      .prepare(`INSERT INTO tech_roulette_chat_messages (user_id, message, created_at) VALUES (?, ?, datetime('now'))`)
      .bind(auth.user.id, message)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 500 });
  }
}

async function ensureChatTables(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, reset_at TEXT NOT NULL)`).run();
  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS tech_roulette_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tech_roulette_chat_created ON tech_roulette_chat_messages(created_at DESC)`).run();
}

async function checkSimpleLimit(context: any, key: string, limit: number, windowSeconds: number) {
  try {
    const now = Date.now();
    const resetAt = new Date(now + windowSeconds * 1000).toISOString();
    const existing = await context.env.DB.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();
    if (!existing || new Date(existing.reset_at).getTime() <= now) {
      await context.env.DB.prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)").bind(key, resetAt).run();
      return { ok: true };
    }
    if (Number(existing.count || 0) >= limit) return { ok: false };
    await context.env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`SELECT users.id, users.name, users.email, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!["off", "admin", "owner"].includes(user.role)) return { ok: false, status: 403, error: "OFF erişimi gerekli." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Rulet sohbeti yüklenemedi.";
}
