-- EkaTech OFF / Tech Coin migration
-- Tech Coin sadece admin/owner için site içi eğlence puanıdır.

CREATE TABLE IF NOT EXISTS tech_coin_wallets (
  user_id INTEGER PRIMARY KEY,
  balance INTEGER DEFAULT 100,
  lifetime_earned INTEGER DEFAULT 0,
  best_round INTEGER DEFAULT 0,
  perfect_clears INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tech_coin_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  round_gain INTEGER DEFAULT 0,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tech_coin_events_user_created
ON tech_coin_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tech_coin_wallets_balance
ON tech_coin_wallets(balance);
