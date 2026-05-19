import { requireOffUser } from '../../../../_offFriends';
import { endOffSeason, ensureOffSeasonEngineSchema } from '../../../../_offSeasons';
export async function onRequestPost(context:any){await ensureOffSeasonEngineSchema(context);const a=await requireOffUser(context); if(!a.ok) return Response.json({error:a.error},{status:a.status}); if(!['admin','owner'].includes(String(a.user.role||''))) return Response.json({error:'Forbidden'},{status:403}); await endOffSeason(context,Number(context.params.id||0),a.user.id); return Response.json({ok:true});}
