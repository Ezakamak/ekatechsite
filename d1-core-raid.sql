CREATE TABLE IF NOT EXISTS core_raid_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_name TEXT NOT NULL DEFAULT 'GLITCH TITAN',
  max_hp INTEGER NOT NULL DEFAULT 10000,
  current_hp INTEGER NOT NULL DEFAULT 10000,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ends_at TEXT,
  defeated_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS core_raid_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  last_action_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES core_raid_events(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS core_raid_daily_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action_day TEXT NOT NULL,
  action_type TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  damage INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id, action_day, action_type),
  FOREIGN KEY (event_id) REFERENCES core_raid_events(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS core_raid_action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES core_raid_events(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS core_raid_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  tech_coin INTEGER NOT NULL DEFAULT 0,
  reward_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES core_raid_events(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_core_raid_events_status ON core_raid_events(status);
CREATE INDEX IF NOT EXISTS idx_core_raid_contributions_event ON core_raid_contributions(event_id, damage DESC);
CREATE INDEX IF NOT EXISTS idx_core_raid_contributions_user ON core_raid_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_core_raid_daily_user_day ON core_raid_daily_actions(user_id, action_day);
CREATE INDEX IF NOT EXISTS idx_core_raid_action_log_event ON core_raid_action_log(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_raid_rewards_event ON core_raid_rewards(event_id);
