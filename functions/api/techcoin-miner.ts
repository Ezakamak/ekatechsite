const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const SESSION_MINUTES = 60;
const COINS_PER_MINUTE = 1;
const COOLDOWN_DIVISOR = 5;

const MINER_SERVERS = [
  { id: "server-1", nameTr: "Miner Server Alpha", nameEn: "Miner Server Alpha", accent: "cyan" },
  { id: "server-2", nameTr: "Miner Server Beta", nameEn: "Miner Server Beta", accent: "purple" },
  { id: "server-3", nameTr: "Miner Server Gamma", nameEn: "Miner Server Gamma", accent: "amber" },
];

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureMinerTables(context);
    await settleExpiredSessions(context);
    return json(await buildMinerState(context, auth.user.id));
  } catch (error) {
    return json({ error: "TechCoin Miner verisi alınamadı.", detail: readableError(error) }, 500);
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureMinerTables(context);
    await settleExpiredSessions(context);

    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "start") {
      const serverId = String(body?.serverId || "");
      if (!MINER_SERVERS.some((server) => server.id === serverId)) return json({ error: "Geçersiz miner server." }, 400);

      const userActive = await getActiveSessionForUser(context, auth.user.id);
      if (userActive) return json({ error: "Aynı anda sadece 1 miner server kullanabilirsin." }, 409);

      const serverActive = await getActiveSessionForServer(context, serverId);
      if (serverActive) return json({ error: "Bu server şu an başka kullanıcı tarafından kullanılıyor." }, 409);

      const serverCooldown = await getActiveCooldownForServer(context, serverId);
      if (serverCooldown) return json({ error: "Bu server soğuma modunda. Geri sayım bitince tekrar kullanılabilir." }, 409);

      await context.env.DB
        .prepare(`
          INSERT INTO techcoin_miner_sessions (server_id, user_id, status, started_at, last_claimed_at, expires_at, total_claimed)
          VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, datetime('now', '+60 minutes'), 0)
        `)
        .bind(serverId, auth.user.id)
        .run();

      await writeAuditLog(context, {
        actorUserId: auth.user.id,
        action: "techcoin_miner_started",
        targetType: "techcoin_miner_server",
        targetId: null,
        targetLabel: serverId,
        details: `${auth.user.name} ${serverId} üzerinde TechCoin Miner başlattı.`,
      });

      return json(await buildMinerState(context, auth.user.id, "Miner server bağlandı. Her dakika Tech Coin üretmeye başladı."));
    }

    if (action === "claim") {
      const session = await getActiveSessionForUser(context, auth.user.id);
      if (!session) return json({ error: "Aktif miner oturumun yok." }, 404);
      const awarded = await claimSession(context, session);
      return json(await buildMinerState(context, auth.user.id, awarded > 0 ? `${awarded} Tech Coin cüzdana aktarıldı.` : "Henüz aktarılacak tam dakika yok."));
    }

    if (action === "leave") {
      const session = await getActiveSessionForUser(context, auth.user.id);
      if (!session) return json({ error: "Aktif miner oturumun yok." }, 404);
      const awarded = await claimSession(context, session);
      const cooldown = calculateCooldown(session, Date.now());

      await context.env.DB
        .prepare(`UPDATE techcoin_miner_sessions SET status = 'completed', ended_at = CURRENT_TIMESTAMP, cooldown_seconds = ?, cooldown_until = ? WHERE id = ?`)
        .bind(cooldown.cooldownSeconds, toSqlDate(new Date(cooldown.cooldownUntilMs).toISOString()), session.id)
        .run();

      await writeAuditLog(context, {
        actorUserId: auth.user.id,
        action: "techcoin_miner_left",
        targetType: "techcoin_miner_server",
        targetId: session.id,
        targetLabel: session.server_id,
        details: `${auth.user.name} miner serverdan ayrıldı. Aktarılan coin: ${awarded}. Soğuma: ${cooldown.cooldownSeconds} saniye.`,
      });

      return json(await buildMinerState(context, auth.user.id, awarded > 0 ? `Server boşaltıldı. ${awarded} Tech Coin cüzdana aktarıldı. Server soğuma moduna geçti.` : "Server boşaltıldı ve soğuma moduna geçti."));
    }

    return json({ error: "Bilinmeyen miner işlemi." }, 400);
  } catch (error) {
    return json({ error: readableError(error) }, 400);
  }
}

