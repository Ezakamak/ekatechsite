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
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existingUser) {
      return Response.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
    }

    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);

    const result = await context.env.DB
      .prepare("INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)")
      .bind(name, email, passwordHash, salt)
      .run();

    const userId = result.meta.last_row_id;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await context.env.DB
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(userId, token, expiresAt)
      .run();

    return jsonWithSession(
      {
        success: true,
        message: "Kayıt başarılı.",
        user: { id: userId, name, email },
      },
      token
    );
  } catch (error) {
    return Response.json({ error: "Sunucu hatası. D1 binding adının DB olduğundan emin ol." }, { status: 500 });
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

function jsonWithSession(payload: unknown, token: string) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
    },
  });
}
