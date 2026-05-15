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
};

type BoxType = {
  id: string;
  emoji: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  accent: "white" | "cyan" | "purple" | "amber" | "emerald" | "rose" | "fuchsia";
  multipliers: Record<Rarity, number>;
};

const RARITY_VALUES: Record<Rarity, number> = {
  common: 3,
  rare: 8,
  epic: 18,
  legendary: 45,
  glitch: 120,
};

const BOX_TYPES: BoxType[] = [
  { id: "standard_cache", emoji: "📦", name_tr: "Standard Cache", name_en: "Standard Cache", description_tr: "DropTech'in günlük klasik kutusu. Dengeli ama sade drop havuzu.", description_en: "The classic daily DropTech box. Balanced and simple.", accent: "white", multipliers: { common: 1.15, rare: 0.95, epic: 0.75, legendary: 0.55, glitch: 0.35 } },
  { id: "signal_crate", emoji: "📡", name_tr: "Signal Crate", name_en: "Signal Crate", description_tr: "Rare itemlara hafif eğilimli sinyal kutusu.", description_en: "A signal-themed box with a slight Rare bias.", accent: "cyan", multipliers: { common: 0.82, rare: 1.35, epic: 1.05, legendary: 0.75, glitch: 0.55 } },
  { id: "circuit_box", emoji: "🔌", name_tr: "Circuit Box", name_en: "Circuit Box", description_tr: "Donanım temalı, Rare ve Epic dengesi güçlü kutu.", description_en: "Hardware-themed box with stronger Rare and Epic balance.", accent: "emerald", multipliers: { common: 0.75, rare: 1.2, epic: 1.25, legendary: 0.8, glitch: 0.55 } },
  { id: "neon_vault", emoji: "🟣", name_tr: "Neon Vault", name_en: "Neon Vault", description_tr: "Parlak, hızlı ve Epic ağırlığı daha belirgin kasa.", description_en: "Bright, fast and more Epic-focused.", accent: "purple", multipliers: { common: 0.62, rare: 1.05, epic: 1.55, legendary: 1.0, glitch: 0.7 } },
  { id: "data_relic", emoji: "💿", name_tr: "Data Relic", name_en: "Data Relic", description_tr: "Eski sistemlerden kalma veri sandığı. Epic ve Legendary daha canlı.", description_en: "A relic from old systems. Epic and Legendary feel stronger.", accent: "cyan", multipliers: { common: 0.55, rare: 0.95, epic: 1.55, legendary: 1.35, glitch: 0.8 } },
  { id: "core_capsule", emoji: "💠", name_tr: "Core Capsule", name_en: "Core Capsule", description_tr: "Eka Core temalı kapsül. Legendary ağırlığı yüksek.", description_en: "Eka Core themed capsule with higher Legendary weight.", accent: "amber", multipliers: { common: 0.45, rare: 0.85, epic: 1.3, legendary: 1.9, glitch: 0.9 } },
  { id: "firewall_chest", emoji: "🛡️", name_tr: "Firewall Chest", name_en: "Firewall Chest", description_tr: "Savunma temalı özel sandık. Epic ve stabil Legendary oranı sunar.", description_en: "Defense-themed chest with stable Epic and Legendary pressure.", accent: "rose", multipliers: { common: 0.5, rare: 0.9, epic: 1.45, legendary: 1.55, glitch: 0.75 } },
  { id: "quantum_case", emoji: "⚙️", name_tr: "Quantum Case", name_en: "Quantum Case", description_tr: "Daha yüksek riskli ama nadir parıltısı güçlü kuantum kasası.", description_en: "A higher-variance case with stronger rare shine.", accent: "amber", multipliers: { common: 0.38, rare: 0.75, epic: 1.35, legendary: 2.2, glitch: 1.05 } },
  { id: "legend_vault", emoji: "🏛️", name_tr: "Legend Vault", name_en: "Legend Vault", description_tr: "Legendary odaklı ağır koleksiyon kasası.", description_en: "A heavy collection box focused on Legendary items.", accent: "amber", multipliers: { common: 0.25, rare: 0.55, epic: 1.15, legendary: 3.1, glitch: 1.15 } },
  { id: "glitch_rift", emoji: "🕳️", name_tr: "Glitch Rift", name_en: "Glitch Rift", description_tr: "Bozuk gerçeklik yarığı. Glitch item ağırlığı en yüksek kutu.", description_en: "A broken-reality rift with the strongest Glitch weight.", accent: "fuchsia", multipliers: { common: 0.22, rare: 0.45, epic: 1.05, legendary: 2.0, glitch: 4.5 } },
  { id: "founder_box", emoji: "👑", name_tr: "Founder Box", name_en: "Founder Box", description_tr: "Etkinlik/admin ödülleri için premium koleksiyon kutusu.", description_en: "Premium collection box for events and admin rewards.", accent: "purple", multipliers: { common: 0.18, rare: 0.5, epic: 1.35, legendary: 2.8, glitch: 2.8 } },
];

