const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    await ensureWallet(context, admin.user.id);

    const wallet = await getWallet(context, admin.user.id);
    const leaderboard = await context.env.DB
      .prepare(`
        SELECT
          users.id,
          users.name,
          users.email,
          users.avatar_url,
          tech_coin_wallets.balance,
          tech_coin_wallets.best_round,
          tech_coin_wallets.perfect_clears,
          tech_coin_wallets.total_rounds,
          tech_coin_wallets.lifetime_earned,
          COALESCE(tech_coin_wallets.lifetime_spent, 0) AS lifetime_spent
        FROM tech_coin_wallets
        JOIN users ON tech_coin_wallets.user_id = users.id
        WHERE lower(users.email) = ? OR COALESCE(users.role, 'client') = 'admin'
        ORDER BY tech_coin_wallets.balance DESC, tech_coin_wallets.best_round DESC
        LIMIT 10
      `)
      .bind(OWNER_EMAIL)
      .all();

    return json({ wallet, leaderboard: leaderboard?.results || [] });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Tech Coin verisi alınamadı: ${detail}` }, 500);
  }
}

export async function onRequestPost(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    const body = await context.request.json().catch(() => null);
    const eventType = String(body?.eventType || "reward").trim();
    const rawAmount = Number(body?.amount || 0);
    const roundGain = clampNumber(Number(body?.roundGain || 0), 0, 5000);
    const perfect = Boolean(body?.perfect);
    const details = String(body?.details || "").slice(0, 240);

    const allowedEvents = ["cell_cost", "safe_cell", "perfect_clear", "round_end", "bonus"];
    if (!allowedEvents.includes(eventType)) {
      return json({ error: "Geçersiz Tech Coin olayı." }, 400);
    }

    const amount = eventType === "cell_cost"
      ? clampNumber(rawAmount, -100, -1)
      : clampNumber(rawAmount, 0, 500);

    await ensureWallet(context, admin.user.id);

    const current = await getWallet(context, admin.user.id);
    const currentBalance = Number(current.balance || 0);
    const nextBalance = currentBalance + amount;

    if (eventType === "cell_cost" && nextBalance < 0) {
      return json({ error: "Yeterli Tech Coin yok." }, 402);
    }

    const nextBestRound = Math.max(Number(current.best_round || 0), roundGain);
    const addRound = eventType === "round_end" || eventType === "perfect_clear" ? 1 : 0;
    const addPerfect = perfect || eventType === "perfect_clear" ? 1 : 0;
    const earnedDelta = Math.max(0, amount);
    const spentDelta = Math.max(0, -amount);

    await context.env.DB
      .prepare(`
        UPDATE tech_coin_wallets
        SET
          balance = ?,
          lifetime_earned = COALESCE(lifetime_earned, 0) + ?,
          lifetime_spent = COALESCE(lifetime_spent, 0) + ?,
          best_round = ?,
          perfect_clears = COALESCE(perfect_clears, 0) + ?,
          total_rounds = COALESCE(total_rounds, 0) + ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `)
      .bind(nextBalance, earnedDelta, spentDelta, nextBestRound, addPerfect, addRound, admin.user.id)
      .run();

    await context.env.DB
      .prepare(`
        INSERT INTO tech_coin_events (user_id, event_type, amount, balance_after, round_gain, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(admin.user.id, eventType, amount, nextBalance, roundGain, details)
      .run();

    const wallet = await getWallet(context, admin.user.id);
    return json({ success: true, wallet });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    return json({ error: `Tech Coin güncellenemedi: ${detail}` }, 500);
  }
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB
    .prepare(`
      INSERT OR IGNORE INTO tech_coin_wallets (user_id, balance, lifetime_earned, lifetime_spent, best_round, perfect_clears, total_rounds)
      VALUES (?, 100, 0, 0, 0, 0, 0)
    `)
    .bind(userId)
    .run();
}

async function getWallet(context: any, userId: number) {
  return await context.env.DB
    .prepare(`
      SELECT
        user_id,
        COALESCE(balance, 100) AS balance,
        COALESCE(lifetime_earned, 0) AS lifetime_earned,
        COALESCE(lifetime_spent, 0) AS lifetime_spent,
        COALESCE(best_round, 0) AS best_round,
        COALESCE(perfect_clears, 0) AS perfect_clears,
        COALESCE(total_rounds, 0) AS total_rounds,
        updated_at
      FROM tech_coin_wallets
      WHERE user_id = ?
    `)
    .bind(userId)
    .first();
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        users.avatar_url,
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

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece admin ve owner içindir." };

  return { ok: true, user };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
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
