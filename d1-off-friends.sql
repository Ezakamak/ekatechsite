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
