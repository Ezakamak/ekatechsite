import { requireOffUser } from '../../../_offFriends';
import { rebuildLeaderboard } from '../../../_offLeaderboard';

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!['admin','owner'].includes(String(auth.user.role || ''))) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const body = await context.request.json().catch(() => ({}));
  const seasonId = body?.seasonId == null ? undefined : Number(body.seasonId);
  const rebuilt = await rebuildLeaderboard(context, { seasonId });
  return Response.json({ ok: true, rebuilt: true, seasonId: seasonId ?? 0, affectedUsers: rebuilt.affectedUsers });
}
