import { ensureOffTables, requireOffUser } from "../_offMigrations";
import { advanceQuestProgress } from "../_offQuests";

function code() { return Math.random().toString(36).slice(2, 5).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase(); }

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  await context.env.DB.prepare(`UPDATE off_lobbies SET status = 'expired', updated_at = datetime('now') WHERE status = 'waiting' AND expires_at < datetime('now')`).run();
  const rows = await context.env.DB.prepare(`SELECT * FROM off_lobbies WHERE (host_user_id = ? OR guest_user_id = ?) AND status IN ('waiting','ready','in_progress') ORDER BY id DESC LIMIT 10`).bind(auth.user.id, auth.user.id).all();
  return Response.json({ ok: true, lobbies: rows?.results || [] });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  await ensureOffTables(context);
  await context.env.DB.prepare(`UPDATE off_lobbies SET status = 'expired', updated_at = datetime('now') WHERE status = 'waiting' AND expires_at < datetime('now')`).run();
  const action = String(body?.action || "create");
  if (action === "create") {
    const active = await context.env.DB.prepare(`SELECT id FROM off_lobbies WHERE host_user_id = ? AND status IN ('waiting','ready','in_progress')`).bind(auth.user.id).first();
    if (active) return Response.json({ error: "Aynı anda birden fazla aktif lobby açamazsın." }, { status: 409 });
    const lobbyCode = code();
    await context.env.DB.prepare(`INSERT INTO off_lobbies (lobby_code, host_user_id, game_key, status, host_ready, is_private, created_at, updated_at, expires_at) VALUES (?, ?, ?, 'waiting', 0, 1, datetime('now'), datetime('now'), datetime('now', '+5 minutes'))`).bind(lobbyCode, auth.user.id, String(body?.gameKey || "dice")).run();
    await advanceQuestProgress(context, auth.user.id, { type: "use_feature", gameKey: "lobby", amount: 1 });
    return Response.json({ ok: true, lobbyCode });
  }
  if (action === "join") {
    const lobby: any = await context.env.DB.prepare(`SELECT * FROM off_lobbies WHERE lobby_code = ?`).bind(String(body?.lobbyCode || "").toUpperCase()).first();
    if (!lobby || lobby.status !== "waiting") return Response.json({ error: "Lobby katılmaya uygun değil." }, { status: 400 });
    await context.env.DB.prepare(`UPDATE off_lobbies SET guest_user_id = ?, status = 'ready', updated_at = datetime('now') WHERE id = ?`).bind(auth.user.id, lobby.id).run();
  }
  if (action === "ready") {
    await context.env.DB.prepare(`UPDATE off_lobbies SET host_ready = CASE WHEN host_user_id = ? THEN 1 ELSE host_ready END, guest_ready = CASE WHEN guest_user_id = ? THEN 1 ELSE guest_ready END, updated_at = datetime('now') WHERE id = ?`).bind(auth.user.id, auth.user.id, Number(body?.lobbyId || 0)).run();
    await context.env.DB.prepare(`UPDATE off_lobbies SET status = 'in_progress' WHERE id = ? AND host_ready = 1 AND guest_ready = 1 AND status = 'ready'`).bind(Number(body?.lobbyId || 0)).run();
  }
  if (action === "cancel") await context.env.DB.prepare(`UPDATE off_lobbies SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND host_user_id = ?`).bind(Number(body?.lobbyId || 0), auth.user.id).run();
  return Response.json({ ok: true });
}
