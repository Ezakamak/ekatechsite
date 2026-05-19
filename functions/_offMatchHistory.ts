const GAME_LABELS: Record<string, string> = {
  tech_duel: 'Tech Duel', cipher_break: 'Cipher Break', core_clash: 'Core Clash', tech_dice: 'Tech Dice', tech_mines: 'Tech Mines', eka_towers: 'Eka Towers', tech_aviator: 'Tech Aviator', tech_roulette: 'Tech Roulette', tech_blackjack: 'Tech Blackjack', droptech: 'DropTech'
};
export function getGameLabel(gameKey: string) { return GAME_LABELS[gameKey] || gameKey; }
export function normalizeMatchStatus(status: string) {
  const s = String(status || '').toLowerCase();
  if (['completed','finished','won','lost'].includes(s)) return 'completed';
  if (['draw','tie'].includes(s)) return 'draw';
  if (['cancelled','canceled'].includes(s)) return 'cancelled';
  if (['expired','timeout'].includes(s)) return 'expired';
  if (['abandoned','forfeit'].includes(s)) return 'abandoned';
  return 'completed';
}
import { applySeasonPointsForMatch } from './_offLeaderboard';
import { ensureOffLeaderboardSchema } from './_offLeaderboardSchema';

export async function recordOffMatchHistory(context: any, payload: any) {
  try {
    await ensureOffLeaderboardSchema(context);
    const started = payload.startedAt ? Date.parse(payload.startedAt) : NaN;
    const ended = payload.completedAt ? Date.parse(payload.completedAt) : NaN;
    const duration = Number.isFinite(started) && Number.isFinite(ended) && ended >= started ? Math.round((ended-started)/1000) : null;
    const status = normalizeMatchStatus(payload.status);
    const result = await context.env.DB.prepare(`INSERT OR IGNORE INTO off_match_history (game_key,game_label,lobby_table,lobby_id,host_user_id,opponent_user_id,winner_user_id,loser_user_id,status,result_json,game_settings_json,started_at,completed_at,duration_seconds,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
      .bind(payload.gameKey, payload.gameLabel || getGameLabel(payload.gameKey), payload.lobbyTable, payload.lobbyId, payload.hostUserId, payload.opponentUserId ?? null, payload.winnerUserId ?? null, payload.loserUserId ?? null, status, payload.resultJson == null ? null : JSON.stringify(payload.resultJson), payload.gameSettingsJson == null ? null : JSON.stringify(payload.gameSettingsJson), payload.startedAt ?? null, payload.completedAt ?? null, duration)
      .run();

    const inserted = Boolean((result as any)?.meta?.changes);
    const existing = await context.env.DB.prepare(`SELECT id, season_points_applied FROM off_match_history WHERE game_key=? AND lobby_id=? LIMIT 1`).bind(payload.gameKey, payload.lobbyId).first<any>();
    const matchId = Number(existing?.id || 0);
    if (!inserted && !matchId) console.warn('[off_match_history] insert ignored but existing match not found', { gameKey: payload.gameKey, lobbyId: payload.lobbyId });
    if (!matchId) console.warn('[off_match_history] missing match id after write', { gameKey: payload.gameKey, lobbyId: payload.lobbyId });
    if (matchId && Number(existing?.season_points_applied || 0) === 0) {
      try {
        await applySeasonPointsForMatch(context, matchId);
      } catch (error) {
        console.warn('[off_leaderboard] apply points failed', { matchId, error: String(error) });
      }
    }
    return { inserted, matchId };
  } catch (error) {
    console.warn('[off_match_history] failed', { payload, error: String(error) });
    return { inserted: false, error: String(error) };
  }
}

