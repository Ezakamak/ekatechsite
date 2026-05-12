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

    const limitResult = await checkSimpleLimit(context, `signup:${email}`, 3, 15 * 60);
    if (!limitResult.ok) {
      return Response.json({ error: "Bu e-posta için çok sık kayıt denemesi yapıldı. Biraz bekleyip tekrar dene." }, { status: 429 });
    }

    if (password.length < 8) {
      return Response.json({ error: "Şifre en az 8 karakter olmalı." }, { status: 400 });
    }

    const existingUser = await context.env.DB
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existingUser) {
      return Response.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene." }, { status: 409 });
    }

    const passwordSalt = makeSalt();
    const passwordHash = await hashValue(password, passwordSalt);
    const code = makeCode();
    const codeSalt = makeSalt();
    const codeHash = await hashValue(code, codeSalt);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();

    await context.env.DB
      .prepare("DELETE FROM pending_signups WHERE email = ?")
      .bind(email)
      .run();

    await context.env.DB
      .prepare(`
        INSERT INTO pending_signups (name, email, password_hash, password_salt, code_hash, code_salt, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(name, email, passwordHash, passwordSalt, codeHash, codeSalt, expiresAt)
      .run();

    await sendVerificationCode(context, email, name, code);

    return Response.json({
      success: true,
      requiresCode: true,
      message: "Doğrulama kodu e-postana gönderildi. Hesap, kod doğrulanınca oluşturulacak.",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Kayıt başlatılamadı: ${detail}` }, { status: 500 });
  }
}

async function sendVerificationCode(context: any, email: string, name: string, code: string) {
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
      subject: "EkaTech doğrulama kodu",
      html: `
        <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:32px;border-radius:18px">
          <h1 style="margin:0 0 12px;font-size:28px">EkaTech doğrulama kodu</h1>
          <p style="color:#c7c7c7;line-height:1.6">Merhaba ${escapeHtml(name)}, hesabını oluşturmak için aşağıdaki kodu kayıt ekranına gir.</p>
          <div style="font-size:36px;letter-spacing:10px;font-weight:800;background:#ffffff;color:#000000;border-radius:16px;padding:18px 24px;text-align:center;margin:22px 0">${code}</div>
          <p style="margin-top:22px;color:#888;font-size:13px">Bu kod 15 dakika geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
        </div>
      `,
      text: `EkaTech doğrulama kodun: ${code}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Doğrulama e-postası gönderilemedi. Resend HTTP ${response.status}: ${detail.slice(0, 160)}`);
  }
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
