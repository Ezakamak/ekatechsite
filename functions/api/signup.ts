export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!name || !email || !password) {
      return Response.json({ error: "İsim, e-posta ve şifre gerekli." }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ error: "Geçerli bir e-posta gir." }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: "Şifre en az 8 karakter olmalı." }, { status: 400 });
    }

    const existingUser = await context.env.DB
      .prepare("SELECT id, name, email, COALESCE(email_verified, 0) AS email_verified FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existingUser?.email_verified) {
      return Response.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
    }

    if (existingUser && !existingUser.email_verified) {
      await createVerificationAndSend(context, existingUser.id, existingUser.email, existingUser.name);
      return Response.json({
        success: true,
        requiresVerification: true,
        message: "Bu e-posta kayıtlı ama doğrulanmamış. Yeni doğrulama e-postası gönderdik.",
      });
    }

    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);

    const result = await context.env.DB
      .prepare("INSERT INTO users (name, email, password_hash, salt, email_verified) VALUES (?, ?, ?, ?, 0)")
      .bind(name, email, passwordHash, salt)
      .run();

    const userId = result.meta.last_row_id;

    await createVerificationAndSend(context, userId, email, name);

    return Response.json({
      success: true,
      requiresVerification: true,
      message: "Kayıt oluşturuldu. Giriş yapmadan önce e-postana gelen doğrulama linkine tıkla.",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Kayıt tamamlanamadı: ${detail}` }, { status: 500 });
  }
}

async function createVerificationAndSend(context: any, userId: number, email: string, name: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  await context.env.DB
    .prepare("DELETE FROM email_verifications WHERE user_id = ?")
    .bind(userId)
    .run();

  await context.env.DB
    .prepare("INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)")
    .bind(userId, token, expiresAt)
    .run();

  await sendVerificationEmail(context, email, name, token);
}

async function sendVerificationEmail(context: any, email: string, name: string, token: string) {
  const apiKey = context.env.RESEND_API_KEY;
  const from = context.env.EMAIL_FROM || "EkaTech <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY eksik. Cloudflare Pages environment variables içine ekle.");
  }

  const origin = new URL(context.request.url).origin;
  const verifyUrl = `${origin}/api/verify-email?token=${encodeURIComponent(token)}`;

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
      subject: "EkaTech e-posta doğrulama",
      html: `
        <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:32px;border-radius:18px">
          <h1 style="margin:0 0 12px;font-size:28px">EkaTech hesabını doğrula</h1>
          <p style="color:#c7c7c7;line-height:1.6">Merhaba ${escapeHtml(name)}, hesabına giriş yapabilmek için e-posta adresini doğrulaman gerekiyor.</p>
          <a href="${verifyUrl}" style="display:inline-block;margin-top:18px;padding:14px 22px;border-radius:999px;background:#ffffff;color:#000000;text-decoration:none;font-weight:700">E-postamı doğrula</a>
          <p style="margin-top:22px;color:#888;font-size:13px">Bu link 24 saat geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
        </div>
      `,
      text: `EkaTech hesabını doğrulamak için bu linke tıkla: ${verifyUrl}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Doğrulama e-postası gönderilemedi. Resend HTTP ${response.status}: ${detail.slice(0, 160)}`);
  }
}

function makeSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
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
