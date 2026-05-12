const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const lobbyId = Number(body?.lobby_id);
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await context.env.DB
      .prepare("SELECT id, creator_user_id, opponent_user_id, status FROM duel_lobbies WHERE id = ?")
      .bind(lobbyId)
      .first();

    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (lobby.status !== "open") return Response.json({ error: "Bu lobby artık katılıma açık değil." }, { status: 409 });
    if (Number(lobby.creator_user_id) === Number(auth.user.id)) return Response.json({ error: "Kendi lobby'ne katılamazsın." }, { status: 400 });

    const result = await context.env.DB
      .prepare("UPDATE duel_lobbies SET opponent_user_id = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL")
      .bind(auth.user.id, lobbyId)
      .run();

    if (result?.meta?.changes === 0) {
      return Response.json({ error: "Bu lobby'ye başka biri katılmış." }, { status: 409 });
    }

    return Response.json({ success: true, message: "Düelloya katıldın.", lobby_id: lobbyId });
  } catch (error) {
    return Response.json({ error: "Lobby'ye katılınamadı." }, { status: 500 });
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
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
