const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const FIXED_REWARD_AMOUNT = 40;
const BOT_REWARD_AMOUNT = 25;
const ROUND_COUNT = 5;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 3;
const OPTION_COUNT = 14;
const LOCKS_PER_ROUND = 3;
const START_DELAY_MS = 3000;
const SERVER_GRACE_MS = 260;
const ROUND_TIMEOUT_MS = 45000;
const BOT_EMAIL_MARKER = ".bot@ekatech.local";

const BOT_PROFILES = [
  { name: "Byte BOT", email: "byte.bot@ekatech.local", skill: "normal" },
  { name: "Glitch BOT", email: "glitch.bot@ekatech.local", skill: "hard" },
  { name: "Echo BOT", email: "echo.bot@ekatech.local", skill: "easy" },
  { name: "Nova BOT", email: "nova.bot@ekatech.local", skill: "normal" },
  { name: "Kairo BOT", email: "kairo.bot@ekatech.local", skill: "normal" },
];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await cleanup(context);
    const url = new URL(context.request.url);
    const lobbyId = Number(url.searchParams.get("lobby_id"));

    if (lobbyId) return Response.json(await buildState(context, lobbyId, auth.user.id));

    const open = await listLobbies(context, "WHERE l.status IN ('open', 'in_progress')", []);
    const mine = await listLobbies(context, "WHERE l.creator_user_id = ? OR l.opponent_user_id = ?", [auth.user.id, auth.user.id]);
    return Response.json({ user: auth.user, open, mine });
  } catch {
    return Response.json({ error: "Cipher Break verileri alınamadı. D1 tablolarını kontrol et." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await cleanup(context);
    const body = await context.request.json().catch(() => null);
    const action = String(body?.action || "create");

    if (action === "create") return await createLobby(context, auth.user.id);

    const lobbyId = Number(body?.lobby_id);
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });

    if (action === "join") return await joinLobby(context, lobby, auth.user.id);
    if (action === "bot") return await joinBotLobby(context, lobby, auth.user.id);

    if (!isParticipant(lobby, auth.user.id)) return Response.json({ error: "Bu oyunun oyuncusu değilsin." }, { status: 403 });
    if (lobby.status !== "in_progress") return Response.json({ error: "Bu oyun aktif değil." }, { status: 409 });

    if (action === "ready") return await markReadyAndMaybeStart(context, lobby, auth.user.id);
    if (action === "submit") return await submitCode(context, lobbyId, auth.user.id, String(body?.selected_code || ""));
    if (action === "next_round") return await nextRound(context, lobbyId, auth.user.id);

    return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch {
    return Response.json({ error: "Cipher Break işlemi tamamlanamadı. cipher_round_ready tablosunu kontrol et." }, { status: 500 });
  }
}

async function createLobby(context: any, userId: number) {
  const existing = await context.env.DB
    .prepare("SELECT id FROM cipher_lobbies WHERE creator_user_id = ? AND status = 'open' LIMIT 1")
    .bind(userId)
    .first();

  if (existing) return Response.json({ error: "Zaten açık bir Cipher Break lobby'n var." }, { status: 409 });

  const result = await context.env.DB
    .prepare("INSERT INTO cipher_lobbies (creator_user_id, reward_amount, round_count, status) VALUES (?, ?, ?, 'open')")
    .bind(userId, FIXED_REWARD_AMOUNT, ROUND_COUNT)
    .run();

  return Response.json({ success: true, lobby_id: result?.meta?.last_row_id });
}

async function joinLobby(context: any, lobby: any, userId: number) {
  if (lobby.status !== "open") return Response.json({ error: "Bu lobby artık açık değil." }, { status: 409 });
  if (Number(lobby.creator_user_id) === Number(userId)) return Response.json({ error: "Kendi lobby'ne katılamazsın." }, { status: 400 });

  const update = await context.env.DB
    .prepare("UPDATE cipher_lobbies SET opponent_user_id = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL")
    .bind(userId, lobby.id)
    .run();

  if (Number(update?.meta?.changes || 0) === 0) return Response.json({ error: "Bu lobby'ye başka biri katılmış." }, { status: 409 });

  return Response.json(await buildState(context, lobby.id, userId));
}

