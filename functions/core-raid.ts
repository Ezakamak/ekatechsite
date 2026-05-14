const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const DEFAULT_MAX_HP = 10000;
const DAILY_DAMAGE_CAP = 600;

type TaskScope = "daily" | "event";
type RaidTask = { label: string; description: string; damage: number; scope: TaskScope };

const TASKS: Record<string, RaidTask> = {
  daily_checkin: {
    label: "Core Raid'e giriş yap",
    description: "Bugün Core Raid sayfasına girerek sistemi taradın.",
    damage: 25,
    scope: "daily",
  },
  play_duel_today: {
    label: "Tech Duel oyna",
    description: "Bugün en az 1 Tech Duel lobisine katıl veya oluştur.",
    damage: 75,
    scope: "daily",
  },
  win_duel_today: {
    label: "Tech Duel kazan",
    description: "Bugün 1 Tech Duel maçı kazan.",
    damage: 130,
    scope: "daily",
  },
  play_cipher_today: {
    label: "Cipher Break oyna",
    description: "Bugün en az 1 Cipher Break lobisine katıl veya oluştur.",
    damage: 75,
    scope: "daily",
  },
  win_cipher_today: {
    label: "Cipher Break kazan",
    description: "Bugün 1 Cipher Break maçı kazan.",
    damage: 130,
    scope: "daily",
  },
  streak_3: {
    label: "3 gün streak yap",
    description: "Core Raid sayfasına 3 gün üst üste gir.",
    damage: 150,
    scope: "event",
  },
};

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const event = await getOrCreateEvent(context);
    await markVisit(context, event.id, auth.user.id);
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
    const taskKey = String(body?.action || "").trim();
    const task = TASKS[taskKey];
    if (!task) return Response.json({ error: "Geçersiz raid görevi." }, { status: 400 });

    const event = await getOrCreateEvent(context);
    await markVisit(context, event.id, auth.user.id);
    if (event.status !== "active") return Response.json(await buildState(context, auth.user.id));

    const status = await getTaskStatus(context, event.id, auth.user.id, taskKey, task);
    if (status.claimed) {
      return Response.json({ error: "Bu görevin hasarı zaten alındı.", ...(await buildState(context, auth.user.id)) }, { status: 409 });
    }
    if (!status.completed) {
      return Response.json({ error: "Bu görev henüz tamamlanmadı.", ...(await buildState(context, auth.user.id)) }, { status: 409 });
    }

    const dailyDamage = await getDailyDamage(context, event.id, auth.user.id);
    const remainingDaily = Math.max(0, DAILY_DAMAGE_CAP - dailyDamage);
    if (remainingDaily <= 0) {
      return Response.json({ error: "Günlük raid hasar limitin doldu.", ...(await buildState(context, auth.user.id)) }, { status: 429 });
    }

    const damage = Math.min(task.damage, remainingDaily, Number(event.current_hp || 0));
    if (damage <= 0) return Response.json(await buildState(context, auth.user.id));

    await applyDamage(context, event.id, auth.user.id, taskKey, task, damage);
    await finalizeEventIfDefeated(context, event.id);
    return Response.json({ success: true, damage, action: taskKey, ...(await buildState(context, auth.user.id)) });
  } catch {
    return Response.json({ error: "Core Raid görevi tamamlanamadı." }, { status: 500 });
  }
}

async function applyDamage(context: any, eventId: number, userId: number, taskKey: string, task: RaidTask, damage: number) {
  const claimDay = task.scope === "event" ? "event" : todayKey();

  await context.env.DB
    .prepare("UPDATE core_raid_events SET current_hp = MAX(0, current_hp - ?), updated_at = datetime('now') WHERE id = ? AND status = 'active'")
    .bind(damage, eventId)
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
    .bind(eventId, userId, damage)
    .run();

  await context.env.DB
    .prepare(`
      INSERT INTO core_raid_daily_actions (event_id, user_id, action_day, action_type, uses, damage, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
      ON CONFLICT(event_id, user_id, action_day, action_type) DO UPDATE SET
        uses = 1,
        damage = excluded.damage,
        updated_at = datetime('now')
    `)
    .bind(eventId, userId, claimDay, taskKey, damage)
    .run();

  await context.env.DB
    .prepare("INSERT INTO core_raid_action_log (event_id, user_id, action_type, damage) VALUES (?, ?, ?, ?)")
    .bind(eventId, userId, taskKey, damage)
    .run();
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

  const dailyDamage = await getDailyDamage(context, event.id, userId);
  const tasks = [];
  for (const [key, task] of Object.entries(TASKS)) {
    const status = await getTaskStatus(context, event.id, userId, key, task);
    tasks.push({
      key,
      label: task.label,
      description: task.description,
      damage: task.damage,
      scope: task.scope,
      completed: status.completed,
      claimed: status.claimed,
      progress: status.progress,
      target: status.target,
    });
  }

  return {
    user_id: userId,
    event,
    actions: tasks,
    tasks,
    my_damage: Number(mine?.damage || 0),
    daily_damage: dailyDamage,
    daily_damage_cap: DAILY_DAMAGE_CAP,
    visit_streak: await getVisitStreak(context, event.id, userId),
    leaderboard: leaderboard?.results || [],
  };
}

