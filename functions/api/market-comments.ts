const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureMarketComments(context);
    const url = new URL(context.request.url);
    const symbol = String(url.searchParams.get("symbol") || "").toUpperCase().trim();

    if (!symbol) return json({ error: "Hisse sembolü gerekli." }, 400);

    const comments = await context.env.DB
      .prepare(`
        SELECT
          market_stock_comments.id,
          market_stock_comments.symbol,
          market_stock_comments.comment,
          market_stock_comments.created_at,
          users.name AS user_name,
          CASE WHEN COALESCE(users.avatar_approved, 0) = 1 THEN users.avatar_url ELSE '' END AS user_avatar_url
        FROM market_stock_comments
        JOIN users ON users.id = market_stock_comments.user_id
        WHERE market_stock_comments.symbol = ? AND market_stock_comments.status = 'approved'
        ORDER BY market_stock_comments.approved_at DESC, market_stock_comments.created_at DESC
        LIMIT 30
      `)
      .bind(symbol)
      .all();

    return json({ comments: comments?.results || [] });
  } catch (error) {
    return json({ error: "Yorumlar alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureMarketComments(context);
    const body = await context.request.json().catch(() => ({}));
    const symbol = String(body?.symbol || "").toUpperCase().trim();
    const comment = sanitizeComment(String(body?.comment || ""));

    if (!symbol) return json({ error: "Hisse sembolü gerekli." }, 400);
    if (comment.length < 3) return json({ error: "Yorum en az 3 karakter olmalı." }, 400);
    if (comment.length > 420) return json({ error: "Yorum 420 karakteri geçemez." }, 400);

    const stock = await context.env.DB
      .prepare(`SELECT symbol FROM market_stocks WHERE symbol = ?`)
      .bind(symbol)
      .first();

    if (!stock) return json({ error: "Bu hisse bulunamadı." }, 404);

    await context.env.DB
      .prepare(`
        INSERT INTO market_stock_comments (symbol, user_id, comment, status)
        VALUES (?, ?, ?, 'pending')
      `)
      .bind(symbol, auth.user.id, comment)
      .run();

    return json({ success: true, message: "Yorum admin onayına gönderildi. Onaylanmadan yayımlanmaz." });
  } catch (error) {
    return json({ error: "Yorum gönderilemedi.", detail: readableError(error) }, 500);
  }
}

async function ensureMarketComments(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_stock_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, user_id INTEGER NOT NULL, comment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewed_by INTEGER, reviewed_at TEXT, approved_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_comments_symbol_status ON market_stock_comments(symbol, status)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_comments_status_created ON market_stock_comments(status, created_at)`).run();
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  return { ok: true, user };
}

function sanitizeComment(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 420);
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
