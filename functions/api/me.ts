export async function onRequestGet(context: any) {
  try {
    const token = getCookie(context.request.headers.get("Cookie") || "", "session");

    if (!token) {
      return Response.json({ loggedIn: false }, { status: 401 });
    }

    const user = await context.env.DB
      .prepare(`
        SELECT users.id, users.name, users.email, COALESCE(users.role, 'client') AS role
        FROM sessions
        JOIN users ON sessions.user_id = users.id
        WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
      `)
      .bind(token)
      .first();

    if (!user) {
      return Response.json({ loggedIn: false }, { status: 401 });
    }

    return Response.json({
      loggedIn: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return Response.json({ error: "Sunucu hatası. D1 binding adının DB olduğundan emin ol." }, { status: 500 });
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
