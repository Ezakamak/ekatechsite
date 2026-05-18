import { getWallet } from "./_coinWallet";
import { awardGameExp, getLevelProgress } from "./_levels";
import { checkAndUnlockBadges } from "./_offAchievements";
import { ensureOffTables } from "./_offMigrations";
import { advanceQuestProgress } from "./_offQuests";

export async function recordOffMatch(context: any, userId: number, input: any) {
  await ensureOffTables(context);
  const gameKey = String(input.gameKey || "unknown");
  const result = String(input.result || "completed");
  const score = Number(input.score || 0);
  const expAmount = Math.max(0, Math.floor(Number(input.expAmount || 0)));
  const pointsEarned = Math.max(0, Math.floor(Number(input.pointsEarned || 0)));
  const season: any = await context.env.DB.prepare(`SELECT id FROM off_seasons WHERE is_active = 1 AND datetime('now') BETWEEN starts_at AND ends_at ORDER BY id DESC LIMIT 1`).first();
  const publicId = `off_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const inserted = await context.env.DB.prepare(
    `INSERT INTO off_matches (public_id, game_key, season_id, status, started_at, ended_at, winner_user_id, metadata_json)
     VALUES (?, ?, ?, 'completed', datetime('now'), datetime('now'), ?, ?)`
  ).bind(publicId, gameKey, season?.id || null, result === "win" ? userId : null, JSON.stringify(input.metadata || {})).run();
  const matchId = inserted.meta?.last_row_id;
  await context.env.DB.prepare(
    `INSERT INTO off_match_players (match_id, user_id, result, score, exp_earned, points_earned, stats_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(matchId, userId, result, score, expAmount, pointsEarned, JSON.stringify(input.stats || {})).run();
  await context.env.DB.prepare(
    `INSERT INTO off_match_events (match_id, user_id, event_type, payload_json, created_at) VALUES (?, ?, 'completed', ?, datetime('now'))`
  ).bind(matchId, userId, JSON.stringify(input)).run();
  await context.env.DB.prepare(
    `UPDATE off_user_profiles
     SET total_matches = COALESCE(total_matches, 0) + 1,
         wins = COALESCE(wins, 0) + ?,
         losses = COALESCE(losses, 0) + ?,
         perfect_rounds = COALESCE(perfect_rounds, 0) + ?,
         best_reaction_ms = CASE WHEN ? IS NULL THEN best_reaction_ms WHEN best_reaction_ms IS NULL THEN ? ELSE MIN(best_reaction_ms, ?) END,
         favorite_game = COALESCE(?, favorite_game),
         updated_at = datetime('now')
     WHERE user_id = ?`
  ).bind(result === "win" ? 1 : 0, result === "loss" ? 1 : 0, input.perfectRound ? 1 : 0, input.reactionMs ?? null, input.reactionMs ?? null, input.reactionMs ?? null, gameKey, userId).run();
  const level = expAmount > 0 ? await awardGameExp(context, userId, expAmount, input.expReason || `OFF match: ${gameKey}`, gameKey) : await getLevelProgress(context, userId);
  const questUpdates = await advanceQuestProgress(context, userId, { type: result === "win" ? "win_game" : "play_game", gameKey, amount: 1 });
  if (result === "win") questUpdates.push(...await advanceQuestProgress(context, userId, { type: "play_game", gameKey, amount: 1 }));
  const unlockedBadges = await checkAndUnlockBadges(context, userId, { ...input, gameKey, source: "match" });
  const wallet = await getWallet(context, userId);
  return {
    matchSummary: { publicId, gameKey, result, score, expEarned: expAmount, pointsEarned, completedAt: new Date().toISOString() },
    level,
    questUpdates,
    unlockedBadges,
    wallet,
  };
}
