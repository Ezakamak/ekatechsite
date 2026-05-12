const BROWSER_COOKIE = "ekatech_browser_id";
const OAUTH_ADD_COOKIE = "ekatech_oauth_add";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function onRequestGet(context: any) {
  const clientId = context.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return Response.json({ error: "GOOGLE_CLIENT_ID eksik. Cloudflare Pages environment variables içine ekle." }, { status: 500 });
  }

  const requestUrl = new URL(context.request.url);
  const addMode = requestUrl.searchParams.get("add") === "1";
  const origin = requestUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = crypto.randomUUID();
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const activeToken = getCookie(cookieHeader, "session");
  const existingBrowserId = getCookie(cookieHeader, BROWSER_COOKIE);
  const browserId = existingBrowserId || crypto.randomUUID();

  if (activeToken) {
    try {
      await context.env.DB
        .prepare("INSERT OR IGNORE INTO account_switch_sessions (browser_id, session_token, created_at, last_used_at) VALUES (?, ?, datetime('now'), datetime('now'))")
        .bind(browserId, activeToken)
        .run();

      await context.env.DB
        .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
        .bind(browserId, activeToken)
        .run();
    } catch {
      // account_switch_sessions yoksa Google girişini bozma.
    }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const headers = new Headers();
  headers.set("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  headers.append("Set-Cookie", `google_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  headers.append("Set-Cookie", `${BROWSER_COOKIE}=${browserId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ONE_YEAR_SECONDS}`);
  headers.append("Set-Cookie", `${OAUTH_ADD_COOKIE}=${addMode ? "1" : "0"}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

  return new Response(null, { status: 302, headers });
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
