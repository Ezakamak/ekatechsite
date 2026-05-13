const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const FIXED_REWARD_AMOUNT = 50;
const ROUND_OPTIONS = [3, 5, 7];
const MODE_OPTIONS = ["classic", "best_focus", "what_the_hold"];
const OFF_ROLES = ["off", "admin", "owner"];

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await expireOldOpenLobbies(context);

    const open = await context.env.DB
      .prepare(`
        SELECT
          duel_lobbies.id,
          duel_lobbies.creator_user_id,
          duel_lobbies.opponent_user_id,
          COALESCE(duel_lobbies.mode, 'classic') AS mode,
          duel_lobbies.reward_amount,
          duel_lobbies.round_count,
          duel_lobbies.status,
          duel_lobbies.winner_user_id,
          duel_lobbies.created_at,
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
        WHERE duel_lobbies.status IN ('open', 'in_progress')
        ORDER BY duel_lobbies.id DESC
        LIMIT 30
      `)
      .all();

    const mine = await context.env.DB
      .prepare(`
        SELECT
          duel_lobbies.id,
          duel_lobbies.creator_user_id,
          duel_lobbies.opponent_user_id,
          COALESCE(duel_lobbies.mode, 'classic') AS mode,
          duel_lobbies.reward_amount,
          duel_lobbies.round_count,
          duel_lobbies.status,
          duel_lobbies.winner_user_id,
          duel_lobbies.created_at,
          creator.name AS creator_name,
          creator.email AS creator_email,
          creator.avatar_url AS creator_avatar_url,
          opponent.name AS opponent_name,
          opponent.email AS opponent_email,
          opponent.avatar_url AS opponent_avatar_url,
          winner.name AS winner_name,
          my_result.average_ms AS my_average_ms,
          my_result.best_ms AS my_best_ms,
          my_result.too_early_count AS my_too_early_count,
          my_result.round_wins AS my_round_wins
        FROM duel_lobbies
        JOIN users AS creator ON duel_lobbies.creator_user_id = creator.id
        LEFT JOIN users AS opponent ON duel_lobbies.opponent_user_id = opponent.id
        LEFT JOIN users AS winner ON duel_lobbies.winner_user_id = winner.id
        LEFT JOIN duel_results AS my_result ON my_result.lobby_id = duel_lobbies.id AND my_result.user_id = ?
        WHERE duel_lobbies.creator_user_id = ? OR duel_lobbies.opponent_user_id = ?
        ORDER BY duel_lobbies.id DESC
        LIMIT 20
      `)
      .bind(auth.user.id, auth.user.id, auth.user.id)
      .all();

    return Response.json({ user: auth.user, open: open?.results || [], mine: mine?.results || [] });
  } catch (error) {
    return Response.json({ error: "Tech Duel verileri alınamadı. duel_lobbies tablosunda mode kolonu olduğundan emin ol." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await context.request.json().catch(() => null);
    const roundCount = Number(body?.round_count || 5);
    const mode = String(body?.mode || "classic").trim();

    if (!MODE_OPTIONS.includes(mode)) {
      return Response.json({ error: "Oyun modu classic, best_focus veya what_the_hold olabilir." }, { status: 400 });
    }

    if (!ROUND_OPTIONS.includes(roundCount)) {
      return Response.json({ error: "Round sayısı 3, 5 veya 7 olabilir." }, { status: 400 });
    }

    const limitResult = await checkSimpleLimit(context, `duel-create:${auth.user.id}`, 10, 60);
    if (!limitResult.ok) {
      return Response.json({ error: "Çok hızlı lobby oluşturuyorsun. Biraz bekle." }, { status: 429 });
    }

    const existingOpen = await context.env.DB
      .prepare("SELECT id FROM duel_lobbies WHERE creator_user_id = ? AND status = 'open' LIMIT 1")
      .bind(auth.user.id)
      .first();

    if (existingOpen) {
      return Response.json({ error: "Zaten açık bir lobby'n var. Önce onu tamamla veya başka biri katılsın." }, { status: 409 });
    }

    const result = await context.env.DB
      .prepare(`
        INSERT INTO duel_lobbies (creator_user_id, mode, reward_amount, round_count, status)
        VALUES (?, ?, ?, ?, 'open')
      `)
      .bind(auth.user.id, mode, FIXED_REWARD_AMOUNT, roundCount)
      .run();

    return Response.json({ success: true, message: "Tech Duel lobby oluşturuldu.", lobby_id: result?.meta?.last_row_id });
  } catch (error) {
    return Response.json({ error: "Lobby oluşturulamadı. duel_lobbies tablosuna mode kolonu eklediğinden emin ol." }, { status: 500 });
  }
}

async function expireOldOpenLobbies(context: any) {
  await context.env.DB
    .prepare("UPDATE duel_lobbies SET status = 'expired', updated_at = datetime('now') WHERE status = 'open' AND created_at < datetime('now', '-2 hours')")
    .run();
}

async function requireUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        users.avatar_url,
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

async function checkSimpleLimit(context: any, key: string, limit: number, windowSeconds: number) {
  try {
    const now = Date.now();
    const resetAt = new Date(now + windowSeconds * 1000).toISOString();
    const existing = await context.env.DB.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();
    if (!existing || new Date(existing.reset_at).getTime() <= now) {
      await context.env.DB.prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)").bind(key, resetAt).run();
      return { ok: true };
    }
    if (Number(existing.count || 0) >= limit) return { ok: false };
    await context.env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
