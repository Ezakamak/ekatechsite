const OWNER_EMAIL = "emirkaganaksu02@gmail.com";
const OFF_ROLES = ["off", "admin", "owner"];

class DropTechUserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DropTechUserError";
    this.status = status;
  }
}

type Rarity = "common" | "rare" | "epic" | "legendary" | "glitch";
type DropItem = {
  id: string;
  emoji: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  rarity: Rarity;
  weight: number;
  tech_coin_value: number;
  series_id: string;
  series_name_tr: string;
  series_name_en: string;
};
type BoxType = {
  id: string;
  emoji: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  accent: "white" | "cyan" | "purple" | "amber" | "emerald" | "rose" | "fuchsia";
  base_fee: number;
  edge: number;
  multipliers: Record<Rarity, number>;
};

type SeriesItem = [string, string, string];
type SeriesKit = {
  common: SeriesItem[];
  rare: SeriesItem[];
  epic: SeriesItem[];
  legendary: SeriesItem[];
  glitch: SeriesItem[];
};

const RARITY_VALUES: Record<Rarity, number> = { common: 3, rare: 8, epic: 18, legendary: 45, glitch: 120 };
const RARITY_BASE_WEIGHTS: Record<Rarity, number> = { common: 100, rare: 40, epic: 13, legendary: 3.8, glitch: 0.72 };

const BOX_TYPES: BoxType[] = [
  { id: "standard_cache", emoji: "📦", name_tr: "Standard Cache", name_en: "Standard Cache", description_tr: "Klasik başlangıç serisi. Ucuz, dengeli ve güvenli.", description_en: "Classic starter series. Cheap, balanced and safe.", accent: "white", base_fee: 5, edge: 1.05, multipliers: { common: 1.2, rare: 0.95, epic: 0.68, legendary: 0.42, glitch: 0.2 } },
  { id: "signal_crate", emoji: "📡", name_tr: "Signal Crate", name_en: "Signal Crate", description_tr: "Sinyal temalı Rare ağırlıklı seri.", description_en: "Signal-themed Rare-focused series.", accent: "cyan", base_fee: 7, edge: 1.07, multipliers: { common: 0.9, rare: 1.35, epic: 0.95, legendary: 0.55, glitch: 0.28 } },
  { id: "circuit_box", emoji: "🔌", name_tr: "Circuit Box", name_en: "Circuit Box", description_tr: "Donanım temalı Rare/Epic dengesi güçlü seri.", description_en: "Hardware series with strong Rare/Epic balance.", accent: "emerald", base_fee: 8, edge: 1.08, multipliers: { common: 0.82, rare: 1.18, epic: 1.22, legendary: 0.62, glitch: 0.34 } },
  { id: "neon_vault", emoji: "🟣", name_tr: "Neon Vault", name_en: "Neon Vault", description_tr: "Neon temalı Epic ağırlıklı seri.", description_en: "Neon-themed Epic-focused series.", accent: "purple", base_fee: 10, edge: 1.09, multipliers: { common: 0.68, rare: 1.05, epic: 1.55, legendary: 0.78, glitch: 0.42 } },
  { id: "data_relic", emoji: "💿", name_tr: "Data Relic", name_en: "Data Relic", description_tr: "Arşiv/veri temalı Epic ve Legendary karışımı seri.", description_en: "Archive/data series with Epic and Legendary pressure.", accent: "cyan", base_fee: 12, edge: 1.1, multipliers: { common: 0.58, rare: 0.92, epic: 1.52, legendary: 1.1, glitch: 0.5 } },
  { id: "core_capsule", emoji: "💠", name_tr: "Core Capsule", name_en: "Core Capsule", description_tr: "Çekirdek temalı Legendary şansı daha görünür seri.", description_en: "Core-themed series with more visible Legendary odds.", accent: "amber", base_fee: 14, edge: 1.11, multipliers: { common: 0.48, rare: 0.82, epic: 1.28, legendary: 1.62, glitch: 0.62 } },
  { id: "firewall_chest", emoji: "🛡️", name_tr: "Firewall Chest", name_en: "Firewall Chest", description_tr: "Savunma temalı, güvenli ama pahalılaşan seri.", description_en: "Defense-themed series, safe but pricier.", accent: "rose", base_fee: 15, edge: 1.11, multipliers: { common: 0.5, rare: 0.85, epic: 1.42, legendary: 1.42, glitch: 0.58 } },
  { id: "quantum_case", emoji: "⚙️", name_tr: "Quantum Case", name_en: "Quantum Case", description_tr: "Yüksek varyanslı, Legendary/Glitch kıpırtısı olan seri.", description_en: "High-variance series with Legendary/Glitch pressure.", accent: "amber", base_fee: 18, edge: 1.13, multipliers: { common: 0.36, rare: 0.7, epic: 1.25, legendary: 2.05, glitch: 0.9 } },
  { id: "legend_vault", emoji: "🏛️", name_tr: "Legend Vault", name_en: "Legend Vault", description_tr: "Legendary odaklı pahalı koleksiyon serisi.", description_en: "Expensive Legendary-focused collection series.", accent: "amber", base_fee: 22, edge: 1.15, multipliers: { common: 0.28, rare: 0.52, epic: 1.05, legendary: 3.0, glitch: 1.0 } },
  { id: "glitch_rift", emoji: "🕳️", name_tr: "Glitch Rift", name_en: "Glitch Rift", description_tr: "Glitch şansı en yüksek ama pahalı ve riskli seri.", description_en: "Highest Glitch chance, expensive and risky.", accent: "fuchsia", base_fee: 28, edge: 1.18, multipliers: { common: 0.2, rare: 0.42, epic: 0.95, legendary: 1.8, glitch: 4.4 } },
  { id: "founder_box", emoji: "👑", name_tr: "Founder Box", name_en: "Founder Box", description_tr: "Etkinlik/admin ödülü premium Founder serisi.", description_en: "Premium Founder event/admin reward series.", accent: "purple", base_fee: 30, edge: 1.2, multipliers: { common: 0.18, rare: 0.48, epic: 1.25, legendary: 2.6, glitch: 2.6 } },
];

