CREATE TABLE IF NOT EXISTS core_clash_lobbies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_user_id INTEGER NOT NULL,
  opponent_user_id INTEGER,
  map_key TEXT NOT NULL DEFAULT 'firewall_city',
  status TEXT NOT NULL DEFAULT 'open',
  winner_user_id INTEGER,
  turn_number INTEGER NOT NULL DEFAULT 0,
  deadline_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_user_id) REFERENCES users(id),
  FOREIGN KEY (opponent_user_id) REFERENCES users(id),
  FOREIGN KEY (winner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS core_clash_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lobby_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  hp INTEGER NOT NULL DEFAULT 60,
  energy INTEGER NOT NULL DEFAULT 3,
  heat INTEGER NOT NULL DEFAULT 0,
  deck_json TEXT NOT NULL DEFAULT '[]',
  hand_json TEXT NOT NULL DEFAULT '[]',
  discard_json TEXT NOT NULL DEFAULT '[]',
  entered_at TEXT,
  energy_delta_next INTEGER NOT NULL DEFAULT 0,
  draw_block_next INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lobby_id, user_id),
  UNIQUE(lobby_id, side),
  FOREIGN KEY (lobby_id) REFERENCES core_clash_lobbies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS core_clash_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lobby_id INTEGER NOT NULL,
  turn_number INTEGER NOT NULL,
  creator_card_id TEXT,
  opponent_card_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  resolution TEXT,
  deadline_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  UNIQUE(lobby_id, turn_number),
  FOREIGN KEY (lobby_id) REFERENCES core_clash_lobbies(id)
);

CREATE INDEX IF NOT EXISTS idx_core_clash_lobbies_status ON core_clash_lobbies(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_clash_lobbies_creator ON core_clash_lobbies(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_core_clash_lobbies_opponent ON core_clash_lobbies(opponent_user_id);
CREATE INDEX IF NOT EXISTS idx_core_clash_players_lobby ON core_clash_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_core_clash_turns_lobby ON core_clash_turns(lobby_id, turn_number DESC);
