CREATE TABLE IF NOT EXISTS off_match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_label TEXT NOT NULL,
  lobby_table TEXT NOT NULL,
  lobby_id INTEGER NOT NULL,
  host_user_id INTEGER NOT NULL,
  opponent_user_id INTEGER,
  winner_user_id INTEGER,
  loser_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'completed',
  result_json TEXT,
  game_settings_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  duration_seconds INTEGER,
  season_id INTEGER,
  season_points_applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_off_match_history_game_lobby ON off_match_history(game_key, lobby_id);
CREATE INDEX IF NOT EXISTS idx_off_match_history_host_created ON off_match_history(host_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_off_match_history_opponent_created ON off_match_history(opponent_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_off_match_history_winner_created ON off_match_history(winner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_off_match_history_game_created ON off_match_history(game_key, created_at);
CREATE INDEX IF NOT EXISTS idx_off_match_history_season_created ON off_match_history(season_id, created_at);

CREATE TABLE IF NOT EXISTS off_cleanup_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_type TEXT NOT NULL,
  triggered_by_user_id INTEGER,
  expired_invites INTEGER NOT NULL DEFAULT 0,
  expired_lobbies INTEGER NOT NULL DEFAULT 0,
  abandoned_matches INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE duel_lobbies ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE duel_lobbies ADD COLUMN IF NOT EXISTS completed_at TEXT;
ALTER TABLE cipher_lobbies ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE cipher_lobbies ADD COLUMN IF NOT EXISTS completed_at TEXT;
ALTER TABLE core_clash_lobbies ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE core_clash_lobbies ADD COLUMN IF NOT EXISTS completed_at TEXT;
