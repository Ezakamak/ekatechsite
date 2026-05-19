import { requireOffUser } from '../../_offFriends';
import { createOffSeason, ensureOffSeasonEngineSchema, getActiveOffSeason } from '../../_offSeasons';

export async function onRequestGet(context:any){
  await ensureOffSeasonEngineSchema(context);
  const auth=await requireOffUser(context); if(!auth.ok) return Response.json({error:auth.error},{status:auth.status});
  const isAdmin=['admin','owner'].includes(String(auth.user.role||''));
  const q=isAdmin?`status IN ('draft','scheduled','active','ended','archived')`:`status IN ('active','ended')`;
  const seasons=await context.env.DB.prepare(`SELECT id,slug,name,description,status,starts_at,ends_at,updated_at FROM off_seasons WHERE ${q} ORDER BY id DESC LIMIT 200`).all<any>();
  return Response.json({ok:true, activeSeason: await getActiveOffSeason(context), seasons: seasons.results||[]});
}

export async function onRequestPost(context:any){
  await ensureOffSeasonEngineSchema(context);
  const auth=await requireOffUser(context); if(!auth.ok) return Response.json({error:auth.error},{status:auth.status});
  if(!['admin','owner'].includes(String(auth.user.role||''))) return Response.json({error:'Forbidden'},{status:403});
  const body=await context.request.json().catch(()=>({}));
  const seasonId=await createOffSeason(context, body, auth.user.id);
  return Response.json({ok:true, seasonId});
}
