const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

type AdminGate =
  | { ok: true; user: any }
  | { ok: false; status: number; error: string };

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    await ensureCoinTables(context);

    const users = await context.env.DB
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
          COALESCE(coin_wallets.balance, 0) AS balance,
          COALESCE(coin_wallets.lifetime_earned, 0) AS lifetime_earned,
          coin_wallets.updated_at AS wallet_updated_at
        FROM users
        LEFT JOIN coin_wallets ON coin_wallets.user_id = users.id
        ORDER BY users.id DESC
        LIMIT 150
      `)
      .bind(OWNER_EMAIL)
      .all();

    const recent = await context.env.DB
      .prepare(`
        SELECT
          coin_transactions.id,
          coin_transactions.user_id,
          users.name AS user_name,
          users.email AS user_email,
          coin_transactions.amount,
          coin_transactions.reason,
          coin_transactions.created_at
        FROM coin_transactions
        LEFT JOIN users ON users.id = coin_transactions.user_id
        WHERE coin_transactions.reason LIKE 'Admin OFF credit:%'
        ORDER BY coin_transactions.id DESC
        LIMIT 12
      `)
      .all();

    return Response.json({ users: users?.results || [], recent: recent?.results || [] });
  } catch (error) {
    return Response.json({ error: "OFF kredi verisi alınamadı.", detail: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  if (!canMutateAdminData(admin.user)) {
    return Response.json({ error: "OFF kredi yönetimi için admin profil fotoğrafı yüklemeli ve owner onayı almalısın." }, { status: 403 });
  }

  try {
    await ensureCoinTables(context);

    const body = await context.request.json().catch(() => null);
    const userId = Number(body?.userId || 0);
    const amount = Math.trunc(Number(body?.amount || 0));
    const note = String(body?.note || "").trim().slice(0, 180);

    if (!userId) return Response.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
    if (!amount || Math.abs(amount) > 100000) return Response.json({ error: "Kredi miktarı -100000 ile +100000 arasında ve 0 dışında olmalı." }, { status: 400 });
    if (note.length < 3) return Response.json({ error: "İşlem nedeni en az 3 karakter olmalı." }, { status: 400 });

    const target = await context.env.DB
      .prepare(`
        SELECT
          id,
          name,
          email,
          CASE
            WHEN lower(email) = ? THEN 'owner'
            ELSE COALESCE(role, 'client')
          END AS role
        FROM users
        WHERE id = ?
      `)
      .bind(OWNER_EMAIL, userId)
      .first();

    if (!target) return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    if (target.role === "owner") return Response.json({ error: "Owner hesabının kredisi bu panelden değiştirilemez." }, { status: 403 });

    if (admin.user.role !== "owner") {
      if (target.role === "admin") return Response.json({ error: "Adminler başka adminlerin kredisini değiştiremez." }, { status: 403 });
      if (Number(admin.user.id) === Number(userId)) return Response.json({ error: "Kendi kredini değiştiremezsin." }, { status: 403 });
    }

    await context.env.DB
      .prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned) VALUES (?, 0, 0)`)
      .bind(userId)
      .run();

    const wallet = await context.env.DB
      .prepare(`SELECT balance FROM coin_wallets WHERE user_id = ?`)
      .bind(userId)
      .first();

    const currentBalance = Number(wallet?.balance || 0);
    const nextBalance = currentBalance + amount;

    if (nextBalance < 0) {
      return Response.json({ error: `Kullanıcının bakiyesi yetersiz. Mevcut bakiye: ${currentBalance}` }, { status: 400 });
    }

    const lifetimeDelta = amount > 0 ? amount : 0;
    await context.env.DB
      .prepare(`UPDATE coin_wallets SET balance = balance + ?, lifetime_earned = lifetime_earned + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
      .bind(amount, lifetimeDelta, userId)
      .run();

    const reason = `Admin OFF credit: ${note}`;
    await context.env.DB
      .prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`)
      .bind(userId, amount, reason)
      .run();

    await writeAuditLog(context, {
      actorUserId: admin.user.id,
      action: amount > 0 ? "off_credit_added" : "off_credit_removed",
      targetType: "user",
      targetId: userId,
      targetLabel: `${target.name} <${target.email}>`,
      details: `${admin.user.name} ${target.name} hesabına ${amount > 0 ? "+" : ""}${amount} OFF kredisi uyguladı. Neden: ${note}`,
    });

    return Response.json({ success: true, message: `${target.name} için bakiye ${amount > 0 ? "+" : ""}${amount} güncellendi.`, balance: nextBalance });
  } catch (error) {
    return Response.json({ error: "OFF kredi işlemi yapılamadı.", detail: readableError(error) }, { status: 500 });
  }
}

async function ensureCoinTables(context: any) {
  const db = context.env.DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

function canMutateAdminData(user: any) {
  if (user.role === "owner") return true;
  if (user.role !== "admin") return false;
  return Boolean(user.avatar_url) && Number(user.avatar_approved || 0) === 1;
}

async function requireAdminOrOwner(context: any): Promise<AdminGate> {
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
          WHEN lower(users.email) = ? THEN 1
          ELSE COALESCE(users.avatar_approved, 0)
        END AS avatar_approved,
        CASE
          WHEN lower(users.email) = ? THEN 'owner'
          ELSE COALESCE(users.role, 'client')
        END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  return { ok: true, user };
}

async function writeAuditLog(context: any, entry: any) {
  try {
    await context.env.DB
      .prepare(`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, target_label, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(entry.actorUserId, entry.action, entry.targetType, entry.targetId, entry.targetLabel, entry.details)
      .run();
  } catch {
    // Audit tablosu yoksa ana kredi işlemi bozulmasın.
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}
