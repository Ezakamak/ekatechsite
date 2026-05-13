const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];
const FIXED_REWARD_AMOUNT = 40;
const ROUND_COUNT = 5;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await cleanup(context);
    const url = new URL(context.request.url);
    const lobbyId = Number(url.searchParams.get("lobby_id"));

    if (lobbyId) {
      return Response.json(await buildState(context, lobbyId, auth.user.id));
    }

    const open = await context.env.DB.prepare(`
      SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url,
        opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url,
        winner.name AS winner_name
      FROM cipher_lobbies l
      JOIN users creator ON l.creator_user_id = creator.id
      LEFT JOIN users opponent ON l.opponent_user_id = opponent.id
      LEFT JOIN users winner ON l.winner_user_id = winner.id
      WHERE l.status IN ('open', 'in_progress')
      ORDER BY l.id DESC
      LIMIT 30
    `).all();

    const mine = await context.env.DB.prepare(`
      SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url,
        opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url,
        winner.name AS winner_name
      FROM cipher_lobbies l
      JOIN users creator ON l.creator_user_id = creator.id
      LEFT JOIN users opponent ON l.opponent_user_id = opponent.id
      LEFT JOIN users winner ON l.winner_user_id = winner.id
      WHERE l.creator_user_id = ? OR l.opponent_user_id = ?
      ORDER BY l.id DESC
      LIMIT 20
    `).bind(auth.user.id, auth.user.id).all();

    return Response.json({ user: auth.user, open: open?.results || [], mine: mine?.results || [] });
  } catch {
    return Response.json({ error: "Cipher Break verileri alınamadı. d1-cipher-break.sql dosyasındaki tabloları D1'e ekle." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await cleanup(context);
    const body = await context.request.json().catch(() => null);
    const action = String(body?.action || "create");

    if (action === "create") {
      const existing = await context.env.DB.prepare("SELECT id FROM cipher_lobbies WHERE creator_user_id = ? AND status = 'open' LIMIT 1").bind(auth.user.id).first();
      if (existing) return Response.json({ error: "Zaten açık bir Cipher Break lobby'n var." }, { status: 409 });

      const result = await context.env.DB.prepare(`
        INSERT INTO cipher_lobbies (creator_user_id, reward_amount, round_count, status)
        VALUES (?, ?, ?, 'open')
      `).bind(auth.user.id, FIXED_REWARD_AMOUNT, ROUND_COUNT).run();
      return Response.json({ success: true, lobby_id: result?.meta?.last_row_id });
    }

    const lobbyId = Number(body?.lobby_id);
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });

    if (action === "join") {
      if (lobby.status !== "open") return Response.json({ error: "Bu lobby artık açık değil." }, { status: 409 });
      if (Number(lobby.creator_user_id) === Number(auth.user.id)) return Response.json({ error: "Kendi lobby'ne katılamazsın." }, { status: 400 });

      const update = await context.env.DB.prepare(`
        UPDATE cipher_lobbies
        SET opponent_user_id = ?, status = 'in_progress', updated_at = datetime('now')
        WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL
      `).bind(auth.user.id, lobbyId).run();
      if (Number(update?.meta?.changes || 0) === 0) return Response.json({ error: "Bu lobby'ye başka biri katılmış." }, { status: 409 });

      const freshLobby = await getLobby(context, lobbyId);
      await createRound(context, freshLobby, 1);
      return Response.json(await buildState(context, lobbyId, auth.user.id));
    }

    if (!isParticipant(lobby, auth.user.id)) return Response.json({ error: "Bu oyunun oyuncusu değilsin." }, { status: 403 });
    if (lobby.status !== "in_progress") return Response.json({ error: "Bu oyun aktif değil." }, { status: 409 });

    if (action === "submit") {
      const selectedCode = String(body?.selected_code || "").trim().toUpperCase();
      const round = await getCurrentRound(context, lobbyId);
      if (!round) return Response.json({ error: "Round bulunamadı." }, { status: 404 });
      if (round.status !== "active") return Response.json({ error: "Bu round aktif değil." }, { status: 409 });

      const correct = selectedCode === String(round.target_code);
      await context.env.DB.prepare(`
        INSERT OR IGNORE INTO cipher_submissions (lobby_id, round_number, user_id, selected_code, correct, submitted_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(lobbyId, round.round_number, auth.user.id, selectedCode, correct ? 1 : 0).run();

      if (correct) {
        await context.env.DB.prepare(`
          UPDATE cipher_rounds
          SET status = 'completed', winner_user_id = ?, completed_at = datetime('now')
          WHERE lobby_id = ? AND round_number = ? AND status = 'active'
        `).bind(auth.user.id, lobbyId, round.round_number).run();
        await maybeCompleteLobby(context, lobbyId);
      } else {
        const countRow = await context.env.DB.prepare(`
          SELECT COUNT(*) AS count FROM cipher_submissions WHERE lobby_id = ? AND round_number = ?
        `).bind(lobbyId, round.round_number).first();
        if (Number(countRow?.count || 0) >= 2) {
          await context.env.DB.prepare(`
            UPDATE cipher_rounds
            SET status = 'completed', winner_user_id = NULL, completed_at = datetime('now')
            WHERE lobby_id = ? AND round_number = ? AND status = 'active'
          `).bind(lobbyId, round.round_number).run();
          await maybeCompleteLobby(context, lobbyId);
        }
      }

      return Response.json(await buildState(context, lobbyId, auth.user.id));
    }

    if (action === "next_round") {
      const current = await getCurrentRound(context, lobbyId);
      if (!current) return Response.json({ error: "Round bulunamadı." }, { status: 404 });
      if (current.status !== "completed") return Response.json({ error: "Yeni round için mevcut round bitmeli." }, { status: 409 });

      const freshLobby = await getLobby(context, lobbyId);
      if (freshLobby.status !== "in_progress") return Response.json(await buildState(context, lobbyId, auth.user.id));
      const nextRound = Number(current.round_number) + 1;
      if (nextRound <= Number(freshLobby.round_count || ROUND_COUNT)) await createRound(context, freshLobby, nextRound);
      return Response.json(await buildState(context, lobbyId, auth.user.id));
    }

    return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch {
    return Response.json({ error: "Cipher Break işlemi tamamlanamadı." }, { status: 500 });
  }
}

async function getLobby(context: any, lobbyId: number) {
  return await context.env.DB.prepare(`
    SELECT l.*, creator.name AS creator_name, creator.email AS creator_email, creator.avatar_url AS creator_avatar_url,
      opponent.name AS opponent_name, opponent.email AS opponent_email, opponent.avatar_url AS opponent_avatar_url,
      winner.name AS winner_name
    FROM cipher_lobbies l
    JOIN users creator ON l.creator_user_id = creator.id
    LEFT JOIN users opponent ON l.opponent_user_id = opponent.id
    LEFT JOIN users winner ON l.winner_user_id = winner.id
    WHERE l.id = ?
  `).bind(lobbyId).first();
}

async function getCurrentRound(context: any, lobbyId: number) {
  return await context.env.DB.prepare("SELECT * FROM cipher_rounds WHERE lobby_id = ? ORDER BY round_number DESC LIMIT 1").bind(lobbyId).first();
}

async function createRound(context: any, lobby: any, roundNumber: number) {
  const target = makeCode(roundNumber >= 4 ? 4 : 3);
  const options = makeOptions(target, roundNumber);
  const tickMs = Math.max(380, 720 - roundNumber * 45);
  await context.env.DB.prepare(`
    INSERT OR IGNORE INTO cipher_rounds (lobby_id, round_number, target_code, options_json, tick_ms, started_at, status)
    VALUES (?, ?, ?, ?, ?, datetime('now'), 'active')
  `).bind(lobby.id, roundNumber, target, JSON.stringify(options), tickMs).run();
}

function makeCode(length: number) {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_CHARS[randomInt(0, CODE_CHARS.length - 1)];
  return code;
}

function makeOptions(target: string, roundNumber: number) {
  const total = Math.min(14, 9 + roundNumber);
  const options = new Set<string>();
  options.add(target);
  while (options.size < total) options.add(makeSimilarCode(target));
  return shuffle([...options]);
}

function makeSimilarCode(target: string) {
  const chars = target.split("");
  const changes = Math.random() < 0.72 ? 1 : 2;
  for (let i = 0; i < changes; i++) chars[randomInt(0, chars.length - 1)] = CODE_CHARS[randomInt(0, CODE_CHARS.length - 1)];
  const code = chars.join("");
  return code === target ? makeCode(target.length) : code;
}

async function buildState(context: any, lobbyId: number, userId: number) {
  const lobby = await getLobby(context, lobbyId);
  if (!lobby) return { error: "Lobby bulunamadı." };
  if (!isParticipant(lobby, userId)) return { error: "Bu oyunun oyuncusu değilsin." };

  const currentRound = await getCurrentRound(context, lobbyId);
  const rounds = await context.env.DB.prepare(`
    SELECT r.*, winner.name AS winner_name
    FROM cipher_rounds r
    LEFT JOIN users winner ON r.winner_user_id = winner.id
    WHERE r.lobby_id = ?
    ORDER BY r.round_number ASC
  `).bind(lobbyId).all();
  const submissions = currentRound ? await context.env.DB.prepare(`
    SELECT s.*, users.name
    FROM cipher_submissions s
    JOIN users ON s.user_id = users.id
    WHERE s.lobby_id = ? AND s.round_number = ?
    ORDER BY s.submitted_at ASC
  `).bind(lobbyId, currentRound.round_number).all() : { results: [] };
  const score = await getScore(context, lobbyId);
  const mySubmission = (submissions?.results || []).find((item: any) => Number(item.user_id) === Number(userId)) || null;

  return {
    server_time: new Date().toISOString(),
    user_id: userId,
    lobby,
    current_round: currentRound || null,
    rounds: rounds?.results || [],
    submissions: submissions?.results || [],
    my_submission: mySubmission,
    score,
    target_wins: Math.floor(Number(lobby.round_count || ROUND_COUNT) / 2) + 1,
  };
}

async function getScore(context: any, lobbyId: number) {
  const rows = await context.env.DB.prepare(`
    SELECT winner_user_id, COUNT(*) AS wins
    FROM cipher_rounds
    WHERE lobby_id = ? AND status = 'completed' AND winner_user_id IS NOT NULL
    GROUP BY winner_user_id
  `).bind(lobbyId).all();
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
    await context.env.DB.prepare("UPDATE cipher_lobbies SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'").bind(winner, lobbyId).run();
    if (winner) await awardCoins(context, winner, Number(lobby.reward_amount || FIXED_REWARD_AMOUNT), lobbyId);
  }
}

async function awardCoins(context: any, userId: number, amount: number, lobbyId: number) {
  try {
    const reason = `cipher:${lobbyId}`;
    const existing = await context.env.DB.prepare("SELECT id FROM coin_transactions WHERE reason = ? LIMIT 1").bind(reason).first();
    if (existing) return;
    await context.env.DB.prepare(`
      INSERT INTO coin_wallets (user_id, balance, lifetime_earned, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        lifetime_earned = lifetime_earned + excluded.lifetime_earned,
        updated_at = datetime('now')
    `).bind(userId, amount, amount).run();
    await context.env.DB.prepare("INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)").bind(userId, amount, reason).run();
  } catch {}
}

async function cleanup(context: any) {
  await context.env.DB.prepare("UPDATE cipher_lobbies SET status = 'expired', winner_user_id = NULL, updated_at = datetime('now') WHERE status = 'open' AND created_at < datetime('now', '-2 hours')").run();
  await context.env.DB.prepare("UPDATE cipher_lobbies SET status = 'cancelled', winner_user_id = NULL, updated_at = datetime('now') WHERE status = 'in_progress' AND updated_at < datetime('now', '-15 minutes')").run();
}

function isParticipant(lobby: any, userId: number) {
  return Number(lobby.creator_user_id) === Number(userId) || Number(lobby.opponent_user_id) === Number(userId);
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekiyor." };
  return { ok: true, user };
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

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
