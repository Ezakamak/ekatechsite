import { ensureOffLeaderboardSchema } from './_offLeaderboardSchema';
import { updateLeaderboardSnapshots } from './_offLeaderboard';

const SEASON_GAMES: Record<string, string> = { tech_duel: 'Tech Duel', cipher_break: 'Cipher Break', core_clash: 'Core Clash' };

export async function ensureOffSeasonEngineSchema(context: any) {
  await ensureOffLeaderboardSchema(context);
  const statements = [
`CREATE TABLE IF NOT EXISTS off_season_games (id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,game_key TEXT NOT NULL,game_label TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,points_multiplier REAL NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_games_unique ON off_season_games(season_id, game_key)`,
`CREATE TABLE IF NOT EXISTS off_season_rules (id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,win_points INTEGER NOT NULL DEFAULT 30,loss_points INTEGER NOT NULL DEFAULT 10,draw_points INTEGER NOT NULL DEFAULT 15,daily_first_match_bonus INTEGER NOT NULL DEFAULT 0,streak_bonus_points INTEGER NOT NULL DEFAULT 0,streak_required INTEGER NOT NULL DEFAULT 3,max_daily_points INTEGER,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_rules_unique ON off_season_rules(season_id)`,
`CREATE TABLE IF NOT EXISTS off_season_missions (id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,title TEXT NOT NULL,description TEXT,mission_type TEXT NOT NULL,game_key TEXT,target_value INTEGER NOT NULL DEFAULT 1,reward_points INTEGER NOT NULL DEFAULT 0,cadence TEXT NOT NULL DEFAULT 'season',enabled INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE INDEX IF NOT EXISTS idx_off_season_missions_season ON off_season_missions(season_id, enabled)`,
`CREATE TABLE IF NOT EXISTS off_season_mission_progress (id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,mission_id INTEGER NOT NULL,user_id INTEGER NOT NULL,progress_value INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,completed_at TEXT,reward_applied INTEGER NOT NULL DEFAULT 0,period_key TEXT NOT NULL DEFAULT 'season',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_mission_progress_unique ON off_season_mission_progress(season_id, mission_id, user_id, period_key)`,
`CREATE TABLE IF NOT EXISTS off_season_rewards (id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,reward_type TEXT NOT NULL,reward_key TEXT,reward_label TEXT NOT NULL,reward_value INTEGER,requirement_type TEXT NOT NULL DEFAULT 'rank',requirement_value INTEGER NOT NULL DEFAULT 1,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE INDEX IF NOT EXISTS idx_off_season_rewards_season ON off_season_rewards(season_id, enabled)`,
`CREATE TABLE IF NOT EXISTS off_season_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER,actor_user_id INTEGER,action TEXT NOT NULL,details_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE INDEX IF NOT EXISTS idx_off_season_audit_logs_season ON off_season_audit_logs(season_id, created_at)`
]; for (const stmt of statements) await context.env.DB.prepare(stmt).run();
}

async function logAudit(context: any, seasonId: number | null, actorUserId: number, action: string, details: any) {
  await context.env.DB.prepare(`INSERT INTO off_season_audit_logs (season_id, actor_user_id, action, details_json) VALUES (?,?,?,?)`).bind(seasonId, actorUserId, action, JSON.stringify(details || {})).run();
}

export async function getActiveOffSeason(context: any) { await ensureOffSeasonEngineSchema(context); return await context.env.DB.prepare(`SELECT id,slug,name,description,status,starts_at,ends_at FROM off_seasons WHERE status='active' AND (starts_at IS NULL OR datetime(replace(substr(starts_at,1,19),'T',' '))<=datetime('now')) AND (ends_at IS NULL OR datetime(replace(substr(ends_at,1,19),'T',' '))>datetime('now')) ORDER BY id DESC LIMIT 1`).first<any>(); }

