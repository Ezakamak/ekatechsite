CREATE TABLE IF NOT EXISTS cipher_lobbies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_user_id INTEGER NOT NULL,
  opponent_user_id INTEGER,
  reward_amount INTEGER NOT NULL DEFAULT 40,
  round_count INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'open',
  winner_user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_user_id) REFERENCES users(id),
  FOREIGN KEY (opponent_user_id) REFERENCES users(id),
  FOREIGN KEY (winner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cipher_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lobby_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  target_code TEXT NOT NULL,
  options_json TEXT NOT NULL,
  tick_ms INTEGER NOT NULL DEFAULT 650,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  winner_user_id INTEGER,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lobby_id, round_number),
  FOREIGN KEY (lobby_id) REFERENCES cipher_lobbies(id),
  FOREIGN KEY (winner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cipher_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lobby_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  selected_code TEXT NOT NULL,
  correct INTEGER DEFAULT 0,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lobby_id, round_number, user_id),
  FOREIGN KEY (lobby_id) REFERENCES cipher_lobbies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cipher_lobbies_status ON cipher_lobbies(status);
CREATE INDEX IF NOT EXISTS idx_cipher_lobbies_creator ON cipher_lobbies(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_cipher_lobbies_opponent ON cipher_lobbies(opponent_user_id);
CREATE INDEX IF NOT EXISTS idx_cipher_rounds_lobby ON cipher_rounds(lobby_id);
CREATE INDEX IF NOT EXISTS idx_cipher_rounds_status ON cipher_rounds(status);
CREATE INDEX IF NOT EXISTS idx_cipher_submissions_lobby_round ON cipher_submissions(lobby_id, round_number);
CREATE INDEX IF NOT EXISTS idx_cipher_submissions_user ON cipher_submissions(user_id);
