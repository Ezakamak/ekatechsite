import { requireOffUser } from '../../../_offFriends';
import { ensureOffLeaderboardSchema } from '../../../_offLeaderboardSchema';

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'owner'].includes(String(auth.user.role || ''))) return Response.json({ error: 'Forbidden' }, { status: 403 });
  let schemaOk = true;
  let schemaError: string | null = null;
  try {
    await ensureOffLeaderboardSchema(context);
  } catch (error: any) {
    schemaOk = false;
    schemaError = String(error?.message || error || 'Unknown schema error');
  }
  if (!schemaOk) {
    return Response.json({ ok: false, schemaOk: false, schemaError, counts: {
      matchHistoryCount: 0, completedOrDrawCount: 0, unappliedMatches: 0, seasonPointsCount: 0, snapshotCount: 0, usersInSnapshots: 0, usersInPoints: 0
    }, health: { hasHistory: false, hasCompletedMatches: false, hasPoints: false, hasSnapshots: false, likelyProblem: 'schema_error' }, sampleMatches: [], samplePoints: [], sampleSnapshots: [], lastErrors: [{ step: 'ensureOffLeaderboardSchema', error: schemaError }] }, { status: 500 });
  }

  const [mh, completed, unapplied, points, snapshots, sampleMatches, samplePoints, sampleSnapshots] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history WHERE status IN ('completed','draw')`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_match_history WHERE season_points_applied=0 AND status IN ('completed','draw')`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_season_points`).first<any>(),
    context.env.DB.prepare(`SELECT COUNT(*) count FROM off_leaderboard_snapshots`).first<any>(),
    context.env.DB.prepare(`SELECT * FROM off_match_history ORDER BY id DESC LIMIT 5`).all<any>(),
    context.env.DB.prepare(`SELECT * FROM off_season_points ORDER BY id DESC LIMIT 5`).all<any>(),
    context.env.DB.prepare(`SELECT * FROM off_leaderboard_snapshots ORDER BY updated_at DESC LIMIT 5`).all<any>(),
  ]);

  const counts = {
    matchHistoryCount: Number(mh?.count || 0), completedOrDrawCount: Number(completed?.count || 0), unappliedMatches: Number(unapplied?.count || 0), seasonPointsCount: Number(points?.count || 0), snapshotCount: Number(snapshots?.count || 0),
    usersInSnapshots: Number((await context.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) count FROM off_leaderboard_snapshots`).first<any>())?.count || 0),
    usersInPoints: Number((await context.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) count FROM off_season_points`).first<any>())?.count || 0),
  };
  const likelyProblem = !schemaOk ? 'schema_error'
    : counts.matchHistoryCount === 0 ? 'no_match_history'
    : counts.completedOrDrawCount === 0 ? 'no_completed_matches'
    : counts.unappliedMatches > 0 && counts.seasonPointsCount === 0 ? 'points_not_applied'
    : counts.seasonPointsCount > 0 && counts.snapshotCount === 0 ? 'snapshots_not_built'
    : counts.snapshotCount > 0 ? 'ok'
    : 'unknown';
  return Response.json({ ok: schemaOk, schemaOk, schemaError, counts, health: {
    hasHistory: counts.matchHistoryCount > 0, hasCompletedMatches: counts.completedOrDrawCount > 0, hasPoints: counts.seasonPointsCount > 0, hasSnapshots: counts.snapshotCount > 0, likelyProblem
  }, sampleMatches: sampleMatches.results || [], samplePoints: samplePoints.results || [], sampleSnapshots: sampleSnapshots.results || [], lastErrors: schemaError ? [{ step: 'ensureOffLeaderboardSchema', error: schemaError }] : [] }, { status: schemaOk ? 200 : 500 });
}