async function joinBotLobby(context: any, lobby: any, userId: number) {
  if (lobby.status !== "open") return Response.json({ error: "Bu lobby artık bot için uygun değil." }, { status: 409 });
  if (Number(lobby.creator_user_id) !== Number(userId)) return Response.json({ error: "Botu sadece lobby sahibi çağırabilir." }, { status: 403 });
  if (lobby.opponent_user_id) return Response.json({ error: "Bu lobby'de zaten Player 2 var." }, { status: 409 });

  const profile = pickBotProfile(Number(lobby.id), userId);
  const bot = await ensureBotUser(context, profile);
  if (!bot?.id) return Response.json({ error: "Bot profili hazırlanamadı." }, { status: 500 });

  const update = await context.env.DB
    .prepare("UPDATE cipher_lobbies SET opponent_user_id = ?, reward_amount = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL")
    .bind(bot.id, BOT_REWARD_AMOUNT, lobby.id)
    .run();

  if (Number(update?.meta?.changes || 0) === 0) return Response.json({ error: "Bu lobby'ye başka biri katılmış." }, { status: 409 });
  const updated = await getLobby(context, Number(lobby.id));
  await markReadyAndMaybeStartRaw(context, updated, userId);
  await markReadyAndMaybeStartRaw(context, updated, Number(bot.id));

  return Response.json(await buildState(context, Number(lobby.id), userId));
}

async function markReadyAndMaybeStart(context: any, lobby: any, userId: number) {
  await markReadyAndMaybeStartRaw(context, lobby, userId);
  const botId = getBotUserIdFromLobby(lobby);
  if (botId) await markReadyAndMaybeStartRaw(context, lobby, botId);
  return Response.json(await buildState(context, lobby.id, userId));
}

async function markReadyAndMaybeStartRaw(context: any, lobby: any, userId: number) {
  if (!lobby.opponent_user_id) throw new Error("İkinci oyuncu bekleniyor.");

  const roundNumber = await getPendingRoundNumber(context, lobby.id);
  if (roundNumber > Number(lobby.round_count || ROUND_COUNT)) return;

  const existingRound = await context.env.DB
    .prepare("SELECT id FROM cipher_rounds WHERE lobby_id = ? AND round_number = ? LIMIT 1")
    .bind(lobby.id, roundNumber)
    .first();

  if (existingRound) return;

  await context.env.DB
    .prepare("INSERT OR IGNORE INTO cipher_round_ready (lobby_id, round_number, user_id, ready_at) VALUES (?, ?, ?, datetime('now'))")
    .bind(lobby.id, roundNumber, userId)
    .run();

  await touchLobby(context, lobby.id);

  if (await bothPlayersReady(context, lobby, roundNumber)) await createRound(context, lobby, roundNumber);
}

async function bothPlayersReady(context: any, lobby: any, roundNumber: number) {
  const row = await context.env.DB
    .prepare("SELECT COUNT(DISTINCT user_id) AS ready_count FROM cipher_round_ready WHERE lobby_id = ? AND round_number = ? AND user_id IN (?, ?)")
    .bind(lobby.id, roundNumber, lobby.creator_user_id, lobby.opponent_user_id)
    .first();

  return Number(row?.ready_count || 0) >= 2;
}

async function submitCode(context: any, lobbyId: number, userId: number, selectedCode: string) {
  const round = await getCurrentRound(context, lobbyId);
  if (!round) return Response.json({ error: "Round başlamadı. İki oyuncunun da hazır olması gerekiyor." }, { status: 409 });
  if (round.status !== "active") return Response.json({ error: "Bu round aktif değil." }, { status: 409 });

  const nowMs = Date.now();
  const startedMs = Date.parse(round.started_at);
  if (!Number.isFinite(startedMs) || nowMs < startedMs) {
    return Response.json({ error: "Geri sayım bitmeden kilitleme yapılamaz." }, { status: 409 });
  }

  if (nowMs - startedMs > ROUND_TIMEOUT_MS) {
    await finalizeRoundByTimeout(context, round);
    return Response.json(await buildState(context, lobbyId, userId));
  }

  await applyCipherSubmission(context, lobbyId, round, userId, selectedCode, nowMs);
  return Response.json(await buildState(context, lobbyId, userId));
}

