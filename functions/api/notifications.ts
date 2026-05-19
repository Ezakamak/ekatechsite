import { markNotificationRead } from "../_notifications";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const user = await requireUser(context);
  if (!user.ok) return Response.json({ error: user.error }, { status: user.status });

  try {
    const url = new URL(context.request.url);
    const category = String(url.searchParams.get("category") || "").trim();
    const allowedCategories = new Set(["site", "off", "invest", "miner", "event", "reward"]);
    const hasCategory = category && allowedCategories.has(category);

    const result = await context.env.DB
      .prepare(`
        SELECT id, type, category, title, body, link, action_label, action_payload, source_table, source_id, priority, is_read, created_at, expires_at
        FROM notifications
        WHERE user_id = ?
          AND (expires_at IS NULL OR expires_at > datetime('now'))
          AND (? = '' OR category = ?)
        ORDER BY id DESC
        LIMIT 50
      `)
      .bind(user.user.id, hasCategory ? category : "", hasCategory ? category : "")
      .all();

    const unread = await context.env.DB
      .prepare(`SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id = ?
          AND COALESCE(is_read, 0) = 0
          AND (expires_at IS NULL OR expires_at > datetime('now'))
          AND (? = '' OR category = ?)`)
      .bind(user.user.id, hasCategory ? category : "", hasCategory ? category : "")
      .first();

    return Response.json({ notifications: result?.results || [], unread: unread?.count || 0 });
  } catch {
    return Response.json({ error: "Bildirimler alınamadı. notifications tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const user = await requireUser(context);
  if (!user.ok) return Response.json({ error: user.error }, { status: user.status });

  try {
    const body = await context.request.json().catch(() => null);
    const id = Number(body?.id || 0);
    await markNotificationRead(context, user.user.id, id || undefined);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Bildirim güncellenemedi." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
