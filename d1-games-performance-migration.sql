-- Games runtime schema moved to migration (idempotent)
CREATE TABLE IF NOT EXISTS coin_wallets (
  user_id INTEGER PRIMARY KEY,
  balance REAL DEFAULT 100,
  lifetime_earned REAL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tech_fair_commitments (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  server_seed TEXT NOT NULL,
  server_hash TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tech_dice_rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  target_number REAL NOT NULL,
  rolled_number REAL NOT NULL,
  amount INTEGER NOT NULL,
  multiplier REAL NOT NULL,
  win_chance REAL NOT NULL,
  reward_amount INTEGER DEFAULT 0,
  net_amount INTEGER DEFAULT 0,
  result TEXT NOT NULL,
  server_seed TEXT,
  server_hash TEXT,
  client_seed TEXT,
  nonce INTEGER,
  result_hmac TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tech_blackjack_rounds (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  server_seed TEXT NOT NULL,
  server_hash TEXT NOT NULL,
  client_seed TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  deck_hmac TEXT NOT NULL,
  deck_order TEXT NOT NULL,
  used_deck TEXT,
  settled_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tech_blackjack_hands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  result_type TEXT NOT NULL,
  player_score INTEGER DEFAULT 0,
  dealer_score INTEGER DEFAULT 0,
  bet_amount INTEGER DEFAULT 0,
  net_amount INTEGER DEFAULT 0,
  payout_amount INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created ON coin_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tech_dice_rolls_user_created ON tech_dice_rolls(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tech_blackjack_hands_user_created ON tech_blackjack_hands(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tech_blackjack_rounds_user_created ON tech_blackjack_rounds(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tech_aviator_bets_user_round_status ON tech_aviator_bets(user_id, round_id, status);
CREATE INDEX IF NOT EXISTS idx_tech_aviator_rounds_timing ON tech_aviator_rounds(betting_started_at, crashed_at);
