export async function onRequestPost(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    const body = await context.request.json().catch(() => null);
    const avatarUrl = String(body?.avatar_url || "").trim();

    if (!avatarUrl) {
      return Response.json({ error: "Profil fotoğrafı gerekli." }, { status: 400 });
    }

    if (!avatarUrl.startsWith("data:image/")) {
      return Response.json({ error: "Sadece görsel dosyası yükleyebilirsin." }, { status: 400 });
    }

    if (avatarUrl.length > 550000) {
      return Response.json({ error: "Fotoğraf çok büyük. Daha küçük bir görsel seç." }, { status: 413 });
    }

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = ? WHERE id = ?")
      .bind(avatarUrl, user.user.id)
      .run();

    return Response.json({ success: true, message: "Profil fotoğrafı güncellendi.", avatar_url: avatarUrl });
  } catch (error) {
    return Response.json({ error: "Profil fotoğrafı kaydedilemedi. users tablosuna avatar_url kolonu eklediğinden emin ol." }, { status: 500 });
  }
}

export async function onRequestDelete(context: any) {
  try {
    const user = await requireUser(context);

    if (!user.ok) {
      return Response.json({ error: user.error }, { status: user.status });
    }

    await context.env.DB
      .prepare("UPDATE users SET avatar_url = '' WHERE id = ?")
      .bind(user.user.id)
      .run();

    return Response.json({ success: true, message: "Profil fotoğrafı kaldırıldı." });
  } catch (error) {
    return Response.json({ error: "Profil fotoğrafı kaldırılamadı." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");

  if (!token) {
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  }

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, COALESCE(users.role, 'client') AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(token)
    .first();

  if (!user) {
    return { ok: false, status: 401, error: "Oturum geçersiz." };
  }

  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
