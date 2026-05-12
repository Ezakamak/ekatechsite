export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return Response.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
    }

    const user = await context.env.DB
      .prepare("SELECT id, name, email, password_hash, salt FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user) {
      return Response.json({ error: "E-posta veya şifre yanlış." }, { status: 401 });
    }

    const passwordHash = await hashPassword(password, user.salt);

    if (passwordHash !== user.password_hash) {
      return Response.json({ error: "E-posta veya şifre yanlış." }, { status: 401 });
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
        user: { id: user.id, name: user.name, email: user.email },
      },
      token
    );
  } catch (error) {
    return Response.json({ error: "Sunucu hatası. D1 binding adının DB olduğundan emin ol." }, { status: 500 });
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
