const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const DEFAULT_MAX_HP = 10000;
const DAILY_DAMAGE_CAP = 600;
const ACTIONS: Record<string, { label: string; damage: number; dailyLimit: number }> = {
  stabilize: { label: "Stabilize Core", damage: 35, dailyLimit: 8 },
  decrypt: { label: "Decrypt Fragment", damage: 85, dailyLimit: 3 },
  pulse: { label: "Pulse Blaster", damage: 60, dailyLimit: 3 },
  raygun: { label: "Raygun Charge", damage: 95, dailyLimit: 1 },
};

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const event = await getOrCreateEvent(context);
    await finalizeEventIfDefeated(context, event.id);
    return Response.json(await buildState(context, auth.user.id));
  } catch {
    return Response.json({ error: "Core Raid verileri alınamadı. d1-core-raid.sql migration'ını çalıştır." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const action = String(body?.action || "").trim();
    if (!ACTIONS[action]) return Response.json({ error: "Geçersiz raid görevi." }, { status: 400 });

    const event = await getOrCreateEvent(context);
    if (event.status !== "active") return Response.json(await buildState(context, auth.user.id));

    const actionDate = todayKey();
    const actionInfo = ACTIONS[action];
    const usage = await context.env.DB
      .prepare("SELECT uses, damage FROM core_raid_daily_actions WHERE event_id = ? AND user_id = ? AND action_day = ? AND action_type = ?")
      .bind(event.id, auth.user.id, actionDate, action)
      .first();

    if (Number(usage?.uses || 0) >= actionInfo.dailyLimit) {
      return Response.json({ error: "Bu görevin günlük hakkı doldu.", ...(await buildState(context, auth.user.id)) }, { status: 429 });
    }

    const daily = await context.env.DB
      .prepare("SELECT COALESCE(SUM(damage), 0) AS damage FROM core_raid_daily_actions WHERE event_id = ? AND user_id = ? AND action_day = ?")
      .bind(event.id, auth.user.id, actionDate)
      .first();

    const remainingDaily = Math.max(0, DAILY_DAMAGE_CAP - Number(daily?.damage || 0));
    if (remainingDaily <= 0) {
      return Response.json({ error: "Günlük raid hasar limitin doldu.", ...(await buildState(context, auth.user.id)) }, { status: 429 });
    }

    const damage = Math.min(actionInfo.damage, remainingDaily, Number(event.current_hp || 0));
    if (damage <= 0) return Response.json(await buildState(context, auth.user.id));

    await context.env.DB
      .prepare("UPDATE core_raid_events SET current_hp = MAX(0, current_hp - ?), updated_at = datetime('now') WHERE id = ? AND status = 'active'")
      .bind(damage, event.id)
      .run();

    await context.env.DB
      .prepare(`
        INSERT INTO core_raid_contributions (event_id, user_id, damage, last_action_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(event_id, user_id) DO UPDATE SET
          damage = damage + excluded.damage,
          last_action_at = datetime('now'),
          updated_at = datetime('now')
      `)
      .bind(event.id, auth.user.id, damage)
      .run();

    await context.env.DB
      .prepare(`
        INSERT INTO core_raid_daily_actions (event_id, user_id, action_day, action_type, uses, damage, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
        ON CONFLICT(event_id, user_id, action_day, action_type) DO UPDATE SET
          uses = uses + 1,
          damage = damage + excluded.damage,
          updated_at = datetime('now')
      `)
      .bind(event.id, auth.user.id, actionDate, action, damage)
      .run();

    await context.env.DB
      .prepare("INSERT INTO core_raid_action_log (event_id, user_id, action_type, damage) VALUES (?, ?, ?, ?)")
      .bind(event.id, auth.user.id, action, damage)
      .run();

    await finalizeEventIfDefeated(context, event.id);
    return Response.json({ success: true, damage, action, ...(await buildState(context, auth.user.id)) });
  } catch {
    return Response.json({ error: "Core Raid görevi tamamlanamadı." }, { status: 500 });
  }
}

async function buildState(context: any, userId: number) {
  const event = await getOrCreateEvent(context);
  const leaderboard = await context.env.DB
    .prepare(`
      SELECT core_raid_contributions.user_id, core_raid_contributions.damage, users.name, users.email, users.avatar_url
      FROM core_raid_contributions
      JOIN users ON core_raid_contributions.user_id = users.id
      WHERE core_raid_contributions.event_id = ?
      ORDER BY core_raid_contributions.damage DESC, core_raid_contributions.updated_at ASC
      LIMIT 10
    `)
    .bind(event.id)
    .all();

  const mine = await context.env.DB
    .prepare("SELECT damage, last_action_at FROM core_raid_contributions WHERE event_id = ? AND user_id = ?")
    .bind(event.id, userId)
    .first();

  const dailyRows = await context.env.DB
    .prepare("SELECT action_type, uses, damage FROM core_raid_daily_actions WHERE event_id = ? AND user_id = ? AND action_day = ?")
    .bind(event.id, userId, todayKey())
    .all();

  const daily: Record<string, { uses: number; damage: number }> = {};
  let dailyDamage = 0;
  for (const row of dailyRows?.results || []) {
    daily[String(row.action_type)] = { uses: Number(row.uses || 0), damage: Number(row.damage || 0) };
    dailyDamage += Number(row.damage || 0);
  }

  return {
    user_id: userId,
    event,
    actions: Object.entries(ACTIONS).map(([key, value]) => ({
      key,
      label: value.label,
      damage: value.damage,
      daily_limit: value.dailyLimit,
      uses: daily[key]?.uses || 0,
      remaining: Math.max(0, value.dailyLimit - (daily[key]?.uses || 0)),
    })),
    my_damage: Number(mine?.damage || 0),
    daily_damage: dailyDamage,
    daily_damage_cap: DAILY_DAMAGE_CAP,
    leaderboard: leaderboard?.results || [],
  };
}

async function getOrCreateEvent(context: any) {
  const active = await context.env.DB
    .prepare("SELECT * FROM core_raid_events WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    .first();
  if (active) return active;

  const last = await context.env.DB
    .prepare("SELECT * FROM core_raid_events ORDER BY id DESC LIMIT 1")
    .first();
  if (last && last.status === "active") return last;

  await context.env.DB
    .prepare("INSERT INTO core_raid_events (boss_name, max_hp, current_hp, status) VALUES ('GLITCH TITAN', ?, ?, 'active')")
    .bind(DEFAULT_MAX_HP, DEFAULT_MAX_HP)
    .run();

  return await context.env.DB.prepare("SELECT * FROM core_raid_events WHERE status = 'active' ORDER BY id DESC LIMIT 1").first();
}

async function finalizeEventIfDefeated(context: any, eventId: number) {
  const event = await context.env.DB.prepare("SELECT * FROM core_raid_events WHERE id = ?").bind(eventId).first();
  if (!event || event.status !== "active" || Number(event.current_hp || 0) > 0) return;

  await context.env.DB
    .prepare("UPDATE core_raid_events SET status = 'defeated', defeated_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'active'")
    .bind(eventId)
    .run();

  const contributors = await context.env.DB
    .prepare("SELECT user_id, damage FROM core_raid_contributions WHERE event_id = ? AND damage > 0")
    .bind(eventId)
    .all();

  for (const contributor of contributors?.results || []) {
    const coin = Number(contributor.damage || 0) >= 500 ? 50 : 20;
    await awardCoins(context, Number(contributor.user_id), coin, `core_raid:${eventId}`);
    await context.env.DB
      .prepare("INSERT OR IGNORE INTO core_raid_rewards (event_id, user_id, tech_coin, reward_note) VALUES (?, ?, ?, ?)")
      .bind(eventId, contributor.user_id, coin, "CORE RESTORED")
      .run();
  }
}

async function awardCoins(context: any, userId: number, amount: number, reason: string) {
  const existing = await context.env.DB.prepare("SELECT id FROM coin_transactions WHERE reason = ? AND user_id = ? LIMIT 1").bind(reason, userId).first();
  if (existing) return;

  await context.env.DB
    .prepare(`
      INSERT INTO coin_wallets (user_id, balance, lifetime_earned, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        lifetime_earned = lifetime_earned + excluded.lifetime_earned,
        updated_at = datetime('now')
    `)
    .bind(userId, amount, amount)
    .run();

  await context.env.DB.prepare("INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)").bind(userId, amount, reason).run();
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT users.id, users.name, users.email, users.avatar_url,
        CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
    `)
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "Core Raid için OFF, admin veya owner rolü gerekiyor." };
  return { ok: true, user };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