const SERIES_KITS: Record<string, SeriesKit> = {
  standard_cache: {
    common: [["⌨️", "Kırık Klavye Tuşu", "Broken Keycap"], ["🔩", "Server Vidası", "Server Screw"], ["🧹", "Tozlu Fan", "Dusty Fan"], ["📎", "Eski Kablo", "Old Cable"]],
    rare: [["🏷️", "Debug Sticker", "Debug Sticker"], ["▫️", "Cache Parçası", "Cache Shard"], ["💡", "Boşta LED", "Loose LED"]],
    epic: [["🗜️", "Mini Zip", "Mini Zip"], ["🧊", "Low Poly Küp", "Low Poly Cube"]],
    legendary: [["🪙", "Altın Tech Coin", "Golden Tech Coin"], ["🖥️", "Klasik Terminal", "Classic Terminal"]],
    glitch: [["❓", "Null Fragment", "Null Fragment"]],
  },
  signal_crate: {
    common: [["📶", "Kablosuz Toz", "Wireless Dust"], ["📡", "Kırık Anten", "Broken Antenna"], ["⚪", "Loading Noktası", "Loading Dot"], ["🔘", "Kullanılmamış İkon", "Unused Icon"]],
    rare: [["🔑", "Cyan Anahtar", "Cyan Key"], ["💍", "Signal Ring", "Signal Ring"], ["🔍", "Packet Lens", "Packet Lens"]],
    epic: [["📡", "Void Router", "Void Router"], ["🔴", "Laser Trace", "Laser Trace"]],
    legendary: [["🛰️", "Deep Space Drive", "Deep Space Drive"], ["⚡", "Sıfır Gecikme Çekirdeği", "Zero Latency Core"]],
    glitch: [["🌀", "Recursive Signal", "Recursive Signal"]],
  },
  circuit_box: {
    common: [["🔋", "Minik Kapasitör", "Tiny Capacitor"], ["◽", "Boş Soket", "Empty Socket"], ["〰️", "Test Kablosu", "Test Wire"], ["◾", "Kasa Ayağı", "Rubber Feet"]],
    rare: [["🧩", "Blueprint Chip", "Blueprint Chip"], ["🌬️", "Crystal Fan", "Crystal Fan"], ["🔌", "Buzlu Port", "Frosted Port"]],
    epic: [["⌨️", "Holo Klavye", "Holo Keyboard"], ["🧬", "Encrypted Core", "Encrypted Core"]],
    legendary: [["⚙️", "Quantum Gear", "Quantum Gear"], ["♾️", "Infinity Socket", "Infinity Socket"]],
    glitch: [["🔻", "Inverted Circuit", "Inverted Circuit"]],
  },
  neon_vault: {
    common: [["✨", "Statik Nokta", "Static Speck"], ["⬜", "Gri Placeholder", "Gray Placeholder"], ["🟣", "Neon Kırıntı", "Neon Crumb"], ["🎫", "Boş Rozet", "Blank Badge"]],
    rare: [["🖱️", "Neon Mouse", "Neon Mouse"], ["🩹", "Neon Patch", "Neon Patch"], ["🖱️", "Shadow Cursor", "Shadow Cursor"]],
    epic: [["🖱️", "Plasma Cursor", "Plasma Cursor"], ["🟣", "Gravity Pixel", "Gravity Pixel"]],
    legendary: [["🌌", "Aurora Chipset", "Aurora Chipset"], ["💎", "Prism Database", "Prism Database"]],
    glitch: [["🟥", "Forbidden Pixel", "Forbidden Pixel"]],
  },
  data_relic: {
    common: [["📜", "Tozlu Log", "Dusty Log"], ["📄", "Patch Notu Kırıntısı", "Patch Note Crumb"], ["🏷️", "Backup Etiketi", "Backup Label"], ["📦", "Eski Arşiv Kartı", "Old Archive Card"]],
    rare: [["🔐", "Şifreli Kart", "Encrypted Card"], ["🍪", "Şifreli Cookie", "Encrypted Cookie"], ["🍃", "Memory Leaf", "Memory Leaf"]],
    epic: [["💿", "Hologram Disk", "Hologram Disk"], ["☁️", "Cloud Relic", "Cloud Relic"]],
    legendary: [["⏳", "Quantum Hourglass", "Quantum Hourglass"], ["🌘", "Eclipse Protocol", "Eclipse Protocol"]],
    glitch: [["⬛", "Missing Texture", "Missing Texture"]],
  },
  core_capsule: {
    common: [["🧩", "Yedek Braket", "Spare Bracket"], ["🔲", "Piksel Hurda", "Pixel Scrap"], ["📎", "Mikro Klips", "Micro Clip"], ["🪫", "Bitik Pil", "Flat Battery"]],
    rare: [["💾", "Glitch USB", "Glitch USB"], ["🔵", "Backup Orb", "Backup Orb"], ["🧿", "API Charm", "API Charm"]],
    epic: [["🧠", "Bot Anakartı", "Bot Motherboard"], ["🧠", "Smart Fragment", "Smart Fragment"]],
    legendary: [["💠", "Eka Core", "Eka Core"], ["👑", "Neural Crown", "Neural Crown"]],
    glitch: [["🧿", "Glitch Core", "Glitch Core"]],
  },
  firewall_chest: {
    common: [["🛡️", "Kalkan Civatası", "Shield Bolt"], ["🔒", "Paslı Kilit", "Rusty Lock"], ["🧱", "Firewall Tuğlası", "Firewall Brick"], ["🚧", "Uyarı Levhası", "Warning Sign"]],
    rare: [["🔐", "Secure Token", "Secure Token"], ["🎭", "Proxy Maskesi", "Proxy Mask"], ["👁️", "Drone Gözü", "Drone Eye"]],
    epic: [["🛡️", "Mini Firewall", "Mini Firewall"], ["🪞", "Mirror Panel", "Mirror Panel"]],
    legendary: [["🛡️", "Royal Firewall", "Royal Firewall"], ["🔥", "Phoenix Server", "Phoenix Server"]],
    glitch: [["█", "Sansürlü Kalkan", "Redacted Shield"]],
  },
  quantum_case: {
    common: [["📍", "Yanlış Pin", "Wrong Pin"], ["🧊", "Donmuş Bit", "Frozen Bit"], ["🔁", "Mini Döngü", "Mini Loop"], ["⚙️", "Ters Dişli", "Reverse Gear"]],
    rare: [["🧊", "Frozen Chip", "Frozen Chip"], ["📍", "Quantum Pin", "Quantum Pin"], ["🔁", "Soft Reboot", "Soft Reboot"]],
    epic: [["⏱️", "Chrono Cache", "Chrono Cache"], ["💙", "Synthetic Heart", "Synthetic Heart"]],
    legendary: [["⚙️", "Quantum Gear Prime", "Quantum Gear Prime"], ["⏳", "Quantum Hourglass Prime", "Quantum Hourglass Prime"]],
    glitch: [["🎲", "Bozuk Olasılık", "Broken Probability"]],
  },
  legend_vault: {
    common: [["🏛️", "Taş Tablet", "Stone Tablet"], ["📜", "Eski Ferman", "Old Decree"], ["🗝️", "Paslı Vault Anahtarı", "Rusty Vault Key"], ["🪙", "Mat Coin", "Dull Coin"]],
    rare: [["🎖️", "Runtime Rozeti", "Runtime Badge"], ["🏷️", "Neural Tag", "Neural Tag"], ["🔘", "Silent Switch", "Silent Switch"]],
    epic: [["🌟", "Nova Badge", "Nova Badge"], ["📝", "Zero-Day Notu", "Zero-Day Note"]],
    legendary: [["👑", "Founder Chip", "Founder Chip"], ["🖥️", "Stellar Terminal", "Stellar Terminal"]],
    glitch: [["👻", "Ghost Commit", "Ghost Commit"]],
  },
  glitch_rift: {
    common: [["❔", "Bozuk Soru İşareti", "Broken Question Mark"], ["🕳️", "Küçük Yarık", "Small Rift"], ["📉", "Ters Sayaç", "Reverse Counter"], ["🧷", "Kayıp Bağlantı", "Lost Link"]],
    rare: [["👁️", "Hidden File", "Hidden File"], ["🌀", "Recursive Void", "Recursive Void"], ["⬛", "Missing Texture Lite", "Missing Texture Lite"]],
    epic: [["👻", "Ghost Module", "Ghost Module"], ["🌺", "Overclock Flower", "Overclock Flower"]],
    legendary: [["🕳️", "Bozuk Gerçeklik", "Broken Reality"], ["👑", "Null Crown", "Null Crown"]],
    glitch: [["🕳️", "Redacted Reality", "Redacted Reality"]],
  },
  founder_box: {
    common: [["👑", "Mini Crown", "Mini Crown"], ["📜", "Founder Note", "Founder Note"], ["🪪", "Beta Pass", "Beta Pass"], ["🧾", "Launch Receipt", "Launch Receipt"]],
    rare: [["💠", "Founder Shard", "Founder Shard"], ["🧬", "Founder DNA", "Founder DNA"], ["🎟️", "Event Ticket", "Event Ticket"]],
    epic: [["🔮", "AI Sigil", "AI Sigil"], ["🧬", "Founder Core Sample", "Founder Core Sample"]],
    legendary: [["👑", "Founder Crown", "Founder Crown"], ["💎", "Founder Prism", "Founder Prism"]],
    glitch: [["█", "Founder Redaction", "Founder Redaction"]],
  },
};

