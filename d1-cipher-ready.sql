CREATE TABLE IF NOT EXISTS cipher_round_ready (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lobby_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  ready_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lobby_id, round_number, user_id),
  FOREIGN KEY (lobby_id) REFERENCES cipher_lobbies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cipher_round_ready_lobby_round
ON cipher_round_ready(lobby_id, round_number);

CREATE INDEX IF NOT EXISTS idx_cipher_round_ready_user
ON cipher_round_ready(user_id);
