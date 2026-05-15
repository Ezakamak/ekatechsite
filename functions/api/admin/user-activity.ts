const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

type ActivityItem = {
  type: string;
  title: string;
  detail: string;
  created_at: string | null;
  amount?: number | null;
  status?: string | null;
};

export async function onRequestGet(context: any) {
  const admin = await requireAdminOrOwner(context);
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });

  try {
    const url = new URL(context.request.url);
    const userId = Number(url.searchParams.get("user_id") || 0);

    if (userId) {
      return Response.json(await buildUserDetail(context, userId));
    }

    return Response.json(await buildUserList(context));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kullanıcı aktivitesi alınamadı." }, { status: 500 });
  }
}

async function buildUserList(context: any) {
  const users = await context.env.DB.prepare(`
    SELECT
      id,
      name,
      email,
      avatar_url,
      created_at,
      CASE WHEN lower(email) = ? THEN 'owner' ELSE COALESCE(role, 'client') END AS role
    FROM users
    ORDER BY id DESC
    LIMIT 150
  `).bind(OWNER_EMAIL).all();

  const enriched = [];
  for (const user of users?.results || []) {
    const userId = Number(user.id);
    const [lastLoginAt, wallet, gameStats, marketStats, lastActivityAt] = await Promise.all([
      getLastLoginAt(context, userId),
      getWalletSummary(context, userId),
      getGameSummary(context, userId),
      getMarketSummary(context, userId),
      getLastActivityAt(context, userId),
    ]);

    enriched.push({
      ...user,
      last_login_at: lastLoginAt,
      last_activity_at: lastActivityAt,
      wallet,
      game_stats: gameStats,
      market_stats: marketStats,
    });
  }

  return { users: enriched };
}

async function buildUserDetail(context: any, userId: number) {
  const user = await context.env.DB.prepare(`
    SELECT
      id,
      name,
      email,
      avatar_url,
      created_at,
      CASE WHEN lower(email) = ? THEN 'owner' ELSE COALESCE(role, 'client') END AS role
    FROM users
    WHERE id = ?
  `).bind(OWNER_EMAIL, userId).first();

  if (!user) return { error: "Kullanıcı bulunamadı." };

  const [lastLoginAt, wallet, gameStats, marketStats, holdings, loginHistory, timeline] = await Promise.all([
    getLastLoginAt(context, userId),
    getWalletSummary(context, userId),
    getGameSummary(context, userId),
    getMarketSummary(context, userId),
    getHoldings(context, userId),
    getLoginHistory(context, userId),
    getTimeline(context, userId),
  ]);

  return {
    user,
    last_login_at: lastLoginAt,
    wallet,
    game_stats: gameStats,
    market_stats: marketStats,
    holdings,
    login_history: loginHistory,
    timeline,
  };
}

async function getLastLoginAt(context: any, userId: number) {
  if (!(await tableExists(context, "sessions"))) return null;
  const columns = await columnsOf(context, "sessions");
  const dateColumn = pickColumn(columns, ["created_at", "updated_at", "last_seen_at", "expires_at"]);
  if (!dateColumn || !columns.has("user_id")) return null;
  const row = await context.env.DB.prepare(`SELECT MAX(${quoteIdent(dateColumn)}) AS value FROM sessions WHERE user_id = ?`).bind(userId).first();
  return row?.value || null;
}

async function getLoginHistory(context: any, userId: number) {
  if (!(await tableExists(context, "sessions"))) return [];
  const columns = await columnsOf(context, "sessions");
  const dateColumn = pickColumn(columns, ["created_at", "updated_at", "last_seen_at", "expires_at"]);
  if (!dateColumn || !columns.has("user_id")) return [];

  const selectExpires = columns.has("expires_at") ? "expires_at" : "NULL AS expires_at";
  const rows = await context.env.DB.prepare(`
    SELECT ${quoteIdent(dateColumn)} AS created_at, ${selectExpires}
    FROM sessions
    WHERE user_id = ?
    ORDER BY ${quoteIdent(dateColumn)} DESC
    LIMIT 8
  `).bind(userId).all();
  return rows?.results || [];
}

async function getWalletSummary(context: any, userId: number) {
  if (!(await tableExists(context, "coin_wallets"))) return { balance: 0, lifetime_earned: 0 };
  const row = await context.env.DB.prepare("SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?").bind(userId).first();
  return {
    balance: Number(row?.balance || 0),
    lifetime_earned: Number(row?.lifetime_earned || 0),
    updated_at: row?.updated_at || null,
  };
}

