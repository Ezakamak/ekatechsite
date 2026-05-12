const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  try {
    const row = await context.env.DB.prepare("SELECT is_active, message, updated_at FROM site_settings WHERE key = 'maintenance_mode'").first();
    return Response.json({
      active: Number(row?.is_active || 0) === 1,
      message: row?.message || "Site kısa süreli bakımda.",
      updated_at: row?.updated_at || null,
    });
  } catch {
    return Response.json({ active: false, message: "" });
  }
}

export async function onRequestPost(context: any) {
  const owner = await requireOwner(context);
  if (!owner.ok) return Response.json({ error: owner.error }, { status: owner.status });

  try {
    const body = await context.request.json().catch(() => null);
    const active = body?.active ? 1 : 0;
    const message = String(body?.message || "Site kısa süreli bakımda. Yakında tekrar aktif olacağız.").trim();

    await context.env.DB.prepare(`
      INSERT INTO site_settings (key, is_active, message, updated_at)
      VALUES ('maintenance_mode', ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        is_active = excluded.is_active,
        message = excluded.message,
        updated_at = datetime('now')
    `).bind(active, message).run();

    return Response.json({ success: true, message: active ? "Bakım modu aktif edildi." : "Bakım modu kapatıldı." });
  } catch {
    return Response.json({ error: "Bakım modu güncellenemedi. site_settings tablosunu oluştur." }, { status: 500 });
  }
}

async function requireOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare("SELECT users.id, users.email FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')").bind(token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (String(user.email).toLowerCase() !== OWNER_EMAIL) return { ok: false, status: 403, error: "Bakım modu sadece owner tarafından değiştirilebilir." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
