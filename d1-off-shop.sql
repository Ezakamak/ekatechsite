CREATE TABLE IF NOT EXISTS off_shop_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_slug TEXT NOT NULL,
  item_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  roulette_value INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  acquired_at TEXT DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  roulette_bet_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_off_shop_inventory_user_status
  ON off_shop_inventory(user_id, status, id DESC);
