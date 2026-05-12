const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const BROWSER_COOKIE = "ekatech_browser_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function onRequestGet(context: any) {
  try {
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const activeToken = getCookie(cookieHeader, "session");
    const browser = await ensureBrowserId(context, cookieHeader, activeToken || "");

    if (!activeToken) {
      const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" });
      if (browser.setCookie) headers.append("Set-Cookie", browser.setCookie);
      return new Response(JSON.stringify({ accounts: [], activeUserId: null }), { headers });
    }

    const activeUser = await getUserBySession(context, activeToken);

    if (!activeUser) {
      const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" });
      if (browser.setCookie) headers.append("Set-Cookie", browser.setCookie);
      headers.append("Set-Cookie", `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      return new Response(JSON.stringify({ accounts: [], activeUserId: null }), { headers });
    }

    await attachSessionToBrowser(context, browser.browserId, activeToken);
    await cleanupExpiredSwitchSessions(context, browser.browserId);

    const rows = await context.env.DB
      .prepare(`
        SELECT
          users.id,
          users.name,
          users.email,
          users.avatar_url,
          CASE
            WHEN lower(users.email) = ? THEN 'owner'
            ELSE COALESCE(users.role, 'client')
          END AS role,
          account_switch_sessions.session_token,
          account_switch_sessions.last_used_at
        FROM account_switch_sessions
        JOIN sessions ON account_switch_sessions.session_token = sessions.token
        JOIN users ON sessions.user_id = users.id
        WHERE account_switch_sessions.browser_id = ?
          AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
          AND COALESCE(users.role, 'client') != 'blocked'
        ORDER BY account_switch_sessions.last_used_at DESC, account_switch_sessions.created_at DESC
        LIMIT 30
      `)
      .bind(OWNER_EMAIL, browser.browserId)
      .all();

    const seen = new Set<number>();
    const accounts = (rows?.results || [])
      .filter((row: any) => {
        if (seen.has(Number(row.id))) return false;
        seen.add(Number(row.id));
        return true;
      })
      .slice(0, 8)
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        avatar_url: row.avatar_url || "",
        active: row.session_token === activeToken,
      }));

    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" });
    if (browser.setCookie) headers.append("Set-Cookie", browser.setCookie);

    return new Response(JSON.stringify({ accounts, activeUserId: activeUser.id }), { headers });
  } catch (error) {
    return json({ error: "Hesap geçiş listesi alınamadı. account_switch_sessions tablosunu oluşturduğundan emin ol." }, 500);
  }
}

export async function onRequestPost(context: any) {
  try {
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const activeToken = getCookie(cookieHeader, "session");
    const browserId = getCookie(cookieHeader, BROWSER_COOKIE);

    if (!browserId) return json({ error: "Tarayıcı kimliği bulunamadı. Sayfayı yenileyip tekrar dene." }, 401);

    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);
    if (!userId) return json({ error: "Geçilecek hesap seçilmedi." }, 400);

    if (activeToken) await attachSessionToBrowser(context, browserId, activeToken);
    await cleanupExpiredSwitchSessions(context, browserId);

    const target = await context.env.DB
      .prepare(`
        SELECT
          users.id,
          users.name,
          users.email,
          users.avatar_url,
          CASE
            WHEN lower(users.email) = ? THEN 'owner'
            ELSE COALESCE(users.role, 'client')
          END AS role,
          account_switch_sessions.session_token
        FROM account_switch_sessions
        JOIN sessions ON account_switch_sessions.session_token = sessions.token
        JOIN users ON sessions.user_id = users.id
        WHERE account_switch_sessions.browser_id = ?
          AND users.id = ?
          AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
        ORDER BY account_switch_sessions.last_used_at DESC
        LIMIT 1
      `)
      .bind(OWNER_EMAIL, browserId, userId)
      .first();

    if (!target) return json({ error: "Bu hesap için açık oturum bulunamadı. Hesap ekle ile tekrar giriş yap." }, 404);
    if (target.role === "blocked") return json({ error: "Bu hesap engellenmiş." }, 403);

    await context.env.DB
      .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
      .bind(browserId, target.session_token)
      .run();

    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" });
    headers.append("Set-Cookie", `session=${target.session_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`);

    return new Response(JSON.stringify({
      success: true,
      message: "Hesap değiştirildi.",
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        avatar_url: target.avatar_url || "",
      },
    }), { headers });
  } catch (error) {
    return json({ error: "Hesap değiştirilemedi." }, 500);
  }
}

async function ensureBrowserId(context: any, cookieHeader: string, activeToken: string) {
  const existing = getCookie(cookieHeader, BROWSER_COOKIE);
  const browserId = existing || crypto.randomUUID();
  if (activeToken) await attachSessionToBrowser(context, browserId, activeToken);

  return {
    browserId,
    setCookie: existing ? "" : `${BROWSER_COOKIE}=${browserId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ONE_YEAR_SECONDS}`,
  };
}

async function attachSessionToBrowser(context: any, browserId: string, sessionToken: string) {
  if (!browserId || !sessionToken) return;
  try {
    await context.env.DB
      .prepare("INSERT OR IGNORE INTO account_switch_sessions (browser_id, session_token, created_at, last_used_at) VALUES (?, ?, datetime('now'), datetime('now'))")
      .bind(browserId, sessionToken)
      .run();

    await context.env.DB
      .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
      .bind(browserId, sessionToken)
      .run();
  } catch {}
}

async function cleanupExpiredSwitchSessions(context: any, browserId: string) {
  try {
    await context.env.DB
      .prepare(`
        DELETE FROM account_switch_sessions
        WHERE browser_id = ?
          AND session_token NOT IN (
            SELECT token FROM sessions
            WHERE datetime(replace(substr(expires_at, 1, 19), 'T', ' ')) > datetime('now')
          )
      `)
      .bind(browserId)
      .run();
  } catch {}
}

async function getUserBySession(context: any, token: string) {
  return await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        CASE
          WHEN lower(users.email) = ? THEN 'owner'
          ELSE COALESCE(users.role, 'client')
        END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ?
        AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
