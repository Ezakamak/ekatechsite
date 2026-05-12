export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return Response.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
    }

    const limitResult = await checkSimpleLimit(context, `login:${email}`, 10, 15 * 60);
    if (!limitResult.ok) {
      return Response.json({ error: "Bu e-posta için çok sık giriş denemesi yapıldı. Biraz bekleyip tekrar dene." }, { status: 429 });
    }

    const user = await context.env.DB
      .prepare("SELECT id, name, email, password_hash, salt, COALESCE(role, 'client') AS role, COALESCE(email_verified, 0) AS email_verified FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user) {
      return Response.json({ error: "E-posta veya şifre yanlış." }, { status: 401 });
    }

    const passwordHash = await hashPassword(password, user.salt);

    if (passwordHash !== user.password_hash) {
      return Response.json({ error: "E-posta veya şifre yanlış." }, { status: 401 });
    }

    if (user.role === "blocked") {
      return Response.json({ error: "Bu hesap site erişiminden engellendi." }, { status: 403 });
    }

    if (!user.email_verified) {
      return Response.json({ error: "E-posta adresini doğrulamadan giriş yapamazsın." }, { status: 403 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await context.env.DB
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(user.id, token, expiresAt)
      .run();

    return jsonWithSession(
      {
        success: true,
        message: "Giriş başarılı.",
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
      token
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ error: `Sunucu hatası: ${detail}` }, { status: 500 });
  }
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
