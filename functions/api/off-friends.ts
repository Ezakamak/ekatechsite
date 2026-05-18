import { ensureOffTables, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const friends = await context.env.DB.prepare(`SELECT f.*, u1.name AS requester_name, u2.name AS addressee_name FROM off_friendships f LEFT JOIN users u1 ON u1.id = f.requester_id LEFT JOIN users u2 ON u2.id = f.addressee_id WHERE f.requester_id = ? OR f.addressee_id = ? ORDER BY f.updated_at DESC`).bind(auth.user.id, auth.user.id).all();
  const results = q ? await context.env.DB.prepare(`SELECT id, name, avatar_url, role FROM users WHERE lower(name) LIKE ? AND id <> ? AND role IN ('off','admin','owner') LIMIT 10`).bind(`%${q.toLowerCase()}%`, auth.user.id).all() : { results: [] };
  return Response.json({ ok: true, friends: friends?.results || [], searchResults: results?.results || [] });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  await ensureOffTables(context);
  const action = String(body?.action || "request");
  const targetId = Number(body?.targetUserId || body?.friendshipId || 0);
  if (action === "request") {
    if (targetId === Number(auth.user.id)) return Response.json({ error: "Kendine istek gönderemezsin." }, { status: 400 });
    const a = Math.min(Number(auth.user.id), targetId), b = Math.max(Number(auth.user.id), targetId);
    const existing = await context.env.DB.prepare(`SELECT id FROM off_friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`).bind(auth.user.id, targetId, targetId, auth.user.id).first();
    if (existing) return Response.json({ error: "Bu kullanıcıyla zaten bir arkadaşlık kaydı var." }, { status: 409 });
    await context.env.DB.prepare(`INSERT INTO off_friendships (requester_id, addressee_id, status, created_at, updated_at) VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`).bind(auth.user.id, targetId).run();
  } else if (action === "accept") {
    await context.env.DB.prepare(`UPDATE off_friendships SET status = 'accepted', updated_at = datetime('now') WHERE id = ? AND addressee_id = ?`).bind(targetId, auth.user.id).run();
  } else if (action === "reject" || action === "remove") {
    await context.env.DB.prepare(`DELETE FROM off_friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`).bind(targetId, auth.user.id, auth.user.id).run();
  } else if (action === "block") {
    await context.env.DB.prepare(`UPDATE off_friendships SET status = 'blocked', updated_at = datetime('now') WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`).bind(targetId, auth.user.id, auth.user.id).run();
  }
  return Response.json({ ok: true });
}
