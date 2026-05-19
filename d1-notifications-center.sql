CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  category TEXT NOT NULL DEFAULT 'site',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  action_label TEXT,
  action_payload TEXT,
  source_table TEXT,
  source_id TEXT,
  priority TEXT DEFAULT 'normal',
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN category TEXT NOT NULL DEFAULT 'site';
ALTER TABLE notifications ADD COLUMN action_label TEXT;
ALTER TABLE notifications ADD COLUMN action_payload TEXT;
ALTER TABLE notifications ADD COLUMN source_table TEXT;
ALTER TABLE notifications ADD COLUMN source_id TEXT;
ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category_created ON notifications(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
