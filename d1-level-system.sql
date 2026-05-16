-- EkaTech OFF Hub level / EXP system
CREATE TABLE IF NOT EXISTS user_levels (
  user_id INTEGER PRIMARY KEY,
  exp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_exp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  difficulty TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_exp_events_user_created
  ON user_exp_events(user_id, created_at DESC);
