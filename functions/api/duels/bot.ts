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
    if (!bot?.id) return json({ error: "Bot profili hazırlanamadı." }, 500);

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

  const systemValue = `bot-user-${profile.email}`;
  const attempts = [
    { sql: "INSERT INTO users (name, email, password_hash, password_salt, role, email_verified, avatar_approved) VALUES (?, ?, ?, ?, 'off', 1, 1)", values: [profile.name, profile.email, systemValue, systemValue] },
    { sql: "INSERT INTO users (name, email, password_hash, password_salt, role, email_verified) VALUES (?, ?, ?, ?, 'off', 1)", values: [profile.name, profile.email, systemValue, systemValue] },
    { sql: "INSERT INTO users (name, email, role) VALUES (?, ?, 'off')", values: [profile.name, profile.email] },
  ];

  for (const attempt of attempts) {
    try {
      await context.env.DB.prepare(attempt.sql).bind(...attempt.values).run();
      return await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
    } catch {}
  }

  return null;
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
