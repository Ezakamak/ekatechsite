CREATE TABLE IF NOT EXISTS duel_lobbies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_user_id INTEGER NOT NULL,
  opponent_user_id INTEGER,
  mode TEXT DEFAULT 'classic',
  reward_amount INTEGER NOT NULL DEFAULT 50,
  round_count INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'open',
  winner_user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_user_id) REFERENCES users(id),
  FOREIGN KEY (opponent_user_id) REFERENCES users(id),
  FOREIGN KEY (winner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS duel_results (
  lobby_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  average_ms INTEGER NOT NULL,
  best_ms INTEGER NOT NULL,
  too_early_count INTEGER DEFAULT 0,
  round_wins INTEGER DEFAULT 0,
  score_ms INTEGER NOT NULL,
  rounds_json TEXT,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lobby_id, user_id),
  FOREIGN KEY (lobby_id) REFERENCES duel_lobbies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS coin_wallets (
  user_id INTEGER PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_duel_lobbies_status ON duel_lobbies(status);
CREATE INDEX IF NOT EXISTS idx_duel_lobbies_creator ON duel_lobbies(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_duel_lobbies_opponent ON duel_lobbies(opponent_user_id);
CREATE INDEX IF NOT EXISTS idx_duel_lobbies_mode ON duel_lobbies(mode);
CREATE INDEX IF NOT EXISTS idx_duel_results_lobby ON duel_results(lobby_id);
CREATE INDEX IF NOT EXISTS idx_duel_results_user ON duel_results(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_reason ON coin_transactions(reason);

-- Existing DB migration checklist:
-- ALTER TABLE duel_lobbies ADD COLUMN mode TEXT DEFAULT 'classic';
-- UPDATE duel_lobbies SET mode = 'classic' WHERE mode IS NULL;
-- UPDATE duel_lobbies SET reward_amount = 50 WHERE reward_amount IS NULL OR reward_amount != 50;
-- DROP INDEX IF EXISTS idx_coin_transactions_reason;
-- CREATE INDEX IF NOT EXISTS idx_coin_transactions_reason ON coin_transactions(reason);
