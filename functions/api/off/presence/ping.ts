import { requireOffUser, touchOffPresence } from "../../../_offFriends";

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await touchOffPresence(context, Number(auth.user.id));
  return Response.json({ ok: true, lastSeenAt: new Date().toISOString() });
}
