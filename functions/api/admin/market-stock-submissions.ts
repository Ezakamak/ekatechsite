const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    await ensureStockSubmissions(context);
    const url = new URL(context.request.url);
    const status = String(url.searchParams.get("status") || "pending").toLowerCase();
    const safeStatus = ["pending", "approved", "rejected", "all"].includes(status) ? status : "pending";
    const where = safeStatus === "all" ? "" : "WHERE market_stock_submissions.status = ?";

    const query = `
      SELECT
        market_stock_submissions.*,
        users.name AS user_name,
        users.email AS user_email,
        users.avatar_url AS user_avatar_url,
        reviewer.name AS reviewer_name
      FROM market_stock_submissions
      JOIN users ON users.id = market_stock_submissions.user_id
      LEFT JOIN users AS reviewer ON reviewer.id = market_stock_submissions.reviewer_id
      ${where}
      ORDER BY market_stock_submissions.created_at DESC
      LIMIT 80
    `;

    const statement = context.env.DB.prepare(query);
    const result = safeStatus === "all" ? await statement.all() : await statement.bind(safeStatus).all();
    return json({ submissions: result?.results || [] });
  } catch (error) {
    return json({ error: "Hisse başvuruları alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPatch(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return json({ error: admin.error }, admin.status);
  if (!canMutateAdminData(admin.user)) return json({ error: "Hisse onayı için profil fotoğrafı yüklemeli ve owner onayı almalısın." }, 403);

  try {
    await ensureStockSubmissions(context);
    await ensureMarketTables(context);

    const body = await context.request.json().catch(() => ({}));
    const submissionId = Number(body?.submissionId || 0);
    const action = String(body?.action || "").toLowerCase();
    const reviewerNote = cleanText(body?.reviewerNote, 240);

    if (!submissionId) return json({ error: "Geçersiz başvuru." }, 400);
    if (action !== "approve" && action !== "reject") return json({ error: "İşlem approve veya reject olmalı." }, 400);

    const submission: any = await context.env.DB
      .prepare(`
        SELECT market_stock_submissions.*, users.name AS user_name, users.email AS user_email
        FROM market_stock_submissions
        JOIN users ON users.id = market_stock_submissions.user_id
        WHERE market_stock_submissions.id = ?
      `)
      .bind(submissionId)
      .first();

    if (!submission) return json({ error: "Başvuru bulunamadı." }, 404);
    if (submission.status !== "pending") return json({ error: "Bu başvuru zaten incelenmiş." }, 409);

    if (action === "approve") {
      const existingStock = await context.env.DB
        .prepare(`SELECT symbol FROM market_stocks WHERE symbol = ?`)
        .bind(submission.symbol)
        .first();

      if (existingStock) return json({ error: "Bu sembol artık yayında. Başvuru onaylanamaz." }, 409);

      const volatility = submission.risk === "low" ? 0.035 : submission.risk === "high" ? 0.085 : 0.055;

      await context.env.DB.batch([
        context.env.DB
          .prepare(`
            INSERT INTO market_stocks (symbol, name, sector, description_tr, description_en, price, previous_price, volatility, risk)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            submission.symbol,
            submission.name,
            submission.sector,
            submission.description_tr,
            submission.description_en,
            Number(submission.initial_price),
            Number(submission.initial_price),
            volatility,
            submission.risk
          ),
        context.env.DB
          .prepare(`
            UPDATE market_stock_submissions
            SET status = 'approved', reviewer_id = ?, reviewer_note = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(admin.user.id, reviewerNote, submissionId),
      ]);

      await writeAuditLog(context, {
        actorUserId: admin.user.id,
        action: "market_stock_submission_approved",
        targetType: "market_stock_submission",
        targetId: submissionId,
        targetLabel: `${submission.symbol} · ${submission.name}`,
        details: `${admin.user.name} ${submission.symbol} hisse başvurusunu onayladı ve yayına aldı.`,
      });

      await notify(context, submission.user_id, "Hisse başvurun onaylandı", `${submission.symbol} artık Eka InvestSim piyasasında yayında.`, "/off");
      return json({ success: true, message: "Hisse başvurusu onaylandı ve piyasaya eklendi." });
    }

    await context.env.DB
      .prepare(`
        UPDATE market_stock_submissions
        SET status = 'rejected', reviewer_id = ?, reviewer_note = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(admin.user.id, reviewerNote, submissionId)
      .run();

    await writeAuditLog(context, {
      actorUserId: admin.user.id,
      action: "market_stock_submission_rejected",
      targetType: "market_stock_submission",
      targetId: submissionId,
      targetLabel: `${submission.symbol} · ${submission.name}`,
      details: `${admin.user.name} ${submission.symbol} hisse başvurusunu reddetti.`,
    });

    await notify(context, submission.user_id, "Hisse başvurun reddedildi", reviewerNote || `${submission.symbol} başvurun admin tarafından reddedildi.`, "/off");
    return json({ success: true, message: "Hisse başvurusu reddedildi." });
  } catch (error) {
    return json({ error: "Hisse başvurusu güncellenemedi.", detail: readableError(error) }, 500);
  }
}

async function ensureStockSubmissions(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_stock_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, initial_price REAL NOT NULL, risk TEXT NOT NULL, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer_id INTEGER, reviewer_note TEXT, reviewed_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_submissions_status ON market_stock_submissions(status, created_at)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_submissions_symbol ON market_stock_submissions(symbol)`).run();
}

async function ensureMarketTables(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_stocks (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, price REAL NOT NULL, previous_price REAL NOT NULL, volatility REAL NOT NULL, risk TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, price REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
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

async function notify(context: any, userId: number, title: string, body: string, link: string) {
  try {
    await context.env.DB
      .prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)")
      .bind(userId, title, body, link)
      .run();
  } catch {}
}

async function writeAuditLog(context: any, entry: any) {
  try {
    await context.env.DB
      .prepare(`INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, target_label, details) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(entry.actorUserId, entry.action, entry.targetType, entry.targetId, entry.targetLabel, entry.details)
      .run();
  } catch {}
}

function cleanText(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
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
