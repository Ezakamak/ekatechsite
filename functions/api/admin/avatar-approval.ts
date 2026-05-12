const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const owner = await requireOwner(context);

  if (!owner.ok) {
    return Response.json({ error: owner.error }, { status: owner.status });
  }

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT id, name, email, avatar_url, COALESCE(avatar_approved, 0) AS avatar_approved, created_at
        FROM users
        WHERE role = 'admin' AND lower(email) != ?
        ORDER BY avatar_approved ASC, id DESC
        LIMIT 100
      `)
      .bind(OWNER_EMAIL)
      .all();

    return Response.json({ admins: result?.results || [] });
  } catch (error) {
    return Response.json({ error: "Admin profil fotoğrafları alınamadı. avatar_approved kolonu olduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const owner = await requireOwner(context);

  if (!owner.ok) {
    return Response.json({ error: owner.error }, { status: owner.status });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);
    const action = String(body?.action || "").trim();

    if (!userId) {
      return Response.json({ error: "Admin ID gerekli." }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return Response.json({ error: "Geçersiz işlem. action approve veya reject olmalı." }, { status: 400 });
    }

    const target = await context.env.DB
      .prepare(`
        SELECT id, email, role, avatar_url
        FROM users
        WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!target) {
      return Response.json({ error: "Admin bulunamadı." }, { status: 404 });
    }

    if (String(target.email).toLowerCase() === OWNER_EMAIL) {
      return Response.json({ error: "Owner hesabı zaten otomatik onaylıdır." }, { status: 403 });
    }

    if (target.role !== "admin") {
      return Response.json({ error: "Sadece admin hesaplarının profil fotoğrafı onaylanabilir veya reddedilebilir." }, { status: 400 });
    }

    if (action === "approve") {
      if (!target.avatar_url) {
        return Response.json({ error: "Profil fotoğrafı yüklemeyen admin onaylanamaz." }, { status: 400 });
      }

      await context.env.DB
        .prepare("UPDATE users SET avatar_approved = 1 WHERE id = ?")
        .bind(userId)
        .run();

      return Response.json({ success: true, message: "Admin profil fotoğrafı onaylandı." });
    }

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = '', avatar_approved = 0 WHERE id = ?")
      .bind(userId)
      .run();

    return Response.json({ success: true, message: "Admin profil fotoğrafı reddedildi. Adminin yeniden fotoğraf yüklemesi gerekiyor." });
  } catch (error) {
    return Response.json({ error: "Profil fotoğrafı onayı güncellenemedi." }, { status: 500 });
  }
}

async function requireOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  if (String(user.email).toLowerCase() !== OWNER_EMAIL) {
    return { ok: false, status: 403, error: "Bu işlem sadece owner tarafından yapılabilir." };
  }

  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
