CREATE TABLE IF NOT EXISTS tech_roulette_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  bet_type TEXT NOT NULL,
  bet_value TEXT,
  bet_amount INTEGER NOT NULL,
  winning_number INTEGER NOT NULL,
  winning_color TEXT NOT NULL,
  winning_parity TEXT NOT NULL,
  payout_multiplier INTEGER NOT NULL DEFAULT 0,
  payout_amount INTEGER NOT NULL DEFAULT 0,
  profit_amount INTEGER NOT NULL DEFAULT 0,
  wallet_before REAL NOT NULL DEFAULT 0,
  wallet_after REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tech_roulette_logs_user_created
  ON tech_roulette_logs(user_id, created_at DESC);
