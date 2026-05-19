import { ensureOffLeaderboardSchema } from './_offLeaderboardSchema';
const POINTS = { winner: 30, loser: 10, draw: 15 };
const MATCH_STATUSES = "('completed','draw','abandoned','expired','cancelled')";

export async function getActiveSeason(context: any) {
  await ensureOffLeaderboardSchema(context);
  const row = await context.env.DB.prepare(`SELECT * FROM off_seasons
    WHERE status='active'
      AND (starts_at IS NULL OR datetime(replace(substr(starts_at,1,19),'T',' ')) <= datetime('now'))
      AND (ends_at IS NULL OR datetime(replace(substr(ends_at,1,19),'T',' ')) > datetime('now'))
    ORDER BY id DESC LIMIT 1`).first<any>();
  return row || { id: 0, slug: 'all-time', name: 'All Time', status: 'active' };
}

export async function applySeasonPointsForMatch(context: any, matchHistoryId: number) {
  await ensureOffLeaderboardSchema(context);
  const match = await context.env.DB.prepare(`SELECT * FROM off_match_history WHERE id=? LIMIT 1`).bind(matchHistoryId).first<any>();
  if (!match || Number(match.season_points_applied) === 1) return { applied: false, reason: 'already_applied_or_missing' };
  if (!['completed', 'draw'].includes(String(match.status || ''))) return { applied: false, reason: 'status_not_eligible' };

  const activeSeason = await getActiveSeason(context);
  const targetSeasonIds = activeSeason.id === 0 ? [0] : [Number(activeSeason.id), 0];
  const events: Array<{ userId: number; points: number; reason: string }> = [];

  if (match.status === 'draw') {
    if (!match.host_user_id || !match.opponent_user_id) return { applied: false, reason: 'missing_draw_players' };
    events.push({ userId: Number(match.host_user_id), points: POINTS.draw, reason: 'match_draw' });
    events.push({ userId: Number(match.opponent_user_id), points: POINTS.draw, reason: 'match_draw' });
  } else {
    if (!match.winner_user_id || !match.loser_user_id) return { applied: false, reason: 'missing_winner_or_loser' };
    events.push({ userId: Number(match.winner_user_id), points: POINTS.winner, reason: 'match_win' });
    events.push({ userId: Number(match.loser_user_id), points: POINTS.loser, reason: 'match_loss' });
  }
  if (!events.length) return { applied: false, reason: 'no_point_events' };

  for (const e of events) {
    for (const seasonId of targetSeasonIds) {
      await context.env.DB.prepare(`INSERT OR IGNORE INTO off_season_points
        (season_id,user_id,match_history_id,game_key,points,reason,details_json)
        VALUES (?,?,?,?,?,?,?)`)
        .bind(seasonId, e.userId, matchHistoryId, match.game_key, e.points, `${e.reason}_s${seasonId}`, JSON.stringify({ status: match.status }))
        .run();
    }
  }

  const affectedUserIds = [...new Set(events.map((e) => e.userId))];
  if (affectedUserIds.length) await updateLeaderboardSnapshots(context, affectedUserIds);
  await context.env.DB.prepare(`UPDATE off_match_history SET season_points_applied=1, updated_at=datetime('now') WHERE id=?`).bind(matchHistoryId).run();
  return { applied: true, reason: 'applied', affectedUserIds };
}

