CREATE TABLE IF NOT EXISTS off_game_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  game_key TEXT NOT NULL DEFAULT 'tech_duel',
  duel_mode TEXT NOT NULL DEFAULT 'classic',
  game_mode TEXT,
  round_count INTEGER NOT NULL DEFAULT 5,
  game_settings_json TEXT,
  target_route TEXT,
  lobby_table TEXT,
  accepted_lobby_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  lobby_id INTEGER,
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_off_game_invites_invitee_status_created ON off_game_invites(invitee_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_off_game_invites_inviter_status_created ON off_game_invites(inviter_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_off_game_invites_lobby_id ON off_game_invites(lobby_id);
CREATE INDEX IF NOT EXISTS idx_off_game_invites_game_mode_status ON off_game_invites(game_key, duel_mode, status);
CREATE INDEX IF NOT EXISTS idx_off_game_invites_game_status ON off_game_invites(game_key, status, created_at);
CREATE INDEX IF NOT EXISTS idx_off_game_invites_invitee_game_status ON off_game_invites(invitee_id, game_key, status, created_at);
CREATE INDEX IF NOT EXISTS idx_off_game_invites_inviter_game_status ON off_game_invites(inviter_id, game_key, status, created_at);
