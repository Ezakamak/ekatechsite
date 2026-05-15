const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    await ensureMarketComments(context);
    const url = new URL(context.request.url);
    const status = String(url.searchParams.get("status") || "pending").toLowerCase();
    const safeStatus = ["pending", "approved", "rejected", "all"].includes(status) ? status : "pending";

    const where = safeStatus === "all" ? "" : "WHERE market_stock_comments.status = ?";
    const query = `
      SELECT
        market_stock_comments.id,
        market_stock_comments.symbol,
        market_stock_comments.comment,
        market_stock_comments.status,
        market_stock_comments.created_at,
        market_stock_comments.reviewed_at,
        market_stock_comments.approved_at,
        users.name AS user_name,
        users.email AS user_email,
        users.avatar_url AS user_avatar_url,
        reviewer.name AS reviewer_name
      FROM market_stock_comments
      JOIN users ON users.id = market_stock_comments.user_id
      LEFT JOIN users AS reviewer ON reviewer.id = market_stock_comments.reviewed_by
      ${where}
      ORDER BY market_stock_comments.created_at DESC
      LIMIT 80
    `;

    const statement = context.env.DB.prepare(query);
    const comments = safeStatus === "all" ? await statement.all() : await statement.bind(safeStatus).all();
    return json({ comments: comments?.results || [] });
  } catch (error) {
    return json({ error: "Yorum onay listesi alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);
  if (!canMutateAdminData(admin.user)) return json({ error: "Yorum onayı için profil fotoğrafı yüklemeli ve owner onayı almalısın." }, 403);

  try {
    await ensureMarketComments(context);
    const body = await context.request.json().catch(() => ({}));
    const commentId = Number(body?.commentId || 0);
    const action = String(body?.action || "").toLowerCase();

    if (!commentId) return json({ error: "Geçersiz yorum." }, 400);
    if (action !== "approve" && action !== "reject") return json({ error: "İşlem approve veya reject olmalı." }, 400);

    const target: any = await context.env.DB
      .prepare(`
        SELECT market_stock_comments.*, users.name AS user_name, users.email AS user_email
        FROM market_stock_comments
        JOIN users ON users.id = market_stock_comments.user_id
        WHERE market_stock_comments.id = ?
      `)
      .bind(commentId)
      .first();

    if (!target) return json({ error: "Yorum bulunamadı." }, 404);

    const nextStatus = action === "approve" ? "approved" : "rejected";
    await context.env.DB
      .prepare(`
        UPDATE market_stock_comments
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END
        WHERE id = ?
      `)
      .bind(nextStatus, admin.user.id, nextStatus, commentId)
      .run();

    await writeAuditLog(context, {
      actorUserId: admin.user.id,
      action: nextStatus === "approved" ? "market_comment_approved" : "market_comment_rejected",
      targetType: "market_stock_comment",
      targetId: commentId,
      targetLabel: `${target.symbol} · ${target.user_name} <${target.user_email}>`,
      details: `${admin.user.name} ${target.symbol} yorumunu ${nextStatus === "approved" ? "onayladı" : "reddetti"}.`,
    });

    return json({ success: true, message: nextStatus === "approved" ? "Yorum onaylandı ve yayımlandı." : "Yorum reddedildi." });
  } catch (error) {
    return json({ error: "Yorum durumu güncellenemedi.", detail: readableError(error) }, 500);
  }
}

async function ensureMarketComments(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_stock_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, user_id INTEGER NOT NULL, comment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewed_by INTEGER, reviewed_at TEXT, approved_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_comments_symbol_status ON market_stock_comments(symbol, status)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_comments_status_created ON market_stock_comments(status, created_at)`).run();
}

function canMutateAdminData(user: any) {
  if (user.role === "owner") return true;
  if (user.role !== "admin") return false;
  return Boolean(user.avatar_url) && Number(user.avatar_approved || 0) === 1;
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
        CASE WHEN lower(users.email) = ? THEN 1 ELSE COALESCE(users.avatar_approved, 0) END AS avatar_approved,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
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
  } catch {}
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