export async function updateLeaderboardSnapshots(context: any, userIds: number[], seasonId?: number) {
  await ensureOffLeaderboardSchema(context);
  if (!userIds.length) return;
  const active = await getActiveSeason(context);
  const seasons = seasonId != null ? [seasonId] : [...new Set([0, Number(active.id || 0)])];

  for (const uid of userIds) {
    for (const sid of seasons) {
      const pointsRow = await context.env.DB.prepare(`SELECT COALESCE(SUM(points),0) total_points FROM off_season_points WHERE season_id=? AND user_id=?`).bind(sid, uid).first<any>();
      const matchWhere = sid === 0 ? `WHERE (host_user_id=? OR opponent_user_id=?) AND status IN ${MATCH_STATUSES}` : `WHERE (host_user_id=? OR opponent_user_id=?) AND status IN ${MATCH_STATUSES} AND season_id=?`;
      const args = sid === 0 ? [uid, uid] : [uid, uid, sid];
      const stat = await context.env.DB.prepare(`SELECT
        COUNT(*) total_matches,
        SUM(CASE WHEN winner_user_id=? THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN loser_user_id=? THEN 1 ELSE 0 END) losses,
        SUM(CASE WHEN status='draw' AND (host_user_id=? OR opponent_user_id=?) THEN 1 ELSE 0 END) draws,
        SUM(CASE WHEN status IN ('abandoned','expired','cancelled') AND (host_user_id=? OR opponent_user_id=?) THEN 1 ELSE 0 END) abandoned,
        SUM(CASE WHEN game_key='tech_duel' THEN 1 ELSE 0 END) tech_duel_matches,
        SUM(CASE WHEN game_key='cipher_break' THEN 1 ELSE 0 END) cipher_break_matches,
        SUM(CASE WHEN game_key='core_clash' THEN 1 ELSE 0 END) core_clash_matches,
        MAX(COALESCE(completed_at, created_at)) last_match_at,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed_non_draw
        FROM off_match_history ${matchWhere}`).bind(uid, uid, uid, uid, uid, uid, ...args).first<any>();
      const wins = Number(stat?.wins || 0);
      const completedNonDraw = Number(stat?.completed_non_draw || 0);
      const winRate = completedNonDraw > 0 ? (wins / completedNonDraw) * 100 : 0;
      await context.env.DB.prepare(`INSERT INTO off_leaderboard_snapshots
        (season_id,user_id,total_points,total_matches,wins,losses,draws,abandoned,tech_duel_matches,cipher_break_matches,core_clash_matches,win_rate,last_match_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(season_id,user_id) DO UPDATE SET
        total_points=excluded.total_points,total_matches=excluded.total_matches,wins=excluded.wins,losses=excluded.losses,draws=excluded.draws,abandoned=excluded.abandoned,
        tech_duel_matches=excluded.tech_duel_matches,cipher_break_matches=excluded.cipher_break_matches,core_clash_matches=excluded.core_clash_matches,
        win_rate=excluded.win_rate,last_match_at=excluded.last_match_at,updated_at=datetime('now')`)
        .bind(sid, uid, Number(pointsRow?.total_points || 0), Number(stat?.total_matches || 0), wins, Number(stat?.losses || 0), Number(stat?.draws || 0), Number(stat?.abandoned || 0), Number(stat?.tech_duel_matches || 0), Number(stat?.cipher_break_matches || 0), Number(stat?.core_clash_matches || 0), winRate, stat?.last_match_at || null)
        .run();
    }
  }
}

export async function rebuildLeaderboard(context: any, options: { seasonId?: number; limit?: number } = {}) {
  await ensureOffLeaderboardSchema(context);
  const limit = Math.min(5000, Math.max(1, Number(options.limit || 1000)));
  const unapplied = await context.env.DB.prepare(`SELECT id FROM off_match_history WHERE season_points_applied=0 AND status IN ('completed','draw') ORDER BY id ASC LIMIT ?`).bind(limit).all<any>();
  for (const row of unapplied.results || []) {
    await applySeasonPointsForMatch(context, Number(row.id));
  }

  const seasonId = Number(options.seasonId ?? 0);
  const users = await context.env.DB.prepare(`SELECT user_id FROM off_season_points WHERE season_id=?
    UNION SELECT host_user_id AS user_id FROM off_match_history
    UNION SELECT opponent_user_id AS user_id FROM off_match_history`).bind(seasonId).all<any>();
  const userIds = [...new Set((users.results || []).map((r: any) => Number(r.user_id)).filter(Boolean))];
  await updateLeaderboardSnapshots(context, userIds, seasonId);
  return { affectedUsers: userIds.length, backfilledMatches: (unapplied.results || []).length };
}
