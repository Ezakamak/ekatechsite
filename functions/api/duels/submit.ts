const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const lobbyId = Number(body?.lobby_id);
    const rounds = Array.isArray(body?.rounds) ? body.rounds : [];

    if (!lobbyId) return Response.json({ error: "Lobby seçilmedi." }, { status: 400 });

    const lobby = await context.env.DB
      .prepare("SELECT id, creator_user_id, opponent_user_id, round_count, reward_amount, status FROM duel_lobbies WHERE id = ?")
      .bind(lobbyId)
      .first();

    if (!lobby) return Response.json({ error: "Lobby bulunamadı." }, { status: 404 });
    if (lobby.status !== "in_progress") return Response.json({ error: "Bu düello aktif değil." }, { status: 409 });

    const isParticipant = Number(lobby.creator_user_id) === Number(auth.user.id) || Number(lobby.opponent_user_id) === Number(auth.user.id);
    if (!isParticipant) return Response.json({ error: "Bu düellonun oyuncusu değilsin." }, { status: 403 });

    if (!rounds.length || rounds.length !== Number(lobby.round_count)) {
      return Response.json({ error: `Bu düello ${lobby.round_count} round sonuç bekliyor.` }, { status: 400 });
    }

    const normalized = rounds.map((round: any) => ({
      ms: round?.ms === null || round?.ms === undefined ? null : Math.max(0, Math.min(5000, Number(round.ms))),
      tooEarly: Boolean(round?.tooEarly),
    }));

    const validMs = normalized.filter((round: any) => !round.tooEarly && Number.isFinite(round.ms)).map((round: any) => Number(round.ms));
    const tooEarlyCount = normalized.filter((round: any) => round.tooEarly).length;
    const averageMs = validMs.length ? Math.round(validMs.reduce((sum: number, value: number) => sum + value, 0) / validMs.length) : 9999;
    const bestMs = validMs.length ? Math.min(...validMs) : 9999;
    const scoreMs = averageMs + tooEarlyCount * 1000;

    await context.env.DB
      .prepare(`
        INSERT OR REPLACE INTO duel_results (lobby_id, user_id, average_ms, best_ms, too_early_count, score_ms, rounds_json, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(lobbyId, auth.user.id, averageMs, bestMs, tooEarlyCount, scoreMs, JSON.stringify(normalized))
      .run();

    const results = await context.env.DB
      .prepare("SELECT user_id, average_ms, best_ms, too_early_count, score_ms FROM duel_results WHERE lobby_id = ?")
      .bind(lobbyId)
      .all();

    const players = results?.results || [];
    let completed = false;
    let winner: number | null = null;

    if (players.length >= 2) {
      const [a, b] = players;
      winner = Number(a.user_id);
      if (Number(b.score_ms) < Number(a.score_ms)) winner = Number(b.user_id);
      if (Number(b.score_ms) === Number(a.score_ms) && Number(b.best_ms) < Number(a.best_ms)) winner = Number(b.user_id);

      const update = await context.env.DB
        .prepare("UPDATE duel_lobbies SET status = 'completed', winner_user_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'")
        .bind(winner, lobbyId)
        .run();

      completed = Number(update?.meta?.changes || 0) > 0;

      if (completed) {
        await awardSystemCoins(context, winner, Number(lobby.reward_amount || 0), lobbyId);
      }
    }

    return Response.json({
      success: true,
      completed,
      winner_user_id: winner,
      message: completed
        ? `Düello tamamlandı. Kazanan ${lobby.reward_amount} sistem coin ödülü aldı.`
        : "Sonucun kaydedildi. Rakibin sonucu bekleniyor.",
    });
  } catch (error) {
    return Response.json({ error: "Düello sonucu kaydedilemedi." }, { status: 500 });
  }
}

async function awardSystemCoins(context: any, userId: number, amount: number, lobbyId: number) {
  if (!amount || amount < 1) return;

  try {
    const existing = await context.env.DB
      .prepare("SELECT id FROM coin_transactions WHERE reason = ? LIMIT 1")
      .bind(`tech_duel:${lobbyId}`)
      .first();

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

    await context.env.DB
      .prepare("INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)")
      .bind(userId, amount, `tech_duel:${lobbyId}`)
      .run();
  } catch {
    // Coin tabloları yoksa düello sonucu bozulmasın. Migration sonrası ödüller çalışır.
  }
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
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
