import { requireOffUser } from "../../../_offFriends";

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const body = await context.request.json().catch(() => null);
  const friendshipId = Number(body?.friendshipId || 0);
  const action = String(body?.action || "");
  if (!friendshipId || !["accept", "reject"].includes(action)) return Response.json({ error: "Geçersiz body" }, { status: 400 });

  const row = await context.env.DB.prepare(`SELECT * FROM off_friendships WHERE id = ?`).bind(friendshipId).first<any>();
  if (!row) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  if (Number(row.addressee_id) !== uid) return Response.json({ error: "Bu isteği cevaplayamazsın" }, { status: 403 });
  if (row.status !== "pending") return Response.json({ error: "İstek artık pending değil" }, { status: 409 });

  const next = action === "accept" ? "accepted" : "rejected";
  await context.env.DB.prepare(`UPDATE off_friendships SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(next, friendshipId).run();
  return Response.json({ ok: true, status: next });
}
