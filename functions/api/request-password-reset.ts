export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ error: "Geçerli bir e-posta gir." }, { status: 400 });
    }

    const user = await context.env.DB
      .prepare("SELECT id, name, email, COALESCE(role, 'client') AS role FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user || user.role === "blocked") {
      return Response.json({
        success: true,
        message: "Eğer bu e-posta kayıtlıysa şifre sıfırlama kodu gönderildi.",
      });
    }

    const code = makeCode();
    const codeSalt = makeSalt();
    const codeHash = await hashValue(code, codeSalt);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();

    await context.env.DB
      .prepare("DELETE FROM password_resets WHERE user_id = ?")
      .bind(user.id)
      .run();

    await context.env.DB
      .prepare(`
        INSERT INTO password_resets (user_id, email, code_hash, code_salt, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(user.id, user.email, codeHash, codeSalt, expiresAt)
      .run();

    await sendResetCode(context, user.email, user.name, code);

    return Response.json({
      success: true,
      message: "Şifre sıfırlama kodu e-postana gönderildi.",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Şifre sıfırlama başlatılamadı: ${detail}` }, { status: 500 });
  }
}

async function sendResetCode(context: any, email: string, name: string, code: string) {
  const apiKey = context.env.RESEND_API_KEY;
  const from = context.env.EMAIL_FROM || "EkaTech <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY eksik. Cloudflare Pages environment variables içine ekle.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "EkaTech/1.0",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "EkaTech şifre sıfırlama kodu",
      html: `
        <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:32px;border-radius:18px">
          <h1 style="margin:0 0 12px;font-size:28px">Şifre sıfırlama kodu</h1>
          <p style="color:#c7c7c7;line-height:1.6">Merhaba ${escapeHtml(name)}, EkaTech hesabının şifresini sıfırlamak için aşağıdaki kodu kullan.</p>
          <div style="font-size:36px;letter-spacing:10px;font-weight:800;background:#ffffff;color:#000000;border-radius:16px;padding:18px 24px;text-align:center;margin:22px 0">${code}</div>
          <p style="margin-top:22px;color:#888;font-size:13px">Bu kod 15 dakika geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
        </div>
      `,
      text: `EkaTech şifre sıfırlama kodun: ${code}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Şifre sıfırlama e-postası gönderilemedi. Resend HTTP ${response.status}: ${detail.slice(0, 160)}`);
  }
}

function makeCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

function makeSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

async function hashValue(value: string, salt: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 60000,
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