const DROP_ITEMS: DropItem[] = Object.entries(SERIES_KITS).flatMap(([seriesId, kit]) => {
  const box = BOX_TYPES.find((entry) => entry.id === seriesId) || BOX_TYPES[0];
  return (Object.entries(kit) as Array<[Rarity, SeriesItem[]]>).flatMap(([rarity, entries]) =>
    entries.map(([emoji, name_tr, name_en], index) => ({
      id: `${seriesId}_${slug(name_en)}_${index}`,
      emoji,
      name_tr,
      name_en,
      description_tr: `${box.name_tr} serisine ait ${rarityLabelTr(rarity)} koleksiyon parçası.`,
      description_en: `${rarityLabelEn(rarity)} collection item from the ${box.name_en} series.`,
      rarity,
      weight: rarityWeight(rarity, index),
      tech_coin_value: RARITY_VALUES[rarity],
      series_id: seriesId,
      series_name_tr: box.name_tr,
      series_name_en: box.name_en,
    }))
  );
});

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    await ensureTables(context);
    await ensureUserBoxRow(context, auth.user.id);
    await ensureCoinWallet(context, auth.user.id);
    return Response.json(await buildState(context, auth.user.id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "DropTech verisi alınamadı." }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    await ensureTables(context);
    await ensureUserBoxRow(context, auth.user.id);
    await ensureCoinWallet(context, auth.user.id);
    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "open");
    if (action === "claim_daily") return Response.json(await claimDailyBox(context, auth.user.id));
    if (action === "open") return Response.json(await openBox(context, auth.user.id, String(body?.box_type || "standard_cache")));
    return Response.json({ error: "Geçersiz DropTech işlemi." }, { status: 400 });
  } catch (error) {
    const status = error instanceof DropTechUserError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "DropTech işlemi tamamlanamadı." }, { status });
  }
}