async function ensureMinerTables(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS techcoin_miner_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', started_at TEXT DEFAULT CURRENT_TIMESTAMP, last_claimed_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, ended_at TEXT, cooldown_until TEXT, cooldown_seconds INTEGER NOT NULL DEFAULT 0, total_claimed INTEGER NOT NULL DEFAULT 0)`).run();
  await addColumnIfMissing(context, "techcoin_miner_sessions", "cooldown_until", "TEXT");
  await addColumnIfMissing(context, "techcoin_miner_sessions", "cooldown_seconds", "INTEGER NOT NULL DEFAULT 0");
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_techcoin_miner_sessions_active_server ON techcoin_miner_sessions(server_id, status)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_techcoin_miner_sessions_active_user ON techcoin_miner_sessions(user_id, status)`).run();
  await context.env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_techcoin_miner_sessions_cooldown ON techcoin_miner_sessions(server_id, cooldown_until)`).run();
}

async function settleExpiredSessions(context: any) {
  const expired = (await context.env.DB
    .prepare(`
      SELECT * FROM techcoin_miner_sessions
      WHERE status = 'active' AND datetime(expires_at) <= datetime('now')
      LIMIT 25
    `)
    .all())?.results || [];

  for (const session of expired as any[]) {
    const awarded = await claimSession(context, session, true);
    const cooldown = calculateCooldown(session, toMs(session.expires_at));

    await context.env.DB
      .prepare(`UPDATE techcoin_miner_sessions SET status = 'expired', ended_at = expires_at, cooldown_seconds = ?, cooldown_until = ? WHERE id = ?`)
      .bind(cooldown.cooldownSeconds, toSqlDate(new Date(cooldown.cooldownUntilMs).toISOString()), session.id)
      .run();

    await writeAuditLog(context, {
      actorUserId: session.user_id,
      action: "techcoin_miner_expired",
      targetType: "techcoin_miner_session",
      targetId: session.id,
      targetLabel: session.server_id,
      details: `TechCoin Miner oturumu 60 dakika sonunda otomatik kapandı. Aktarılan coin: ${awarded}. Soğuma: ${cooldown.cooldownSeconds} saniye.`,
    });
  }
}

async function claimSession(context: any, session: any, forceToExpiry = false) {
  const nowMs = Date.now();
  const lastClaimMs = toMs(session.last_claimed_at || session.started_at);
  const expiresMs = toMs(session.expires_at);
  const capMs = forceToExpiry ? expiresMs : Math.min(nowMs, expiresMs);
  const minutes = Math.max(0, Math.floor((capMs - lastClaimMs) / 60_000));
  const amount = minutes * COINS_PER_MINUTE;

  if (amount <= 0) return 0;

  const nextClaimDate = new Date(lastClaimMs + minutes * 60_000).toISOString();
  await ensureWallet(context, Number(session.user_id));
  await context.env.DB
    .prepare(`UPDATE coin_wallets SET balance = balance + ?, lifetime_earned = lifetime_earned + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .bind(amount, amount, session.user_id)
    .run();
  await context.env.DB
    .prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`)
    .bind(session.user_id, amount, `TechCoin Miner ${session.server_id}`)
    .run();
  await context.env.DB
    .prepare(`UPDATE techcoin_miner_sessions SET last_claimed_at = ?, total_claimed = total_claimed + ? WHERE id = ?`)
    .bind(toSqlDate(nextClaimDate), amount, session.id)
    .run();

  return amount;
}

