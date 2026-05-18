import { getLevelProgress } from "./_levels";
import { ensureOffTables } from "./_offMigrations";

export async function unlockBadge(context: any, userId: number, badgeSlug: string, source = "system") {
  await ensureOffTables(context);
  const badge: any = await context.env.DB.prepare(`SELECT * FROM off_badges WHERE slug = ? AND is_active = 1`).bind(badgeSlug).first();
  if (!badge) return null;
  const insert = await context.env.DB.prepare(`INSERT OR IGNORE INTO off_user_badges (user_id, badge_slug, unlocked_at, source) VALUES (?, ?, datetime('now'), ?)`).bind(userId, badgeSlug, source).run();
  if ((insert.meta?.changes || 0) < 1) return null;
  return badge;
}

export async function checkAndUnlockBadges(context: any, userId: number, event: any = {}) {
  await ensureOffTables(context);
  const unlocked: any[] = [];
  const profile: any = await context.env.DB.prepare(`SELECT * FROM off_user_profiles WHERE user_id = ?`).bind(userId).first();
  const level = await getLevelProgress(context, userId);
  const games = await context.env.DB.prepare(`SELECT COUNT(DISTINCT game_key) AS count FROM off_matches m JOIN off_match_players p ON p.match_id = m.id WHERE p.user_id = ? AND m.status = 'completed'`).bind(userId).first();
  const gameCount = event.gameKey ? await context.env.DB.prepare(`SELECT COUNT(*) AS count FROM off_matches m JOIN off_match_players p ON p.match_id = m.id WHERE p.user_id = ? AND m.game_key = ? AND m.status = 'completed'`).bind(userId, event.gameKey).first() : null;

  const candidates = [
    ["first-game", Number(profile?.total_matches || 0) >= 1],
    ["first-win", Number(profile?.wins || 0) >= 1],
    ["daily-grinder", Number(profile?.total_matches || 0) >= 8],
    ["perfect-round", Number(profile?.perfect_rounds || 0) >= 1 || Boolean(event.perfectRound)],
    ["fast-hands", Number(profile?.best_reaction_ms || 999999) <= 500 || Number(event.reactionMs || 999999) <= 500],
    ["level-5-verified", level.level >= 5],
    ["level-10", level.level >= 10],
    ["multi-game", Number(games?.count || 0) >= 3],
    ["founder-player", Number(profile?.total_matches || 0) >= 1],
  ];
  const gameBadges: Record<string, string> = {
    memeClicker: "meme-master", dice: "dice-runner", blackjack: "blackjack-learner", mines: "mines-explorer", towers: "towers-climber",
    aviator: "aviator-pilot", market: "market-rookie", "core-clash": "core-clash-player",
  };
  if (event.gameKey && gameBadges[event.gameKey]) {
    const threshold = event.gameKey === "memeClicker" || event.gameKey === "dice" ? 10 : event.gameKey === "blackjack" ? 5 : 1;
    candidates.push([gameBadges[event.gameKey], Number(gameCount?.count || 0) >= threshold]);
  }
  for (const [slug, ok] of candidates) {
    if (ok) {
      const badge = await unlockBadge(context, userId, String(slug), event.source || "match");
      if (badge) unlocked.push(badge);
    }
  }
  return unlocked;
}
