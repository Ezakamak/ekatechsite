CREATE TABLE IF NOT EXISTS off_season_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  game_label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  points_multiplier REAL NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_games_unique ON off_season_games(season_id, game_key);

CREATE TABLE IF NOT EXISTS off_season_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  win_points INTEGER NOT NULL DEFAULT 30,
  loss_points INTEGER NOT NULL DEFAULT 10,
  draw_points INTEGER NOT NULL DEFAULT 15,
  daily_first_match_bonus INTEGER NOT NULL DEFAULT 0,
  streak_bonus_points INTEGER NOT NULL DEFAULT 0,
  streak_required INTEGER NOT NULL DEFAULT 3,
  max_daily_points INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_rules_unique ON off_season_rules(season_id);

CREATE TABLE IF NOT EXISTS off_season_missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL,
  game_key TEXT,
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_points INTEGER NOT NULL DEFAULT 0,
  cadence TEXT NOT NULL DEFAULT 'season',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_off_season_missions_season ON off_season_missions(season_id, enabled);

CREATE TABLE IF NOT EXISTS off_season_mission_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  mission_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  progress_value INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  reward_applied INTEGER NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL DEFAULT 'season',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_off_season_mission_progress_unique ON off_season_mission_progress(season_id, mission_id, user_id, period_key);

CREATE TABLE IF NOT EXISTS off_season_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_key TEXT,
  reward_label TEXT NOT NULL,
  reward_value INTEGER,
  requirement_type TEXT NOT NULL DEFAULT 'rank',
  requirement_value INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_off_season_rewards_season ON off_season_rewards(season_id, enabled);

CREATE TABLE IF NOT EXISTS off_season_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_off_season_audit_logs_season ON off_season_audit_logs(season_id, created_at);