async function applyCipherSubmission(context: any, lobbyId: number, round: any, userId: number, selectedCode: string, nowMs: number) {
  const existing = await context.env.DB
    .prepare("SELECT * FROM cipher_submissions WHERE lobby_id = ? AND round_number = ? AND user_id = ? LIMIT 1")
    .bind(lobbyId, round.round_number, userId)
    .first();

  const previousProgress = Number(existing?.correct || 0);
  if (previousProgress < 0 || previousProgress >= LOCKS_PER_ROUND) return;

  const cleanCode = selectedCode.trim().toUpperCase();
  const locks = parseLocks(round);
  const currentLock = locks[Math.min(previousProgress, locks.length - 1)] || locks[0];
  const expectedTarget = String(currentLock?.target || round.target_code);
  const timingValid = wasCodeActiveOnServer(round, currentLock, cleanCode, nowMs);
  const correct = cleanCode === expectedTarget && timingValid;

  if (correct) {
    const nextProgress = previousProgress + 1;
    const selectedHistory = appendHistory(String(existing?.selected_code || ""), cleanCode);

    await context.env.DB.prepare(`
      INSERT INTO cipher_submissions (lobby_id, round_number, user_id, selected_code, correct, submitted_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(lobby_id, round_number, user_id) DO UPDATE SET
        selected_code = excluded.selected_code,
        correct = excluded.correct,
        submitted_at = datetime('now')
    `).bind(lobbyId, round.round_number, userId, selectedHistory, nextProgress).run();

    await touchLobby(context, lobbyId);

    if (nextProgress >= LOCKS_PER_ROUND) {
      await context.env.DB
        .prepare("UPDATE cipher_rounds SET status = 'completed', winner_user_id = ?, completed_at = datetime('now') WHERE lobby_id = ? AND round_number = ? AND status = 'active'")
        .bind(userId, lobbyId, round.round_number)
        .run();
      await touchLobby(context, lobbyId);
      await maybeCompleteLobby(context, lobbyId);
    }
  } else {
    const selectedHistory = appendHistory(String(existing?.selected_code || ""), cleanCode);

    await context.env.DB.prepare(`
      INSERT INTO cipher_submissions (lobby_id, round_number, user_id, selected_code, correct, submitted_at)
      VALUES (?, ?, ?, ?, -1, datetime('now'))
      ON CONFLICT(lobby_id, round_number, user_id) DO UPDATE SET
        selected_code = excluded.selected_code,
        correct = -1,
        submitted_at = datetime('now')
    `).bind(lobbyId, round.round_number, userId, selectedHistory).run();

    await touchLobby(context, lobbyId);

    const row = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM cipher_submissions WHERE lobby_id = ? AND round_number = ? AND correct < 0")
      .bind(lobbyId, round.round_number)
      .first();

    if (Number(row?.count || 0) >= 2) {
      await context.env.DB
        .prepare("UPDATE cipher_rounds SET status = 'completed', winner_user_id = NULL, completed_at = datetime('now') WHERE lobby_id = ? AND round_number = ? AND status = 'active'")
        .bind(lobbyId, round.round_number)
        .run();
      await touchLobby(context, lobbyId);
      await maybeCompleteLobby(context, lobbyId);
    }
  }
}

function appendHistory(previous: string, next: string) {
  return previous ? `${previous}|${next}` : next;
}

async function nextRound(context: any, lobbyId: number, userId: number) {
  const current = await getCurrentRound(context, lobbyId);
  if (!current) return Response.json({ error: "Round bulunamadı." }, { status: 404 });
  if (current.status !== "completed") return Response.json({ error: "Yeni round için mevcut round bitmeli." }, { status: 409 });

  const lobby = await getLobby(context, lobbyId);
  if (lobby.status !== "in_progress") return Response.json(await buildState(context, lobbyId, userId));

  const next = await getPendingRoundNumber(context, lobbyId);
  if (next > Number(lobby.round_count || ROUND_COUNT)) return Response.json(await buildState(context, lobbyId, userId));

  await context.env.DB
    .prepare("INSERT OR IGNORE INTO cipher_round_ready (lobby_id, round_number, user_id, ready_at) VALUES (?, ?, ?, datetime('now'))")
    .bind(lobbyId, next, userId)
    .run();

  const botId = getBotUserIdFromLobby(lobby);
  if (botId) {
    await context.env.DB
      .prepare("INSERT OR IGNORE INTO cipher_round_ready (lobby_id, round_number, user_id, ready_at) VALUES (?, ?, ?, datetime('now'))")
      .bind(lobbyId, next, botId)
      .run();
  }

  await touchLobby(context, lobbyId);

  if (await bothPlayersReady(context, lobby, next)) await createRound(context, lobby, next);

  return Response.json(await buildState(context, lobbyId, userId));
}

