import { requireOffUser } from "../../../_offFriends";
export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const body = await context.request.json().catch(() => null);
  const other = Number(body?.userId || 0);
  if (!other || other === uid) return Response.json({ error: "Geçersiz userId" }, { status: 400 });

  const existing = await context.env.DB.prepare(`SELECT * FROM off_friendships WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?) LIMIT 1`).bind(uid, other, other, uid).first<any>();
  if (existing) {
    await context.env.DB.prepare(`UPDATE off_friendships SET requester_id=?, addressee_id=?, status='blocked', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(uid, other, existing.id).run();
  } else {
    await context.env.DB.prepare(`INSERT INTO off_friendships (requester_id, addressee_id, status) VALUES (?, ?, 'blocked')`).bind(uid, other).run();
  }
  return Response.json({ ok: true });
}
