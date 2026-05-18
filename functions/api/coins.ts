import { getLevelProgress } from "../_levels";
import { creditTechCoins, ensureCoinTables, ensureWallet, getWallet } from "../_coinWallet";
import { recordOffMatch } from "../_offMatches";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureCoinTables(context);
    await ensureWallet(context, auth.user.id);

    const wallet = await context.env.DB.prepare(
      `
        SELECT
          COALESCE(balance, 0) AS balance,
          COALESCE(lifetime_earned, 0) AS lifetime_earned,
          updated_at
        FROM coin_wallets
        WHERE user_id = ?
      `,
    )
      .bind(auth.user.id)
      .first();

    const level = await getLevelProgress(context, auth.user.id);

    const recent = await context.env.DB.prepare(
      `
        SELECT amount, reason, created_at
        FROM coin_transactions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 5
      `,
    )
      .bind(auth.user.id)
      .all();

    return Response.json({
      currency: "Tech Coin",
      symbol: "TC",
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      updated_at: wallet?.updated_at || null,
      recent: recent?.results || [],
      source: "coin_wallets",
      level,
    });
  } catch (error) {
    return Response.json({
      currency: "Tech Coin",
      symbol: "TC",
      balance: 0,
      lifetime_earned: 0,
      updated_at: null,
      recent: [],
      level: {
        level: 1,
        exp: 0,
        currentLevelExp: 0,
        nextLevelExp: 135,
        expIntoLevel: 0,
        expNeededForNext: 135,
        verified: false,
      },
      note: "Coin tabloları henüz oluşturulmamış olabilir.",
    });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  if (!["off", "admin", "owner"].includes(String(auth.user.role || ""))) {
    return Response.json(
      { error: "Bu ödül için OFF erişimi gerekiyor." },
      { status: 403 },
    );
  }

  const body = await context.request.json().catch(() => null);
  if (body?.action !== "meme-clicker-reward") {
    return Response.json({ error: "Geçersiz coin işlemi." }, { status: 400 });
  }

  const amount = 2;

  try {
    await ensureCoinTables(context);
    await ensureWallet(context, auth.user.id);

    const walletData = await creditTechCoins(context, auth.user.id, amount, "Meme Clicker reward");
    const offSummary = await recordOffMatch(context, auth.user.id, {
      gameKey: "memeClicker",
      result: "completed",
      score: amount,
      expAmount: 4,
      pointsEarned: amount,
      expReason: "Meme Clicker reward",
    });
    const wallet = { ...walletData, ...offSummary.wallet };
    const level = offSummary.level;

    return Response.json({
      message: `+${amount} Tech Coin kazandın`,
      reward: amount,
      currency: "Tech Coin",
      symbol: "TC",
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      updated_at: wallet?.updated_at || null,
      wallet: {
        balance: Number(wallet?.balance || 0),
        lifetime_earned: Number(wallet?.lifetime_earned || 0),
        updated_at: wallet?.updated_at || null,
      },
      level,
      matchSummary: offSummary.matchSummary,
      questUpdates: offSummary.questUpdates,
      unlockedBadges: offSummary.unlockedBadges,
    });
  } catch (error) {
    return Response.json(
      { error: "Tech Coin ödülü eklenemedi." },
      { status: 500 },
    );
  }
}


async function requireUser(context: any) {
  const token = getCookie(
    context.request.headers.get("Cookie") || "",
    "session",
  );
  if (!token)
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(
    `
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `,
  )
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked")
    return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