async function listLobbies(context: any, whereSql: string, args: any[]) {
  const query = `SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url, opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url, winner.name AS winner_name FROM cipher_lobbies l JOIN users creator ON l.creator_user_id = creator.id LEFT JOIN users opponent ON l.opponent_user_id = opponent.id LEFT JOIN users winner ON l.winner_user_id = winner.id ${whereSql} ORDER BY l.id DESC LIMIT 30`;
  const stmt = context.env.DB.prepare(query);
  const rows = args.length ? await stmt.bind(...args).all() : await stmt.all();
  return rows?.results || [];
}

async function getLobby(context: any, lobbyId: number) {
  return await context.env.DB
    .prepare("SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url, opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url, winner.name AS winner_name FROM cipher_lobbies l JOIN users creator ON l.creator_user_id = creator.id LEFT JOIN users opponent ON l.opponent_user_id = opponent.id LEFT JOIN users winner ON l.winner_user_id = winner.id WHERE l.id = ?")
    .bind(lobbyId)
    .first();
}

async function getCurrentRound(context: any, lobbyId: number) {
  return await context.env.DB
    .prepare("SELECT * FROM cipher_rounds WHERE lobby_id = ? ORDER BY round_number DESC LIMIT 1")
    .bind(lobbyId)
    .first();
}

async function getPendingRoundNumber(context: any, lobbyId: number) {
  const current = await getCurrentRound(context, lobbyId);
  if (!current) return 1;
  return Number(current.round_number) + (current.status === "completed" ? 1 : 0);
}

async function createRound(context: any, lobby: any, roundNumber: number) {
  const targets = makeTargets();
  const options = makeOptions(targets);
  const tickMs = Math.max(320, 700 - roundNumber * 50);
  const startedAt = new Date(Date.now() + START_DELAY_MS).toISOString();

  await context.env.DB
    .prepare("INSERT OR IGNORE INTO cipher_rounds (lobby_id, round_number, target_code, options_json, tick_ms, started_at, status) VALUES (?, ?, ?, ?, ?, ?, 'active')")
    .bind(lobby.id, roundNumber, targets.join(""), JSON.stringify({ targets, options }), tickMs, startedAt)
    .run();

  await touchLobby(context, lobby.id);
}

function makeTargets() {
  const targets = new Set<string>();
  while (targets.size < LOCKS_PER_ROUND) targets.add(makeCode(CODE_LENGTH));
  return [...targets];
}

function makeCode(length: number) {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_CHARS[randomInt(0, CODE_CHARS.length - 1)];
  return code;
}

function makeOptions(targets: string[]) {
  const options = new Set<string>(targets);
  while (options.size < OPTION_COUNT) options.add(makeSimilarCode(targets[randomInt(0, targets.length - 1)]));
  return shuffle([...options]);
}

function makeSimilarCode(target: string) {
  const chars = target.split("");
  const changes = Math.random() < 0.82 ? 1 : 2;
  for (let i = 0; i < changes; i++) chars[randomInt(0, chars.length - 1)] = CODE_CHARS[randomInt(0, CODE_CHARS.length - 1)];
  const code = chars.join("");
  return code === target ? makeCode(CODE_LENGTH) : code;
}

function parseLocks(round: any) {
  try {
    const raw = JSON.parse(round?.options_json || "[]");
    if (raw && Array.isArray(raw.targets) && Array.isArray(raw.options)) {
      return raw.targets.map((target: string) => ({ target, options: raw.options }));
    }
    if (raw && Array.isArray(raw.locks)) return raw.locks;
    if (Array.isArray(raw) && raw[0] && typeof raw[0] === "object" && raw[0].target && Array.isArray(raw[0].options)) return raw;
    if (Array.isArray(raw)) return [{ target: round.target_code, options: raw }];
  } catch {}
  return [{ target: round?.target_code || "---", options: [] }];
}

function wasCodeActiveOnServer(round: any, lock: any, selectedCode: string, nowMs: number) {
  const target = String(lock?.target || round?.target_code || "");
  if (selectedCode !== target) return false;

  const options = Array.isArray(lock?.options) ? lock.options : [];
  if (options.length === 0) return false;

  const current = codeAtTime(round, options, nowMs);
  const previousGrace = codeAtTime(round, options, nowMs - SERVER_GRACE_MS);
  return selectedCode === current || selectedCode === previousGrace;
}

