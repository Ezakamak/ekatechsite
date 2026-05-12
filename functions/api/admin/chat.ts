const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const MAX_MESSAGE_LENGTH = 1000;

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const url = new URL(context.request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);

    const result = await context.env.DB
      .prepare(`
        SELECT
          admin_chat_messages.id,
          admin_chat_messages.user_id,
          COALESCE(users.name, 'Silinmiş kullanıcı') AS user_name,
          COALESCE(users.email, '') AS user_email,
          '' AS user_avatar_url,
          CASE
            WHEN lower(COALESCE(users.email, '')) = ? THEN 'owner'
            ELSE 'admin'
          END AS user_role,
          admin_chat_messages.message,
          admin_chat_messages.created_at
        FROM admin_chat_messages
        LEFT JOIN users ON admin_chat_messages.user_id = users.id
        ORDER BY admin_chat_messages.id DESC
        LIMIT ?
      `)
      .bind(OWNER_EMAIL, limit)
      .all();

    return Response.json({ messages: [...(result?.results || [])].reverse() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Admin chat mesajları alınamadı: ${detail}` }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const message = String(body?.message || "").trim();

    if (!message) {
      return Response.json({ error: "Mesaj boş olamaz." }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` }, { status: 413 });
    }

    const limitResult = await checkSimpleLimit(context, `admin-chat:${admin.user.id}`, 20, 60);
    if (!limitResult.ok) {
      return Response.json({ error: "Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene." }, { status: 429 });
    }

    await context.env.DB
      .prepare("INSERT INTO admin_chat_messages (user_id, message) VALUES (?, ?)")
      .bind(admin.user.id, message)
      .run();

    return Response.json({ success: true, message: "Mesaj gönderildi." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Mesaj gönderilemedi: ${detail}` }, { status: 500 });
  }
}

export async function onRequestDelete(context: any) {
  const admin = await requireAdminOrOwner(context);

  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  if (admin.user.role !== "owner") {
    return Response.json({ error: "Mesaj silme yetkisi sadece owner hesabındadır." }, { status: 403 });
  }

  try {
    const url = new URL(context.request.url);
    const id = Number(url.searchParams.get("id"));

    if (!id) {
      return Response.json({ error: "Mesaj id gerekli." }, { status: 400 });
    }

    await context.env.DB
      .prepare("DELETE FROM admin_chat_messages WHERE id = ?")
      .bind(id)
      .run();

    return Response.json({ success: true, message: "Mesaj silindi." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Mesaj silinemedi: ${detail}` }, { status: 500 });
  }
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        CASE
          WHEN lower(users.email) = ? THEN 'owner'
          ELSE COALESCE(users.role, 'client')
        END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  if (user.role === "blocked") {
    return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  }

  if (user.role !== "admin" && user.role !== "owner") {
    return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  }

  return { ok: true, user };
}

async function checkSimpleLimit(context: any, key: string, limit: number, windowSeconds: number) {
  try {
    const now = Date.now();
    const resetAt = new Date(now + windowSeconds * 1000).toISOString();
    const existing = await context.env.DB
      .prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?")
      .bind(key)
      .first();

    if (!existing || new Date(existing.reset_at).getTime() <= now) {
      await context.env.DB
        .prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)")
        .bind(key, resetAt)
        .run();
      return { ok: true };
    }

    if (Number(existing.count || 0) >= limit) return { ok: false };

    await context.env.DB
      .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
      .bind(key)
      .run();

    return { ok: true };
  } catch {
    return { ok: true };
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
