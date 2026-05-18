import { awardGameExp, getLevelProgress } from "../_levels";
const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

type TechStorePackage = {
  slug: string;
  name: string;
  priceTl: string;
  techCoin: number;
  exp: number;
};

type ShopItem = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  roulette_value: number;
  rarity: string;
};

const TL_PACKAGES: TechStorePackage[] = [
  { slug: "neon-kayip-cuzdan", name: "Neon Kayıp Cüzdan", priceTl: "49,99 TL", techCoin: 5000, exp: 500 },
  { slug: "fuzyon-paketi", name: "Füzyon Paketi", priceTl: "129,99 TL", techCoin: 14000, exp: 2000 },
  { slug: "kuantum-paketi", name: "Kuantum Paketi", priceTl: "299,99 TL", techCoin: 35000, exp: 5000 },
];

const SHOP_CATALOG: ShopItem[] = [
  {
    slug: "pahali-tesbih",
    name: "Pahalı Tesbih",
    emoji: "📿",
    description:
      "Racon masasında ağır duran koleksiyon tesbihi. Sadece Tech Roulette masasına değer olarak koyulur.",
    price: 25000,
    roulette_value: 25000,
    rarity: "Racon",
  },
  {
    slug: "usta-caki",
    name: "Usta Çakısı",
    emoji: "🔪",
    description:
      "OFF Hub vitrini için gösterişli çakı. Kumar dışı; yalnızca rulette bahis değeri olarak kullanılabilir.",
    price: 50000,
    roulette_value: 50000,
    rarity: "Ağır",
  },
  {
    slug: "gumus-yuzuk",
    name: "Gümüş Racon Yüzüğü",
    emoji: "💍",
    description:
      "Masaya para yerine koymalık pahalı aksesuar. Tech Coin cüzdanından ayrı envanterde saklanır.",
    price: 75000,
    roulette_value: 75000,
    rarity: "Prestij",
  },
  {
    slug: "altin-saat",
    name: "Altın Racon Saati",
    emoji: "⌚",
    description:
      "Masada zamanı ve ağırlığı gösteren gösterişli saat. Tech Store'dan alınır, rulette bahis değeri taşır.",
    price: 90000,
    roulette_value: 90000,
    rarity: "Racon+",
  },
  {
    slug: "usta-cakmak",
    name: "Usta Çakmağı",
    emoji: "🪔",
    description:
      "Sohbet masasında imza aksesuarı. Sadece Tech Roulette masasında değer olarak kullanılır.",
    price: 35000,
    roulette_value: 35000,
    rarity: "Racon",
  },
  {
    slug: "deri-cuzdan",
    name: "Halis Deri Cüzdan",
    emoji: "👝",
    description:
      "OFF vitrini için ağır deri cüzdan. Tech Coin cüzdanından ayrı koleksiyon eşyasıdır.",
    price: 60000,
    roulette_value: 60000,
    rarity: "Ağır",
  },
];

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureShopTables(context);
    await ensureWallet(context, auth.user.id);
    const [wallet, inventory] = await Promise.all([
      getWallet(context, auth.user.id),
      loadInventory(context, auth.user.id),
    ]);
    return Response.json({
      ok: true,
      catalog: SHOP_CATALOG,
      tlPackages: TL_PACKAGES,
      inventory,
      wallet,
      level: await getLevelProgress(context, auth.user.id),
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  const body = await context.request.json().catch(() => null);
  const slug = String(body?.slug || "");
  const purchaseType = String(body?.type || "item");

  if (purchaseType === "tl-package") {
    const pack = TL_PACKAGES.find((entry) => entry.slug === slug);
    if (!pack) return Response.json({ error: "Tech Store paketi bulunamadı." }, { status: 400 });

    try {
      await ensureShopTables(context);
      await ensureWallet(context, auth.user.id);
      await context.env.DB.prepare(
        `UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`,
      )
        .bind(pack.techCoin, pack.techCoin, auth.user.id)
        .run();
      await context.env.DB.prepare(
        `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
      )
        .bind(auth.user.id, pack.techCoin, `Tech Store TL paketi: ${pack.name} (${pack.priceTl})`)
        .run();
      const level = await awardGameExp(context, auth.user.id, pack.exp, `Tech Store TL paketi: ${pack.name}`, "store");
      const [wallet, inventory] = await Promise.all([
        getWallet(context, auth.user.id),
        loadInventory(context, auth.user.id),
      ]);
      return Response.json({
        ok: true,
        message: `${pack.name} aktif edildi: +${pack.techCoin.toLocaleString("tr-TR")} TC, +${pack.exp.toLocaleString("tr-TR")} EXP.`,
        wallet,
        inventory,
        level,
      });
    } catch (error) {
      return Response.json({ error: readableError(error) }, { status: 500 });
    }
  }

  const item = SHOP_CATALOG.find((entry) => entry.slug === slug);
  if (!item)
    return Response.json(
      { error: "Mağaza ürünü bulunamadı." },
      { status: 400 },
    );

  try {
    await ensureShopTables(context);
    await ensureWallet(context, auth.user.id);
    const beforeWallet = await getWallet(context, auth.user.id);
    const debit = await context.env.DB.prepare(
      `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
    )
      .bind(item.price, auth.user.id, item.price)
      .run();

    if ((debit.meta?.changes || 0) < 1) {
      return Response.json(
        { error: "Yetersiz Tech Coin bakiyesi.", wallet: beforeWallet },
        { status: 402 },
      );
    }

    await context.env.DB.prepare(
      `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
    )
      .bind(auth.user.id, -item.price, `OFF Mağaza alışverişi: ${item.name}`)
      .run();

    await context.env.DB.prepare(
      `INSERT INTO off_shop_inventory (user_id, item_slug, item_name, emoji, roulette_value, status, acquired_at) VALUES (?, ?, ?, ?, ?, 'available', datetime('now'))`,
    )
      .bind(auth.user.id, item.slug, item.name, item.emoji, item.roulette_value)
      .run();

    const [wallet, inventory] = await Promise.all([
      getWallet(context, auth.user.id),
      loadInventory(context, auth.user.id),
    ]);
    return Response.json({
      ok: true,
      message: `${item.name} envantere eklendi.`,
      wallet,
      inventory,
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 500 });
  }
}

async function ensureShopTables(context: any) {
  await ensureCoinTables(context);
  await context.env.DB.prepare(
    `
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
    )
  `,
  ).run();
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_off_shop_inventory_user_status ON off_shop_inventory(user_id, status, id DESC)`,
  ).run();
}

async function ensureCoinTables(context: any) {
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance REAL DEFAULT 100, lifetime_earned REAL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`,
  )
    .bind(userId)
    .run();
}

async function getWallet(context: any, userId: number) {
  const wallet = await context.env.DB.prepare(
    `SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Number(wallet?.balance || 0),
    lifetime_earned: Number(wallet?.lifetime_earned || 0),
    updated_at: wallet?.updated_at || null,
  };
}

function loadInventory(context: any, userId: number) {
  return context.env.DB.prepare(
    `SELECT id, item_slug, item_name, emoji, roulette_value, status, acquired_at, used_at, roulette_bet_id FROM off_shop_inventory WHERE user_id = ? ORDER BY id DESC LIMIT 80`,
  )
    .bind(userId)
    .all()
    .then((result: any) => result?.results || []);
}

async function requireOffUser(context: any) {
  const token = getCookie(
    context.request.headers.get("Cookie") || "",
    "session",
  );
  if (!token)
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(
    `SELECT users.id, users.name, users.email, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`,
  )
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!["off", "admin", "owner"].includes(user.role))
    return { ok: false, status: 403, error: "OFF erişimi gerekli." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function readableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "OFF mağaza işlemi tamamlanamadı.";
}