function codeAtTime(round: any, options: string[], timeMs: number) {
  const startedMs = Date.parse(round?.started_at || "");
  const tickMs = Number(round?.tick_ms || 650);
  if (!Number.isFinite(startedMs) || !Number.isFinite(tickMs) || tickMs <= 0 || timeMs < startedMs) return "";
  const index = Math.floor((timeMs - startedMs) / tickMs) % options.length;
  return options[index] || "";
}

async function buildState(context: any, lobbyId: number, userId: number) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby) return { error: "Lobby bulunamadı." };
  if (!isParticipant(lobby, userId)) return { error: "Bu oyunun oyuncusu değilsin." };

  await maybeRunCipherBot(context, lobby);
  const latestLobby = await getLobby(context, lobbyId);
  const currentRound = await getCurrentRound(context, lobbyId);
  const pendingRoundNumber = currentRound ? Number(currentRound.round_number) + (currentRound.status === "completed" ? 1 : 0) : 1;
  const rounds = await context.env.DB.prepare("SELECT r.*, winner.name AS winner_name FROM cipher_rounds r LEFT JOIN users winner ON r.winner_user_id = winner.id WHERE r.lobby_id = ? ORDER BY r.round_number ASC").bind(lobbyId).all();
  const submissions = currentRound ? await context.env.DB.prepare("SELECT s.*, users.name FROM cipher_submissions s JOIN users ON s.user_id = users.id WHERE s.lobby_id = ? AND s.round_number = ? ORDER BY s.submitted_at ASC").bind(lobbyId, currentRound.round_number).all() : { results: [] };
  const ready = await context.env.DB.prepare("SELECT cipher_round_ready.user_id, users.name FROM cipher_round_ready JOIN users ON cipher_round_ready.user_id = users.id WHERE cipher_round_ready.lobby_id = ? AND cipher_round_ready.round_number = ?").bind(lobbyId, pendingRoundNumber).all();
  const score = await getScore(context, lobbyId);
  const mySubmission = (submissions?.results || []).find((item: any) => Number(item.user_id) === Number(userId)) || null;

  return {
    server_time: new Date().toISOString(),
    user_id: userId,
    lobby: latestLobby || lobby,
    current_round: currentRound || null,
    pending_round_number: pendingRoundNumber,
    ready: ready?.results || [],
    ready_count: ready?.results?.length || 0,
    rounds: rounds?.results || [],
    submissions: submissions?.results || [],
    my_submission: mySubmission,
    score,
    target_wins: Math.floor(Number((latestLobby || lobby).round_count || ROUND_COUNT) / 2) + 1,
    lock_goal: LOCKS_PER_ROUND,
    round_timeout_ms: ROUND_TIMEOUT_MS,
  };
}

async function maybeRunCipherBot(context: any, lobby: any) {
  if (!lobby || lobby.status !== "in_progress") return;
  const botId = getBotUserIdFromLobby(lobby);
  if (!botId) return;

  const round = await getCurrentRound(context, Number(lobby.id));
  if (!round || round.status !== "active") return;
  const startedMs = Date.parse(round.started_at || "");
  if (!Number.isFinite(startedMs) || Date.now() < startedMs) return;
  if (Date.now() - startedMs > ROUND_TIMEOUT_MS) {
    await finalizeRoundByTimeout(context, round);
    return;
  }

  const existing = await context.env.DB.prepare("SELECT * FROM cipher_submissions WHERE lobby_id = ? AND round_number = ? AND user_id = ? LIMIT 1").bind(lobby.id, round.round_number, botId).first();
  const progress = Number(existing?.correct || 0);
  if (progress < 0 || progress >= LOCKS_PER_ROUND) return;

  const skill = getBotSkill(lobby);
  const plan = getCipherBotPlan(lobby, round, progress, skill);
  if (plan.fail) {
    if (Date.now() >= startedMs + plan.failAtMs) await applyCipherSubmission(context, Number(lobby.id), round, botId, "BAD", Date.now());
    return;
  }
  if (Date.now() < startedMs + plan.submitAtMs) return;

  const locks = parseLocks(round);
  const lock = locks[Math.min(progress, locks.length - 1)] || locks[0];
  const target = String(lock?.target || round.target_code);
  const submitTime = findNextActiveTime(round, lock, target, Date.now());
  if (Date.now() >= submitTime) await applyCipherSubmission(context, Number(lobby.id), round, botId, target, submitTime);
}