async function ensureTables(context: any) {
  const db = context.env.DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS droptech_boxes (user_id INTEGER PRIMARY KEY, box_count INTEGER NOT NULL DEFAULT 0, lifetime_opened INTEGER NOT NULL DEFAULT 0, last_daily_claim TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS droptech_user_boxes (user_id INTEGER NOT NULL, box_type TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, box_type))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS droptech_inventory (user_id INTEGER NOT NULL, item_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, rarity TEXT NOT NULL, emoji TEXT NOT NULL, name_tr TEXT NOT NULL, name_en TEXT NOT NULL, description_tr TEXT NOT NULL, description_en TEXT NOT NULL, first_found_at TEXT DEFAULT CURRENT_TIMESTAMP, last_found_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, item_id))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS droptech_openings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, item_id TEXT NOT NULL, rarity TEXT NOT NULL, box_type TEXT DEFAULT 'standard_cache', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 100, lifetime_earned INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await addColumnIfMissing(context, "droptech_openings", "box_type", "TEXT DEFAULT 'standard_cache'");
  await ensureCoinColumns(context);
}

async function ensureCoinColumns(context: any) {
  await addColumnIfMissing(context, "coin_wallets", "balance", "INTEGER DEFAULT 100");
  await addColumnIfMissing(context, "coin_wallets", "lifetime_earned", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "coin_wallets", "updated_at", "TEXT");
  await addColumnIfMissing(context, "coin_transactions", "amount", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "coin_transactions", "reason", "TEXT");
  await addColumnIfMissing(context, "coin_transactions", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
}

async function ensureUserBoxRow(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO droptech_boxes (user_id, box_count, lifetime_opened) VALUES (?, 0, 0)`).bind(userId).run();
  for (const box of BOX_TYPES) await context.env.DB.prepare(`INSERT OR IGNORE INTO droptech_user_boxes (user_id, box_type, quantity) VALUES (?, ?, 0)`).bind(userId, box.id).run();

  const legacy: any = await context.env.DB.prepare(`SELECT box_count FROM droptech_boxes WHERE user_id = ?`).bind(userId).first();
  const legacyCount = Number(legacy?.box_count || 0);
  if (legacyCount > 0) {
    await context.env.DB.prepare(`UPDATE droptech_user_boxes SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND box_type = 'standard_cache'`).bind(legacyCount, userId).run();
    await context.env.DB.prepare(`UPDATE droptech_boxes SET box_count = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(userId).run();
  }
}