async function buildMinerState(context: any, userId: number, message = "") {
  await ensureWallet(context, userId);
  const sessions = (await context.env.DB
    .prepare(`
      SELECT
        techcoin_miner_sessions.*,
        users.name AS user_name,
        CASE WHEN COALESCE(users.avatar_approved, 0) = 1 THEN users.avatar_url ELSE '' END AS user_avatar_url
      FROM techcoin_miner_sessions
      JOIN users ON users.id = techcoin_miner_sessions.user_id
      WHERE techcoin_miner_sessions.status = 'active' AND datetime(techcoin_miner_sessions.expires_at) > datetime('now')
      ORDER BY techcoin_miner_sessions.started_at ASC
    `)
    .all())?.results || [];

  const cooldowns = (await context.env.DB
    .prepare(`
      SELECT * FROM techcoin_miner_sessions
      WHERE status IN ('completed', 'expired') AND cooldown_until IS NOT NULL AND datetime(cooldown_until) > datetime('now')
      ORDER BY cooldown_until DESC
    `)
    .all())?.results || [];

  const wallet: any = await context.env.DB.prepare(`SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
  const currentSession = (sessions as any[]).find((session) => Number(session.user_id) === Number(userId)) || null;
  const servers = MINER_SERVERS.map((server) => {
    const active = (sessions as any[]).find((session) => session.server_id === server.id) || null;
    const cooldown = !active ? (cooldowns as any[]).find((item) => item.server_id === server.id) || null : null;
    return {
      ...server,
      occupied: Boolean(active),
      cooling: Boolean(cooldown),
      session: active ? serializeSession(active, userId) : null,
      cooldown: cooldown ? serializeCooldown(cooldown) : null,
    };
  });

  return {
    servers,
    currentSession: currentSession ? serializeSession(currentSession, userId) : null,
    limits: {
      sessionMinutes: SESSION_MINUTES,
      coinsPerMinute: COINS_PER_MINUTE,
      maxCoinsPerSession: SESSION_MINUTES * COINS_PER_MINUTE,
      cooldownDivisor: COOLDOWN_DIVISOR,
    },
    wallet: {
      balance: Number(wallet?.balance || 0),
      lifetime_earned: Number(wallet?.lifetime_earned || 0),
      updated_at: wallet?.updated_at || null,
    },
    message,
  };
}

function serializeSession(session: any, currentUserId: number) {
  const nowMs = Date.now();
  const startedMs = toMs(session.started_at);
  const expiresMs = toMs(session.expires_at);
  const lastClaimMs = toMs(session.last_claimed_at || session.started_at);
  const remainingSeconds = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
  const elapsedSeconds = Math.max(0, Math.floor((Math.min(nowMs, expiresMs) - startedMs) / 1000));
  const claimable = Math.max(0, Math.floor((Math.min(nowMs, expiresMs) - lastClaimMs) / 60_000) * COINS_PER_MINUTE);

  return {
    id: Number(session.id),
    serverId: session.server_id,
    userId: Number(session.user_id),
    isMine: Number(session.user_id) === Number(currentUserId),
    userName: session.user_name || "OFF Player",
    userAvatarUrl: session.user_avatar_url || "",
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    remainingSeconds,
    elapsedSeconds,
    claimable,
    totalClaimed: Number(session.total_claimed || 0),
  };
}

function serializeCooldown(session: any) {
  const nowMs = Date.now();
  const cooldownUntilMs = toMs(session.cooldown_until);
  const startedMs = toMs(session.started_at);
  const endedMs = toMs(session.ended_at || session.expires_at);
  const usedSeconds = Math.max(0, Math.floor((endedMs - startedMs) / 1000));
  const cooldownSeconds = Number(session.cooldown_seconds || Math.ceil(usedSeconds / COOLDOWN_DIVISOR));
  const remainingSeconds = Math.max(0, Math.floor((cooldownUntilMs - nowMs) / 1000));

  return {
    sessionId: Number(session.id),
    until: session.cooldown_until,
    usedSeconds,
    cooldownSeconds,
    remainingSeconds,
  };
}

function calculateCooldown(session: any, endMs: number) {
  const startedMs = toMs(session.started_at);
  const safeEndMs = Math.max(startedMs, endMs);
  const usedSeconds = Math.max(0, Math.floor((safeEndMs - startedMs) / 1000));
  const cooldownSeconds = Math.ceil(usedSeconds / COOLDOWN_DIVISOR);
  return {
    usedSeconds,
    cooldownSeconds,
    cooldownUntilMs: safeEndMs + cooldownSeconds * 1000,
  };
}

async function getActiveSessionForUser(context: any, userId: number) {
  return await context.env.DB
    .prepare(`SELECT * FROM techcoin_miner_sessions WHERE user_id = ? AND status = 'active' AND datetime(expires_at) > datetime('now') ORDER BY id DESC LIMIT 1`)
    .bind(userId)
    .first();
}

async function getActiveSessionForServer(context: any, serverId: string) {
  return await context.env.DB
    .prepare(`SELECT * FROM techcoin_miner_sessions WHERE server_id = ? AND status = 'active' AND datetime(expires_at) > datetime('now') ORDER BY id DESC LIMIT 1`)
    .bind(serverId)
    .first();
}

async function getActiveCooldownForServer(context: any, serverId: string) {
  return await context.env.DB
    .prepare(`SELECT * FROM techcoin_miner_sessions WHERE server_id = ? AND status IN ('completed', 'expired') AND cooldown_until IS NOT NULL AND datetime(cooldown_until) > datetime('now') ORDER BY cooldown_until DESC LIMIT 1`)
    .bind(serverId)
    .first();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned) VALUES (?, 0, 0)`).bind(userId).run();
}

async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND datetime(replace(substr(sessions.expires_at, 1, 19), 'T', ' ')) > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!["off", "admin", "owner"].includes(String(user.role))) return { ok: false, status: 403, error: "Bu alan sadece OFF, admin ve owner hesapları içindir." };
  return { ok: true, user };
}

async function addColumnIfMissing(context: any, table: string, column: string, definition: string) {
  try {
    const columns = (await context.env.DB.prepare(`PRAGMA table_info(${table})`).all())?.results || [];
    const exists = (columns as any[]).some((item) => item.name === column);
    if (!exists) await context.env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
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

function toMs(value: string) {
  const normalized = String(value || "").replace(" ", "T");
  const parsed = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function toSqlDate(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
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