function getCipherBotPlan(lobby: any, round: any, progress: number, skill: string) {
  const seed = `${lobby.id}:${round.round_number}:${progress}:${skill}`;
  const ranges: Record<string, [number, number]> = { easy: [3400, 7600], normal: [2100, 5200], hard: [1100, 3300] };
  const failRates: Record<string, number> = { easy: 0.18, normal: 0.09, hard: 0.045 };
  const [min, max] = ranges[skill] || ranges.normal;
  return {
    fail: hashUnit(`${seed}:fail`) < (failRates[skill] || 0.09),
    failAtMs: Math.round(2200 + hashUnit(`${seed}:failAt`) * 5400),
    submitAtMs: Math.round(min + hashUnit(`${seed}:submit`) * (max - min) + progress * 900),
  };
}

function findNextActiveTime(round: any, lock: any, target: string, afterMs: number) {
  const options = Array.isArray(lock?.options) ? lock.options : [];
  const startedMs = Date.parse(round.started_at || "");
  const tickMs = Number(round.tick_ms || 650);
  if (!options.length || !Number.isFinite(startedMs) || tickMs <= 0) return afterMs;
  for (let offset = 0; offset < options.length * tickMs * 2; offset += 80) {
    const candidate = afterMs + offset;
    if (codeAtTime(round, options, candidate) === target) return candidate;
  }
  return afterMs;
}

async function getScore(context: any, lobbyId: number) {
  const rows = await context.env.DB
    .prepare("SELECT winner_user_id, COUNT(*) AS wins FROM cipher_rounds WHERE lobby_id = ? AND status = 'completed' AND winner_user_id IS NOT NULL GROUP BY winner_user_id")
    .bind(lobbyId)
    .all();

  const score: Record<string, number> = {};
  for (const row of rows?.results || []) score[String(row.winner_user_id)] = Number(row.wins || 0);
  return score;
}

async function maybeCompleteLobby(context: any, lobbyId: number) {
  const lobby = await getLobby(context, lobbyId);
  const score = await getScore(context, lobbyId);
  const targetWins = Math.floor(Number(lobby.round_count || ROUND_COUNT) / 2) + 1;
  const creatorWins = Number(score[String(lobby.creator_user_id)] || 0);
  const opponentWins = Number(score[String(lobby.opponent_user_id)] || 0);
  const current = await getCurrentRound(context, lobbyId);

  if (creatorWins >= targetWins || opponentWins >= targetWins || Number(current?.round_number || 0) >= Number(lobby.round_count || ROUND_COUNT)) {
    const winner = creatorWins > opponentWins ? Number(lobby.creator_user_id) : opponentWins > creatorWins ? Number(lobby.opponent_user_id) : null;
    await context.env.DB
      .prepare("UPDATE cipher_lobbies SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'")
      .bind(winner, lobbyId)
      .run();

    if (winner) await awardCoins(context, winner, Number(lobby.reward_amount || FIXED_REWARD_AMOUNT), lobbyId);
  }
}

async function awardCoins(context: any, userId: number, amount: number, lobbyId: number) {
  try {
    const reason = `cipher:${lobbyId}`;
    const existing = await context.env.DB.prepare("SELECT id FROM coin_transactions WHERE reason = ? LIMIT 1").bind(reason).first();
    if (existing) return;

    await context.env.DB
      .prepare("INSERT INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, lifetime_earned = lifetime_earned + excluded.lifetime_earned, updated_at = datetime('now')")
      .bind(userId, amount, amount)
      .run();

    await context.env.DB.prepare("INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)").bind(userId, amount, reason).run();
  } catch {}
}

async function cleanup(context: any) {
  await finalizeExpiredRounds(context);
  await context.env.DB
    .prepare("UPDATE cipher_lobbies SET status = 'expired', winner_user_id = NULL, updated_at = datetime('now') WHERE status = 'open' AND created_at < datetime('now', '-2 hours')")
    .run();
  await context.env.DB
    .prepare("UPDATE cipher_lobbies SET status = 'cancelled', winner_user_id = NULL, updated_at = datetime('now') WHERE status = 'in_progress' AND updated_at < datetime('now', '-15 minutes')")
    .run();
}

