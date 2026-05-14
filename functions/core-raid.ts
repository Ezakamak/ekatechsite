const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const DEFAULT_MAX_HP = 10000;
const DAILY_DAMAGE_CAP = 600;
const MAX_DAILY_TASKS = 6;
const DAILY_REGEN_AMOUNT = 500;
const PASSIVE_REGEN_PER_SECOND = DAILY_REGEN_AMOUNT / 86400;
const CORE_RAID_REWARD_POOL = 1000;

type TaskScope = "daily" | "event";
type RaidTask = { label: string; description: string; damage: number; scope: TaskScope };
type GameTable = "duel_lobbies" | "cipher_lobbies" | "core_clash_lobbies";

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
  play_duel_3_today: {
    label: "3 Tech Duel oyna",
    description: "Bugün 3 farklı Tech Duel lobisine katıl veya oluştur.",
    damage: 120,
    scope: "daily",
  },
  win_duel_today: {
    label: "Tech Duel kazan",
    description: "Bugün 1 Tech Duel maçı kazan.",
    damage: 130,
    scope: "daily",
  },
  duel_streak_3: {
    label: "Tech Duel 3 gün streak",
    description: "3 gün üst üste Tech Duel oyna.",
    damage: 180,
    scope: "event",
  },
  play_cipher_today: {
    label: "Cipher Break oyna",
    description: "Bugün en az 1 Cipher Break lobisine katıl veya oluştur.",
    damage: 75,
    scope: "daily",
  },
  play_cipher_3_today: {
    label: "3 Cipher Break oyna",
    description: "Bugün 3 farklı Cipher Break lobisine katıl veya oluştur.",
    damage: 120,
    scope: "daily",
  },
  win_cipher_today: {
    label: "Cipher Break kazan",
    description: "Bugün 1 Cipher Break maçı kazan.",
    damage: 130,
    scope: "daily",
  },
  cipher_streak_3: {
    label: "Cipher Break 3 gün streak",
    description: "3 gün üst üste Cipher Break oyna.",
    damage: 180,
    scope: "event",
  },
  play_clash_today: {
    label: "Core Clash oyna",
    description: "Bugün en az 1 Core Clash lobisine katıl veya oluştur.",
    damage: 75,
    scope: "daily",
  },
  play_clash_3_today: {
    label: "3 Core Clash oyna",
    description: "Bugün 3 farklı Core Clash lobisine katıl veya oluştur.",
    damage: 120,
    scope: "daily",
  },
  win_clash_today: {
    label: "Core Clash kazan",
    description: "Bugün 1 Core Clash maçı kazan.",
    damage: 130,
    scope: "daily",
  },
  clash_streak_3: {
    label: "Core Clash 3 gün streak",
    description: "3 gün üst üste Core Clash oyna.",
    damage: 180,
    scope: "event",
  },
  play_two_modes_today: {
    label: "2 farklı mod oyna",
    description: "Bugün Tech Duel, Cipher Break veya Core Clash içinden 2 farklı mod oyna.",
    damage: 150,
    scope: "daily",
  },
  complete_two_matches_today: {
    label: "2 maç tamamla",
    description: "Bugün toplam 2 Tech Duel / Cipher Break / Core Clash maçı tamamla.",
    damage: 150,
    scope: "daily",
  },
  win_any_today: {
    label: "Bugün 1 galibiyet al",
    description: "Tech Duel, Cipher Break veya Core Clash içinde bugün 1 maç kazan.",
    damage: 140,
    scope: "daily",
  },
  deal_100_damage: {
    label: "100 raid hasarı katkı yap",
    description: "Bu event içinde toplam 100 boss hasarına ulaş.",
    damage: 80,
    scope: "event",
  },
  leaderboard_top10: {
    label: "Leaderboard'a gir",
    description: "Core Raid katkı sıralamasında Top 10'a gir.",
    damage: 100,
    scope: "event",
  },
  core_raid_streak_5: {
    label: "Core Raid 5 gün streak",
    description: "Core Raid sayfasına 5 gün üst üste gir.",
    damage: 220,
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

    if (!isTaskAvailableToday(event.id, taskKey)) {
      return Response.json({ error: "Bugünün raid panosunda en fazla 6 görev var. Bu görev bugün aktif değil.", ...(await buildState(context, auth.user.id)) }, { status: 409 });
    }

    if (event.status !== "active") return Response.json(await buildState(context, auth.user.id));

    const status = await getTaskStatus(context, event.id, auth.user.id, taskKey, task);
    if (status.claimed) {
      return Response.json({ error: "Bu görevin hasarı zaten verildi.", ...(await buildState(context, auth.user.id)) }, { status: 409 });
    }
    if (!status.completed) {
      return Response.json({ error: "Bu görev henüz tamamlanmadı.", ...(await buildState(context, auth.user.id)) }, { status: 409 });
    }

    const dailyDamage = await getDailyDamage(context, event.id, auth.user.id);
    const remainingDaily = Math.max(0, DAILY_DAMAGE_CAP - dailyDamage);
    if (remainingDaily <= 0) {
      return Response.json({ error: "Günlük raid hasar limitin doldu.", ...(await buildState(context, auth.user.id)) }, { status: 429 });
    }

    const freshEvent = await getOrCreateEvent(context);
    const damage = Math.min(task.damage, remainingDaily, Number(freshEvent.current_hp || 0));
    if (damage <= 0) return Response.json(await buildState(context, auth.user.id));

    await applyDamage(context, freshEvent.id, auth.user.id, taskKey, task, damage);
    await finalizeEventIfDefeated(context, freshEvent.id);
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
  for (const [key, task] of getDailyTaskEntries(event.id)) {
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
    max_daily_tasks: MAX_DAILY_TASKS,
    reward_pool: CORE_RAID_REWARD_POOL,
    regen_per_day: DAILY_REGEN_AMOUNT,
    visit_streak: await getVisitStreak(context, event.id, userId),
    leaderboard: leaderboard?.results || [],
  };
}

