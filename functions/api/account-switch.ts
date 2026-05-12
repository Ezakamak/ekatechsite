const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const BROWSER_COOKIE = "ekatech_browser_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function onRequestGet(context: any) {
  try {
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const activeToken = getCookie(cookieHeader, "session");

    if (!activeToken) {
      return Response.json({ accounts: [], activeUserId: null }, { status: 401 });
    }

    const activeUser = await getUserBySession(context, activeToken);

    if (!activeUser) {
      return Response.json({ accounts: [], activeUserId: null }, { status: 401 });
    }

    const browser = await ensureBrowserId(context, cookieHeader, activeToken);
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
          AND sessions.expires_at > datetime('now')
          AND COALESCE(users.role, 'client') != 'blocked'
        ORDER BY account_switch_sessions.last_used_at DESC, account_switch_sessions.created_at DESC
        LIMIT 20
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

    const headers = new Headers({ "Content-Type": "application/json" });
    if (browser.setCookie) headers.append("Set-Cookie", browser.setCookie);

    return new Response(JSON.stringify({ accounts, activeUserId: activeUser.id }), { headers });
  } catch (error) {
    return Response.json({ error: "Hesap geçiş listesi alınamadı. account_switch_sessions tablosunu oluşturduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  try {
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const activeToken = getCookie(cookieHeader, "session");
    const browserId = getCookie(cookieHeader, BROWSER_COOKIE);

    if (!activeToken || !browserId) {
      return Response.json({ error: "Hesap geçişi için aktif oturum gerekli." }, { status: 401 });
    }

    const activeUser = await getUserBySession(context, activeToken);
    if (!activeUser) {
      return Response.json({ error: "Aktif oturum geçersiz." }, { status: 401 });
    }

    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId);

    if (!userId) {
      return Response.json({ error: "Geçilecek hesap seçilmedi." }, { status: 400 });
    }

    await attachSessionToBrowser(context, browserId, activeToken);

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
          AND sessions.expires_at > datetime('now')
        ORDER BY account_switch_sessions.last_used_at DESC
        LIMIT 1
      `)
      .bind(OWNER_EMAIL, browserId, userId)
      .first();

    if (!target) {
      return Response.json({ error: "Bu hesap için açık oturum bulunamadı. Önce o hesapla giriş yap." }, { status: 404 });
    }

    if (target.role === "blocked") {
      return Response.json({ error: "Bu hesap engellenmiş." }, { status: 403 });
    }

    await context.env.DB
      .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
      .bind(browserId, target.session_token)
      .run();

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
    }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${target.session_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      },
    });
  } catch (error) {
    return Response.json({ error: "Hesap değiştirilemedi." }, { status: 500 });
  }
}

async function ensureBrowserId(context: any, cookieHeader: string, activeToken: string) {
  const existing = getCookie(cookieHeader, BROWSER_COOKIE);
  const browserId = existing || crypto.randomUUID();
  await attachSessionToBrowser(context, browserId, activeToken);

  return {
    browserId,
    setCookie: existing ? "" : `${BROWSER_COOKIE}=${browserId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ONE_YEAR_SECONDS}`,
  };
}

async function attachSessionToBrowser(context: any, browserId: string, sessionToken: string) {
  try {
    await context.env.DB
      .prepare(`
        INSERT OR IGNORE INTO account_switch_sessions (browser_id, session_token, created_at, last_used_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
      `)
      .bind(browserId, sessionToken)
      .run();

    await context.env.DB
      .prepare("UPDATE account_switch_sessions SET last_used_at = datetime('now') WHERE browser_id = ? AND session_token = ?")
      .bind(browserId, sessionToken)
      .run();
  } catch {
    // Tablo yoksa ana oturum sistemi bozulmasın.
  }
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
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
