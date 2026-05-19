import { ensureUsersNicknameColumn, resolvePublicDisplayName, sanitizeNickname } from "../../_displayName";

export async function onRequestGet(context: any) {
  const auth = await getUserFromSession(context);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  await ensureUsersNicknameColumn(context);

  const row = await context.env.DB.prepare(`SELECT id, name, nickname FROM users WHERE id = ?`).bind(auth.user.id).first<any>();
  return json({ ok: true, nickname: String(row?.nickname || "").trim(), displayName: resolvePublicDisplayName(row || auth.user) });
}

export async function onRequestPatch(context: any) {
  const auth = await getUserFromSession(context);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  await ensureUsersNicknameColumn(context);

  const body = await context.request.json().catch(() => ({}));
  const validation = sanitizeNickname(body?.nickname);
  if (!validation.ok) return json({ ok: false, error: validation.error }, 400);

  await context.env.DB.prepare(`UPDATE users SET nickname = ? WHERE id = ?`).bind(validation.nickname, auth.user.id).run();
  const row = await context.env.DB.prepare(`SELECT id, name, nickname FROM users WHERE id = ?`).bind(auth.user.id).first<any>();
  return json({ ok: true, nickname: String(row?.nickname || "").trim(), displayName: resolvePublicDisplayName(row || auth.user) });
}

async function getUserFromSession(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const user = await context.env.DB.prepare(
    `SELECT u.id, u.name, u.nickname
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?
       AND datetime(replace(substr(s.expires_at, 1, 19), 'T', ' ')) > datetime('now')`
  ).bind(token).first<any>();

  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, user: { id: Number(user.id), name: String(user.name || ""), nickname: String(user.nickname || "") } };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
