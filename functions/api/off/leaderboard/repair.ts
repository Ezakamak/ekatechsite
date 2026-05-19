import { requireOffUser } from '../../../_offFriends';
import { applySeasonPointsForMatch, rebuildLeaderboard } from '../../../_offLeaderboard';
import { ensureOffLeaderboardSchema } from '../../../_offLeaderboardSchema';

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'owner'].includes(String(auth.user.role || ''))) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const steps: any[] = [];
  try {
    await ensureOffLeaderboardSchema(context);
    steps.push({ step: 'ensure_schema', ok: true });
  } catch (error: any) {
    return Response.json({ ok: false, failedStep: 'ensure_schema', error: String(error?.message || error || 'Unknown schema error'), partialCounts: {}, steps }, { status: 500 });
  }
  try {
    await context.env.DB.prepare(`UPDATE off_match_history
      SET season_points_applied = 0
      WHERE status IN ('completed','draw')
      AND season_points_applied = 1
      AND id NOT IN (
        SELECT DISTINCT match_history_id
        FROM off_season_points
        WHERE match_history_id IS NOT NULL
      )`).run();
  } catch {}
  const unapplied = await context.env.DB.prepare(`SELECT id FROM off_match_history WHERE season_points_applied=0 AND status IN ('completed','draw') ORDER BY id ASC LIMIT 10000`).all<any>();
  let backfilled = 0;
  try {
    for (const row of unapplied.results || []) {
      const res = await applySeasonPointsForMatch(context, Number(row.id));
      if (res?.applied) backfilled++;
    }
    steps.push({ step: 'backfill_points', ok: true, backfilledMatches: backfilled });
  } catch (error: any) {
    return Response.json({ ok: false, failedStep: 'backfill_points', error: String(error?.message || error || 'Unknown error'), partialCounts: { backfilledMatches: backfilled }, steps }, { status: 500 });
  }

  let rebuilt: any = null;
  try {
    rebuilt = await rebuildLeaderboard(context, {});
    steps.push({ step: 'rebuild_snapshots', ok: true, affectedUsers: Number(rebuilt?.affectedUsers || 0) });
  } catch (error: any) {
    return Response.json({ ok: false, failedStep: 'rebuild_snapshots', error: String(error?.message || error || 'Unknown error'), partialCounts: { backfilledMatches: backfilled }, steps }, { status: 500 });
  }

  const [mh, completed, sp, ss, unappliedNow] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history WHERE status IN ('completed','draw')`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_season_points`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_leaderboard_snapshots`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history WHERE season_points_applied=0 AND status IN ('completed','draw')`).first<any>(),
  ]);

  steps.push({ step: 'final_counts', matchHistoryCount: Number(mh?.count || 0), completedOrDrawCount: Number(completed?.count || 0), seasonPointsCount: Number(sp?.count || 0), snapshotCount: Number(ss?.count || 0), unappliedMatches: Number(unappliedNow?.count || 0) });
  return Response.json({ ok: true, repaired: true, steps, matchHistoryCount: Number(mh?.count || 0), completedOrDrawCount: Number(completed?.count || 0), seasonPointsCount: Number(sp?.count || 0), snapshotCount: Number(ss?.count || 0), unappliedMatches: Number(unappliedNow?.count || 0), backfilledMatches: backfilled, affectedUsers: Number(rebuilt?.affectedUsers || 0) });
}
