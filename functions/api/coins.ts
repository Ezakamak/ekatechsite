import { getLevelProgress } from "../_levels";
import { creditWallet, ensureWallet, getWallet } from "../_coinWallet";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureWallet(context, auth.user.id);
    const wallet = await getWallet(context, auth.user.id);
    const level = await getLevelProgress(context, auth.user.id);

    const recent = await context.env.DB.prepare(
      `SELECT amount, reason, created_at FROM coin_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 5`,
    ).bind(auth.user.id).all();

    return Response.json({ ...wallet, recent: recent?.results || [], source: "coin_wallets", level });
  } catch {
    return Response.json({ error: "Wallet unavailable" }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!["off", "admin", "owner"].includes(String(auth.user.role || ""))) {
    return Response.json({ error: "Bu ödül için OFF erişimi gerekiyor." }, { status: 403 });
  }

  const body = await context.request.json().catch(() => null);
  if (body?.action !== "meme-clicker-reward") return Response.json({ error: "Geçersiz coin işlemi." }, { status: 400 });

  try {
    await ensureWallet(context, auth.user.id);
    await creditWallet(context, auth.user.id, 2, "Meme Clicker reward");
    const wallet = await getWallet(context, auth.user.id);
    const level = await getLevelProgress(context, auth.user.id);
    return Response.json({ message: "+2 Tech Coin kazandın", reward: 2, ...wallet, wallet, level });
  } catch {
    return Response.json({ error: "Tech Coin ödülü eklenemedi." }, { status: 500 });
  }
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(
    `
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `,
  ).bind(OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
