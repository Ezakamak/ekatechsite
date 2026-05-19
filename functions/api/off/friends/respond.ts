import { requireOffUser } from "../../../_offFriends";
import { createOffFriendAcceptedNotification } from "../../../_notifications";

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
  await context.env.DB.prepare(
    `UPDATE notifications
     SET is_read = 1, expires_at = datetime('now')
     WHERE user_id = ?
       AND source_table = 'off_friendships'
       AND source_id = ?
       AND type = 'friend_request'`
  ).bind(uid, String(friendshipId)).run();

  if (next === 'accepted') {
    const accepter = await context.env.DB.prepare(`SELECT COALESCE(name, email, 'Bir kullanıcı') AS display_name FROM users WHERE id = ?`).bind(uid).first<any>();
    await createOffFriendAcceptedNotification(context, {
      requesterId: Number(row.requester_id),
      addresseeDisplayName: String(accepter?.display_name || 'Bir kullanıcı'),
      friendshipId,
    });
  }

  return Response.json({ ok: true, status: next });
}
