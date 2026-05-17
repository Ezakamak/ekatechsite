const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];

const GAME_TABLES: Record<string, string> = {
  tech_duel: "duel_lobbies",
  cipher: "cipher_lobbies",
  core_clash: "core_clash_lobbies",
};

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await readBody(context.request);
  const game = String(body?.game || "").trim();
  const lobbyId = Number(body?.lobby_id);
  const table = GAME_TABLES[game];

  if (!table || !lobbyId) return Response.json({ error: "Geçersiz oyun veya lobby." }, { status: 400 });

  try {
    const lobby = await context.env.DB.prepare(`SELECT id, creator_user_id, status FROM ${table} WHERE id = ?`).bind(lobbyId).first();
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (Number(lobby.creator_user_id) !== Number(auth.user.id)) return Response.json({ error: "Bu lobby'yi sadece kurucusu kapatabilir." }, { status: 403 });
    if (lobby.status !== "open") return Response.json({ error: "Sadece bekleyen açık lobby kapatılabilir." }, { status: 409 });

    const update = await context.env.DB.prepare(`UPDATE ${table} SET status = 'cancelled', winner_user_id = NULL, updated_at = datetime('now') WHERE id = ? AND creator_user_id = ? AND status = 'open'`)
      .bind(lobbyId, auth.user.id)
      .run();

    await context.env.DB.prepare("DELETE FROM game_presence WHERE game = ? AND lobby_id = ?").bind(game, lobbyId).run().catch(() => null);

    return Response.json({ success: true, closed: Number(update?.meta?.changes || 0) > 0, lobby_id: lobbyId });
  } catch {
    return Response.json({ error: "Lobby kapatılamadı." }, { status: 500 });
  }
}

async function readBody(request: Request) {
  const text = await request.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
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
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "Bu işlem için OFF, admin veya owner rolü gerekiyor." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
