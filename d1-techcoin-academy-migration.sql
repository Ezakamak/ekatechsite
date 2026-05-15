-- EKA ACADEMY ile Tech Coin entegrasyonu için ek tablolar
-- Oluşturma tarihi: 2026-05-15

CREATE TABLE IF NOT EXISTS academy_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_user_id TEXT NOT NULL UNIQUE, -- oyun tarafındaki kullanıcı kimliği
  user_id INTEGER,                       -- tech_coin_wallets.user_id ile eşleşirse buraya yaz
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS techcoin_academy_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_account_id INTEGER,
  wallet_user_id INTEGER,    -- tech_coin_wallets.user_id
  direction TEXT NOT NULL,   -- 'to_game' veya 'from_game'
  amount INTEGER NOT NULL,
  reason TEXT,
  reference_id TEXT,         -- idempotency / oyun işlem numarası
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_account_id) REFERENCES academy_accounts(id),
  FOREIGN KEY (wallet_user_id) REFERENCES tech_coin_wallets(user_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_accounts_academy_user_id ON academy_accounts(academy_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_reference_id ON techcoin_academy_transfers(reference_id);
