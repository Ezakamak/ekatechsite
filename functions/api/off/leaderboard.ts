import { resolveDisplayName } from '../../_offFriends';

export async function onRequestGet(context: any) {
  const u = new URL(context.request.url);
  const seasonId = Number(u.searchParams.get('seasonId') || 0);
  const gameKey = (u.searchParams.get('gameKey') || '').trim();
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit') || 50)));
  const season = await context.env.DB.prepare(`SELECT id, slug, name, status, starts_at, ends_at FROM off_seasons WHERE id=? LIMIT 1`).bind(seasonId).first<any>() || { id: 0, slug: 'all-time', name: 'All Time', status: 'active', starts_at: null, ends_at: null };

  const gameFilter = gameKey === 'tech_duel' ? 's.tech_duel_matches > 0' : gameKey === 'cipher_break' ? 's.cipher_break_matches > 0' : gameKey === 'core_clash' ? 's.core_clash_matches > 0' : '1=1';
  const rows = await context.env.DB.prepare(`SELECT s.*, u.name, u.email, u.nickname, u.role, op.display_name off_display_name, op.avatar_url, op.avatar_data
    FROM off_leaderboard_snapshots s
    JOIN users u ON u.id=s.user_id
    LEFT JOIN off_profiles op ON op.user_id=u.id
    WHERE s.season_id=? AND ${gameFilter} AND lower(COALESCE(u.role,'')) <> 'blocked'
    ORDER BY s.total_points DESC, s.win_rate DESC, s.total_matches DESC, s.user_id ASC
    LIMIT ?`).bind(seasonId, limit).all<any>();
  const leaderboard = (rows.results || []).map((r: any, i: number) => ({
    rank: i + 1, userId: r.user_id, displayName: resolveDisplayName(r), avatarUrl: r.avatar_data || r.avatar_url || null,
    totalPoints: r.total_points, totalMatches: r.total_matches, wins: r.wins, losses: r.losses, draws: r.draws, abandoned: r.abandoned,
    winRate: r.win_rate, techDuelMatches: r.tech_duel_matches, cipherBreakMatches: r.cipher_break_matches, coreClashMatches: r.core_clash_matches, lastMatchAt: r.last_match_at
  }));
  return Response.json({ ok: true, season: { id: season.id, slug: season.slug, name: season.name, status: season.status, startsAt: season.starts_at, endsAt: season.ends_at }, leaderboard });
}