const DROP_ITEMS: DropItem[] = [
  { id: "broken_keycap", emoji: "⌨️", name_tr: "Kırık Klavye Tuşu", name_en: "Broken Keycap", description_tr: "Eski bir debug gecesinden kalma tuş.", description_en: "A keycap from an old debug night.", rarity: "common", weight: 90, tech_coin_value: RARITY_VALUES.common },
  { id: "server_screw", emoji: "🔩", name_tr: "Server Vidası", name_en: "Server Screw", description_tr: "Nereye ait olduğu bilinmeyen küçük bir vida.", description_en: "A tiny screw with an unknown origin.", rarity: "common", weight: 90, tech_coin_value: RARITY_VALUES.common },
  { id: "dusty_fan", emoji: "🧹", name_tr: "Tozlu Fan", name_en: "Dusty Fan", description_tr: "Çalışıyor ama biraz homurdanıyor.", description_en: "It still works, but it complains.", rarity: "common", weight: 84, tech_coin_value: RARITY_VALUES.common },
  { id: "old_cable", emoji: "📎", name_tr: "Eski Kablo", name_en: "Old Cable", description_tr: "Kimse ne işe yaradığını bilmiyor.", description_en: "Nobody knows what it is for.", rarity: "common", weight: 84, tech_coin_value: RARITY_VALUES.common },
  { id: "glitch_usb", emoji: "💾", name_tr: "Glitch USB", name_en: "Glitch USB", description_tr: "Takınca bazen dosyalar isim değiştiriyor.", description_en: "Sometimes files rename themselves when plugged in.", rarity: "rare", weight: 45, tech_coin_value: RARITY_VALUES.rare },
  { id: "frozen_chip", emoji: "🧊", name_tr: "Frozen Chip", name_en: "Frozen Chip", description_tr: "Soğuk çalışır, sıcak bakmaz.", description_en: "Runs cold and stays distant.", rarity: "rare", weight: 42, tech_coin_value: RARITY_VALUES.rare },
  { id: "encrypted_card", emoji: "🔐", name_tr: "Şifreli Kart", name_en: "Encrypted Card", description_tr: "Açmak için şifre değil sabır gerekiyor.", description_en: "Needs patience more than a password.", rarity: "rare", weight: 42, tech_coin_value: RARITY_VALUES.rare },
  { id: "neon_mouse", emoji: "🖱️", name_tr: "Neon Mouse", name_en: "Neon Mouse", description_tr: "Tıklamadan önce bile parlar.", description_en: "Glows before you even click.", rarity: "rare", weight: 38, tech_coin_value: RARITY_VALUES.rare },
  { id: "holo_disk", emoji: "💿", name_tr: "Hologram Disk", name_en: "Hologram Disk", description_tr: "İçinde silinmiş bir sürüm notu var.", description_en: "Contains a deleted release note.", rarity: "epic", weight: 20, tech_coin_value: RARITY_VALUES.epic },
  { id: "bot_motherboard", emoji: "🧠", name_tr: "Bot Anakartı", name_en: "Bot Motherboard", description_tr: "Bir botun karar vermeden önce düşündüğü yer.", description_en: "Where a bot thinks before choosing.", rarity: "epic", weight: 18, tech_coin_value: RARITY_VALUES.epic },
  { id: "data_crystal", emoji: "🧬", name_tr: "Veri Kristali", name_en: "Data Crystal", description_tr: "Kırılırsa loglar şarkı söylemeye başlar.", description_en: "If it breaks, logs start singing.", rarity: "epic", weight: 18, tech_coin_value: RARITY_VALUES.epic },
  { id: "mini_firewall", emoji: "🛡️", name_tr: "Mini Firewall", name_en: "Mini Firewall", description_tr: "Küçük ama tripli bir savunma duvarı.", description_en: "Small, defensive, and dramatic.", rarity: "epic", weight: 16, tech_coin_value: RARITY_VALUES.epic },
  { id: "gold_techcoin", emoji: "🪙", name_tr: "Altın Tech Coin", name_en: "Golden Tech Coin", description_tr: "Harcanmaz; koleksiyonda parlar.", description_en: "Not spendable; it only shines in collection.", rarity: "legendary", weight: 8, tech_coin_value: RARITY_VALUES.legendary },
  { id: "quantum_gear", emoji: "⚙️", name_tr: "Quantum Gear", name_en: "Quantum Gear", description_tr: "Döndüğünü görürsen çoktan dönmüştür.", description_en: "If you see it spin, it already did.", rarity: "legendary", weight: 7, tech_coin_value: RARITY_VALUES.legendary },
  { id: "black_terminal", emoji: "🖥️", name_tr: "Siyah Terminal", name_en: "Black Terminal", description_tr: "Sadece gece cevap verir.", description_en: "Only responds at night.", rarity: "legendary", weight: 6, tech_coin_value: RARITY_VALUES.legendary },
  { id: "eka_core", emoji: "💠", name_tr: "Eka Core", name_en: "Eka Core", description_tr: "OFF sisteminin merkezinde saklanan eski çekirdek.", description_en: "An old core hidden at the center of OFF.", rarity: "legendary", weight: 5, tech_coin_value: RARITY_VALUES.legendary },
  { id: "null_fragment", emoji: "❓", name_tr: "Null Fragment", name_en: "Null Fragment", description_tr: "Var mı yok mu, tabloya göre değişiyor.", description_en: "Exists depending on the table state.", rarity: "glitch", weight: 2, tech_coin_value: RARITY_VALUES.glitch },
  { id: "broken_reality", emoji: "🕳️", name_tr: "Bozuk Gerçeklik", name_en: "Broken Reality", description_tr: "Bakınca sayfa bir anlık kendini unutur.", description_en: "The page forgets itself for a moment.", rarity: "glitch", weight: 1.5, tech_coin_value: RARITY_VALUES.glitch },
  { id: "hidden_file", emoji: "👁️", name_tr: "Hidden File", name_en: "Hidden File", description_tr: "Görünüyor olması gizli olmadığı anlamına gelmez.", description_en: "Being visible does not mean it is not hidden.", rarity: "glitch", weight: 1.2, tech_coin_value: RARITY_VALUES.glitch },
  { id: "glitch_core", emoji: "🧿", name_tr: "Glitch Core", name_en: "Glitch Core", description_tr: "Sistemin bilinçsizce sakladığı şey.", description_en: "The thing the system hides unconsciously.", rarity: "glitch", weight: 1, tech_coin_value: RARITY_VALUES.glitch },
];

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    await ensureTables(context);
    await ensureUserBoxRow(context, auth.user.id);
    await ensureTechCoinWallet(context, auth.user.id);
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
    await ensureTechCoinWallet(context, auth.user.id);
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
  await db.prepare(`CREATE TABLE IF NOT EXISTS tech_coin_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 100, lifetime_earned INTEGER DEFAULT 0, lifetime_spent INTEGER DEFAULT 0, best_round INTEGER DEFAULT 0, perfect_clears INTEGER DEFAULT 0, total_rounds INTEGER DEFAULT 0, updated_at TEXT)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS tech_coin_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, round_gain INTEGER DEFAULT 0, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await addColumnIfMissing(context, "droptech_openings", "box_type", "TEXT DEFAULT 'standard_cache'");
  await ensureTechCoinWalletColumns(context);
  await ensureTechCoinEventColumns(context);
}

async function ensureTechCoinWalletColumns(context: any) {
  await addColumnIfMissing(context, "tech_coin_wallets", "balance", "INTEGER DEFAULT 100");
  await addColumnIfMissing(context, "tech_coin_wallets", "lifetime_earned", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "lifetime_spent", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "best_round", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "perfect_clears", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "total_rounds", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_wallets", "updated_at", "TEXT");
}

async function ensureTechCoinEventColumns(context: any) {
  await addColumnIfMissing(context, "tech_coin_events", "event_type", "TEXT DEFAULT ''");
  await addColumnIfMissing(context, "tech_coin_events", "amount", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_events", "balance_after", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_events", "round_gain", "INTEGER DEFAULT 0");
  await addColumnIfMissing(context, "tech_coin_events", "details", "TEXT");
  await addColumnIfMissing(context, "tech_coin_events", "created_at", "TEXT");
}

async function ensureUserBoxRow(context: any, userId: number) {
  await context.env.DB.prepare(`INSERT OR IGNORE INTO droptech_boxes (user_id, box_count, lifetime_opened) VALUES (?, 0, 0)`).bind(userId).run();
  for (const box of BOX_TYPES) {
    await context.env.DB.prepare(`INSERT OR IGNORE INTO droptech_user_boxes (user_id, box_type, quantity) VALUES (?, ?, 0)`).bind(userId, box.id).run();
  }

  const legacy: any = await context.env.DB.prepare(`SELECT box_count FROM droptech_boxes WHERE user_id = ?`).bind(userId).first();
  const legacyCount = Number(legacy?.box_count || 0);
  if (legacyCount > 0) {
    await context.env.DB.prepare(`UPDATE droptech_user_boxes SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND box_type = 'standard_cache'`).bind(legacyCount, userId).run();
    await context.env.DB.prepare(`UPDATE droptech_boxes SET box_count = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(userId).run();
  }
}

