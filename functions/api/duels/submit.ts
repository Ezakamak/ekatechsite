const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const lobbyId = Number(body?.lobby_id);
    const roundNumber = Number(body?.round_number);
    const msValue = body?.ms === null || body?.ms === undefined ? null : Math.max(0, Math.min(5000, Number(body.ms)));
    const tooEarly = Boolean(body?.tooEarly);

    if (!lobbyId || !roundNumber) return Response.json({ error: "Lobby ve round gerekli." }, { status: 400 });

    const lobby = await getLobby(context, lobbyId);
    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (lobby.status !== "in_progress") return Response.json({ error: "Bu düello aktif değil." }, { status: 409 });
    if (!isParticipant(lobby, auth.user.id)) return Response.json({ error: "Bu düellonun oyuncusu değilsin." }, { status: 403 });

    const round = await context.env.DB
      .prepare("SELECT * FROM duel_rounds WHERE lobby_id = ? AND round_number = ?")
      .bind(lobbyId, roundNumber)
      .first();

    if (!round) return Response.json({ error: "Round bulunamadı." }, { status: 404 });
    if (round.status !== "active") return Response.json({ error: "Bu round artık aktif değil." }, { status: 409 });

    const scoreMs = tooEarly ? 9999 : Number.isFinite(msValue) ? Number(msValue) : 9999;

    const inserted = await context.env.DB
      .prepare(`
        INSERT OR IGNORE INTO duel_round_submissions (lobby_id, round_number, user_id, ms, too_early, score_ms, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(lobbyId, roundNumber, auth.user.id, msValue, tooEarly ? 1 : 0, scoreMs)
      .run();

    if (Number(inserted?.meta?.changes || 0) === 0) {
      return Response.json({ error: "Bu round için sonucun zaten kaydedildi." }, { status: 409 });
    }

    const submissions = await context.env.DB
      .prepare("SELECT * FROM duel_round_submissions WHERE lobby_id = ? AND round_number = ? ORDER BY submitted_at ASC")
      .bind(lobbyId, roundNumber)
      .all();

    const items = submissions?.results || [];
    if (items.length >= 2) {
      const winner = decideRoundWinner(items[0], items[1]);

      await context.env.DB
        .prepare("UPDATE duel_rounds SET status = 'completed', winner_user_id = ?, completed_at = datetime('now') WHERE lobby_id = ? AND round_number = ? AND status = 'active'")
        .bind(winner, lobbyId, roundNumber)
        .run();

      await syncDuelResultRows(context, lobbyId, Number(lobby.creator_user_id), Number(lobby.opponent_user_id));

      const score = await getScore(context, lobbyId);
      const targetWins = Math.floor(Number(lobby.round_count) / 2) + 1;
      const creatorWins = Number(score[lobby.creator_user_id] || 0);
      const opponentWins = Number(score[lobby.opponent_user_id] || 0);

      if (creatorWins >= targetWins || opponentWins >= targetWins || roundNumber >= Number(lobby.round_count)) {
        const matchWinner = creatorWins > opponentWins ? Number(lobby.creator_user_id) : Number(lobby.opponent_user_id);
        await completeLobby(context, lobby, matchWinner);
      }
    }

    return Response.json({ success: true, message: items.length >= 2 ? "Round tamamlandı." : "Sonucun kaydedildi. Rakip bekleniyor." });
  } catch (error) {
    return Response.json({ error: "Round sonucu kaydedilemedi. duel_round_submissions tablosunu kontrol et." }, { status: 500 });
  }
}

function decideRoundWinner(a: any, b: any) {
  const aEarly = Number(a.too_early) === 1;
  const bEarly = Number(b.too_early) === 1;
  if (aEarly && !bEarly) return Number(b.user_id);
  if (!aEarly && bEarly) return Number(a.user_id);
  if (Number(a.score_ms) < Number(b.score_ms)) return Number(a.user_id);
  if (Number(b.score_ms) < Number(a.score_ms)) return Number(b.user_id);
  return Number(a.submitted_at || "") <= Number(b.submitted_at || "") ? Number(a.user_id) : Number(b.user_id);
}

async function getLobby(context: any, lobbyId: number) {
  return await context.env.DB
    .prepare("SELECT * FROM duel_lobbies WHERE id = ?")
    .bind(lobbyId)
    .first();
}

async function syncDuelResultRows(context: any, lobbyId: number, creatorId: number, opponentId: number) {
  for (const userId of [creatorId, opponentId]) {
    const subs = await context.env.DB
      .prepare("SELECT * FROM duel_round_submissions WHERE lobby_id = ? AND user_id = ? ORDER BY round_number ASC")
      .bind(lobbyId, userId)
      .all();

    const rounds = subs?.results || [];
    const valid = rounds.filter((item: any) => Number(item.too_early) !== 1 && Number.isFinite(Number(item.ms))).map((item: any) => Number(item.ms));
    const tooEarlyCount = rounds.filter((item: any) => Number(item.too_early) === 1).length;
    const averageMs = valid.length ? Math.round(valid.reduce((sum: number, value: number) => sum + value, 0) / valid.length) : 9999;
    const bestMs = valid.length ? Math.min(...valid) : 9999;
    const roundWinsRow = await context.env.DB
      .prepare("SELECT COUNT(*) AS wins FROM duel_rounds WHERE lobby_id = ? AND winner_user_id = ?")
      .bind(lobbyId, userId)
      .first();
    const roundWins = Number(roundWinsRow?.wins || 0);
    const scoreMs = averageMs + tooEarlyCount * 1000 - roundWins * 50;

    await context.env.DB
      .prepare(`
        INSERT OR REPLACE INTO duel_results (lobby_id, user_id, average_ms, best_ms, too_early_count, round_wins, score_ms, rounds_json, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(lobbyId, userId, averageMs, bestMs, tooEarlyCount, roundWins, scoreMs, JSON.stringify(rounds))
      .run();
  }
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

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