async function ensureCoinWallet(context: any, userId: number) {
  await ensureCoinColumns(context);
  await context.env.DB.prepare(`INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`).bind(userId).run();
  await context.env.DB.prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 100), lifetime_earned = COALESCE(lifetime_earned, 0), updated_at = COALESCE(updated_at, datetime('now')) WHERE user_id = ?`).bind(userId).run();
}

async function getTechCoinWallet(context: any, userId: number) {
  await ensureCoinWallet(context, userId);
  return await context.env.DB.prepare(`SELECT user_id, COALESCE(balance, 100) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, 0 AS lifetime_spent, updated_at, 'coin_wallets' AS source FROM coin_wallets WHERE user_id = ?`).bind(userId).first();
}

async function spendTechCoinForDropTech(context: any, userId: number, amount: number, details: string) {
  await ensureCoinWallet(context, userId);
  const result = await context.env.DB.prepare(`UPDATE coin_wallets SET balance = COALESCE(balance, 100) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 100) >= ?`).bind(amount, userId, amount).run();
  if (Number(result?.meta?.changes || 0) === 0) return null;
  const wallet: any = await getTechCoinWallet(context, userId);
  await logTechCoinEvent(context, userId, -amount, details);
  return wallet;
}

async function logTechCoinEvent(context: any, userId: number, amount: number, details: string) {
  try {
    await ensureCoinColumns(context);
    await context.env.DB.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).bind(userId, amount, details.slice(0, 240)).run();
  } catch {}
}

async function claimDailyBox(context: any, userId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const row: any = await context.env.DB.prepare(`SELECT last_daily_claim FROM droptech_boxes WHERE user_id = ?`).bind(userId).first();
  if (row?.last_daily_claim === today) return { ...await buildState(context, userId), claimed: false, message: "Bugünkü DropTech kutusu zaten alındı." };
  await addBox(context, userId, "standard_cache", 1);
  await context.env.DB.prepare(`UPDATE droptech_boxes SET last_daily_claim = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(today, userId).run();
  return { ...await buildState(context, userId), claimed: true, message: "Günlük Standard Cache alındı." };
}