export async function createOffSeason(context: any, payload: any, actorUserId: number) {
  await ensureOffSeasonEngineSchema(context);
  const r = await context.env.DB.prepare(`INSERT INTO off_seasons (slug,name,description,status,starts_at,ends_at,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).bind(payload.slug, payload.name, payload.description || null, payload.status || 'draft', payload.startsAt || null, payload.endsAt || null, actorUserId).run();
  const seasonId = Number(r.meta.last_row_id);
  await upsertChildren(context, seasonId, payload);
  await logAudit(context, seasonId, actorUserId, 'create_season', { payload });
  return seasonId;
}

async function upsertChildren(context:any, seasonId:number, payload:any){
  await context.env.DB.prepare(`DELETE FROM off_season_games WHERE season_id=?`).bind(seasonId).run();
  for (const g of (payload.games||[])) await context.env.DB.prepare(`INSERT INTO off_season_games (season_id,game_key,game_label,enabled,points_multiplier,created_at,updated_at) VALUES (?,?,?,?,?,datetime('now'),datetime('now'))`).bind(seasonId,g.gameKey,SEASON_GAMES[g.gameKey]||g.gameLabel||g.gameKey,Number(g.enabled??1),Number(g.pointsMultiplier??1)).run();
}

export async function updateOffSeason(context:any, seasonId:number, payload:any, actorUserId:number){ await ensureOffSeasonEngineSchema(context); await context.env.DB.prepare(`UPDATE off_seasons SET name=COALESCE(?,name), slug=COALESCE(?,slug), description=COALESCE(?,description), starts_at=?, ends_at=?, status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?`).bind(payload.name??null,payload.slug??null,payload.description??null,payload.startsAt??null,payload.endsAt??null,payload.status??null,seasonId).run(); await upsertChildren(context,seasonId,payload); await logAudit(context,seasonId,actorUserId,'update_season',{payload});}
export async function activateOffSeason(context:any, seasonId:number, actorUserId:number){const active=await getActiveOffSeason(context); if (active && Number(active.id)!==seasonId) throw new Error('Önce aktif sezonu bitir.'); await context.env.DB.prepare(`UPDATE off_seasons SET status='active', updated_at=datetime('now') WHERE id=?`).bind(seasonId).run(); await logAudit(context,seasonId,actorUserId,'activate_season',{});} 
export async function endOffSeason(context:any, seasonId:number, actorUserId:number){await context.env.DB.prepare(`UPDATE off_seasons SET status='ended', ends_at=COALESCE(ends_at,datetime('now')), updated_at=datetime('now') WHERE id=?`).bind(seasonId).run(); await logAudit(context,seasonId,actorUserId,'end_season',{});} 
export async function archiveOffSeason(context:any, seasonId:number, actorUserId:number){await context.env.DB.prepare(`UPDATE off_seasons SET status='archived', updated_at=datetime('now') WHERE id=?`).bind(seasonId).run(); await logAudit(context,seasonId,actorUserId,'archive_season',{});} 
export async function rebuildSeasonLeaderboard(context:any, seasonId:number){ const users=await context.env.DB.prepare(`SELECT DISTINCT user_id FROM off_season_points WHERE season_id=? LIMIT 10000`).bind(seasonId).all<any>(); const ids=(users.results||[]).map((x:any)=>Number(x.user_id)).filter(Boolean); await updateLeaderboardSnapshots(context,ids,seasonId); return {affectedUsers:ids.length}; }

export async function applySeasonPointsForMatchV2(context:any, matchHistoryId:number){
  await ensureOffSeasonEngineSchema(context);
  const match=await context.env.DB.prepare(`SELECT id,game_key,host_user_id,opponent_user_id,winner_user_id,loser_user_id,status,season_points_applied FROM off_match_history WHERE id=? LIMIT 1`).bind(matchHistoryId).first<any>();
  if(!match || Number(match.season_points_applied)===1) return {applied:false};
  const allowed=['completed','draw']; if(!allowed.includes(String(match.status||''))) { await context.env.DB.prepare(`UPDATE off_match_history SET season_points_applied=1 WHERE id=?`).bind(matchHistoryId).run(); return {applied:false}; }
  const active=await getActiveOffSeason(context);
  const target=[0];
  let mul=1, win=30, loss=10, draw=15;
  if(active){ const game=await context.env.DB.prepare(`SELECT enabled,points_multiplier FROM off_season_games WHERE season_id=? AND game_key=? LIMIT 1`).bind(active.id,match.game_key).first<any>(); if(Number(game?.enabled||0)===1){target.unshift(Number(active.id)); mul=Number(game?.points_multiplier||1); const rules=await context.env.DB.prepare(`SELECT win_points,loss_points,draw_points FROM off_season_rules WHERE season_id=? AND enabled=1 LIMIT 1`).bind(active.id).first<any>(); win=Number(rules?.win_points||30); loss=Number(rules?.loss_points||10); draw=Number(rules?.draw_points||15);} }
  const events = String(match.status)==='draw' ? [{userId:Number(match.host_user_id),points:Math.round(draw*mul),reason:'match_draw'},{userId:Number(match.opponent_user_id),points:Math.round(draw*mul),reason:'match_draw'}] : [{userId:Number(match.winner_user_id),points:Math.round(win*mul),reason:'match_win'},{userId:Number(match.loser_user_id),points:Math.round(loss*mul),reason:'match_loss'}];
  for (const e of events){ for (const sid of target){ await context.env.DB.prepare(`INSERT OR IGNORE INTO off_season_points (season_id,user_id,match_history_id,game_key,points,reason,details_json) VALUES (?,?,?,?,?,?,?)`).bind(sid,e.userId,matchHistoryId,match.game_key,e.points,e.reason,JSON.stringify({v:2})).run(); }}
  await context.env.DB.prepare(`UPDATE off_match_history SET season_points_applied=1,updated_at=datetime('now') WHERE id=?`).bind(matchHistoryId).run();
  return {applied:true};
}
