import { getLevelProgress } from "../_levels";

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

    await context.env.DB.prepare(
      `
        UPDATE coin_wallets
        SET
          balance = COALESCE(balance, 0) + ?,
          lifetime_earned = COALESCE(lifetime_earned, 0) + ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `,
    )
      .bind(amount, amount, auth.user.id)
      .run();

    await context.env.DB.prepare(
      `
        INSERT INTO coin_transactions (user_id, amount, reason, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `,
    )
      .bind(auth.user.id, amount, "Meme Clicker reward")
      .run();

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
    });
  } catch (error) {
    return Response.json(
      { error: "Tech Coin ödülü eklenemedi." },
      { status: 500 },
    );
  }
}

async function ensureCoinTables(context: any) {
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS coin_wallets (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 100,
      lifetime_earned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  await addColumnIfMissing(
    context,
    "coin_wallets",
    "balance",
    "INTEGER DEFAULT 100",
  );
  await addColumnIfMissing(
    context,
    "coin_wallets",
    "lifetime_earned",
    "INTEGER DEFAULT 0",
  );
  await addColumnIfMissing(context, "coin_wallets", "updated_at", "TEXT");
  await addColumnIfMissing(
    context,
    "coin_transactions",
    "amount",
    "INTEGER DEFAULT 0",
  );
  await addColumnIfMissing(context, "coin_transactions", "reason", "TEXT");
  await addColumnIfMissing(
    context,
    "coin_transactions",
    "created_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP",
  );
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `
    INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at)
    VALUES (?, 100, 0, datetime('now'))
  `,
  )
    .bind(userId)
    .run();

  await context.env.DB.prepare(
    `
    UPDATE coin_wallets
    SET
      balance = COALESCE(balance, 100),
      lifetime_earned = COALESCE(lifetime_earned, 0),
      updated_at = COALESCE(updated_at, datetime('now'))
    WHERE user_id = ?
  `,
  )
    .bind(userId)
    .run();
}

async function addColumnIfMissing(
  context: any,
  table: string,
  column: string,
  definition: string,
) {
  const rows = await context.env.DB.prepare(
    `PRAGMA table_info(${quoteIdent(table)})`,
  ).all();
  const exists = (rows?.results || []).some(
    (row: any) => String(row.name || "") === column,
  );
  if (!exists)
    await context.env.DB.prepare(
      `ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`,
    ).run();
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
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