async function ensureTechCoinWallet(context: any, userId: number) {
  await ensureTechCoinWalletColumns(context);
  await context.env.DB.prepare(`
    INSERT OR IGNORE INTO tech_coin_wallets (user_id, balance, lifetime_earned, lifetime_spent, best_round, perfect_clears, total_rounds)
    VALUES (?, 100, 0, 0, 0, 0, 0)
  `).bind(userId).run();

  await context.env.DB.prepare(`
    UPDATE tech_coin_wallets
    SET
      balance = COALESCE(balance, 100),
      lifetime_earned = COALESCE(lifetime_earned, 0),
      lifetime_spent = COALESCE(lifetime_spent, 0),
      best_round = COALESCE(best_round, 0),
      perfect_clears = COALESCE(perfect_clears, 0),
      total_rounds = COALESCE(total_rounds, 0),
      updated_at = COALESCE(updated_at, datetime('now'))
    WHERE user_id = ?
  `).bind(userId).run();
}

async function getTechCoinWallet(context: any, userId: number) {
  await ensureTechCoinWallet(context, userId);
  return await context.env.DB.prepare(`
    SELECT user_id, COALESCE(balance, 100) AS balance, COALESCE(lifetime_earned, 0) AS lifetime_earned, COALESCE(lifetime_spent, 0) AS lifetime_spent, COALESCE(best_round, 0) AS best_round, COALESCE(perfect_clears, 0) AS perfect_clears, COALESCE(total_rounds, 0) AS total_rounds, updated_at
    FROM tech_coin_wallets
    WHERE user_id = ?
  `).bind(userId).first();
}

