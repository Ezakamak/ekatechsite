import { requireOffUser, resolveDisplayName } from "../../../_offFriends";
import { createNotification } from "../../../_notifications";
import { createPlayer } from "../../core-clash";

const FIXED_DUEL_REWARD = 50;
const FIXED_CIPHER_REWARD = 50;
const FIXED_CIPHER_ROUNDS = 3;
const MODE_LABELS: Record<string, string> = { classic: "Classic Mode", best_focus: "Best Focus", what_the_hold: "What The Hold" };
const MAP_LABELS: Record<string, string> = { firewall_city: "Firewall City", glitch_ruins: "Glitch Ruins", overclock_core: "Overclock Core", data_archive: "Data Archive" };
const INVITABLE_GAMES: Record<string, any> = {
  tech_duel: { label: "Tech Duel", offGameKey: "duel", route: "/off?game=duel&lobbyId={lobbyId}", modes: Object.keys(MODE_LABELS), rounds: [3, 5, 7] },
  cipher_break: { label: "Cipher Break", offGameKey: "cipher", route: "/off?game=cipher&lobbyId={lobbyId}" },
  core_clash: { label: "Core Clash", offGameKey: "clash", route: "/off?game=clash&lobbyId={lobbyId}", maps: Object.keys(MAP_LABELS) },
};

const sanitizeMessage = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
const toModeName = (mode: string) => MODE_LABELS[mode] || "Classic Mode";
const toMapName = (mapKey: string) => MAP_LABELS[mapKey] || "Firewall City";
const routeFor = (gameKey: string, lobbyId?: number | null) => lobbyId ? String(INVITABLE_GAMES[gameKey]?.route || "/off").replace("{lobbyId}", String(lobbyId)) : "/off";

