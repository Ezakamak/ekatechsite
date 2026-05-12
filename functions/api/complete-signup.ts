export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();

    if (!email || !code) {
      return Response.json({ error: "E-posta ve doğrulama kodu gerekli." }, { status: 400 });
    }

    const pending = await context.env.DB
      .prepare(`
        SELECT id, name, email, password_hash, password_salt, code_hash, code_salt, expires_at, attempts
        FROM pending_signups
        WHERE email = ?
      `)
      .bind(email)
      .first();

    if (!pending) {
      return Response.json({ error: "Bu e-posta için bekleyen kayıt bulunamadı." }, { status: 404 });
    }

    if (new Date(pending.expires_at).getTime() < Date.now()) {
      await context.env.DB
        .prepare("DELETE FROM pending_signups WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Doğrulama kodunun süresi doldu. Tekrar kayıt ol." }, { status: 410 });
    }

    if ((pending.attempts || 0) >= 5) {
      await context.env.DB
        .prepare("DELETE FROM pending_signups WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Çok fazla hatalı deneme. Tekrar kayıt ol." }, { status: 429 });
    }

    const codeHash = await hashValue(code, pending.code_salt);

    if (codeHash !== pending.code_hash) {
      await context.env.DB
        .prepare("UPDATE pending_signups SET attempts = COALESCE(attempts, 0) + 1 WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Doğrulama kodu hatalı." }, { status: 401 });
    }

    const existingUser = await context.env.DB
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existingUser) {
      await context.env.DB
        .prepare("DELETE FROM pending_signups WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
    }

    const result = await context.env.DB
      .prepare("INSERT INTO users (name, email, password_hash, salt, email_verified) VALUES (?, ?, ?, ?, 1)")
      .bind(pending.name, pending.email, pending.password_hash, pending.password_salt)
      .run();

    const userId = result.meta.last_row_id;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await context.env.DB
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(userId, token, expiresAt)
      .run();

    await context.env.DB
      .prepare("DELETE FROM pending_signups WHERE email = ?")
      .bind(email)
      .run();

    return jsonWithSession(
      {
        success: true,
        message: "E-posta doğrulandı. Hesabın oluşturuldu.",
        user: { id: userId, name: pending.name, email: pending.email, role: "client" },
      },
      token
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Kayıt tamamlanamadı: ${detail}` }, { status: 500 });
  }
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

function jsonWithSession(payload: unknown, token: string) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
    },
  });
}