async function finalizeExpiredRounds(context: any) {
  const rows = await context.env.DB
    .prepare("SELECT * FROM cipher_rounds WHERE status = 'active' ORDER BY started_at ASC LIMIT 50")
    .all();

  for (const round of rows?.results || []) {
    const startedMs = Date.parse(round.started_at || "");
    if (Number.isFinite(startedMs) && Date.now() - startedMs > ROUND_TIMEOUT_MS) {
      await finalizeRoundByTimeout(context, round);
    }
  }
}

async function finalizeRoundByTimeout(context: any, round: any) {
  const lobby = await getLobby(context, Number(round.lobby_id));
  if (!lobby || lobby.status !== "in_progress" || !lobby.opponent_user_id) return;

  const rows = await context.env.DB
    .prepare("SELECT user_id, correct FROM cipher_submissions WHERE lobby_id = ? AND round_number = ?")
    .bind(round.lobby_id, round.round_number)
    .all();

  const progress = new Map<number, number>([
    [Number(lobby.creator_user_id), 0],
    [Number(lobby.opponent_user_id), 0],
  ]);

  for (const row of rows?.results || []) {
    progress.set(Number(row.user_id), Number(row.correct || 0));
  }

  const creatorProgress = progress.get(Number(lobby.creator_user_id)) ?? 0;
  const opponentProgress = progress.get(Number(lobby.opponent_user_id)) ?? 0;
  const winner = creatorProgress > opponentProgress ? Number(lobby.creator_user_id) : opponentProgress > creatorProgress ? Number(lobby.opponent_user_id) : null;

  await context.env.DB
    .prepare("UPDATE cipher_rounds SET status = 'completed', winner_user_id = ?, completed_at = datetime('now') WHERE lobby_id = ? AND round_number = ? AND status = 'active'")
    .bind(winner, round.lobby_id, round.round_number)
    .run();

  await touchLobby(context, Number(round.lobby_id));
  await maybeCompleteLobby(context, Number(round.lobby_id));
}

async function touchLobby(context: any, lobbyId: number) {
  await context.env.DB.prepare("UPDATE cipher_lobbies SET updated_at = datetime('now') WHERE id = ?").bind(lobbyId).run();
}

function isParticipant(lobby: any, userId: number) {
  return Number(lobby.creator_user_id) === Number(userId) || Number(lobby.opponent_user_id) === Number(userId);
}

function getBotUserIdFromLobby(lobby: any) {
  if (isBotIdentity(lobby.creator_name, lobby.creator_email)) return Number(lobby.creator_user_id || 0);
  if (isBotIdentity(lobby.opponent_name, lobby.opponent_email)) return Number(lobby.opponent_user_id || 0);
  return 0;
}

function isBotIdentity(name?: string | null, email?: string | null) {
  return String(email || "").toLowerCase().includes(BOT_EMAIL_MARKER) || String(name || "").toUpperCase().includes("BOT");
}

function getBotSkill(lobby: any) {
  const name = String(lobby.opponent_name || lobby.creator_name || "").toLowerCase();
  if (name.includes("glitch")) return "hard";
  if (name.includes("echo")) return "easy";
  return "normal";
}

function pickBotProfile(lobbyId: number, userId: number) {
  const index = Math.abs(hashNumber(`${lobbyId}:${userId}`)) % BOT_PROFILES.length;
  return BOT_PROFILES[index];
}

async function ensureBotUser(context: any, profile: any) {
  const existing = await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
  if (existing) return existing;
  const systemValue = `bot-user-${profile.email}`;
  const attempts = [
    { sql: "INSERT INTO users (name, email, password_hash, password_salt, role, email_verified, avatar_approved) VALUES (?, ?, ?, ?, 'off', 1, 1)", values: [profile.name, profile.email, systemValue, systemValue] },
    { sql: "INSERT INTO users (name, email, password_hash, password_salt, role, email_verified) VALUES (?, ?, ?, ?, 'off', 1)", values: [profile.name, profile.email, systemValue, systemValue] },
    { sql: "INSERT INTO users (name, email, role) VALUES (?, ?, 'off')", values: [profile.name, profile.email] },
  ];
  for (const attempt of attempts) {
    try {
      await context.env.DB.prepare(attempt.sql).bind(...attempt.values).run();
      return await context.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(profile.email).first();
    } catch {}
  }
  return null;
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare("SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')")
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekiyor." };
  return { ok: true, user };
}

function hashUnit(value: string) {
  return (Math.abs(hashNumber(value)) % 10000) / 10000;
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashNumber(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
