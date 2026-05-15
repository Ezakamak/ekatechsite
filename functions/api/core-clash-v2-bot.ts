import { createPlayer, getLobby, requireUser } from "./core-clash-v2";

const BOT_REWARD_AMOUNT = 25;
const BOT_PROFILES = [
  { name: "Byte BOT", email: "byte.bot@ekatech.local" },
  { name: "Glitch BOT", email: "glitch.bot@ekatech.local" },
  { name: "Echo BOT", email: "echo.bot@ekatech.local" },
  { name: "Nova BOT", email: "nova.bot@ekatech.local" },
  { name: "Kairo BOT", email: "kairo.bot@ekatech.local" },
];

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => ({}));
    const lobbyId = Number(body?.lobby_id || 0);
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (lobby.status !== "open") return Response.json({ error: "Bu lobby artık bot için uygun değil." }, { status: 409 });
    if (Number(lobby.creator_user_id) !== Number(auth.user.id)) return Response.json({ error: "Botu sadece lobby sahibi çağırabilir." }, { status: 403 });
    if (lobby.opponent_user_id) return Response.json({ error: "Bu lobby'de zaten Player 2 var." }, { status: 409 });

    const profile = pickBotProfile(lobbyId, auth.user.id);
    const bot = await ensureBotUser(context, profile);
    if (!bot?.id) return Response.json({ error: "Bot profili hazırlanamadı." }, { status: 500 });

    const update = await context.env.DB
      .prepare("UPDATE core_clash_lobbies SET opponent_user_id = ?, reward_amount = COALESCE(reward_amount, ?), status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL")
      .bind(bot.id, BOT_REWARD_AMOUNT, lobbyId)
      .run();

    if (Number(update?.meta?.changes || 0) === 0) return Response.json({ error: "Bu lobby'ye başka biri katılmış." }, { status: 409 });

    await createPlayer(context, lobbyId, Number(bot.id), "opponent");
    await context.env.DB
      .prepare("UPDATE core_clash_players SET entered_at = COALESCE(entered_at, datetime('now')), updated_at = datetime('now') WHERE lobby_id = ? AND user_id = ?")
      .bind(lobbyId, bot.id)
      .run();

    return Response.json({ success: true, message: `${profile.name} Player 2 olarak bağlandı.`, lobby_id: lobbyId, bot });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Core Clash BOT bağlanamadı." }, { status: 500 });
  }
}

function pickBotProfile(lobbyId: number, userId: number) {
  const index = Math.abs(hashNumber(`${lobbyId}:${userId}`)) % BOT_PROFILES.length;
  return BOT_PROFILES[index];
}

async function ensureBotUser(context: any, profile: any) {
  const existing = await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
  if (existing) return existing;

  const columns = (await context.env.DB.prepare("PRAGMA table_info(users)").all())?.results || [];
  const insertColumns: string[] = [];
  const values: any[] = [];
  const systemValue = `bot-user-${profile.email}`;
  const now = new Date().toISOString();

  for (const column of columns as any[]) {
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

  if (!insertColumns.includes("email") || !insertColumns.includes("name")) return null;
  const columnSql = insertColumns.map((name) => `"${name.replaceAll('"', '""')}"`).join(", ");
  const placeholders = insertColumns.map(() => "?").join(", ");
  await context.env.DB.prepare(`INSERT OR IGNORE INTO users (${columnSql}) VALUES (${placeholders})`).bind(...values).run();
  return await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
}

function hashNumber(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
