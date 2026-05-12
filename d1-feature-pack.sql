-- EkaTech feature pack migration
-- Bu komutlar canlı D1 veritabanına yeni özellik tablolarını ekler.
-- ALTER TABLE satırlarında duplicate column name hatası alırsan o kolon zaten vardır; sonraki komuta geç.

-- Proje planlama alanları
ALTER TABLE project_requests ADD COLUMN priority TEXT DEFAULT 'normal';
ALTER TABLE project_requests ADD COLUMN target_date TEXT;

-- Her kullanıcı için bildirim merkezi
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON notifications(created_at);

-- Proje özel müşteri mesajları
CREATE TABLE IF NOT EXISTS project_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_request_id INTEGER NOT NULL,
  sender_user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_request_id) REFERENCES project_requests(id),
  FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_project_messages_project_id
ON project_messages(project_request_id);

-- Proje dosya/link alanı
CREATE TABLE IF NOT EXISTS project_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_request_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by_user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_request_id) REFERENCES project_requests(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_project_links_project_id
ON project_links(project_request_id);

-- Admin todo
CREATE TABLE IF NOT EXISTS admin_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  assigned_admin_id INTEGER,
  created_by_user_id INTEGER,
  is_done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_admin_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_todos_assigned_done
ON admin_todos(assigned_admin_id, is_done);

-- Müşteri memnuniyet puanı
CREATE TABLE IF NOT EXISTS project_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_request_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_request_id, user_id),
  FOREIGN KEY (project_request_id) REFERENCES project_requests(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_project_feedback_project_id
ON project_feedback(project_request_id);

-- Site bakım modu / genel ayarlar
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  is_active INTEGER DEFAULT 0,
  message TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (key, is_active, message)
VALUES ('maintenance_mode', 0, 'Site kısa süreli bakımda. Yakında tekrar aktif olacağız.');
