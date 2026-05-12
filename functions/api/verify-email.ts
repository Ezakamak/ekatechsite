export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const token = String(url.searchParams.get("token") || "").trim();

  if (!token) {
    return htmlPage("Doğrulama linki eksik", "Bu link geçerli değil.", false);
  }

  try {
    const record = await context.env.DB
      .prepare(`
        SELECT email_verifications.id, email_verifications.user_id, email_verifications.expires_at, users.email
        FROM email_verifications
        JOIN users ON users.id = email_verifications.user_id
        WHERE email_verifications.token = ?
      `)
      .bind(token)
      .first();

    if (!record) {
      return htmlPage("Link geçersiz", "Bu doğrulama linki bulunamadı veya daha önce kullanıldı.", false);
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      await context.env.DB
        .prepare("DELETE FROM email_verifications WHERE id = ?")
        .bind(record.id)
        .run();

      return htmlPage("Linkin süresi doldu", "Lütfen tekrar kayıt ol veya yeni doğrulama linki iste.", false);
    }

    await context.env.DB
      .prepare("UPDATE users SET email_verified = 1 WHERE id = ?")
      .bind(record.user_id)
      .run();

    await context.env.DB
      .prepare("DELETE FROM email_verifications WHERE user_id = ?")
      .bind(record.user_id)
      .run();

    return htmlPage("E-posta doğrulandı", "Artık EkaTech hesabına giriş yapabilirsin.", true);
  } catch (error) {
    return htmlPage("Sunucu hatası", "Doğrulama tamamlanamadı. D1 tablolarını kontrol et.", false);
  }
}

function htmlPage(title: string, message: string, success: boolean) {
  const color = success ? "#5eead4" : "#fca5a5";
  const icon = success ? "✓" : "!";

  return new Response(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · EkaTech</title>
</head>
<body style="margin:0;background:#050505;color:#fff;font-family:Inter,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px">
  <main style="max-width:640px;width:100%;border:1px solid rgba(255,255,255,.12);border-radius:32px;background:rgba(255,255,255,.045);padding:36px;text-align:center;box-shadow:0 0 80px rgba(0,212,255,.08)">
    <div style="margin:0 auto 18px;width:64px;height:64px;border-radius:999px;background:${color};color:#000;display:grid;place-items:center;font-size:34px;font-weight:800">${icon}</div>
    <h1 style="margin:0;font-size:42px;letter-spacing:-.04em">${escapeHtml(title)}</h1>
    <p style="margin:16px 0 28px;color:#aaa;font-size:18px;line-height:1.6">${escapeHtml(message)}</p>
    <a href="/signin" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:700;border-radius:999px;padding:14px 24px">Giriş sayfasına git</a>
  </main>
</body>
</html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
