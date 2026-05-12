export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    const password = String(body?.password || "");

    if (!email || !code || !password) {
      return Response.json({ error: "E-posta, kod ve yeni şifre gerekli." }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: "Yeni şifre en az 8 karakter olmalı." }, { status: 400 });
    }

    const reset = await context.env.DB
      .prepare(`
        SELECT password_resets.id, password_resets.user_id, password_resets.email, password_resets.code_hash,
               password_resets.code_salt, password_resets.expires_at, password_resets.attempts,
               users.role
        FROM password_resets
        JOIN users ON users.id = password_resets.user_id
        WHERE password_resets.email = ?
      `)
      .bind(email)
      .first();

    if (!reset) {
      return Response.json({ error: "Bu e-posta için geçerli sıfırlama kodu bulunamadı." }, { status: 404 });
    }

    if (reset.role === "blocked") {
      return Response.json({ error: "Bu hesap engellenmiş." }, { status: 403 });
    }

    if (new Date(reset.expires_at).getTime() < Date.now()) {
      await context.env.DB
        .prepare("DELETE FROM password_resets WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Şifre sıfırlama kodunun süresi doldu. Tekrar kod iste." }, { status: 410 });
    }

    if ((reset.attempts || 0) >= 5) {
      await context.env.DB
        .prepare("DELETE FROM password_resets WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Çok fazla hatalı deneme. Tekrar kod iste." }, { status: 429 });
    }

    const codeHash = await hashValue(code, reset.code_salt);

    if (codeHash !== reset.code_hash) {
      await context.env.DB
        .prepare("UPDATE password_resets SET attempts = COALESCE(attempts, 0) + 1 WHERE email = ?")
        .bind(email)
        .run();

      return Response.json({ error: "Şifre sıfırlama kodu hatalı." }, { status: 401 });
    }

    const salt = makeSalt();
    const passwordHash = await hashValue(password, salt);

    await context.env.DB
      .prepare("UPDATE users SET password_hash = ?, salt = ?, email_verified = 1 WHERE id = ?")
      .bind(passwordHash, salt, reset.user_id)
      .run();

    await context.env.DB
      .prepare("DELETE FROM password_resets WHERE user_id = ?")
      .bind(reset.user_id)
      .run();

    await context.env.DB
      .prepare("DELETE FROM sessions WHERE user_id = ?")
      .bind(reset.user_id)
      .run();

    return Response.json({ success: true, message: "Şifren güncellendi. Yeni şifrenle giriş yapabilirsin." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Şifre sıfırlama tamamlanamadı: ${detail}` }, { status: 500 });
  }
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
