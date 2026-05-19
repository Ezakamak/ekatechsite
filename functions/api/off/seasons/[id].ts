import { requireOffUser } from '../../../_offFriends';
import { ensureOffSeasonEngineSchema, updateOffSeason } from '../../../_offSeasons';

export async function onRequestGet(context:any){
  await ensureOffSeasonEngineSchema(context);
  const auth=await requireOffUser(context); if(!auth.ok) return Response.json({error:auth.error},{status:auth.status});
  const id=Number(context.params.id||0);
  const season=await context.env.DB.prepare(`SELECT id,slug,name,description,status,starts_at,ends_at,updated_at FROM off_seasons WHERE id=? LIMIT 1`).bind(id).first<any>();
  if(!season) return Response.json({error:'Not found'},{status:404});
  const [games,rules,missions,rewards,leaderboardPreview]=await Promise.all([
    context.env.DB.prepare(`SELECT game_key,game_label,enabled,points_multiplier FROM off_season_games WHERE season_id=?`).bind(id).all<any>(),
    context.env.DB.prepare(`SELECT win_points,loss_points,draw_points,daily_first_match_bonus,streak_bonus_points,streak_required,max_daily_points,enabled FROM off_season_rules WHERE season_id=? LIMIT 1`).bind(id).first<any>(),
    context.env.DB.prepare(`SELECT id,title,description,mission_type,game_key,target_value,reward_points,cadence,enabled,sort_order FROM off_season_missions WHERE season_id=? ORDER BY sort_order ASC, id ASC LIMIT 200`).bind(id).all<any>(),
    context.env.DB.prepare(`SELECT id,reward_type,reward_key,reward_label,reward_value,requirement_type,requirement_value,enabled FROM off_season_rewards WHERE season_id=? ORDER BY id ASC LIMIT 200`).bind(id).all<any>(),
    context.env.DB.prepare(`SELECT user_id,total_points,wins,total_matches,win_rate FROM off_leaderboard_snapshots WHERE season_id=? ORDER BY total_points DESC LIMIT 10`).bind(id).all<any>()
  ]);
  return Response.json({ok:true,season,games:games.results||[],rules:rules||null,missions:missions.results||[],rewards:rewards.results||[],leaderboardPreview:leaderboardPreview.results||[]});
}

export async function onRequestPatch(context:any){
  await ensureOffSeasonEngineSchema(context);
  const auth=await requireOffUser(context); if(!auth.ok) return Response.json({error:auth.error},{status:auth.status});
  if(!['admin','owner'].includes(String(auth.user.role||''))) return Response.json({error:'Forbidden'},{status:403});
  const id=Number(context.params.id||0); const body=await context.request.json().catch(()=>({}));
  await updateOffSeason(context,id,body,auth.user.id); return Response.json({ok:true});
}
