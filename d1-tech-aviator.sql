-- Tech Aviator shared SQL round engine
CREATE TABLE IF NOT EXISTS tech_aviator_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id TEXT UNIQUE NOT NULL,
  crash_point REAL NOT NULL,
  hash TEXT,
  server_seed TEXT,
  salt TEXT,
  betting_started_at INTEGER,
  flight_started_at INTEGER,
  crashed_at INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tech_aviator_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  round_id TEXT NOT NULL,
  panel_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  cashout_multiplier REAL,
  payout REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, round_id, panel_id)
);

CREATE INDEX IF NOT EXISTS idx_tech_aviator_rounds_timing ON tech_aviator_rounds(betting_started_at, crashed_at);
CREATE INDEX IF NOT EXISTS idx_tech_aviator_rounds_created ON tech_aviator_rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_tech_aviator_bets_user_round ON tech_aviator_bets(user_id, round_id);
