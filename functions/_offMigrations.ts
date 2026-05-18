import { addColumnIfMissing, ensureCoinTables, quoteIdent } from "./_coinWallet";
import { ensureLevelTables } from "./_levels";

export const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

export async function ensureOffTables(context: any) {
  await ensureCoinTables(context);
  await ensureLevelTables(context);

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_user_profiles (
    user_id INTEGER PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    favorite_game TEXT,
    equipped_frame_slug TEXT,
    equipped_avatar_glow_slug TEXT,
    equipped_name_tag_slug TEXT,
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    perfect_rounds INTEGER DEFAULT 0,
    best_reaction_ms INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  for (const [column, definition] of [
    ["display_name", "TEXT"], ["avatar_url", "TEXT"], ["favorite_game", "TEXT"],
    ["equipped_frame_slug", "TEXT"], ["equipped_avatar_glow_slug", "TEXT"], ["equipped_name_tag_slug", "TEXT"],
    ["total_matches", "INTEGER DEFAULT 0"], ["wins", "INTEGER DEFAULT 0"], ["losses", "INTEGER DEFAULT 0"],
    ["perfect_rounds", "INTEGER DEFAULT 0"], ["best_reaction_ms", "INTEGER"], ["updated_at", "TEXT"],
  ]) await addColumnIfMissing(context, "off_user_profiles", column, definition);

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, title_tr TEXT, title_en TEXT, description_tr TEXT, description_en TEXT,
    type TEXT, target_type TEXT, target_game TEXT, target_count INTEGER DEFAULT 1, reward_exp INTEGER DEFAULT 0,
    reward_points INTEGER DEFAULT 0, reward_badge_slug TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_user_quest_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, quest_slug TEXT NOT NULL, period_key TEXT NOT NULL,
    current_count INTEGER DEFAULT 0, target_count INTEGER DEFAULT 1, completed_at TEXT, claimed_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quest_slug, period_key)
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, title_tr TEXT, title_en TEXT, description_tr TEXT, description_en TEXT,
    icon TEXT, rarity TEXT, condition_type TEXT, condition_value INTEGER, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, badge_slug TEXT NOT NULL, unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP, source TEXT,
    UNIQUE(user_id, badge_slug)
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_cosmetics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name_tr TEXT, name_en TEXT, description_tr TEXT, description_en TEXT,
    category TEXT, rarity TEXT, cost_points INTEGER DEFAULT 0, preview_data TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_user_cosmetics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, cosmetic_slug TEXT NOT NULL, acquired_at TEXT DEFAULT CURRENT_TIMESTAMP, equipped INTEGER DEFAULT 0,
    UNIQUE(user_id, cosmetic_slug)
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name_tr TEXT, name_en TEXT, starts_at TEXT, ends_at TEXT,
    is_active INTEGER DEFAULT 0, archived_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT UNIQUE, game_key TEXT NOT NULL, season_id INTEGER, status TEXT NOT NULL,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP, ended_at TEXT, winner_user_id INTEGER, metadata_json TEXT
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL, user_id INTEGER NOT NULL, result TEXT, score REAL DEFAULT 0,
    exp_earned INTEGER DEFAULT 0, points_earned INTEGER DEFAULT 0, stats_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL, user_id INTEGER, event_type TEXT NOT NULL, payload_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL, addressee_id INTEGER NOT NULL, status TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(requester_id, addressee_id)
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_lobbies (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lobby_code TEXT UNIQUE, host_user_id INTEGER NOT NULL, guest_user_id INTEGER, game_key TEXT NOT NULL,
    status TEXT NOT NULL, host_ready INTEGER DEFAULT 0, guest_ready INTEGER DEFAULT 0, is_private INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, title_tr TEXT, title_en TEXT, description_tr TEXT, description_en TEXT,
    target_game TEXT, starts_at TEXT, ends_at TEXT, reward_exp INTEGER DEFAULT 0, reward_points INTEGER DEFAULT 0, reward_badge_slug TEXT,
    is_active INTEGER DEFAULT 1, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_event_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT, claimed_at TEXT, UNIQUE(event_id, user_id)
  )`).run();

  await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS off_leaderboard_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER, user_id INTEGER NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  for (const sql of [
    `CREATE INDEX IF NOT EXISTS idx_off_matches_game_started ON off_matches(game_key, started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_off_match_players_user_created ON off_match_players(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_off_quest_progress_user ON off_user_quest_progress(user_id, period_key)`,
    `CREATE INDEX IF NOT EXISTS idx_off_badges_user ON off_user_badges(user_id, unlocked_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_off_cosmetics_user ON off_user_cosmetics(user_id, cosmetic_slug)`,
    `CREATE INDEX IF NOT EXISTS idx_off_friendships_lookup ON off_friendships(requester_id, addressee_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_off_lobbies_code ON off_lobbies(lobby_code)`,
    `CREATE INDEX IF NOT EXISTS idx_off_events_active ON off_events(is_active, starts_at, ends_at)`,
  ]) await context.env.DB.prepare(sql).run();

  await seedOffDefaults(context);
}

async function seedOffDefaults(context: any) {
  const quests = [
    ["daily-8-games", "Günlük 8 OFF oyunu tamamla", "Complete 8 OFF games today", "daily", "play_game", null, 8, 80, 12, null],
    ["daily-3-games", "Bugün 3 farklı oyun dene", "Try 3 different games today", "daily", "play_game", null, 3, 45, 8, "multi-game"],
    ["meme-10-clicks", "Meme Clicker’da 10 tıklama yap", "Click Meme Clicker 10 times", "daily", "play_game", "memeClicker", 10, 35, 6, "meme-master"],
    ["dice-10-rounds", "Tech Dice’ta 10 tur tamamla", "Complete 10 Tech Dice rounds", "daily", "play_game", "dice", 10, 50, 8, "dice-runner"],
    ["blackjack-5-rounds", "Blackjack’te 5 tur tamamla", "Complete 5 Blackjack rounds", "daily", "play_game", "blackjack", 5, 45, 8, "blackjack-learner"],
    ["market-1-sim", "MarketAcademy’de 1 işlem simülasyonu tamamla", "Complete 1 MarketAcademy simulation", "daily", "play_game", "market", 1, 40, 6, "market-rookie"],
    ["friend-lobby", "Arkadaşla 1 özel lobby oluştur", "Create 1 private friend lobby", "daily", "use_feature", "lobby", 1, 30, 5, null],
    ["weekly-50-games", "Haftalık 50 OFF oyunu tamamla", "Complete 50 OFF games this week", "weekly", "play_game", null, 50, 300, 55, "daily-grinder"],
  ];
  for (const q of quests) {
    await context.env.DB.prepare(`INSERT OR IGNORE INTO off_quests (slug, title_tr, title_en, description_tr, description_en, type, target_type, target_game, target_count, reward_exp, reward_points, reward_badge_slug, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).bind(q[0], q[1], q[2], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[9]).run();
  }
  const badges = [
    ["first-win","İlk Galibiyet","First Win","İlk OFF galibiyetini aldın.","Win your first OFF match.","🏆","common","wins",1],
    ["first-game","İlk Oyun","First Game","İlk OFF maçını tamamladın.","Complete your first OFF match.","🎮","common","matches",1],
    ["daily-grinder","Daily Grinder","Daily Grinder","Günlük ritmi yakaladın.","Keep the daily rhythm.","🔥","rare","matches",8],
    ["fast-hands","Hızlı Eller","Fast Hands","Reflekslerin parladı.","Your reflexes shined.","⚡","rare","reaction_ms",500],
    ["perfect-round","Perfect Round","Perfect Round","Kusursuz raund tamamladın.","Complete a perfect round.","💎","epic","perfect_rounds",1],
    ["level-5-verified","Level 5","Level 5","Level 5 eşiğini geçtin.","Reach Level 5.","✅","rare","level",5],
    ["level-10","Level 10 Verified","Level 10 Verified","Yeni verified eşiği: Level 10.","Reach the new verified threshold: Level 10.","🔷","epic","level",10],
    ["multi-game","Çoklu Oyuncu","Multi Game","Farklı OFF oyunlarını denedin.","Try multiple OFF games.","🧩","rare","games",3],
    ["meme-master","Meme Master","Meme Master","Meme Clicker ritmini yakaladın.","Find the Meme Clicker rhythm.","😂","rare","game:memeClicker",10],
    ["blackjack-learner","Blackjack Öğrencisi","Blackjack Learner","Blackjack masasına oturdun.","Sit at the Blackjack table.","♣️","common","game:blackjack",5],
    ["dice-runner","Dice Runner","Dice Runner","Tech Dice tur serisini tamamladın.","Complete a Tech Dice run.","🎲","common","game:dice",10],
    ["mines-explorer","Mines Explorer","Mines Explorer","TechMines keşfi.","Explore TechMines.","💣","common","game:mines",1],
    ["towers-climber","Towers Climber","Towers Climber","Eka Towers tırmanışı.","Climb Eka Towers.","🏗️","common","game:towers",1],
    ["aviator-pilot","Aviator Pilot","Aviator Pilot","Tech Aviator pilotu.","Pilot Tech Aviator.","✈️","common","game:aviator",1],
    ["market-rookie","Market Rookie","Market Rookie","MarketAcademy başlangıcı.","Start MarketAcademy.","📈","common","game:market",1],
    ["core-clash-player","Core Clash Player","Core Clash Player","Core Clash oyuncusu.","Core Clash player.","🛡️","common","game:core-clash",1],
    ["founder-player","Founder Player","Founder Player","OFF Hub erken dönem oyuncusu.","Early OFF Hub player.","👑","legendary","matches",1],
  ];
  for (const b of badges) {
    await context.env.DB.prepare(`INSERT OR IGNORE INTO off_badges (slug, title_tr, title_en, description_tr, description_en, icon, rarity, condition_type, condition_value, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).bind(...b).run();
  }
  const cosmetics = [
    ["violet-glass-frame","Mor Glass Çerçeve","Violet Glass Frame","Premium profil çerçevesi.","Premium profile frame.","frame","rare",80,"gradient:violet"],
    ["cyan-avatar-glow","Cyan Avatar Glow","Cyan Avatar Glow","Avatarına cyan glow ekler.","Adds cyan glow to your avatar.","avatar_glow","rare",65,"glow:cyan"],
    ["verified-name-tag","Verified Name Tag","Verified Name Tag","İsim yanında verified etiketi.","Verified label near your name.","name_tag","epic",140,"tag:verified"],
    ["black-card-back","Siyah Kart Arkası","Black Card Back","Kart oyunları için premium arka yüz.","Premium card back for card games.","card_back","common",45,"card:black"],
    ["clean-victory","Clean Victory","Clean Victory","Minimal zafer animasyonu.","Minimal victory animation.","victory_anim","epic",180,"anim:clean"],
    ["linear-bg","Linear Profil BG","Linear Profile BG","Glass profil arka planı.","Glass profile background.","profile_bg","rare",110,"bg:linear"],
    ["roulette-racon-lite","Rulet Racon Lite","Roulette Swagger Lite","Rulet masası için racon eşyası.","Swagger item for roulette table.","roulette_racon","rare",95,"roulette:racon"],
    ["tl-techcoin-entry","TL ile Tech Coin","TRY Tech Coin Entry","TL satın alım sekmesi vitrini.","TRY purchase tab showcase.","tl_package","common",0,"store:tl"],
  ];
  for (const c of cosmetics) {
    await context.env.DB.prepare(`INSERT OR IGNORE INTO off_cosmetics (slug, name_tr, name_en, description_tr, description_en, category, rarity, cost_points, preview_data, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).bind(...c).run();
  }
  await context.env.DB.prepare(`INSERT OR IGNORE INTO off_seasons (slug, name_tr, name_en, starts_at, ends_at, is_active, created_at, updated_at)
    VALUES ('genesis-2026', 'Genesis Sezonu', 'Genesis Season', datetime('now', '-7 day'), datetime('now', '+30 day'), 1, datetime('now'), datetime('now'))`).run();
  await context.env.DB.prepare(`INSERT OR IGNORE INTO off_events (slug, title_tr, title_en, description_tr, description_en, starts_at, ends_at, reward_exp, reward_points, reward_badge_slug, is_active, created_at, updated_at)
    VALUES ('genesis-week', 'Genesis Haftası', 'Genesis Week', 'OFF Hub genişleme etkinliğine katıl.', 'Join the OFF Hub expansion event.', datetime('now', '-1 day'), datetime('now', '+14 day'), 120, 25, 'founder-player', 1, datetime('now'), datetime('now'))`).run();
}

export async function ensureOffProfile(context: any, user: any) {
  await ensureOffTables(context);
  await context.env.DB.prepare(`INSERT OR IGNORE INTO off_user_profiles (user_id, display_name, avatar_url, updated_at) VALUES (?, ?, ?, datetime('now'))`)
    .bind(user.id, user.name || "OFF Player", user.avatar_url || null).run();
  await context.env.DB.prepare(`UPDATE off_user_profiles SET display_name = COALESCE(display_name, ?), avatar_url = COALESCE(avatar_url, ?), updated_at = datetime('now') WHERE user_id = ?`)
    .bind(user.name || "OFF Player", user.avatar_url || null, user.id).run();
}

export async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  const user = await context.env.DB.prepare(`SELECT users.id, users.name, users.email, users.avatar_url,
    CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`)
    .bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!["off", "admin", "owner"].includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekli." };
  await ensureOffProfile(context, user);
  return { ok: true, user };
}

export async function requireAdminUser(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return auth;
  if (!["admin", "owner"].includes(String(auth.user.role))) return { ok: false, status: 403, error: "Admin erişimi gerekli." };
  return auth;
}

export function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}

export function json(payload: any, init?: ResponseInit) {
  return Response.json(payload, init);
}

export async function tableColumns(context: any, table: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  return rows?.results || [];
}