async function getMarketSummary(context: any, userId: number) {
  if (!(await tableExists(context, "market_transactions"))) {
    return { buys: 0, sells: 0, buy_total: 0, sell_total: 0, trades: 0, last_trade_at: null };
  }

  const row = await context.env.DB.prepare(`
    SELECT
      COUNT(*) AS trades,
      SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) AS buys,
      SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) AS sells,
      SUM(CASE WHEN side = 'buy' THEN total ELSE 0 END) AS buy_total,
      SUM(CASE WHEN side = 'sell' THEN total ELSE 0 END) AS sell_total,
      MAX(created_at) AS last_trade_at
    FROM market_transactions
    WHERE user_id = ?
  `).bind(userId).first();

  return {
    trades: Number(row?.trades || 0),
    buys: Number(row?.buys || 0),
    sells: Number(row?.sells || 0),
    buy_total: Number(row?.buy_total || 0),
    sell_total: Number(row?.sell_total || 0),
    net_flow: Number(row?.sell_total || 0) - Number(row?.buy_total || 0),
    last_trade_at: row?.last_trade_at || null,
  };
}

async function getHoldings(context: any, userId: number) {
  if (!(await tableExists(context, "market_holdings"))) return [];
  const hasStocks = await tableExists(context, "market_stocks");
  if (hasStocks) {
    const rows = await context.env.DB.prepare(`
      SELECT h.symbol, h.shares, s.name, s.price, ROUND(h.shares * s.price, 2) AS value, h.updated_at
      FROM market_holdings h
      LEFT JOIN market_stocks s ON s.symbol = h.symbol
      WHERE h.user_id = ? AND h.shares > 0
      ORDER BY value DESC
      LIMIT 20
    `).bind(userId).all();
    return rows?.results || [];
  }

  const rows = await context.env.DB.prepare(`
    SELECT symbol, shares, updated_at
    FROM market_holdings
    WHERE user_id = ? AND shares > 0
    ORDER BY shares DESC
    LIMIT 20
  `).bind(userId).all();
  return rows?.results || [];
}

async function getGameSummary(context: any, userId: number) {
  const games = [
    { key: "tech_duel", label: "Tech Duel", table: "duel_lobbies" },
    { key: "cipher", label: "Cipher Break", table: "cipher_lobbies" },
    { key: "core_clash", label: "Core Clash", table: "core_clash_lobbies" },
  ];

  const result: Record<string, any> = {};
  for (const game of games) {
    if (!(await tableExists(context, game.table))) {
      result[game.key] = { label: game.label, played: 0, wins: 0, losses: 0, draws: 0, last_played_at: null };
      continue;
    }

    const columns = await columnsOf(context, game.table);
    if (!columns.has("creator_user_id") || !columns.has("opponent_user_id")) {
      result[game.key] = { label: game.label, played: 0, wins: 0, losses: 0, draws: 0, last_played_at: null };
      continue;
    }

    const winnerColumn = columns.has("winner_user_id") ? "winner_user_id" : "NULL";
    const statusColumn = columns.has("status") ? "status" : "''";
    const updatedColumn = pickColumn(columns, ["updated_at", "completed_at", "created_at"]);
    const maxUpdated = updatedColumn ? `MAX(${quoteIdent(updatedColumn)}) AS last_played_at` : "NULL AS last_played_at";

    const row = await context.env.DB.prepare(`
      SELECT
        COUNT(*) AS played,
        SUM(CASE WHEN ${winnerColumn} = ? THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN ${winnerColumn} IS NOT NULL AND ${winnerColumn} != ? THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN ${statusColumn} = 'completed' AND ${winnerColumn} IS NULL THEN 1 ELSE 0 END) AS draws,
        ${maxUpdated}
      FROM ${quoteIdent(game.table)}
      WHERE creator_user_id = ? OR opponent_user_id = ?
    `).bind(userId, userId, userId, userId).first();

    result[game.key] = {
      label: game.label,
      played: Number(row?.played || 0),
      wins: Number(row?.wins || 0),
      losses: Number(row?.losses || 0),
      draws: Number(row?.draws || 0),
      last_played_at: row?.last_played_at || null,
    };
  }

  return result;
}

async function getLastActivityAt(context: any, userId: number) {
  const candidates: Array<string | null> = [];
  candidates.push(await getLastLoginAt(context, userId));

  const market = await getMarketSummary(context, userId);
  candidates.push(market.last_trade_at);

  const games = await getGameSummary(context, userId);
  Object.values(games).forEach((game: any) => candidates.push(game.last_played_at || null));

  if (await tableExists(context, "coin_transactions")) {
    const row = await context.env.DB.prepare("SELECT MAX(created_at) AS value FROM coin_transactions WHERE user_id = ?").bind(userId).first();
    candidates.push(row?.value || null);
  }

  return candidates.filter(Boolean).sort().reverse()[0] || null;
}

