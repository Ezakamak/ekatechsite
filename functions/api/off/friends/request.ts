import { requireOffUser } from "../../../_offFriends";

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const from = auth.user.id;
  const body = await context.request.json().catch(() => null);
  const to = Number(body?.userId || 0);
  if (!to) return Response.json({ error: "userId gerekli" }, { status: 400 });
  if (to === from) return Response.json({ error: "Kendine istek gönderemezsin." }, { status: 400 });

  const target = await context.env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(to).first();
  if (!target) return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const existing = await context.env.DB.prepare(
    `SELECT * FROM off_friendships WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?) LIMIT 1`
  ).bind(from, to, to, from).first<any>();

  if (existing) {
    if (existing.status === "blocked") return Response.json({ error: "Bu kullanıcı ile arkadaşlık engellenmiş." }, { status: 403 });
    if (existing.status === "accepted") return Response.json({ error: "Zaten arkadaşsınız.", friendship: existing }, { status: 409 });
    if (existing.status === "pending") return Response.json({ error: "Bekleyen istek zaten var.", friendship: existing }, { status: 409 });
    await context.env.DB.prepare(`UPDATE off_friendships SET requester_id=?, addressee_id=?, status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(from,to,existing.id).run();
    return Response.json({ ok: true, message: "İstek yeniden gönderildi." });
  }

  await context.env.DB.prepare(`INSERT INTO off_friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`).bind(from, to).run();
  return Response.json({ ok: true, message: "İstek gönderildi." });
}