async function addBox(context: any, userId: number, boxType: string, amount: number) {
  const safeBoxType = BOX_TYPES.some((box) => box.id === boxType) ? boxType : "standard_cache";
  await context.env.DB.prepare(`INSERT INTO droptech_user_boxes (user_id, box_type, quantity, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id, box_type) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP`).bind(userId, safeBoxType, amount).run();
}

async function openBox(context: any, userId: number, boxType: string) {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const openCost = boxOpenCost(box.id);
  const wallet: any = await getTechCoinWallet(context, userId);
  const owned: any = await context.env.DB.prepare(`SELECT quantity FROM droptech_user_boxes WHERE user_id = ? AND box_type = ?`).bind(userId, box.id).first();
  const useOwnedBox = Number(owned?.quantity || 0) > 0;

  if (!useOwnedBox && Number(wallet?.balance || 0) < openCost) throw new DropTechUserError(`${box.name_tr} almak için ${openCost} Tech Coin gerekiyor. Bakiyen: ${Number(wallet?.balance || 0)}.`, 402);
  if (useOwnedBox) {
    const boxUpdate = await context.env.DB.prepare(`UPDATE droptech_user_boxes SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND box_type = ? AND quantity > 0`).bind(userId, box.id).run();
    if (Number(boxUpdate?.meta?.changes || 0) === 0) throw new DropTechUserError(`Açacak ${box.name_tr} kutun yok.`);
  } else {
    const spentWallet = await spendTechCoinForDropTech(context, userId, openCost, `DropTech ${box.name_tr} satın alma ve açma bedeli`);
    if (!spentWallet) throw new DropTechUserError(`${box.name_tr} almak için ${openCost} Tech Coin gerekiyor. Bakiyen güncel olmayabilir; sayfayı yenile.`, 402);
  }

  const item = pickDropItem(box.id);
  await context.env.DB.prepare(`UPDATE droptech_boxes SET lifetime_opened = lifetime_opened + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(userId).run();
  await context.env.DB.prepare(`INSERT INTO droptech_inventory (user_id, item_id, quantity, rarity, emoji, name_tr, name_en, description_tr, description_en) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1, rarity = excluded.rarity, emoji = excluded.emoji, name_tr = excluded.name_tr, name_en = excluded.name_en, description_tr = excluded.description_tr, description_en = excluded.description_en, last_found_at = CURRENT_TIMESTAMP`).bind(userId, item.id, item.rarity, item.emoji, item.name_tr, item.name_en, item.description_tr, item.description_en).run();
  await context.env.DB.prepare(`INSERT INTO droptech_openings (user_id, item_id, rarity, box_type) VALUES (?, ?, ?, ?)`).bind(userId, item.id, item.rarity, box.id).run();
  return { ...await buildState(context, userId), won: item, opened_box: withBoxValue(box), spent: useOwnedBox ? 0 : openCost, used_owned_box: useOwnedBox };
}

async function buildState(context: any, userId: number) {
  const box: any = await context.env.DB.prepare(`SELECT lifetime_opened, last_daily_claim, updated_at FROM droptech_boxes WHERE user_id = ?`).bind(userId).first();
  const boxRows = await context.env.DB.prepare(`SELECT box_type, quantity FROM droptech_user_boxes WHERE user_id = ?`).bind(userId).all();
  const inventoryRows = await context.env.DB.prepare(`SELECT * FROM droptech_inventory WHERE user_id = ? ORDER BY CASE rarity WHEN 'glitch' THEN 5 WHEN 'legendary' THEN 4 WHEN 'epic' THEN 3 WHEN 'rare' THEN 2 ELSE 1 END DESC, last_found_at DESC`).bind(userId).all();
  const recentRows = await context.env.DB.prepare(`SELECT item_id, rarity, box_type, created_at FROM droptech_openings WHERE user_id = ? ORDER BY id DESC LIMIT 12`).bind(userId).all();
  const wallet = await getTechCoinWallet(context, userId);
  const today = new Date().toISOString().slice(0, 10);
  const quantityMap = new Map((boxRows?.results || []).map((row: any) => [String(row.box_type), Number(row.quantity || 0)]));
  const boxes = BOX_TYPES.map((boxType) => ({ ...withBoxValue(boxType), quantity: quantityMap.get(boxType.id) || 0, odds: rarityOdds(boxType.id), series_count: itemsForBox(boxType.id).length }));
  const inventory = (inventoryRows?.results || []).map(enrichInventoryItem);
  const totalQuantity = inventory.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  const collectionValue = inventory.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.tech_coin_value || 0), 0);

  return {
    box_count: boxes.reduce((sum, boxItem) => sum + Number(boxItem.quantity || 0), 0),
    boxes,
    tech_coin_wallet: wallet,
    lifetime_opened: Number(box?.lifetime_opened || 0),
    last_daily_claim: box?.last_daily_claim || null,
    can_claim_daily: box?.last_daily_claim !== today,
    collection_total: DROP_ITEMS.length,
    owned_count: Number(inventory.length || 0),
    total_quantity: totalQuantity,
    collection_value: collectionValue,
    inventory,
    recent: recentRows?.results || [],
    items: DROP_ITEMS,
    items_by_box: Object.fromEntries(BOX_TYPES.map((boxType) => [boxType.id, itemsForBox(boxType.id)])),
    box_types: BOX_TYPES.map(withBoxValue),
    odds: rarityOdds("standard_cache"),
    odds_by_box: Object.fromEntries(BOX_TYPES.map((boxType) => [boxType.id, rarityOdds(boxType.id)])),
    value_rules: {
      mode: "exclusive_box_series",
      wallet_source: "coin_wallets",
      box_open_spend_enabled: true,
      owned_box_opens_free: true,
      buy_and_open_with_tech_coin: true,
      pricing: "ceil(expected_value * box_edge + base_fee)",
      item_exclusivity: "one_item_one_box_series",
      payout_on_open: false,
      trade_enabled: false,
      market_enabled: false,
      rarity_values: RARITY_VALUES,
    },
  };
}

function enrichInventoryItem(row: any) {
  const item = DROP_ITEMS.find((entry) => entry.id === row.item_id);
  const value = item?.tech_coin_value || RARITY_VALUES[row.rarity as Rarity] || 0;
  return { ...row, ...(item || {}), tech_coin_value: value, total_tech_coin_value: Number(row.quantity || 0) * value };
}
function withBoxValue(box: BoxType) {
  const expectedValue = boxExpectedValue(box.id);
  return { ...box, tech_coin_value: expectedValue, open_cost: boxOpenCost(box.id), value_formula: "exclusive_series_expected_value", series_count: itemsForBox(box.id).length };
}
function boxOpenCost(boxType = "standard_cache") {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  return Math.max(5, Math.ceil(boxExpectedValue(boxType) * box.edge + box.base_fee));
}
function boxExpectedValue(boxType = "standard_cache") {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const pool = itemsForBox(box.id);
  const totalWeight = pool.reduce((sum, item) => sum + effectiveWeight(item, box), 0);
  if (!totalWeight) return 0;
  const expected = pool.reduce((sum, item) => sum + (effectiveWeight(item, box) / totalWeight) * Number(item.tech_coin_value || 0), 0);
  return Number(expected.toFixed(2));
}
function pickDropItem(boxType: string) {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const pool = itemsForBox(box.id);
  const total = pool.reduce((sum, item) => sum + effectiveWeight(item, box), 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= effectiveWeight(item, box);
    if (roll <= 0) return item;
  }
  return pool[0] || DROP_ITEMS[0];
}
function itemsForBox(boxType: string) {
  const pool = DROP_ITEMS.filter((item) => item.series_id === boxType);
  return pool.length ? pool : DROP_ITEMS.filter((item) => item.series_id === "standard_cache");
}
function effectiveWeight(item: DropItem, box: BoxType) {
  return item.weight * (box.multipliers[item.rarity] || 1);
}
function rarityOdds(boxType = "standard_cache") {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const pool = itemsForBox(box.id);
  const total = pool.reduce((sum, item) => sum + effectiveWeight(item, box), 0);
  const buckets: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0, glitch: 0 };
  for (const item of pool) buckets[item.rarity] += effectiveWeight(item, box);
  return Object.fromEntries(Object.entries(buckets).map(([rarity, weight]) => [rarity, Number(total ? ((weight / total) * 100).toFixed(2) : 0)]));
}
function rarityWeight(rarity: Rarity, index: number) {
  return Number((RARITY_BASE_WEIGHTS[rarity] * Math.max(0.82, 1 - index * 0.035)).toFixed(2));
}
function rarityLabelTr(rarity: Rarity) {
  return rarity === "common" ? "Common" : rarity === "rare" ? "Rare" : rarity === "epic" ? "Epic" : rarity === "legendary" ? "Legendary" : "Glitch";
}
function rarityLabelEn(rarity: Rarity) {
  return rarityLabelTr(rarity);
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
async function addColumnIfMissing(context: any, table: string, column: string, definition: string) {
  const rows = await context.env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  const exists = (rows?.results || []).some((row: any) => String(row.name || "") === column);
  if (!exists) await context.env.DB.prepare(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`).run();
}
function quoteIdent(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
async function requireOffUser(context: any) {
  const token = getCookie(context.request.headers.get("Cookie") || "", "session");
  if (!token) return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };
  const user = await context.env.DB.prepare(`SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`).bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekiyor." };
  return { ok: true, user };
}
function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}
