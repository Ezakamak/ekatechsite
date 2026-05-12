const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const wallet = await context.env.DB
      .prepare(`
        SELECT
          COALESCE(balance, 0) AS balance,
          COALESCE(lifetime_earned, 0) AS lifetime_earned,
          updated_at
        FROM coin_wallets
        WHERE user_id = ?
      `)
      .bind(auth.user.id)
      .first();

    const recent = await context.env.DB
      .prepare(`
        SELECT amount, reason, created_at
        FROM coin_transactions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 5
      `)
      .bind(auth.user.id)
      .all();

    return Response.json({
      currency: "Tech Coin",
      symbol: "TC",
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      updated_at: wallet?.updated_at || null,
      recent: recent?.results || [],
    });
  } catch (error) {
    return Response.json({
      currency: "Tech Coin",
      symbol: "TC",
      balance: 0,
      lifetime_earned: 0,
      updated_at: null,
      recent: [],
      note: "Coin tabloları henüz oluşturulmamış olabilir.",
    });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
