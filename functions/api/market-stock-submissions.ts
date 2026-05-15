const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const MIN_INITIAL_PRICE = 25;
const MAX_INITIAL_PRICE = 250;
const MIN_SYMBOL_LENGTH = 2;
const MAX_SYMBOL_LENGTH = 8;

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureStockSubmissions(context);
    const submissions = await context.env.DB
      .prepare(`
        SELECT id, symbol, name, sector, description_tr, description_en, initial_price, risk, status, reviewer_note, created_at, reviewed_at
        FROM market_stock_submissions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `)
      .bind(auth.user.id)
      .all();

    return json({ submissions: submissions?.results || [] });
  } catch (error) {
    return json({ error: "Hisse başvuruları alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureStockSubmissions(context);
    await ensureMarketStocks(context);

    const body = await context.request.json().catch(() => ({}));
    const symbol = normalizeSymbol(body?.symbol);
    const name = cleanText(body?.name, 48);
    const sector = cleanText(body?.sector, 36);
    const descriptionTr = cleanText(body?.descriptionTr || body?.description_tr, 420);
    const descriptionEnRaw = cleanText(body?.descriptionEn || body?.description_en, 420);
    const descriptionEn = descriptionEnRaw || descriptionTr;
    const initialPrice = Number(body?.initialPrice ?? body?.initial_price);
    const risk = normalizeRisk(body?.risk);

    if (!symbol || symbol.length < MIN_SYMBOL_LENGTH || symbol.length > MAX_SYMBOL_LENGTH) {
      return json({ error: `Sembol zorunlu. ${MIN_SYMBOL_LENGTH}-${MAX_SYMBOL_LENGTH} karakter, sadece harf/rakam kullan.` }, 400);
    }
    if (!name || name.length < 3) return json({ error: "Şirket/hisse adı zorunlu ve en az 3 karakter olmalı." }, 400);
    if (!sector || sector.length < 3) return json({ error: "Sektör zorunlu ve en az 3 karakter olmalı." }, 400);
    if (!descriptionTr || descriptionTr.length < 20) return json({ error: "Açıklama zorunlu ve en az 20 karakter olmalı." }, 400);
    if (!Number.isFinite(initialPrice) || initialPrice < MIN_INITIAL_PRICE || initialPrice > MAX_INITIAL_PRICE) {
      return json({ error: `Başlangıç fiyatı ${MIN_INITIAL_PRICE} ile ${MAX_INITIAL_PRICE} Tech Coin arasında olmalı.` }, 400);
    }
    if (!risk) return json({ error: "Risk seviyesi düşük, orta veya yüksek olmalı." }, 400);

    const existingStock = await context.env.DB
      .prepare(`SELECT symbol FROM market_stocks WHERE symbol = ?`)
      .bind(symbol)
      .first();

    if (existingStock) return json({ error: "Bu sembol zaten yayında. Farklı bir sembol seç." }, 409);

    const existingPending = await context.env.DB
      .prepare(`SELECT id FROM market_stock_submissions WHERE symbol = ? AND status = 'pending'`)
      .bind(symbol)
      .first();

    if (existingPending) return json({ error: "Bu sembol için zaten bekleyen başvuru var." }, 409);

    await context.env.DB
      .prepare(`
        INSERT INTO market_stock_submissions (symbol, name, sector, description_tr, description_en, initial_price, risk, user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `)
      .bind(symbol, name, sector, descriptionTr, descriptionEn, Number(initialPrice.toFixed(2)), risk, auth.user.id)
      .run();

    await writeAuditLog(context, {
      actorUserId: auth.user.id,
      action: "market_stock_submission_created",
      targetType: "market_stock_submission",
      targetId: null,
      targetLabel: `${symbol} · ${name}`,
      details: `${auth.user.name} yeni hisse başvurusu gönderdi.`,
    });

    return json({ success: true, message: "Hisse başvurun admin onayına gönderildi. Onaylanmadan yayımlanmaz." });
  } catch (error) {
    return json({ error: "Hisse başvurusu gönderilemedi.", detail: readableError(error) }, 500);
  }
}

async function ensureStockSubmissions(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_stock_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, initial_price REAL NOT NULL, risk TEXT NOT NULL, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer_id INTEGER, reviewer_note TEXT, reviewed_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_submissions_status ON market_stock_submissions(status, created_at)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_market_stock_submissions_symbol ON market_stock_submissions(symbol)`).run();
}

async function ensureMarketStocks(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_stocks (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, price REAL NOT NULL, previous_price REAL NOT NULL, volatility REAL NOT NULL, risk TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
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

function normalizeSymbol(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_SYMBOL_LENGTH);
}

function normalizeRisk(value: unknown) {
  const risk = String(value || "").toLowerCase();
  if (["low", "medium", "high"].includes(risk)) return risk;
  if (risk === "düşük" || risk === "dusuk") return "low";
  if (risk === "orta") return "medium";
  if (risk === "yüksek" || risk === "yuksek") return "high";
  return "";
}

function cleanText(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function writeAuditLog(context: any, entry: any) {
  try {
    await context.env.DB
      .prepare(`INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, target_label, details) VALUES (?, ?, ?, ?, ?, ?)`)
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
