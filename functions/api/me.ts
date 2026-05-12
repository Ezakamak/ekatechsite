const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  try {
    const token = getCookie(context.request.headers.get("Cookie") || "", "session");

    if (!token) {
      return Response.json({ loggedIn: false }, { status: 401 });
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
        WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
      `)
      .bind(OWNER_EMAIL, OWNER_EMAIL, token)
      .first();

    if (!user) {
      return Response.json({ loggedIn: false }, { status: 401 });
    }

    return Response.json({
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
    return Response.json({ error: "Sunucu hatası. users tablosunda avatar_url ve avatar_approved kolonları olduğundan ve D1 binding adının DB olduğundan emin ol." }, { status: 500 });
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