async function getTaskStatus(context: any, eventId: number, userId: number, taskKey: string, task: RaidTask) {
  const claimDay = task.scope === "event" ? "event" : todayKey();
  const claim = await context.env.DB
    .prepare("SELECT uses, damage FROM core_raid_daily_actions WHERE event_id = ? AND user_id = ? AND action_day = ? AND action_type = ?")
    .bind(eventId, userId, claimDay, taskKey)
    .first();
  const claimed = Number(claim?.uses || 0) > 0 && Number(claim?.damage || 0) > 0;

  if (taskKey === "daily_checkin") {
    const progress = await countAction(context, eventId, userId, todayKey(), "visit_marker");
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "play_duel_today") {
    const progress = await countUserRows(context, "duel_lobbies", userId, "created_at", false);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "win_duel_today") {
    const progress = await countUserRows(context, "duel_lobbies", userId, "updated_at", true);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "play_cipher_today") {
    const progress = await countUserRows(context, "cipher_lobbies", userId, "created_at", false);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "win_cipher_today") {
    const progress = await countUserRows(context, "cipher_lobbies", userId, "updated_at", true);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "streak_3") {
    const progress = await getVisitStreak(context, eventId, userId);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  return { completed: false, claimed, progress: 0, target: 1 };
}

async function markVisit(context: any, eventId: number, userId: number) {
  await context.env.DB
    .prepare(`
      INSERT INTO core_raid_daily_actions (event_id, user_id, action_day, action_type, uses, damage, updated_at)
      VALUES (?, ?, ?, 'visit_marker', 1, 0, datetime('now'))
      ON CONFLICT(event_id, user_id, action_day, action_type) DO UPDATE SET
        uses = 1,
        updated_at = datetime('now')
    `)
    .bind(eventId, userId, todayKey())
    .run();
}

async function countAction(context: any, eventId: number, userId: number, day: string, actionType: string) {
  const row = await context.env.DB
    .prepare("SELECT uses FROM core_raid_daily_actions WHERE event_id = ? AND user_id = ? AND action_day = ? AND action_type = ?")
    .bind(eventId, userId, day, actionType)
    .first();
  return Number(row?.uses || 0);
}

async function countUserRows(context: any, table: "duel_lobbies" | "cipher_lobbies", userId: number, dateColumn: "created_at" | "updated_at", winnersOnly: boolean) {
  try {
    const day = todayKey();
    const where = winnersOnly
      ? `winner_user_id = ? AND date(${dateColumn}) = date(?)`
      : `(creator_user_id = ? OR opponent_user_id = ?) AND date(${dateColumn}) = date(?)`;
    const stmt = winnersOnly
      ? context.env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).bind(userId, day)
      : context.env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).bind(userId, userId, day);
    const row = await stmt.first();
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

async function getDailyDamage(context: any, eventId: number, userId: number) {
  const row = await context.env.DB
    .prepare("SELECT COALESCE(SUM(damage), 0) AS damage FROM core_raid_action_log WHERE event_id = ? AND user_id = ? AND date(created_at) = date(?)")
    .bind(eventId, userId, todayKey())
    .first();
  return Number(row?.damage || 0);
}

async function getVisitStreak(context: any, eventId: number, userId: number) {
  const rows = await context.env.DB
    .prepare("SELECT action_day FROM core_raid_daily_actions WHERE event_id = ? AND user_id = ? AND action_type = 'visit_marker' ORDER BY action_day DESC LIMIT 30")
    .bind(eventId, userId)
    .all();

  const days = new Set((rows?.results || []).map((row: any) => String(row.action_day)));
  let streak = 0;
  const cursor = new Date(`${todayKey()}T00:00:00.000Z`);

  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
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
