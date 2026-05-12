CREATE TABLE IF NOT EXISTS admin_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_created_at
ON admin_chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_user_id
ON admin_chat_messages(user_id);