function getDailyTaskEntries(eventId: number): Array<[string, RaidTask]> {
  const entries = Object.entries(TASKS);
  const guaranteed = entries.filter(([key]) => key === "daily_checkin");
  const rotating = entries
    .filter(([key]) => key !== "daily_checkin")
    .sort(([a], [b]) => hashNumber(`${todayKey()}:${eventId}:${a}`) - hashNumber(`${todayKey()}:${eventId}:${b}`));

  return [...guaranteed, ...rotating].slice(0, MAX_DAILY_TASKS);
}

function isTaskAvailableToday(eventId: number, taskKey: string) {
  return getDailyTaskEntries(eventId).some(([key]) => key === taskKey);
}

function hashNumber(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

  if (taskKey === "play_duel_3_today") {
    const progress = await countUserRows(context, "duel_lobbies", userId, "created_at", false);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  if (taskKey === "win_duel_today") {
    const progress = await countUserRows(context, "duel_lobbies", userId, "updated_at", true);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "duel_streak_3") {
    const progress = await getGameStreak(context, "duel_lobbies", userId);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  if (taskKey === "play_cipher_today") {
    const progress = await countUserRows(context, "cipher_lobbies", userId, "created_at", false);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "play_cipher_3_today") {
    const progress = await countUserRows(context, "cipher_lobbies", userId, "created_at", false);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  if (taskKey === "win_cipher_today") {
    const progress = await countUserRows(context, "cipher_lobbies", userId, "updated_at", true);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "cipher_streak_3") {
    const progress = await getGameStreak(context, "cipher_lobbies", userId);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  if (taskKey === "play_clash_today") {
    const progress = await countUserRows(context, "core_clash_lobbies", userId, "created_at", false);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "play_clash_3_today") {
    const progress = await countUserRows(context, "core_clash_lobbies", userId, "created_at", false);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  if (taskKey === "win_clash_today") {
    const progress = await countUserRows(context, "core_clash_lobbies", userId, "updated_at", true);
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "clash_streak_3") {
    const progress = await getGameStreak(context, "core_clash_lobbies", userId);
    return { completed: progress >= 3, claimed, progress, target: 3 };
  }

  if (taskKey === "play_two_modes_today") {
    const duel = await countUserRows(context, "duel_lobbies", userId, "created_at", false);
    const cipher = await countUserRows(context, "cipher_lobbies", userId, "created_at", false);
    const clash = await countUserRows(context, "core_clash_lobbies", userId, "created_at", false);
    const progress = Math.min(1, duel) + Math.min(1, cipher) + Math.min(1, clash);
    return { completed: progress >= 2, claimed, progress, target: 2 };
  }

  if (taskKey === "complete_two_matches_today") {
    const duel = await countCompletedRows(context, "duel_lobbies", userId);
    const cipher = await countCompletedRows(context, "cipher_lobbies", userId);
    const clash = await countCompletedRows(context, "core_clash_lobbies", userId);
    const progress = duel + cipher + clash;
    return { completed: progress >= 2, claimed, progress, target: 2 };
  }

  if (taskKey === "win_any_today") {
    const duel = await countUserRows(context, "duel_lobbies", userId, "updated_at", true);
    const cipher = await countUserRows(context, "cipher_lobbies", userId, "updated_at", true);
    const clash = await countUserRows(context, "core_clash_lobbies", userId, "updated_at", true);
    const progress = duel + cipher + clash;
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "deal_100_damage") {
    const progress = await getContributionDamage(context, eventId, userId);
    return { completed: progress >= 100, claimed, progress, target: 100 };
  }

  if (taskKey === "leaderboard_top10") {
    const rank = await getLeaderboardRank(context, eventId, userId);
    const progress = rank > 0 && rank <= 10 ? 1 : 0;
    return { completed: progress >= 1, claimed, progress, target: 1 };
  }

  if (taskKey === "core_raid_streak_5") {
    const progress = await getVisitStreak(context, eventId, userId);
    return { completed: progress >= 5, claimed, progress, target: 5 };
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

async function countUserRows(context: any, table: GameTable, userId: number, dateColumn: "created_at" | "updated_at", winnersOnly: boolean) {
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

async function countCompletedRows(context: any, table: GameTable, userId: number) {
  try {
    const row = await context.env.DB
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE status = 'completed' AND (creator_user_id = ? OR opponent_user_id = ?) AND date(updated_at) = date(?)`)
      .bind(userId, userId, todayKey())
      .first();
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

async function getGameStreak(context: any, table: GameTable, userId: number) {
  try {
    const rows = await context.env.DB
      .prepare(`SELECT DISTINCT date(created_at) AS action_day FROM ${table} WHERE creator_user_id = ? OR opponent_user_id = ? ORDER BY action_day DESC LIMIT 30`)
      .bind(userId, userId)
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
  } catch {
    return 0;
  }
}

async function getContributionDamage(context: any, eventId: number, userId: number) {
  const row = await context.env.DB
    .prepare("SELECT damage FROM core_raid_contributions WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .first();
  return Number(row?.damage || 0);
}

async function getLeaderboardRank(context: any, eventId: number, userId: number) {
  const rows = await context.env.DB
    .prepare("SELECT user_id FROM core_raid_contributions WHERE event_id = ? ORDER BY damage DESC, updated_at ASC LIMIT 10")
    .bind(eventId)
    .all();

  const index = (rows?.results || []).findIndex((row: any) => Number(row.user_id) === Number(userId));
  return index >= 0 ? index + 1 : 0;
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
  if (active) return await applyPassiveRegen(context, active);

  const last = await context.env.DB
    .prepare("SELECT * FROM core_raid_events ORDER BY id DESC LIMIT 1")
    .first();
  if (last && last.status === "active") return await applyPassiveRegen(context, last);

  await context.env.DB
    .prepare("INSERT INTO core_raid_events (boss_name, max_hp, current_hp, status) VALUES ('GLITCH TITAN', ?, ?, 'active')")
    .bind(DEFAULT_MAX_HP, DEFAULT_MAX_HP)
    .run();

  return await context.env.DB.prepare("SELECT * FROM core_raid_events WHERE status = 'active' ORDER BY id DESC LIMIT 1").first();
}

async function applyPassiveRegen(context: any, event: any) {
  if (!event || event.status !== "active") return event;

  const maxHp = Number(event.max_hp || DEFAULT_MAX_HP);
  const currentHp = Number(event.current_hp || 0);
  if (currentHp <= 0 || currentHp >= maxHp) return event;

  const updatedAt = String(event.updated_at || "").trim();
  const lastTick = updatedAt ? new Date(`${updatedAt.replace(" ", "T")}Z`).getTime() : Date.now();
  const elapsedSeconds = Number.isFinite(lastTick) ? Math.max(0, Math.floor((Date.now() - lastTick) / 1000)) : 0;
  if (elapsedSeconds <= 0) return event;

  const healAmount = Math.min(maxHp - currentHp, elapsedSeconds * PASSIVE_REGEN_PER_SECOND);
  if (healAmount <= 0) return event;

  const nextHp = Number((currentHp + healAmount).toFixed(4));
  await context.env.DB
    .prepare("UPDATE core_raid_events SET current_hp = MIN(max_hp, ?), updated_at = datetime('now') WHERE id = ? AND status = 'active'")
    .bind(nextHp, event.id)
    .run();

  return await context.env.DB.prepare("SELECT * FROM core_raid_events WHERE id = ?").bind(event.id).first();
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

  const rows = contributors?.results || [];
  const totalDamage = rows.reduce((sum: number, contributor: any) => sum + Number(contributor.damage || 0), 0);
  if (totalDamage <= 0) return;

  for (const contributor of rows) {
    const ratio = Number(contributor.damage || 0) / totalDamage;
    const coin = Math.max(1, Math.round(ratio * CORE_RAID_REWARD_POOL));
    await awardCoins(context, Number(contributor.user_id), coin, `core_raid:${eventId}`);
    await context.env.DB
      .prepare("INSERT OR IGNORE INTO core_raid_rewards (event_id, user_id, tech_coin, reward_note) VALUES (?, ?, ?, ?)")
      .bind(eventId, contributor.user_id, coin, `CORE RESTORED · ${(ratio * 100).toFixed(2)}% contribution`)
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
