const BROWSER_COOKIE = "ekatech_browser_id";
const MAX_AGE = 31536000;

export async function onRequestGet(context: any) {
  const requestUrl = new URL(context.request.url);
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const token = readCookie(cookieHeader, "session");
  const existingBrowser = readCookie(cookieHeader, BROWSER_COOKIE);
  const browserId = existingBrowser || crypto.randomUUID();

  if (token) {
    try {
      await context.env.DB
        .prepare("INSERT OR IGNORE INTO account_switch_sessions (browser_id, session_token, created_at, last_used_at) VALUES (?, ?, datetime('now'), datetime('now'))")
        .bind(browserId, token)
        .run();

      await context.env.DB
        .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
        .bind(browserId, token)
        .run();
    } catch {
      // Tablo yoksa giriş ekranına geçiş yine çalışsın.
    }
  }

  const headers = new Headers();
  headers.set("Location", `${requestUrl.origin}/signin?add=1`);
  headers.append("Set-Cookie", `${BROWSER_COOKIE}=${browserId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
  return new Response(null, { status: 302, headers });
}

function readCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
