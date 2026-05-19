import { useMemo, useState } from "react";

type Season = { id:number; name:string; slug:string; description?:string; status:string; starts_at?:string; ends_at?:string; updated_at?:string };
const GAME_OPTIONS=[{key:"tech_duel",label:"Tech Duel"},{key:"cipher_break",label:"Cipher Break"},{key:"core_clash",label:"Core Clash"}] as const;

const defaultPayload={name:"OFF Season 1: Neon Rush",slug:"off-season-1-neon-rush",description:"OFF’un ilk resmi sezonu. Tech Duel, Cipher Break ve Core Clash maçlarında puan topla, görevleri tamamla ve leaderboard’da yüksel.",status:"draft",startsAt:"",endsAt:"",games:GAME_OPTIONS.map(g=>({gameKey:g.key,enabled:true,pointsMultiplier:1})),rules:{winPoints:30,lossPoints:10,drawPoints:15,dailyFirstMatchBonus:0,streakBonusPoints:0,streakRequired:3,maxDailyPoints:null},missions:[{title:"İlk Maç",description:"Sezon içinde 1 maç oyna.",missionType:"play_matches",gameKey:null,targetValue:1,rewardPoints:10,cadence:"season",enabled:true,sortOrder:1}],rewards:[{rewardType:"title",rewardKey:"neon_champion",rewardLabel:"Neon Champion",rewardValue:null,requirementType:"rank",requirementValue:1,enabled:true}]};

export function AdminSeasonEngine(){
 const [seasons,setSeasons]=useState<Season[]>([]); const [loading,setLoading]=useState(false); const [msg,setMsg]=useState(""); const [payload,setPayload]=useState<any>(defaultPayload);
 const grouped=useMemo(()=>({active:seasons.filter(s=>s.status==='active'),draft:seasons.filter(s=>s.status==='draft'),scheduled:seasons.filter(s=>s.status==='scheduled'),ended:seasons.filter(s=>s.status==='ended'),archived:seasons.filter(s=>s.status==='archived')}),[seasons]);
 const load=async()=>{setLoading(true);const r=await fetch('/api/off/seasons',{credentials:'same-origin'});const d=await r.json().catch(()=>({}));setSeasons(d.seasons||[]);setLoading(false);};
 const act=async(id:number,action:'activate'|'end'|'archive'|'rebuild')=>{const r=await fetch(`/api/off/seasons/${id}/${action}`,{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));setMsg(r.ok?`✅ ${action} başarılı`:(d?.error||'İşlem başarısız')); await load();};
 const create=async()=>{const r=await fetch('/api/off/seasons',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));setMsg(r.ok?'✅ Season oluşturuldu':(d?.error||'Oluşturma hatası')); if(r.ok) await load();};
 return <div className="space-y-4">
  <div className="flex items-center justify-between"><h3 className="text-xl text-white">Season Engine</h3><button className="rounded-full border border-white/20 px-4 py-2 text-white" onClick={load}>Fetch Seasons</button></div>
  {msg && <p className="text-sm text-cyan-100">{msg}</p>}
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
    <h4 className="text-white font-medium">Create New Season</h4>
    <input className="w-full rounded bg-black/40 p-2 text-white" value={payload.name} onChange={e=>setPayload((p:any)=>({...p,name:e.target.value,slug:e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}))} placeholder="Season name"/>
    <input className="w-full rounded bg-black/40 p-2 text-white" value={payload.slug} onChange={e=>setPayload((p:any)=>({...p,slug:e.target.value}))} placeholder="Slug"/>
    <textarea className="w-full rounded bg-black/40 p-2 text-white" value={payload.description} onChange={e=>setPayload((p:any)=>({...p,description:e.target.value}))} />
    <div className="grid gap-2 sm:grid-cols-2">{GAME_OPTIONS.map((g,idx)=><label key={g.key} className="rounded border border-white/10 p-2 text-white text-sm flex justify-between"><span>{g.label}</span><input type="number" min={0.5} max={3} step={0.1} value={payload.games[idx].pointsMultiplier} onChange={e=>setPayload((p:any)=>{const n=[...p.games];n[idx]={...n[idx],pointsMultiplier:Number(e.target.value)};return {...p,games:n};})} /></label>)}</div>
    <button className="rounded-full bg-white text-black px-4 py-2" onClick={create}>Save Draft</button>
  </div>
  {loading ? <p className="text-white/60">Loading...</p> : Object.entries(grouped).map(([k,list])=><div key={k} className="space-y-2"><h4 className="uppercase text-xs tracking-widest text-white/60">{k}</h4>{list.map(s=><div key={s.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-white flex flex-wrap gap-2 items-center justify-between"><div><p>{s.name}</p><p className="text-xs text-white/60">{s.status} · {s.starts_at||'-'} → {s.ends_at||'-'}</p></div><div className="flex gap-2 text-xs"><button className="rounded border border-white/20 px-2 py-1" onClick={()=>act(s.id,'activate')}>Activate</button><button className="rounded border border-white/20 px-2 py-1" onClick={()=>act(s.id,'end')}>End</button><button className="rounded border border-white/20 px-2 py-1" onClick={()=>act(s.id,'archive')}>Archive</button><button className="rounded border border-white/20 px-2 py-1" onClick={()=>act(s.id,'rebuild')}>Rebuild</button></div></div>)}</div>)}
 </div>
}
