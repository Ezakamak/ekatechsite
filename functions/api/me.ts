const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  try {
    const token = getCookie(context.request.headers.get("Cookie") || "", "session");

    if (!token) {
      return json({ loggedIn: false, user: null });
    }

    const user = await context.env.DB
      .prepare(`
        SELECT
          users.id,
          users.name,
          users.email,
          CASE
            WHEN lower(users.email) = ? THEN 'owner'
            ELSE COALESCE(users.role, 'client')
          END AS role,
          users.avatar_url,
          CASE
            WHEN lower(users.email) = ? THEN 1
            ELSE COALESCE(users.avatar_approved, 0)
          END AS avatar_approved
        FROM sessions
        JOIN users ON sessions.user_id = users.id
        WHERE sessions.token = ?
          AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
      `)
      .bind(OWNER_EMAIL, OWNER_EMAIL, token)
      .first();

    if (!user) {
      return json({ loggedIn: false, user: null });
    }

    if (user.role === "blocked") {
      return json({ loggedIn: false, user: null, blocked: true });
    }

    return json({
      loggedIn: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url || "",
        avatar_approved: Number(user.avatar_approved || 0),
      },
    });
  } catch (error) {
    return json({ loggedIn: false, user: null, error: "Auth kontrolü yapılamadı." }, 500);
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