async function getTimeline(context: any, userId: number) {
  const items: ActivityItem[] = [];

  if (await tableExists(context, "market_transactions")) {
    const rows = await context.env.DB.prepare(`
      SELECT side, symbol, quantity, price, total, created_at
      FROM market_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).bind(userId).all();

    for (const row of rows?.results || []) {
      items.push({
        type: "market",
        title: row.side === "buy" ? "Hisse aldı" : "Hisse sattı",
        detail: `${row.symbol} · ${row.quantity} adet · ${formatNumber(row.total)} Tech Coin`,
        amount: Number(row.total || 0),
        created_at: row.created_at || null,
      });
    }
  }

  if (await tableExists(context, "coin_transactions")) {
    const rows = await context.env.DB.prepare(`
      SELECT amount, reason, created_at
      FROM coin_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).bind(userId).all();

    for (const row of rows?.results || []) {
      items.push({
        type: "coin",
        title: Number(row.amount || 0) >= 0 ? "Tech Coin kazandı" : "Tech Coin harcadı",
        detail: `${Number(row.amount || 0) >= 0 ? "+" : ""}${formatNumber(row.amount)} · ${row.reason || "İşlem"}`,
        amount: Number(row.amount || 0),
        created_at: row.created_at || null,
      });
    }
  }

  await pushGameTimeline(context, items, userId, "duel_lobbies", "Tech Duel");
  await pushGameTimeline(context, items, userId, "cipher_lobbies", "Cipher Break");
  await pushGameTimeline(context, items, userId, "core_clash_lobbies", "Core Clash");

  return items
    .filter((item) => item.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 60);
}

async function pushGameTimeline(context: any, items: ActivityItem[], userId: number, table: string, label: string) {
  if (!(await tableExists(context, table))) return;

  const columns = await columnsOf(context, table);
  if (!columns.has("creator_user_id") || !columns.has("opponent_user_id")) return;

  const selectParts = [
    columns.has("id") ? "id" : "NULL AS id",
    columns.has("status") ? "status" : "'' AS status",
    columns.has("winner_user_id") ? "winner_user_id" : "NULL AS winner_user_id",
    columns.has("reward_amount") ? "reward_amount" : "NULL AS reward_amount",
    columns.has("created_at") ? "created_at" : "NULL AS created_at",
    columns.has("updated_at") ? "updated_at" : columns.has("completed_at") ? "completed_at AS updated_at" : "NULL AS updated_at",
    "creator_user_id",
    "opponent_user_id",
  ];

  const orderColumn = pickColumn(columns, ["updated_at", "completed_at", "created_at", "id"]);
  const orderSql = orderColumn ? `ORDER BY ${quoteIdent(orderColumn)} DESC` : "";

  const rows = await context.env.DB.prepare(`
    SELECT ${selectParts.join(", ")}
    FROM ${quoteIdent(table)}
    WHERE creator_user_id = ? OR opponent_user_id = ?
    ${orderSql}
    LIMIT 20
  `).bind(userId, userId).all();

  for (const row of rows?.results || []) {
    const completed = row.status === "completed";
    const won = completed && Number(row.winner_user_id || 0) === Number(userId);
    const lost = completed && row.winner_user_id && Number(row.winner_user_id) !== Number(userId);
    const draw = completed && !row.winner_user_id;
    const rewardText = row.reward_amount ? ` · ödül ${row.reward_amount}` : "";

    items.push({
      type: "game",
      title: `${label} ${won ? "kazandı" : lost ? "kaybetti" : draw ? "berabere" : "oynadı"}`,
      detail: `Lobby #${row.id || "?"} · ${row.status || "unknown"}${rewardText}`,
      status: row.status || null,
      created_at: row.updated_at || row.created_at || null,
    });
  }
}

async function tableExists(context: any, table: string) {
  const row = await context.env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first();
  return Boolean(row?.name);
}

async function columnsOf(context: any, table: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  return new Set((rows?.results || []).map((row: any) => String(row.name || "")));
}

function pickColumn(columns: Set<string>, names: string[]) {
  return names.find((name) => columns.has(name)) || null;
}

function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatNumber(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString("tr-TR") : "0";
}

async function requireAdminOrOwner(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(`
    SELECT
      users.id,
      users.name,
      users.email,
      users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 1 ELSE COALESCE(users.avatar_approved, 0) END AS avatar_approved,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, OWNER_EMAIL, token).first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (user.role !== "admin" && user.role !== "owner") return { ok: false, status: 403, error: "Bu alan sadece yöneticiler içindir." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
