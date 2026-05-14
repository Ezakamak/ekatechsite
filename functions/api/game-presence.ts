import { markGameLeft, syncGamePresence, peekGamePresence } from "../_game-presence";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];

const GAME_TABLES: Record<string, string> = {
  tech_duel: "duel_lobbies",
  cipher: "cipher_lobbies",
  core_clash: "core_clash_lobbies",
};

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const url = new URL(context.request.url);
  const game = String(url.searchParams.get("game") || "").trim();
  const lobbyId = Number(url.searchParams.get("lobby_id"));
  const table = GAME_TABLES[game];

  if (!table || !lobbyId) return Response.json({ error: "Geçersiz oyun veya lobby." }, { status: 400 });

  try {
    return Response.json(await peekGamePresence(context, game, table, lobbyId, auth.user.id));
  } catch {
    return Response.json({ error: "Presence bilgisi alınamadı." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await context.request.json().catch(() => null);
  const game = String(body?.game || "").trim();
  const lobbyId = Number(body?.lobby_id);
  const action = String(body?.action || "active");
  const table = GAME_TABLES[game];

  if (!table || !lobbyId) return Response.json({ error: "Geçersiz oyun veya lobby." }, { status: 400 });

  try {
    if (action === "leave") {
      return Response.json(await markGameLeft(context, game, table, lobbyId, auth.user.id));
    }
    return Response.json(await syncGamePresence(context, game, table, lobbyId, auth.user.id));
  } catch {
    return Response.json({ error: "Presence güncellenemedi." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekiyor." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
