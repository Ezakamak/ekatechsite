export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return json({ error: "E-posta ve şifre gerekli." }, 400);
    }

    const limitResult = await checkSimpleLimit(context, `login:${email}`, 10, 15 * 60);
    if (!limitResult.ok) {
      return json({ error: "Bu e-posta için çok sık giriş denemesi yapıldı. Biraz bekleyip tekrar dene." }, 429);
    }

    const user = await context.env.DB
      .prepare("SELECT id, name, email, password_hash, salt, COALESCE(role, 'client') AS role, COALESCE(email_verified, 0) AS email_verified FROM users WHERE lower(email) = ?")
      .bind(email)
      .first();

    if (!user) return json({ error: "E-posta veya şifre yanlış." }, 401);

    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.password_hash) return json({ error: "E-posta veya şifre yanlış." }, 401);
    if (user.role === "blocked") return json({ error: "Bu hesap site erişiminden engellendi." }, 403);
    if (!user.email_verified) return json({ error: "E-posta adresini doğrulamadan giriş yapamazsın." }, 403);

    const token = crypto.randomUUID();
    const expiresAt = sqlDate(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await context.env.DB
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(user.id, token, expiresAt)
      .run();

    await cleanupOldSessions(context, user.id);

    const cookieHeader = context.request.headers.get("Cookie") || "";
    const browser = await ensureBrowserId(context, cookieHeader, token);

    return jsonWithSession(
      {
        success: true,
        message: "Giriş başarılı.",
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
      token,
      browser.setCookie
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Sunucu hatası: ${detail}` }, 500);
  }
}

const BROWSER_COOKIE = "ekatech_browser_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function sqlDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 60000 }, keyMaterial, 256);
  return bytesToBase64(new Uint8Array(bits));
}

async function checkSimpleLimit(context: any, key: string, limit: number, windowSeconds: number) {
  try {
    const now = Date.now();
    const resetAt = sqlDate(now + windowSeconds * 1000);
    const existing = await context.env.DB.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();

    if (!existing || new Date(String(existing.reset_at).replace(" ", "T")).getTime() <= now) {
      await context.env.DB.prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)").bind(key, resetAt).run();
      return { ok: true };
    }

    if (Number(existing.count || 0) >= limit) return { ok: false };
    await context.env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

async function ensureBrowserId(context: any, cookieHeader: string, sessionToken: string) {
  const existing = getCookie(cookieHeader, BROWSER_COOKIE);
  const browserId = existing || crypto.randomUUID();

  await attachSessionToBrowser(context, browserId, sessionToken);

  return {
    browserId,
    setCookie: existing ? "" : `${BROWSER_COOKIE}=${browserId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ONE_YEAR_SECONDS}`,
  };
}

async function attachSessionToBrowser(context: any, browserId: string, sessionToken: string) {
  try {
    await context.env.DB
      .prepare("INSERT OR IGNORE INTO account_switch_sessions (browser_id, session_token, created_at, last_used_at) VALUES (?, ?, datetime('now'), datetime('now'))")
      .bind(browserId, sessionToken)
      .run();
    await context.env.DB
      .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
      .bind(browserId, sessionToken)
      .run();
  } catch {
    // account_switch_sessions yoksa giriş bozulmasın.
  }
}

async function cleanupOldSessions(context: any, userId: number) {
  try {
    await context.env.DB
      .prepare("DELETE FROM sessions WHERE user_id = ? AND datetime(replace(substr(expires_at, 1, 19), 'T', ' ')) <= datetime('now')")
      .bind(userId)
      .run();
  } catch {}
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

function jsonWithSession(payload: unknown, token: string, browserCookie = "") {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" });
  headers.append("Set-Cookie", `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`);
  if (browserCookie) headers.append("Set-Cookie", browserCookie);
  return new Response(JSON.stringify(payload), { headers });
}
