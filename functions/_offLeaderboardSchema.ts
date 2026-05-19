async function tableExists(context: any, tableName: string) {
  const row = await context.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function getColumns(context: any, tableName: string) {
  const exists = await tableExists(context, tableName);
  if (!exists) return new Set<string>();
  const cols = await context.env.DB.prepare(`PRAGMA table_info(${tableName})`).all<any>();
  return new Set((cols.results || []).map((c: any) => String(c.name)));
}

async function ensureColumn(context: any, tableName: string, colName: string, colSql: string) {
  const cols = await getColumns(context, tableName);
  if (!cols.has(colName)) {
    await context.env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${colSql}`).run();
  }
}

export async function ensureOffLeaderboardSchema(context: any) {
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_key TEXT NOT NULL,
    game_label TEXT,
    lobby_table TEXT,
    lobby_id INTEGER,
    host_user_id INTEGER NOT NULL,
    opponent_user_id INTEGER,
    winner_user_id INTEGER,
    loser_user_id INTEGER,
    season_id INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    result_json TEXT,
    game_settings_json TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_seconds INTEGER,
    season_points_applied INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_key, lobby_id)
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_cleanup_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dry_run INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    result_json TEXT
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_seasons (
    id INTEGER PRIMARY KEY,
    slug TEXT UNIQUE,
    name TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    starts_at TEXT,
    ends_at TEXT,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();

  await ensureColumn(context, 'off_seasons', 'slug', 'slug TEXT UNIQUE');
  await ensureColumn(context, 'off_seasons', 'name', 'name TEXT');
  await ensureColumn(context, 'off_seasons', 'description', 'description TEXT');
  await ensureColumn(context, 'off_seasons', 'status', "status TEXT NOT NULL DEFAULT 'active'");
  await ensureColumn(context, 'off_seasons', 'starts_at', 'starts_at TEXT');
  await ensureColumn(context, 'off_seasons', 'ends_at', 'ends_at TEXT');
  await ensureColumn(context, 'off_seasons', 'created_by_user_id', 'created_by_user_id INTEGER');
  await ensureColumn(context, 'off_seasons', 'created_at', "created_at TEXT NOT NULL DEFAULT (datetime('now'))");
  await ensureColumn(context, 'off_seasons', 'updated_at', "updated_at TEXT NOT NULL DEFAULT (datetime('now'))");

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_season_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL,
    match_history_id INTEGER NOT NULL,
    game_key TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(season_id, user_id, match_history_id)
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_leaderboard_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    total_matches INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    abandoned INTEGER NOT NULL DEFAULT 0,
    tech_duel_matches INTEGER NOT NULL DEFAULT 0,
    cipher_break_matches INTEGER NOT NULL DEFAULT 0,
    core_clash_matches INTEGER NOT NULL DEFAULT 0,
    win_rate REAL NOT NULL DEFAULT 0,
    last_match_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(season_id, user_id)
  )`).run();

  await context.env.DB.prepare(`INSERT INTO off_seasons (id, slug, name, status, description, created_at, updated_at)
    VALUES (0, 'all-time', 'All Time', 'active', 'All-time leaderboard season', datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET slug='all-time', name='All Time', status='active', updated_at=datetime('now')`).run();
}
