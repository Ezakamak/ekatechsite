import { requireSessionOnly, resolveDisplayName } from '../../_offFriends';

const ADMIN = new Set(['admin','owner']);
export async function onRequestGet(context: any) {
  const auth = await requireSessionOnly(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const q = new URL(context.request.url);
  const reqUserId = Number(q.searchParams.get('userId') || 0);
  const targetUserId = reqUserId && ADMIN.has(String(auth.user.role)) ? reqUserId : Number(auth.user.id);

  const user = await context.env.DB.prepare(`SELECT u.id,u.name,u.email,u.nickname,u.role,op.display_name off_display_name,op.avatar_url,op.avatar_data FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(targetUserId).first<any>();
  if (!user || String(user.role||'').toLowerCase() === 'blocked') return Response.json({ error: 'User not found' }, { status: 404 });
  const snap = await context.env.DB.prepare(`SELECT * FROM off_leaderboard_snapshots WHERE season_id=0 AND user_id=? LIMIT 1`).bind(targetUserId).first<any>();
  const m = await context.env.DB.prepare(`SELECT id,game_key,game_label,status,host_user_id,opponent_user_id,winner_user_id,loser_user_id,completed_at,created_at FROM off_match_history WHERE host_user_id=? OR opponent_user_id=? ORDER BY id DESC LIMIT 5`).bind(targetUserId, targetUserId).all<any>();
  return Response.json({ ok: true, user: { id: user.id, displayName: resolveDisplayName(user), avatarUrl: user.avatar_data || user.avatar_url || null }, allTime: {
    totalPoints: Number(snap?.total_points || 0), totalMatches: Number(snap?.total_matches || 0), wins: Number(snap?.wins || 0), losses: Number(snap?.losses || 0), draws: Number(snap?.draws || 0), abandoned: Number(snap?.abandoned || 0), winRate: Number(snap?.win_rate || 0),
    gameBreakdown: { techDuelMatches: Number(snap?.tech_duel_matches || 0), cipherBreakMatches: Number(snap?.cipher_break_matches || 0), coreClashMatches: Number(snap?.core_clash_matches || 0) }
  }, recentMatches: m.results || [] });
}
