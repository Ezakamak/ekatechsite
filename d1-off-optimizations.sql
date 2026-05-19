-- OFF/D1 optimization migration
CREATE INDEX IF NOT EXISTS idx_friend_req_add_status ON off_friendships(requester_id, addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_add_req_status ON off_friendships(addressee_id, requester_id, status);

CREATE TABLE IF NOT EXISTS off_user_presence (
  user_id INTEGER PRIMARY KEY,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_off_user_presence_last_seen_at ON off_user_presence(last_seen_at);

CREATE TABLE IF NOT EXISTS off_titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  rarity TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS off_user_titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title_code TEXT NOT NULL,
  unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, title_code)
);
CREATE INDEX IF NOT EXISTS idx_off_user_titles_user_id ON off_user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_off_user_titles_title_code ON off_user_titles(title_code);

INSERT OR IGNORE INTO off_titles (code, name, description, rarity) VALUES
  ('first_win', 'İlk Zafer', 'İlk galibiyetini aldın', 'common'),
  ('sharp_reflex', 'Keskin Refleks', 'Hızlı reaksiyon ustası', 'rare'),
  ('coin_guardian', 'Coin Muhafızı', 'Coinlerini iyi korursun', 'rare'),
  ('tower_climber', 'Kule Tırmanıcısı', 'Towers oyununda yükseğe çıktın', 'epic'),
  ('mines_survivor', 'Mayın Kaçkını', 'Mines'ta hayatta kaldın', 'epic'),
  ('lucky_core', 'Şanslı Çekirdek', 'Şans seninle', 'legendary'),
  ('off_legend', 'OFF Efsanesi', 'OFF dünyasının efsanesi', 'mythic');

UPDATE off_profiles SET avatar_data = NULL, banner_data = NULL;
