const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function onRequestGet(context: any) {
  try {
    const url = new URL(context.request.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const savedState = getCookie(context.request.headers.get("Cookie") || "", "google_oauth_state") || "";

    if (!code || !state || !savedState || state !== savedState) {
      return redirectWithError(url.origin, "Google oturum doğrulaması geçersiz. Tekrar dene.");
    }

    const clientId = context.env.GOOGLE_CLIENT_ID;
    const clientSecret = context.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return redirectWithError(url.origin, "GOOGLE_CLIENT_ID veya GOOGLE_CLIENT_SECRET eksik.");
    }

    const redirectUri = `${url.origin}/api/auth/google/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json().catch(() => null) as any;

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return redirectWithError(url.origin, "Google token alınamadı. Redirect URI ve client secret değerlerini kontrol et.");
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userResponse.json().catch(() => null) as GoogleUserInfo | null;

    if (!userResponse.ok || !googleUser?.email || !googleUser?.sub) {
      return redirectWithError(url.origin, "Google kullanıcı bilgileri alınamadı.");
    }

    if (!googleUser.email_verified) {
      return redirectWithError(url.origin, "Google hesabının e-postası doğrulanmış görünmüyor.");
    }

    const email = googleUser.email.trim().toLowerCase();
    const name = String(googleUser.name || email.split("@")[0] || "Google User").trim();
    const picture = String(googleUser.picture || "").trim();
    const isOwner = email === OWNER_EMAIL;

    let user = await context.env.DB
      .prepare(`
        SELECT id, name, email,
          CASE
            WHEN lower(email) = ? THEN 'owner'
            ELSE COALESCE(role, 'client')
          END AS role
        FROM users
        WHERE lower(email) = ?
      `)
      .bind(OWNER_EMAIL, email)
      .first();

    if (user?.role === "blocked") {
      return redirectWithError(url.origin, "Bu hesap site erişiminden engellendi.");
    }

    if (!user) {
      const salt = makeSalt();
      const randomPasswordHash = await hashValue(crypto.randomUUID(), salt);

      await context.env.DB
        .prepare(`
          INSERT INTO users (name, email, password_hash, salt, role, email_verified, avatar_url, avatar_approved)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `)
        .bind(name, email, randomPasswordHash, salt, isOwner ? "owner" : "client", picture, 1)
        .run();

      user = await context.env.DB
        .prepare(`
          SELECT id, name, email,
            CASE
              WHEN lower(email) = ? THEN 'owner'
              ELSE COALESCE(role, 'client')
            END AS role
          FROM users
          WHERE lower(email) = ?
        `)
        .bind(OWNER_EMAIL, email)
        .first();
    } else {
      await context.env.DB
        .prepare(`
          UPDATE users
          SET email_verified = 1,
              name = CASE WHEN name IS NULL OR trim(name) = '' THEN ? ELSE name END,
              avatar_url = CASE WHEN avatar_url IS NULL OR trim(avatar_url) = '' THEN ? ELSE avatar_url END,
              avatar_approved = CASE WHEN role = 'admin' THEN COALESCE(avatar_approved, 0) ELSE COALESCE(avatar_approved, 1) END
          WHERE id = ?
        `)
        .bind(name, picture, user.id)
        .run();
    }

    if (!user) {
      return redirectWithError(url.origin, "Google hesabı oluşturulamadı.");
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await context.env.DB
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(user.id, token, expiresAt)
      .run();

    const headers = new Headers();
    headers.set("Location", `${url.origin}/account`);
    headers.append("Set-Cookie", `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    headers.append("Set-Cookie", `google_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    const origin = new URL(context.request.url).origin;
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return redirectWithError(origin, `Google giriş tamamlanamadı: ${detail}`);
  }
}

function redirectWithError(origin: string, message: string) {
  const headers = new Headers();
  headers.set("Location", `${origin}/signin?error=${encodeURIComponent(message)}`);
  headers.append("Set-Cookie", `google_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);

  return new Response(null, {
    status: 302,
    headers,
  });
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
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
