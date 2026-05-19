import { requireOffUser } from '../../../_offFriends';
import { applySeasonPointsForMatch, rebuildLeaderboard } from '../../../_offLeaderboard';
import { ensureOffLeaderboardSchema } from '../../../_offLeaderboardSchema';

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'owner'].includes(String(auth.user.role || ''))) return Response.json({ error: 'Forbidden' }, { status: 403 });

  await ensureOffLeaderboardSchema(context);
  const unapplied = await context.env.DB.prepare(`SELECT id FROM off_match_history WHERE season_points_applied=0 AND status IN ('completed','draw') ORDER BY id ASC LIMIT 10000`).all<any>();
  let backfilled = 0;
  for (const row of unapplied.results || []) {
    const res = await applySeasonPointsForMatch(context, Number(row.id));
    if (res?.applied) backfilled++;
  }

  const rebuilt = await rebuildLeaderboard(context, {});

  const [mh, sp, ss, unappliedNow] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_season_points`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_leaderboard_snapshots`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history WHERE season_points_applied=0 AND status IN ('completed','draw')`).first<any>(),
  ]);

  return Response.json({ ok: true, repaired: true, matchHistoryCount: Number(mh?.count || 0), seasonPointsCount: Number(sp?.count || 0), snapshotCount: Number(ss?.count || 0), unappliedMatches: Number(unappliedNow?.count || 0), backfilledMatches: backfilled, affectedUsers: Number(rebuilt?.affectedUsers || 0) });
}
