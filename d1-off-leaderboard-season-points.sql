CREATE TABLE IF NOT EXISTS off_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TEXT,
  ends_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS off_season_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER NOT NULL,
  match_history_id INTEGER,
  game_key TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_points_unique_match_reason
ON off_season_points(user_id, match_history_id, reason);

CREATE INDEX IF NOT EXISTS idx_off_season_points_user_created
ON off_season_points(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_off_season_points_season_user
ON off_season_points(season_id, user_id);

CREATE INDEX IF NOT EXISTS idx_off_season_points_game_created
ON off_season_points(game_key, created_at);

CREATE TABLE IF NOT EXISTS off_leaderboard_snapshots (
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, user_id)
);

INSERT OR IGNORE INTO off_seasons (id, slug, name, status)
VALUES (0, 'all-time', 'All Time', 'active');