export async function onRequestGet(context: any) { /* unchanged behavior + extra fields */
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await context.env.DB.prepare(`SELECT i.*, inviter.name inviter_name, inviter.email inviter_email, inviter.nickname inviter_nickname, invp.display_name inviter_off_display_name, invitee.name invitee_name, invitee.email invitee_email, invitee.nickname invitee_nickname, inteep.display_name invitee_off_display_name FROM off_game_invites i JOIN users inviter ON inviter.id=i.inviter_id JOIN users invitee ON invitee.id=i.invitee_id LEFT JOIN off_profiles invp ON invp.user_id=inviter.id LEFT JOIN off_profiles inteep ON inteep.user_id=invitee.id WHERE i.status='pending' AND (i.inviter_id=? OR i.invitee_id=?) AND i.expires_at > datetime('now') ORDER BY i.id DESC LIMIT 80`).bind(auth.user.id, auth.user.id).all<any>();
  const normalized = (rows?.results || []).map((row: any) => { const s = (()=>{try{return JSON.parse(row.game_settings_json||"{}")}catch{return {}}})(); return ({ inviteId: Number(row.id), inviter: { id: Number(row.inviter_id), displayName: resolveDisplayName({ id: row.inviter_id, name: row.inviter_name, email: row.inviter_email, nickname: row.inviter_nickname, off_display_name: row.inviter_off_display_name }) }, invitee: { id: Number(row.invitee_id), displayName: resolveDisplayName({ id: row.invitee_id, name: row.invitee_name, email: row.invitee_email, nickname: row.invitee_nickname, off_display_name: row.invitee_off_display_name }) }, gameKey: row.game_key, gameLabel: INVITABLE_GAMES[row.game_key]?.label || row.game_key, gameMode: row.game_mode || row.duel_mode || null, modeName: toModeName(String(row.game_mode || row.duel_mode || "")), roundCount: Number(row.round_count || 5), mapKey: s.mapKey || null, mapName: s.mapKey ? toMapName(s.mapKey) : null, status: row.status, expiresAt: row.expires_at, createdAt: row.created_at, targetRoute: row.target_route || null }); });
  return Response.json({ ok: true, incoming: normalized.filter((i: any) => i.invitee.id === auth.user.id), outgoing: normalized.filter((i: any) => i.inviter.id === auth.user.id) });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => null); const friendId = Number(body?.friendId || 0); const gameKey = String(body?.gameKey || "");
  const gameMode = String(body?.gameMode || body?.duelMode || ""); const roundCount = Number(body?.roundCount || 0); const mapKeyInput = String(body?.mapKey || ""); const message = sanitizeMessage(body?.message);
  if (!friendId || friendId === auth.user.id) return Response.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
  const gameCfg = INVITABLE_GAMES[gameKey]; if (!gameCfg) return Response.json({ error: "Geçersiz oyun." }, { status: 400 });
  const friend = await context.env.DB.prepare("SELECT id FROM users WHERE id=? LIMIT 1").bind(friendId).first(); if (!friend) return Response.json({ error: "Geçersiz kullanıcı." }, { status: 404 });
  const friendship = await context.env.DB.prepare(`SELECT id FROM off_friendships WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)) LIMIT 1`).bind(auth.user.id, friendId, friendId, auth.user.id).first();
  if (!friendship) return Response.json({ error: "Sadece accepted arkadaşlarına davet gönderebilirsin." }, { status: 403 });

  let selectedMode: string | null = null; let settings: any = {}; let rr: number | null = null;
  if (gameKey === "tech_duel") { if (!gameCfg.modes.includes(gameMode) || !gameCfg.rounds.includes(roundCount)) return Response.json({ error: "Geçersiz Tech Duel ayarı." }, { status: 400 }); selectedMode = gameMode; rr = roundCount; settings = { gameMode, roundCount }; }
  if (gameKey === "cipher_break") { settings = {}; rr = FIXED_CIPHER_ROUNDS; }
  if (gameKey === "core_clash") { const mk = gameCfg.maps.includes(mapKeyInput) ? mapKeyInput : gameCfg.maps[Math.floor(Math.random() * gameCfg.maps.length)]; settings = { mapKey: mk }; }

  const settingsJson = JSON.stringify(settings);
  const dup = await context.env.DB.prepare(`SELECT id FROM off_game_invites WHERE inviter_id=? AND invitee_id=? AND game_key=? AND COALESCE(game_mode,duel_mode,'')=? AND COALESCE(game_settings_json,'{}')=? AND status='pending' AND expires_at>datetime('now') LIMIT 1`).bind(auth.user.id, friendId, gameKey, selectedMode || "", settingsJson).first();
  if (dup) return Response.json({ error: "Bu oyun/ayar için aktif davet var." }, { status: 409 });

  const created = await context.env.DB.prepare(`INSERT INTO off_game_invites (inviter_id, invitee_id, game_key, duel_mode, game_mode, round_count, game_settings_json, target_route, status, message, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, '/off', 'pending', ?, datetime('now', '+5 minutes'))`).bind(auth.user.id, friendId, gameKey, selectedMode || null, selectedMode || null, rr, settingsJson, message || null).run();
  const inviteId = Number(created?.meta?.last_row_id || 0); const expiresRow = await context.env.DB.prepare("SELECT expires_at FROM off_game_invites WHERE id=?").bind(inviteId).first<any>();
  const me = await context.env.DB.prepare(`SELECT u.id, u.name, u.email, u.nickname, op.display_name AS off_display_name FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(auth.user.id).first<any>();
  const actor = resolveDisplayName(me);
  let notificationCreated = false;
  let notificationSkipped = false;
  let notificationError: string | null = null;
  try {
    const createdNotification = await createNotification(context, {
      userId: friendId,
      category: "off",
      type: "game_invite",
      title: gameKey === "tech_duel" ? "Tech Duel daveti" : gameKey === "cipher_break" ? "Cipher Break daveti" : "Core Clash daveti",
      body: gameKey === "tech_duel" ? `${actor} seni ${toModeName(selectedMode || "classic")} modunda Tech Duel oynamaya davet etti.` : gameKey === "cipher_break" ? `${actor} seni Cipher Break maçına davet etti.` : `${actor} seni ${toMapName(settings.mapKey)} haritasında Core Clash maçına davet etti.`,
      link: "/off",
      sourceTable: "off_game_invites",
      sourceId: String(inviteId),
      priority: "high",
      expiresAt: expiresRow?.expires_at || undefined
    });
    notificationSkipped = Boolean(createdNotification?.skipped);
    notificationCreated = Boolean(createdNotification?.ok) && !notificationSkipped;
  } catch (error: any) {
    notificationError = String(error?.message || error || "notification_create_failed");
    console.warn("[off/game-invites/create] createNotification failed", { inviteId, inviteeId: friendId, gameKey, notificationError });
  }
  return Response.json({ ok: true, inviteId, expiresAt: expiresRow?.expires_at || null, notificationCreated, notificationSkipped, notificationError, targetUserId: friendId, inviteeId: friendId, gameKey, gameSettingsJson: settingsJson });
}

export async function respondInvite(context: any, action: "accept" | "reject") { /* generic */
  const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => null); const inviteId = Number(body?.inviteId || 0);
  const invite = await context.env.DB.prepare(`SELECT * FROM off_game_invites WHERE id=? LIMIT 1`).bind(inviteId).first<any>();
  if (!invite) return Response.json({ error: "Davet bulunamadı." }, { status: 404 }); if (Number(invite.invitee_id) !== Number(auth.user.id)) return Response.json({ error: "Yetkisiz işlem." }, { status: 403 }); if (invite.status !== "pending") return Response.json({ error: "Bu davet artık aktif değil." }, { status: 409 });
  if (String(invite.expires_at || "") <= new Date().toISOString().slice(0, 19).replace("T", " ")) { await context.env.DB.prepare("UPDATE off_game_invites SET status='expired', responded_at=datetime('now') WHERE id=? AND status='pending'").bind(inviteId).run(); return Response.json({ error: "Bu davetin süresi dolmuş." }, { status: 409 }); }
  let lobbyId: number | null = null;
  if (action === "accept") {
    const s = (()=>{try{return JSON.parse(invite.game_settings_json||"{}")}catch{return {}}})();
    if (invite.game_key === "tech_duel") { const l = await context.env.DB.prepare(`INSERT INTO duel_lobbies (creator_user_id, opponent_user_id, mode, reward_amount, round_count, status) VALUES (?, ?, ?, ?, ?, 'in_progress')`).bind(invite.inviter_id, invite.invitee_id, invite.game_mode || invite.duel_mode || "classic", FIXED_DUEL_REWARD, Number(invite.round_count || 5)).run(); lobbyId = Number(l?.meta?.last_row_id || 0); }
    else if (invite.game_key === "cipher_break") { const l = await context.env.DB.prepare(`INSERT INTO cipher_lobbies (creator_user_id, opponent_user_id, reward_amount, round_count, status) VALUES (?, ?, ?, ?, 'in_progress')`).bind(invite.inviter_id, invite.invitee_id, FIXED_CIPHER_REWARD, FIXED_CIPHER_ROUNDS).run(); lobbyId = Number(l?.meta?.last_row_id || 0); }
    else if (invite.game_key === "core_clash") { const l = await context.env.DB.prepare(`INSERT INTO core_clash_lobbies (creator_user_id, opponent_user_id, map_key, status) VALUES (?, ?, ?, 'in_progress')`).bind(invite.inviter_id, invite.invitee_id, String(s.mapKey || "firewall_city")).run(); lobbyId = Number(l?.meta?.last_row_id || 0); await createPlayer(context, lobbyId, Number(invite.inviter_id), "creator"); await createPlayer(context, lobbyId, Number(invite.invitee_id), "opponent"); }
    const route = routeFor(invite.game_key, lobbyId);
    await context.env.DB.prepare(`UPDATE off_game_invites SET status='accepted', lobby_id=?, accepted_lobby_id=?, target_route=?, lobby_table=?, responded_at=datetime('now') WHERE id=? AND status='pending'`).bind(lobbyId, lobbyId, route, invite.game_key === "tech_duel" ? "duel_lobbies" : invite.game_key === "cipher_break" ? "cipher_lobbies" : "core_clash_lobbies", inviteId).run();
  } else await context.env.DB.prepare("UPDATE off_game_invites SET status='rejected', responded_at=datetime('now') WHERE id=? AND status='pending'").bind(inviteId).run();
  const me = await context.env.DB.prepare(`SELECT u.id, u.name, u.email, u.nickname, op.display_name AS off_display_name FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(auth.user.id).first<any>();
  const gameLabel = INVITABLE_GAMES[invite.game_key]?.label || "Oyun";
  await createNotification(context, { userId: Number(invite.inviter_id), category: "off", type: action === "accept" ? "game_invite_accepted" : "game_invite_rejected", title: action === "accept" ? `${gameLabel} davetin kabul edildi` : `${gameLabel} davetin reddedildi`, body: `${resolveDisplayName(me)} ${gameLabel} davetini ${action === "accept" ? "kabul etti" : "reddetti"}.`, link: action === "accept" ? routeFor(invite.game_key, lobbyId) : "/off", sourceTable: "off_game_invites", sourceId: `${action}:${inviteId}` });
  return Response.json({ ok: true, lobbyId, gameKey: invite.game_key, offGameKey: INVITABLE_GAMES[invite.game_key]?.offGameKey || null, redirectTo: action === "accept" ? routeFor(invite.game_key, lobbyId) : "/off" });
}

export async function cancelInvite(context: any) { const auth = await requireOffUser(context); if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status }); const body = await context.request.json().catch(() => null); const inviteId = Number(body?.inviteId || 0); const invite = await context.env.DB.prepare(`SELECT * FROM off_game_invites WHERE id=? LIMIT 1`).bind(inviteId).first<any>(); if (!invite) return Response.json({ error: "Davet bulunamadı." }, { status: 404 }); if (Number(invite.inviter_id) !== Number(auth.user.id)) return Response.json({ error: "Yetkisiz işlem." }, { status: 403 }); if (invite.status !== "pending") return Response.json({ error: "Bu davet artık iptal edilemez." }, { status: 409 }); await context.env.DB.prepare("UPDATE off_game_invites SET status='cancelled', responded_at=datetime('now') WHERE id=? AND status='pending'").bind(inviteId).run(); return Response.json({ ok: true }); }
