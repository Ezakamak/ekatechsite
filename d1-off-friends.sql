-- OFF Hub Friends MVP
CREATE TABLE IF NOT EXISTS off_friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL,
  addressee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_id, addressee_id),
  CHECK (status IN ('pending','accepted','rejected','blocked')),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_off_friendships_requester_id ON off_friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_off_friendships_addressee_id ON off_friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_off_friendships_status ON off_friendships(status);

CREATE TABLE IF NOT EXISTS off_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  selected_title TEXT,
  selected_badge TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_off_profiles_user_id ON off_profiles(user_id);
