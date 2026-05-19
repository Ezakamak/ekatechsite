import { requireOffUser } from '../../../_offFriends';
import { applySeasonPointsForMatch, rebuildLeaderboard } from '../../../_offLeaderboard';
import { ensureOffLeaderboardSchema } from '../../../_offLeaderboardSchema';

async function getColumns(context: any, tableName: string) {
  try {
    const cols = await context.env.DB.prepare(`PRAGMA table_info(${tableName})`).all<any>();
    return new Set((cols.results || []).map((c: any) => String(c.name)));
  } catch {
    return new Set<string>();
  }
}

function selectTimestampExpr(cols: Set<string>) {
  const parts = ['created_at'];
  if (cols.has('updated_at')) parts.unshift('updated_at');
  if (cols.has('completed_at')) parts.unshift('completed_at');
  return `COALESCE(${parts.join(',')})`;
}

async function backfillMatchHistoryFromCompletedLobbies(context: any) {
  const duelCols = await getColumns(context, 'duel_lobbies');
  const cipherCols = await getColumns(context, 'cipher_lobbies');
  const coreCols = await getColumns(context, 'core_clash_lobbies');

  const duelTs = selectTimestampExpr(duelCols);
  const cipherTs = selectTimestampExpr(cipherCols);
  const coreTs = selectTimestampExpr(coreCols);

  const duelMode = duelCols.has('mode') ? 'mode' : 'NULL';
  const duelRoundCount = duelCols.has('round_count') ? 'round_count' : 'NULL';
  const duelReward = duelCols.has('reward_amount') ? 'reward_amount' : 'NULL';
  const cipherRoundCount = cipherCols.has('round_count') ? 'round_count' : 'NULL';
  const cipherReward = cipherCols.has('reward_amount') ? 'reward_amount' : 'NULL';
  const coreMapKey = coreCols.has('map_key') ? 'map_key' : 'NULL';

  const completedLobbyCounts = {
    techDuel: Number((await context.env.DB.prepare(`SELECT COUNT(*) count FROM duel_lobbies WHERE status='completed' AND creator_user_id IS NOT NULL AND opponent_user_id IS NOT NULL AND winner_user_id IS NOT NULL`).first<any>())?.count || 0),
    cipherBreak: Number((await context.env.DB.prepare(`SELECT COUNT(*) count FROM cipher_lobbies WHERE status='completed' AND creator_user_id IS NOT NULL AND opponent_user_id IS NOT NULL`).first<any>())?.count || 0),
    coreClash: Number((await context.env.DB.prepare(`SELECT COUNT(*) count FROM core_clash_lobbies WHERE status='completed' AND creator_user_id IS NOT NULL AND opponent_user_id IS NOT NULL`).first<any>())?.count || 0),
  };

  const duelInsert = await context.env.DB.prepare(`
    INSERT OR IGNORE INTO off_match_history (game_key,game_label,lobby_table,lobby_id,host_user_id,opponent_user_id,winner_user_id,loser_user_id,status,started_at,completed_at,season_id,season_points_applied,result_json,updated_at)
    SELECT
      'tech_duel','Tech Duel','duel_lobbies',id,creator_user_id,opponent_user_id,winner_user_id,
      CASE WHEN winner_user_id=creator_user_id THEN opponent_user_id ELSE creator_user_id END,
      'completed',created_at,${duelTs},0,0,
      json_object('source','completed_lobby_backfill','winner_user_id',winner_user_id,'mode',${duelMode},'round_count',${duelRoundCount},'reward_amount',${duelReward}),
      datetime('now')
    FROM duel_lobbies
    WHERE status='completed' AND creator_user_id IS NOT NULL AND opponent_user_id IS NOT NULL AND winner_user_id IS NOT NULL
  `).run();

  const cipherInsert = await context.env.DB.prepare(`
    INSERT OR IGNORE INTO off_match_history (game_key,game_label,lobby_table,lobby_id,host_user_id,opponent_user_id,winner_user_id,loser_user_id,status,started_at,completed_at,season_id,season_points_applied,result_json,updated_at)
    SELECT
      'cipher_break','Cipher Break','cipher_lobbies',id,creator_user_id,opponent_user_id,
      winner_user_id,
      CASE WHEN winner_user_id IS NULL THEN NULL WHEN winner_user_id=creator_user_id THEN opponent_user_id ELSE creator_user_id END,
      CASE WHEN winner_user_id IS NULL THEN 'draw' ELSE 'completed' END,
      created_at,${cipherTs},0,0,
      json_object('source','completed_lobby_backfill','winner_user_id',winner_user_id,'round_count',${cipherRoundCount},'reward_amount',${cipherReward}),
      datetime('now')
    FROM cipher_lobbies
    WHERE status='completed' AND creator_user_id IS NOT NULL AND opponent_user_id IS NOT NULL
  `).run();

  const coreInsert = await context.env.DB.prepare(`
    INSERT OR IGNORE INTO off_match_history (game_key,game_label,lobby_table,lobby_id,host_user_id,opponent_user_id,winner_user_id,loser_user_id,status,started_at,completed_at,season_id,season_points_applied,result_json,updated_at)
    SELECT
      'core_clash','Core Clash','core_clash_lobbies',id,creator_user_id,opponent_user_id,
      winner_user_id,
      CASE WHEN winner_user_id IS NULL THEN NULL WHEN winner_user_id=creator_user_id THEN opponent_user_id ELSE creator_user_id END,
      CASE WHEN winner_user_id IS NULL THEN 'draw' ELSE 'completed' END,
      created_at,${coreTs},0,0,
      json_object('source','completed_lobby_backfill','winner_user_id',winner_user_id,'map_key',${coreMapKey}),
      datetime('now')
    FROM core_clash_lobbies
    WHERE status='completed' AND creator_user_id IS NOT NULL AND opponent_user_id IS NOT NULL
  `).run();

  const backfilledHistory = {
    techDuel: Number((duelInsert as any)?.meta?.changes || 0),
    cipherBreak: Number((cipherInsert as any)?.meta?.changes || 0),
    coreClash: Number((coreInsert as any)?.meta?.changes || 0),
  };

  return {
    backfilledHistory: { ...backfilledHistory, total: backfilledHistory.techDuel + backfilledHistory.cipherBreak + backfilledHistory.coreClash },
    completedLobbyCounts,
  };
}

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
  let backfillInfo = { backfilledHistory: { techDuel: 0, cipherBreak: 0, coreClash: 0, total: 0 }, completedLobbyCounts: { techDuel: 0, cipherBreak: 0, coreClash: 0 } };
  try {
    backfillInfo = await backfillMatchHistoryFromCompletedLobbies(context);
    steps.push({ step: 'backfill_completed_lobbies', ok: true, ...backfillInfo });
  } catch (error: any) {
    return Response.json({ ok: false, failedStep: 'backfill_completed_lobbies', error: String(error?.message || error || 'Unknown error'), partialCounts: {}, steps }, { status: 500 });
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
  return Response.json({ ok: true, repaired: true, steps, backfilledHistory: backfillInfo.backfilledHistory, completedLobbyCounts: backfillInfo.completedLobbyCounts, matchHistoryCount: Number(mh?.count || 0), completedOrDrawCount: Number(completed?.count || 0), seasonPointsCount: Number(sp?.count || 0), snapshotCount: Number(ss?.count || 0), unappliedMatches: Number(unappliedNow?.count || 0), backfilledMatches: backfilled, affectedUsers: Number(rebuilt?.affectedUsers || 0) });
}
