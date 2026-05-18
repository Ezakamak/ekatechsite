import { requireOffUser } from "../../../_offFriends";
export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const body = await context.request.json().catch(() => null);
  const other = Number(body?.userId || 0);
  if (!other) return Response.json({ error: "userId gerekli" }, { status: 400 });

  await context.env.DB.prepare(
    `DELETE FROM off_friendships WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?))`
  ).bind(uid, other, other, uid).run();
  return Response.json({ ok: true });
}
