CREATE TABLE IF NOT EXISTS tech_roulette_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'betting',
  betting_started_at INTEGER NOT NULL,
  spins_at INTEGER NOT NULL,
  winning_number INTEGER,
  winning_color TEXT,
  winning_parity TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS tech_roulette_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  bet_type TEXT NOT NULL,
  bet_value TEXT,
  bet_amount INTEGER NOT NULL,
  stake_type TEXT NOT NULL DEFAULT 'coin',
  stake_item_id INTEGER,
  stake_item_label TEXT,
  winning_number INTEGER,
  payout_multiplier INTEGER NOT NULL DEFAULT 0,
  payout_amount INTEGER NOT NULL DEFAULT 0,
  profit_amount INTEGER NOT NULL DEFAULT 0,
  wallet_before REAL NOT NULL DEFAULT 0,
  wallet_after REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS tech_roulette_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER,
  user_id INTEGER NOT NULL,
  bet_type TEXT NOT NULL,
  bet_value TEXT,
  bet_amount INTEGER NOT NULL,
  stake_type TEXT NOT NULL DEFAULT 'coin',
  stake_item_id INTEGER,
  stake_item_label TEXT,
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

CREATE INDEX IF NOT EXISTS idx_tech_roulette_rounds_status_spins
  ON tech_roulette_rounds(status, spins_at);

CREATE INDEX IF NOT EXISTS idx_tech_roulette_bets_round
  ON tech_roulette_bets(round_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tech_roulette_bets_user_round
  ON tech_roulette_bets(user_id, round_id);

CREATE INDEX IF NOT EXISTS idx_tech_roulette_logs_user_created
  ON tech_roulette_logs(user_id, created_at DESC);


CREATE TABLE IF NOT EXISTS tech_roulette_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tech_roulette_chat_created
  ON tech_roulette_chat_messages(created_at DESC);