async function spendTechCoinForDropTech(context: any, userId: number, amount: number, details: string) {
  await ensureTechCoinWallet(context, userId);
  await ensureTechCoinEventColumns(context);

  const result = await context.env.DB.prepare(`
    UPDATE tech_coin_wallets
    SET balance = COALESCE(balance, 100) - ?, lifetime_spent = COALESCE(lifetime_spent, 0) + ?, updated_at = datetime('now')
    WHERE user_id = ? AND COALESCE(balance, 100) >= ?
  `).bind(amount, amount, userId, amount).run();

  if (Number(result?.meta?.changes || 0) === 0) return null;

  const wallet: any = await getTechCoinWallet(context, userId);
  await logTechCoinEvent(context, userId, "droptech_open", -amount, Number(wallet?.balance || 0), details);

  return wallet;
}

async function logTechCoinEvent(context: any, userId: number, eventType: string, amount: number, balanceAfter: number, details: string) {
  try {
    await ensureTechCoinEventColumns(context);
    await context.env.DB.prepare(`
      INSERT INTO tech_coin_events (user_id, event_type, amount, balance_after, round_gain, details)
      VALUES (?, ?, ?, ?, 0, ?)
    `).bind(userId, eventType, amount, balanceAfter, details.slice(0, 240)).run();
  } catch {
    // Logging should never break the actual DropTech box opening flow.
  }
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
  await context.env.DB.prepare(`
    INSERT INTO droptech_user_boxes (user_id, box_type, quantity, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, box_type) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP
  `).bind(userId, safeBoxType, amount).run();
}

