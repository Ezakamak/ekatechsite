const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(context.request.url);
    const lobbyId = Number(url.searchParams.get("lobby_id"));
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (!isParticipant(lobby, auth.user.id)) return Response.json({ error: "Bu düellonun oyuncusu değilsin." }, { status: 403 });

    await ensureRoundOneAfterBothReady(context, lobby, auth.user.id);
    return Response.json(await buildRoundPayload(context, lobbyId, auth.user.id));
  } catch (error) {
    return Response.json({ error: "Round verisi alınamadı. duel_round_ready, duel_round_hold_ready ve duel_rounds tablolarını kontrol et." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const lobbyId = Number(body?.lobby_id);
    const action = String(body?.action || "next_round");
    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });
    if (!["next_round", "hold_ready", "hold_cancel"].includes(action)) return Response.json({ error: "Geçersiz işlem." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (!isParticipant(lobby, auth.user.id)) return Response.json({ error: "Bu düellonun oyuncusu değilsin." }, { status: 403 });
    if (lobby.status !== "in_progress") return Response.json({ error: "Bu düello aktif değil." }, { status: 409 });

    let currentRound = await context.env.DB
      .prepare("SELECT * FROM duel_rounds WHERE lobby_id = ? ORDER BY round_number DESC LIMIT 1")
      .bind(lobbyId)
      .first();

    if (!currentRound) {
      await ensureRoundOneAfterBothReady(context, lobby, auth.user.id);
      currentRound = await context.env.DB
        .prepare("SELECT * FROM duel_rounds WHERE lobby_id = ? ORDER BY round_number DESC LIMIT 1")
        .bind(lobbyId)
        .first();
    }

    if (action === "hold_ready" || action === "hold_cancel") {
      if (!currentRound) return Response.json(await buildRoundPayload(context, lobbyId, auth.user.id));
      if (String(lobby.mode || "classic") !== "what_the_hold") return Response.json({ error: "Hold işlemi sadece What The Hold modu için geçerli." }, { status: 400 });

      if (currentRound.status === "waiting_hold") {
        if (action === "hold_ready") {
          await markHoldReady(context, lobbyId, Number(currentRound.round_number), auth.user.id);
          if (await bothPlayersHoldReady(context, lobby, Number(currentRound.round_number))) {
            await activateHoldRound(context, lobbyId, Number(currentRound.round_number));
          }
        } else {
          await unmarkHoldReady(context, lobbyId, Number(currentRound.round_number), auth.user.id);
        }
      }

      return Response.json(await buildRoundPayload(context, lobbyId, auth.user.id));
    }

    if (!currentRound) return Response.json(await buildRoundPayload(context, lobbyId, auth.user.id));

    if (currentRound.status !== "completed") {
      return Response.json({ error: "Sonraki tura geçmeden önce iki oyuncunun da sonucu gerekli." }, { status: 409 });
    }

    const score = await getScore(context, lobbyId);
    const targetWins = Math.floor(Number(lobby.round_count) / 2) + 1;
    const creatorWins = Number(score[lobby.creator_user_id] || 0);
    const opponentWins = Number(score[lobby.opponent_user_id] || 0);

    if (creatorWins >= targetWins || opponentWins >= targetWins || Number(currentRound.round_number) >= Number(lobby.round_count)) {
      const winner = creatorWins > opponentWins ? Number(lobby.creator_user_id) : Number(lobby.opponent_user_id);
      await completeLobby(context, lobby, winner);
      return Response.json(await buildRoundPayload(context, lobbyId, auth.user.id));
    }

    const nextRoundNumber = Number(currentRound.round_number) + 1;
    await markReady(context, lobbyId, nextRoundNumber, auth.user.id);
    if (await bothPlayersReady(context, lobby, nextRoundNumber)) {
      await createRound(context, lobby, nextRoundNumber);
    }

    return Response.json(await buildRoundPayload(context, lobbyId, auth.user.id));
  } catch (error) {
    return Response.json({ error: "Sonraki tur başlatılamadı. duel_round_ready ve duel_round_hold_ready tablolarını kontrol et." }, { status: 500 });
  }
}

async function getLobby(context: any, lobbyId: number) {
  return await context.env.DB
    .prepare(`
      SELECT
        duel_lobbies.*,
        creator.name AS creator_name,
        creator.email AS creator_email,
        creator.avatar_url AS creator_avatar_url,
        opponent.name AS opponent_name,
        opponent.email AS opponent_email,
        opponent.avatar_url AS opponent_avatar_url,
        winner.name AS winner_name
      FROM duel_lobbies
      JOIN users AS creator ON duel_lobbies.creator_user_id = creator.id
      LEFT JOIN users AS opponent ON duel_lobbies.opponent_user_id = opponent.id
      LEFT JOIN users AS winner ON duel_lobbies.winner_user_id = winner.id
      WHERE duel_lobbies.id = ?
    `)
    .bind(lobbyId)
    .first();
}

async function ensureRoundOneAfterBothReady(context: any, lobby: any, userId: number) {
  if (lobby.status !== "in_progress" || !lobby.opponent_user_id) return;

  const existing = await context.env.DB
    .prepare("SELECT id FROM duel_rounds WHERE lobby_id = ? AND round_number = 1 LIMIT 1")
    .bind(lobby.id)
    .first();
  if (existing) return;

  await markReady(context, lobby.id, 1, userId);
  if (await bothPlayersReady(context, lobby, 1)) {
    await createRound(context, lobby, 1);
  }
}

async function markReady(context: any, lobbyId: number, roundNumber: number, userId: number) {
  await context.env.DB
    .prepare(`
      INSERT OR IGNORE INTO duel_round_ready (lobby_id, round_number, user_id, ready_at)
      VALUES (?, ?, ?, datetime('now'))
    `)
    .bind(lobbyId, roundNumber, userId)
    .run();
}

async function bothPlayersReady(context: any, lobby: any, roundNumber: number) {
  if (!lobby.creator_user_id || !lobby.opponent_user_id) return false;

  const row = await context.env.DB
    .prepare(`
      SELECT COUNT(DISTINCT user_id) AS ready_count
      FROM duel_round_ready
      WHERE lobby_id = ? AND round_number = ? AND user_id IN (?, ?)
    `)
    .bind(lobby.id, roundNumber, lobby.creator_user_id, lobby.opponent_user_id)
    .first();

  return Number(row?.ready_count || 0) >= 2;
}

async function createRound(context: any, lobby: any, roundNumber: number) {
  const mode = String(lobby.mode || "classic");
  const status = mode === "what_the_hold" ? "waiting_hold" : "active";
  const signalAt = getSignalAtForMode(mode);

  await context.env.DB
    .prepare(`
      INSERT OR IGNORE INTO duel_rounds (lobby_id, round_number, signal_at, status)
      VALUES (?, ?, ?, ?)
    `)
    .bind(lobby.id, roundNumber, signalAt, status)
    .run();
}

function getSignalAtForMode(mode: string) {
  if (mode === "what_the_hold") {
    return new Date(Date.now() + 30 * 60 * 1000).toISOString();
  }

  if (mode === "best_focus") {
    const fakeCount = randomInt(4, 9);
    const fakeIntervalMs = randomInt(620, 920);
    const finalGapMs = randomInt(240, 620);
    return new Date(Date.now() + fakeCount * fakeIntervalMs + finalGapMs).toISOString();
  }

  return new Date(Date.now() + 5000).toISOString();
}

async function markHoldReady(context: any, lobbyId: number, roundNumber: number, userId: number) {
  await context.env.DB
    .prepare(`
      INSERT OR IGNORE INTO duel_round_hold_ready (lobby_id, round_number, user_id, ready_at)
      VALUES (?, ?, ?, datetime('now'))
    `)
    .bind(lobbyId, roundNumber, userId)
    .run();
}

async function unmarkHoldReady(context: any, lobbyId: number, roundNumber: number, userId: number) {
  await context.env.DB
    .prepare("DELETE FROM duel_round_hold_ready WHERE lobby_id = ? AND round_number = ? AND user_id = ?")
    .bind(lobbyId, roundNumber, userId)
    .run();
}

async function bothPlayersHoldReady(context: any, lobby: any, roundNumber: number) {
  if (!lobby.creator_user_id || !lobby.opponent_user_id) return false;

  const row = await context.env.DB
    .prepare(`
      SELECT COUNT(DISTINCT user_id) AS ready_count
      FROM duel_round_hold_ready
      WHERE lobby_id = ? AND round_number = ? AND user_id IN (?, ?)
    `)
    .bind(lobby.id, roundNumber, lobby.creator_user_id, lobby.opponent_user_id)
    .first();

  return Number(row?.ready_count || 0) >= 2;
}

async function activateHoldRound(context: any, lobbyId: number, roundNumber: number) {
  const signalAt = new Date(Date.now() + randomInt(4200, 6200)).toISOString();
  await context.env.DB
    .prepare("UPDATE duel_rounds SET status = 'active', signal_at = ? WHERE lobby_id = ? AND round_number = ? AND status = 'waiting_hold'")
    .bind(signalAt, lobbyId, roundNumber)
    .run();
}

async function buildRoundPayload(context: any, lobbyId: number, userId: number) {
  const lobby = await getLobby(context, lobbyId);
  const currentRound = await context.env.DB
    .prepare("SELECT * FROM duel_rounds WHERE lobby_id = ? ORDER BY round_number DESC LIMIT 1")
    .bind(lobbyId)
    .first();

  const rounds = await context.env.DB
    .prepare(`
      SELECT duel_rounds.*, winner.name AS winner_name
      FROM duel_rounds
      LEFT JOIN users AS winner ON duel_rounds.winner_user_id = winner.id
      WHERE duel_rounds.lobby_id = ?
      ORDER BY duel_rounds.round_number ASC
    `)
    .bind(lobbyId)
    .all();

  const submissions = currentRound
    ? await context.env.DB
        .prepare(`
          SELECT duel_round_submissions.*, users.name, users.avatar_url
          FROM duel_round_submissions
          JOIN users ON duel_round_submissions.user_id = users.id
          WHERE duel_round_submissions.lobby_id = ? AND duel_round_submissions.round_number = ?
          ORDER BY duel_round_submissions.submitted_at ASC
        `)
        .bind(lobbyId, currentRound.round_number)
        .all()
    : { results: [] };

  const pendingRoundNumber = currentRound ? Number(currentRound.round_number) + (currentRound.status === "completed" ? 1 : 0) : 1;
  const readyRows = await context.env.DB
    .prepare(`
      SELECT duel_round_ready.user_id, users.name
      FROM duel_round_ready
      JOIN users ON duel_round_ready.user_id = users.id
      WHERE duel_round_ready.lobby_id = ? AND duel_round_ready.round_number = ?
    `)
    .bind(lobbyId, pendingRoundNumber)
    .all();

  const holdReadyRows = currentRound
    ? await context.env.DB
        .prepare(`
          SELECT duel_round_hold_ready.user_id, users.name
          FROM duel_round_hold_ready
          JOIN users ON duel_round_hold_ready.user_id = users.id
          WHERE duel_round_hold_ready.lobby_id = ? AND duel_round_hold_ready.round_number = ?
        `)
        .bind(lobbyId, currentRound.round_number)
        .all()
    : { results: [] };

  const score = await getScore(context, lobbyId);
  const targetWins = lobby ? Math.floor(Number(lobby.round_count) / 2) + 1 : 0;
  const mySubmission = (submissions?.results || []).find((item: any) => Number(item.user_id) === Number(userId)) || null;

  return {
    server_time: new Date().toISOString(),
    lobby,
    current_round: currentRound || null,
    rounds: rounds?.results || [],
    submissions: submissions?.results || [],
    my_submission: mySubmission,
    score,
    target_wins: targetWins,
    ready: readyRows?.results || [],
    ready_count: readyRows?.results?.length || 0,
    hold_ready: holdReadyRows?.results || [],
    hold_ready_count: holdReadyRows?.results?.length || 0,
    pending_round_number: pendingRoundNumber,
  };
}

async function getScore(context: any, lobbyId: number) {
  const rows = await context.env.DB
    .prepare("SELECT winner_user_id, COUNT(*) AS wins FROM duel_rounds WHERE lobby_id = ? AND status = 'completed' AND winner_user_id IS NOT NULL GROUP BY winner_user_id")
    .bind(lobbyId)
    .all();

  const score: Record<string, number> = {};
  for (const row of rows?.results || []) score[String(row.winner_user_id)] = Number(row.wins || 0);
  return score;
}

async function completeLobby(context: any, lobby: any, winner: number) {
  const update = await context.env.DB
    .prepare("UPDATE duel_lobbies SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'")
    .bind(winner, lobby.id)
    .run();

  if (Number(update?.meta?.changes || 0) > 0) {
    await awardSystemCoins(context, winner, Number(lobby.reward_amount || 50), Number(lobby.id));
  }
}

async function awardSystemCoins(context: any, userId: number, amount: number, lobbyId: number) {
  if (!amount || amount < 1) return;
  try {
    const existing = await context.env.DB.prepare("SELECT id FROM coin_transactions WHERE reason = ? LIMIT 1").bind(`tech_duel:${lobbyId}`).first();
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
    await context.env.DB.prepare("INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)").bind(userId, amount, `tech_duel:${lobbyId}`).run();
  } catch {
    // Coin tabloları yoksa düello sonucu bozulmasın.
  }
}

function isParticipant(lobby: any, userId: number) {
  return Number(lobby.creator_user_id) === Number(userId) || Number(lobby.opponent_user_id) === Number(userId);
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
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "Tech Duel için OFF, admin veya owner rolü gerekiyor." };
  return { ok: true, user };
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
