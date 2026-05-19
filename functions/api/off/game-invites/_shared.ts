import { requireOffUser, resolveDisplayName } from "../../_offFriends";
import { createNotification } from "../../_notifications";

const GAME_KEY = "tech_duel";
const MODE_LABELS: Record<string, string> = {
  classic: "Classic Mode",
  best_focus: "Best Focus",
  what_the_hold: "What The Hold",
};
const ALLOWED_MODES = new Set(Object.keys(MODE_LABELS));
const ALLOWED_ROUNDS = new Set([3, 5, 7]);
const FIXED_REWARD_AMOUNT = 50;

function sanitizeMessage(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function toModeName(mode: string) { return MODE_LABELS[mode] || "Classic Mode"; }

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const rows = await context.env.DB.prepare(
    `SELECT i.id, i.inviter_id, i.invitee_id, i.game_key, i.duel_mode, i.round_count, i.status, i.expires_at, i.created_at,
            inviter.name inviter_name, inviter.email inviter_email, inviter.nickname inviter_nickname, invp.display_name inviter_off_display_name,
            invitee.name invitee_name, invitee.email invitee_email, invitee.nickname invitee_nickname, inteep.display_name invitee_off_display_name
     FROM off_game_invites i
     JOIN users inviter ON inviter.id = i.inviter_id
     JOIN users invitee ON invitee.id = i.invitee_id
     LEFT JOIN off_profiles invp ON invp.user_id = inviter.id
     LEFT JOIN off_profiles inteep ON inteep.user_id = invitee.id
     WHERE i.status = 'pending'
       AND (i.inviter_id = ? OR i.invitee_id = ?)
       AND i.expires_at > datetime('now')
     ORDER BY i.id DESC
     LIMIT 80`
  ).bind(auth.user.id, auth.user.id).all<any>();

  const normalized = (rows?.results || []).map((row: any) => ({
    inviteId: Number(row.id),
    inviter: { id: Number(row.inviter_id), displayName: resolveDisplayName({ id: row.inviter_id, name: row.inviter_name, email: row.inviter_email, nickname: row.inviter_nickname, off_display_name: row.inviter_off_display_name }) },
    invitee: { id: Number(row.invitee_id), displayName: resolveDisplayName({ id: row.invitee_id, name: row.invitee_name, email: row.invitee_email, nickname: row.invitee_nickname, off_display_name: row.invitee_off_display_name }) },
    gameKey: row.game_key,
    duelMode: row.duel_mode,
    modeName: toModeName(String(row.duel_mode || "")),
    roundCount: Number(row.round_count || 5),
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));

  return Response.json({ ok: true, incoming: normalized.filter((i: any) => i.invitee.id === auth.user.id), outgoing: normalized.filter((i: any) => i.inviter.id === auth.user.id) });
}

export async function onRequestPost(context: any) {
  return onCreate(context);
}

async function onCreate(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => null);
  const friendId = Number(body?.friendId || 0);
  const gameKey = String(body?.gameKey || "");
  const duelMode = String(body?.duelMode || "classic");
  const roundCount = Number(body?.roundCount || 5);
  const message = sanitizeMessage(body?.message);

  if (!friendId || friendId === auth.user.id) return Response.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
  const friend = await context.env.DB.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(friendId).first();
  if (!friend) return Response.json({ error: "Geçersiz kullanıcı." }, { status: 404 });
  if (gameKey !== GAME_KEY) return Response.json({ error: "Geçersiz oyun." }, { status: 400 });
  if (!ALLOWED_MODES.has(duelMode)) return Response.json({ error: "Geçersiz Tech Duel modu." }, { status: 400 });
  if (!ALLOWED_ROUNDS.has(roundCount)) return Response.json({ error: "Geçersiz round sayısı." }, { status: 400 });

  const friendship = await context.env.DB.prepare(
    `SELECT id FROM off_friendships
     WHERE status = 'accepted'
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
     LIMIT 1`
  ).bind(auth.user.id, friendId, friendId, auth.user.id).first();
  if (!friendship) return Response.json({ error: "Sadece arkadaşlarını Tech Duel’e davet edebilirsin." }, { status: 403 });

  const duplicate = await context.env.DB.prepare(
    `SELECT id FROM off_game_invites
     WHERE inviter_id = ? AND invitee_id = ? AND game_key = ? AND duel_mode = ?
       AND status = 'pending' AND expires_at > datetime('now')
     LIMIT 1`
  ).bind(auth.user.id, friendId, GAME_KEY, duelMode).first();
  if (duplicate) return Response.json({ error: "Bu kullanıcıya bu mod için zaten aktif davetin var." }, { status: 409 });

  const created = await context.env.DB.prepare(
    `INSERT INTO off_game_invites (inviter_id, invitee_id, game_key, duel_mode, round_count, status, message, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now', '+5 minutes'))`
  ).bind(auth.user.id, friendId, GAME_KEY, duelMode, roundCount, message || null).run();

  const inviteId = Number(created?.meta?.last_row_id || 0);
  const expiresRow = await context.env.DB.prepare("SELECT expires_at FROM off_game_invites WHERE id = ?").bind(inviteId).first<any>();
  const inviteeProfile = await context.env.DB.prepare(`SELECT u.id, u.name, u.email, u.nickname, op.display_name AS off_display_name FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(auth.user.id).first<any>();
  const inviterDisplayName = resolveDisplayName(inviteeProfile);
  const notificationResult = await createNotification(context, {
    userId: friendId,
    category: "off",
    type: "game_invite",
    title: "Tech Duel daveti",
    body: `${inviterDisplayName} seni ${toModeName(duelMode)} modunda Tech Duel oynamaya davet etti.`,
    link: "/off",
    sourceTable: "off_game_invites",
    sourceId: String(inviteId),
    priority: "high",
    expiresAt: expiresRow?.expires_at || undefined,
  });

  return Response.json({ ok: true, inviteId, notificationCreated: !notificationResult?.skipped, expiresAt: expiresRow?.expires_at || null });
}

export async function respondInvite(context: any, action: "accept" | "reject") {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => null);
  const inviteId = Number(body?.inviteId || 0);
  if (!inviteId || !["accept", "reject"].includes(action)) return Response.json({ error: "Geçersiz istek." }, { status: 400 });

  const invite = await context.env.DB.prepare(`SELECT * FROM off_game_invites WHERE id = ? LIMIT 1`).bind(inviteId).first<any>();
  if (!invite) return Response.json({ error: "Davet bulunamadı." }, { status: 404 });
  if (Number(invite.invitee_id) !== Number(auth.user.id)) return Response.json({ error: "Yetkisiz işlem." }, { status: 403 });
  if (invite.status !== "pending") return Response.json({ error: "Bu davet artık aktif değil." }, { status: 409 });
  if (String(invite.expires_at || "") <= new Date().toISOString().slice(0, 19).replace("T", " ")) {
    await context.env.DB.prepare("UPDATE off_game_invites SET status='expired', responded_at=datetime('now') WHERE id=? AND status='pending'").bind(inviteId).run();
    return Response.json({ error: "Bu davetin süresi dolmuş." }, { status: 409 });
  }

  let lobbyId: number | null = null;
  if (action === "accept") {
    const l = await context.env.DB.prepare(`INSERT INTO duel_lobbies (creator_user_id, opponent_user_id, mode, reward_amount, round_count, status) VALUES (?, ?, ?, ?, ?, 'in_progress')`).bind(invite.inviter_id, invite.invitee_id, invite.duel_mode, FIXED_REWARD_AMOUNT, invite.round_count).run();
    lobbyId = Number(l?.meta?.last_row_id || 0);
    await context.env.DB.prepare("UPDATE off_game_invites SET status='accepted', lobby_id=?, responded_at=datetime('now') WHERE id=? AND status='pending'").bind(lobbyId, inviteId).run();
  } else {
    await context.env.DB.prepare("UPDATE off_game_invites SET status='rejected', responded_at=datetime('now') WHERE id=? AND status='pending'").bind(inviteId).run();
  }

  const me = await context.env.DB.prepare(`SELECT u.id, u.name, u.email, u.nickname, op.display_name AS off_display_name FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(auth.user.id).first<any>();
  const actor = resolveDisplayName(me);
  const modeName = toModeName(String(invite.duel_mode || ""));
  await createNotification(context, {
    userId: Number(invite.inviter_id),
    category: "off",
    type: action === "accept" ? "game_invite_accepted" : "game_invite_rejected",
    title: action === "accept" ? "Tech Duel davetin kabul edildi" : "Tech Duel davetin reddedildi",
    body: `${actor} ${modeName} davetini ${action === "accept" ? "kabul etti" : "reddetti"}.`,
    link: "/off",
    sourceTable: "off_game_invites",
    sourceId: `${action}:${inviteId}`,
  });

  return Response.json({ ok: true, lobbyId });
}

export async function cancelInvite(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => null);
  const inviteId = Number(body?.inviteId || 0);
  if (!inviteId) return Response.json({ error: "Geçersiz davet." }, { status: 400 });

  const invite = await context.env.DB.prepare(`SELECT * FROM off_game_invites WHERE id=? LIMIT 1`).bind(inviteId).first<any>();
  if (!invite) return Response.json({ error: "Davet bulunamadı." }, { status: 404 });
  if (Number(invite.inviter_id) !== Number(auth.user.id)) return Response.json({ error: "Yetkisiz işlem." }, { status: 403 });
  if (invite.status !== "pending") return Response.json({ error: "Bu davet artık iptal edilemez." }, { status: 409 });

  await context.env.DB.prepare("UPDATE off_game_invites SET status='cancelled', responded_at=datetime('now') WHERE id=? AND status='pending'").bind(inviteId).run();
  return Response.json({ ok: true });
}
