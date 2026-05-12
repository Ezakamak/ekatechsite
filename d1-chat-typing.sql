CREATE TABLE IF NOT EXISTS admin_chat_typing (
  user_id INTEGER PRIMARY KEY,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_typing_expires_at
ON admin_chat_typing(expires_at);
