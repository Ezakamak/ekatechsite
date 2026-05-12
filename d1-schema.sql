-- EkaTech D1 schema / migration checklist
-- Bu dosya canlı D1 veritabanını sıfırlamadan eksik tabloları oluşturmak için hazırlandı.
-- ALTER TABLE satırlarında duplicate column name hatası alırsan o satır zaten uygulanmış demektir.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'client',
  email_verified INTEGER DEFAULT 0,
  avatar_url TEXT,
  avatar_approved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pending_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL,
  budget_range TEXT,
  deadline TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'received',
  assigned_admin_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_admin_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_type TEXT NOT NULL,
  message TEXT,
  image_url TEXT,
  expires_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  reset_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  target_label TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_project_requests_user_id ON project_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_project_requests_assigned_admin_id ON project_requests(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active_expires ON announcements(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);

-- Mevcut eski tablolara kolon eklemek için gerekirse tek tek çalıştır:
-- ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'client';
-- ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN avatar_url TEXT;
-- ALTER TABLE users ADD COLUMN avatar_approved INTEGER DEFAULT 0;
-- ALTER TABLE project_requests ADD COLUMN assigned_admin_id INTEGER;

-- Owner hesabını garantiye almak için:
UPDATE users
SET role = 'owner', email_verified = 1, avatar_approved = 1
WHERE lower(email) = 'emirkaganaksu02@gmail.com';

-- Owner dışındaki adminler, owner onayı almadan sipariş yönetemesin:
UPDATE users
SET avatar_approved = 0
WHERE role = 'admin' AND lower(email) != 'emirkaganaksu02@gmail.com';