async function openBox(context: any, userId: number, boxType: string) {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const openCost = boxOpenCost(box.id);
  const wallet: any = await getTechCoinWallet(context, userId);
  const owned: any = await context.env.DB.prepare(`SELECT quantity FROM droptech_user_boxes WHERE user_id = ? AND box_type = ?`).bind(userId, box.id).first();
  const ownedQuantity = Number(owned?.quantity || 0);
  const useOwnedBox = ownedQuantity > 0;

  if (!useOwnedBox && Number(wallet?.balance || 0) < openCost) {
    throw new DropTechUserError(`${box.name_tr} almak için ${openCost} Tech Coin gerekiyor. Bakiyen: ${Number(wallet?.balance || 0)}.`, 402);
  }

  if (useOwnedBox) {
    const boxUpdate = await context.env.DB.prepare(`UPDATE droptech_user_boxes SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND box_type = ? AND quantity > 0`).bind(userId, box.id).run();
    if (Number(boxUpdate?.meta?.changes || 0) === 0) throw new DropTechUserError(`Açacak ${box.name_tr} kutun yok.`);
  } else {
    const spentWallet = await spendTechCoinForDropTech(context, userId, openCost, `DropTech ${box.name_tr} satın alma ve açma bedeli`);
    if (!spentWallet) throw new DropTechUserError(`${box.name_tr} almak için ${openCost} Tech Coin gerekiyor. Bakiyen güncel olmayabilir; sayfayı yenile.`, 402);
  }

  const item = pickDropItem(box.id);
  await context.env.DB.prepare(`UPDATE droptech_boxes SET lifetime_opened = lifetime_opened + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(userId).run();
  await context.env.DB.prepare(`
    INSERT INTO droptech_inventory (user_id, item_id, quantity, rarity, emoji, name_tr, name_en, description_tr, description_en)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1, rarity = excluded.rarity, emoji = excluded.emoji, name_tr = excluded.name_tr, name_en = excluded.name_en, description_tr = excluded.description_tr, description_en = excluded.description_en, last_found_at = CURRENT_TIMESTAMP
  `).bind(userId, item.id, item.rarity, item.emoji, item.name_tr, item.name_en, item.description_tr, item.description_en).run();
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
  const boxes = BOX_TYPES.map((boxType) => ({ ...withBoxValue(boxType), quantity: quantityMap.get(boxType.id) || 0, odds: rarityOdds(boxType.id) }));
  const boxCount = boxes.reduce((sum, boxItem) => sum + Number(boxItem.quantity || 0), 0);
  const inventory = (inventoryRows?.results || []).map(enrichInventoryItem);
  const ownedCount = Number(inventory.length || 0);
  const totalQuantity = inventory.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  const collectionValue = inventory.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.tech_coin_value || 0), 0);

  return {
    box_count: boxCount,
    boxes,
    tech_coin_wallet: wallet,
    lifetime_opened: Number(box?.lifetime_opened || 0),
    last_daily_claim: box?.last_daily_claim || null,
    can_claim_daily: box?.last_daily_claim !== today,
    collection_total: DROP_ITEMS.length,
    owned_count: ownedCount,
    total_quantity: totalQuantity,
    collection_value: collectionValue,
    inventory,
    recent: recentRows?.results || [],
    items: DROP_ITEMS,
    box_types: BOX_TYPES.map(withBoxValue),
    odds: rarityOdds("standard_cache"),
    odds_by_box: Object.fromEntries(BOX_TYPES.map((boxType) => [boxType.id, rarityOdds(boxType.id)])),
    value_rules: {
      mode: "collection_value_only",
      box_value_mode: "expected_value_from_drop_odds",
      box_open_spend_enabled: true,
      owned_box_opens_free: true,
      buy_and_open_with_tech_coin: true,
      open_cost_mode: "ceil_expected_value",
      formula: "sum(item_probability * item_tech_coin_value)",
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
  return { ...row, tech_coin_value: value, total_tech_coin_value: Number(row.quantity || 0) * value };
}

function withBoxValue(box: BoxType) {
  const expectedValue = boxExpectedValue(box.id);
  return { ...box, tech_coin_value: expectedValue, open_cost: boxOpenCost(box.id), value_formula: "expected_drop_value" };
}

function boxOpenCost(boxType = "standard_cache") {
  return Math.max(1, Math.ceil(boxExpectedValue(boxType)));
}

function boxExpectedValue(boxType = "standard_cache") {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const totalWeight = DROP_ITEMS.reduce((sum, item) => sum + effectiveWeight(item, box), 0);
  if (!totalWeight) return 0;
  const expected = DROP_ITEMS.reduce((sum, item) => sum + (effectiveWeight(item, box) / totalWeight) * Number(item.tech_coin_value || 0), 0);
  return Number(expected.toFixed(2));
}

function pickDropItem(boxType: string) {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const total = DROP_ITEMS.reduce((sum, item) => sum + effectiveWeight(item, box), 0);
  let roll = Math.random() * total;
  for (const item of DROP_ITEMS) {
    roll -= effectiveWeight(item, box);
    if (roll <= 0) return item;
  }
  return DROP_ITEMS[0];
}

function effectiveWeight(item: DropItem, box: BoxType) {
  return item.weight * (box.multipliers[item.rarity] || 1);
}

function rarityOdds(boxType = "standard_cache") {
  const box = BOX_TYPES.find((entry) => entry.id === boxType) || BOX_TYPES[0];
  const total = DROP_ITEMS.reduce((sum, item) => sum + effectiveWeight(item, box), 0);
  const buckets: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0, glitch: 0 };
  for (const item of DROP_ITEMS) buckets[item.rarity] += effectiveWeight(item, box);
  return Object.fromEntries(Object.entries(buckets).map(([rarity, weight]) => [rarity, Number(((weight / total) * 100).toFixed(2))]));
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
  const user = await context.env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.avatar_url,
      CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role
    FROM sessions JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > datetime('now')
  `).bind(OWNER_EMAIL, token).first();
  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (user.role === "blocked") return { ok: false, status: 403, error: "Bu hesap engellenmiş." };
  if (!OFF_ROLES.includes(String(user.role))) return { ok: false, status: 403, error: "OFF erişimi gerekiyor." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1];
}