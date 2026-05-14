import { createPlayer, getLobby, requireUser } from "./core-clash";

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const lobbyId = Number(body?.lobby_id);
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (lobby.status !== "open") return Response.json({ error: "Bu lobby artık açık değil." }, { status: 409 });
    if (Number(lobby.creator_user_id) === Number(auth.user.id)) return Response.json({ error: "Kendi lobby'ne katılamazsın." }, { status: 400 });

    const result = await context.env.DB
      .prepare("UPDATE core_clash_lobbies SET opponent_user_id = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL")
      .bind(auth.user.id, lobbyId)
      .run();

    if (result?.meta?.changes === 0) return Response.json({ error: "Bu lobby'ye başka biri katılmış." }, { status: 409 });

    await createPlayer(context, lobbyId, auth.user.id, "opponent");
    return Response.json({ success: true, message: "Core Clash lobby'sine katıldın. Maç iki taraf da ekrana girince başlar.", lobby_id: lobbyId });
  } catch {
    return Response.json({ error: "Core Clash lobby'sine katılınamadı." }, { status: 500 });
  }
}
