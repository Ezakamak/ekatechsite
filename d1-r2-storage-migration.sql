CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id);

CREATE TABLE IF NOT EXISTS storage_quota (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  used_bytes INTEGER NOT NULL DEFAULT 0,
  max_bytes INTEGER NOT NULL DEFAULT 8000000000,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO storage_quota (id, used_bytes, max_bytes, updated_at)
VALUES (1, 0, 8000000000, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

ALTER TABLE off_profiles ADD COLUMN avatar_data TEXT;
ALTER TABLE off_profiles ADD COLUMN banner_data TEXT;
