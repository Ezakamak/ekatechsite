import { requireOffUser } from '../../../_offFriends';
import { ensureOffLeaderboardSchema } from '../../../_offLeaderboardSchema';

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'owner'].includes(String(auth.user.role || ''))) return Response.json({ error: 'Forbidden' }, { status: 403 });
  await ensureOffLeaderboardSchema(context);

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

  return Response.json({ ok: true, tables: { off_match_history: true, off_seasons: true, off_season_points: true, off_leaderboard_snapshots: true }, counts: {
    matchHistoryCount: Number(mh?.count || 0), completedOrDrawCount: Number(completed?.count || 0), unappliedMatches: Number(unapplied?.count || 0), seasonPointsCount: Number(points?.count || 0), snapshotCount: Number(snapshots?.count || 0)
  }, sampleMatches: sampleMatches.results || [], samplePoints: samplePoints.results || [], sampleSnapshots: sampleSnapshots.results || [] });
}
