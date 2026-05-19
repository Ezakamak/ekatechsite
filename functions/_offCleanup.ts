import { recordOffMatchHistory, getGameLabel } from './_offMatchHistory';

export async function runOffCleanup(context: any, options: any) {
  const dryRun = Boolean(options?.dryRun);
  const opportunistic = options?.triggerType === 'opportunistic';
  const limit = opportunistic ? 50 : 200;
  const expiredInvitesRows = await context.env.DB.prepare("SELECT id FROM off_game_invites WHERE status='pending' AND expires_at < datetime('now') LIMIT ?").bind(limit).all<any>();
  const expiredInviteIds = (expiredInvitesRows?.results || []).map((r:any)=>Number(r.id));
  if (!dryRun && expiredInviteIds.length) {
    const q = expiredInviteIds.map(()=>'?').join(',');
    await context.env.DB.prepare(`UPDATE off_game_invites SET status='expired', responded_at=COALESCE(responded_at, datetime('now')) WHERE id IN (${q})`).bind(...expiredInviteIds).run();
    await context.env.DB.prepare(`UPDATE notifications SET is_read=1, expires_at=datetime('now') WHERE source_table='off_game_invites' AND type='game_invite' AND source_id IN (${q})`).bind(...expiredInviteIds.map(String)).run();
  }
  let expiredLobbies=0, abandonedMatches=0;
  for (const cfg of [{t:'duel_lobbies',k:'tech_duel'},{t:'cipher_lobbies',k:'cipher_break'},{t:'core_clash_lobbies',k:'core_clash'}]) {
    const waiting = await context.env.DB.prepare(`SELECT * FROM ${cfg.t} WHERE status IN ('waiting','pending','open') AND created_at < datetime('now','-10 minutes') AND COALESCE(status,'') <> 'completed' LIMIT ?`).bind(limit).all<any>();
    for (const l of waiting?.results || []) { expiredLobbies++; if (!dryRun) { await context.env.DB.prepare(`UPDATE ${cfg.t} SET status='expired', completed_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND status<>'completed'`).bind(l.id).run(); await recordOffMatchHistory(context,{gameKey:cfg.k,gameLabel:getGameLabel(cfg.k),lobbyTable:cfg.t,lobbyId:l.id,hostUserId:l.creator_user_id,opponentUserId:l.opponent_user_id,status:'expired',startedAt:l.created_at,completedAt:new Date().toISOString()}); }}
    if (!opportunistic) {
      const active = await context.env.DB.prepare(`SELECT * FROM ${cfg.t} WHERE status IN ('active','in_progress') AND COALESCE(updated_at, created_at) < datetime('now','-30 minutes') AND COALESCE(status,'') <> 'completed' LIMIT ?`).bind(limit).all<any>();
      for (const l of active?.results || []) { abandonedMatches++; if (!dryRun) { await context.env.DB.prepare(`UPDATE ${cfg.t} SET status='abandoned', completed_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND status IN ('active','in_progress')`).bind(l.id).run(); await recordOffMatchHistory(context,{gameKey:cfg.k,gameLabel:getGameLabel(cfg.k),lobbyTable:cfg.t,lobbyId:l.id,hostUserId:l.creator_user_id,opponentUserId:l.opponent_user_id,status:'abandoned',startedAt:l.created_at,completedAt:new Date().toISOString()}); }}
    }
  }
  let cleanupRunId = null;
  if (!dryRun) {
    const r = await context.env.DB.prepare('INSERT INTO off_cleanup_runs (trigger_type,triggered_by_user_id,expired_invites,expired_lobbies,abandoned_matches,notes) VALUES (?,?,?,?,?,?)').bind(options.triggerType, options.triggeredByUserId ?? null, expiredInviteIds.length, expiredLobbies, abandonedMatches, opportunistic ? 'light-cleanup':'full-cleanup').run();
    cleanupRunId = Number(r?.meta?.last_row_id || 0);
  }
  return { dryRun, expiredInvites: expiredInviteIds.length, expiredLobbies, abandonedMatches, cleanupRunId };
}
