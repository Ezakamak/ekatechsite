import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Box, Gift, PackageOpen, RefreshCw, Sparkles } from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";

type Rarity = "common" | "rare" | "epic" | "legendary" | "glitch";

type DropItem = {
  id: string;
  emoji: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  rarity: Rarity;
  tech_coin_value?: number;
};

type InventoryItem = DropItem & {
  item_id?: string;
  quantity: number;
  last_found_at?: string | null;
  total_tech_coin_value?: number;
};

type DropTechState = {
  box_count: number;
  lifetime_opened: number;
  can_claim_daily: boolean;
  collection_total: number;
  owned_count: number;
  total_quantity: number;
  collection_value?: number;
  inventory: InventoryItem[];
  items: DropItem[];
  odds: Record<Rarity, number>;
  won?: DropItem;
  message?: string;
};

const rarityOrder: Rarity[] = ["common", "rare", "epic", "legendary", "glitch"];
const rarityClass: Record<Rarity, string> = {
  common: "border-white/15 bg-white/[0.055] text-white",
  rare: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  epic: "border-purple-300/30 bg-purple-300/10 text-purple-100",
  legendary: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  glitch: "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100",
};
const rarityGlow: Record<Rarity, string> = {
  common: "shadow-white/10",
  rare: "shadow-cyan-400/25",
  epic: "shadow-purple-400/25",
  legendary: "shadow-amber-400/30",
  glitch: "shadow-fuchsia-500/30",
};
const rarityText: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  glitch: "Glitch",
};

function itemName(item: DropItem | InventoryItem, tr: boolean) {
  return tr ? item.name_tr : item.name_en;
}

function itemDescription(item: DropItem | InventoryItem, tr: boolean) {
  return tr ? item.description_tr : item.description_en;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(Number(value || 0));
}

function buildStrip(items: DropItem[], won?: DropItem | null) {
  const pool = items.length ? items : [];
  if (!pool.length) return [];
  const strip: DropItem[] = [];
  for (let i = 0; i < 32; i += 1) strip.push(pool[i % pool.length]);
  if (won) strip.splice(24, 1, won);
  return strip;
}

export function DropTech() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const [state, setState] = useState<DropTechState | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [won, setWon] = useState<DropItem | null>(null);
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = useMemo(() => tr ? {
    loading: "DropTech yükleniyor...",
    title: "DropTech",
    subtitle: "Kutu aç, OFF'a özel koleksiyon parçalarını topla. Eşyalar kullanılmaz; sadece koleksiyonunda Tech Coin değeriyle görünür.",
    boxes: "Kutu",
    opened: "Açılan",
    collection: "Koleksiyon",
    collectionValue: "Koleksiyon değeri",
    itemValue: "Eşya değeri",
    totalValue: "Toplam değer",
    claim: "Günlük kutuyu al",
    claimed: "Bugünkü kutu alındı",
    open: "Kutuyu aç",
    opening: "Kutu açılıyor...",
    noBox: "Açacak kutun yok.",
    won: "Çıkan eşya",
    inventory: "DropTech Collection",
    odds: "Oranlar",
    all: "Tümü",
    owned: "Sahip olunan",
    empty: "Henüz eşya yok. Günlük kutunu alıp aç.",
    add: "Envantere eklendi",
    valueNote: "Bu değer sadece envanterde duran koleksiyon değeridir; kutu açınca Tech Coin bakiyesine eklenmez.",
  } : {
    loading: "Loading DropTech...",
    title: "DropTech",
    subtitle: "Open boxes and collect OFF-exclusive items. Items are not usable; they only appear with Tech Coin value in your collection.",
    boxes: "Boxes",
    opened: "Opened",
    collection: "Collection",
    collectionValue: "Collection value",
    itemValue: "Item value",
    totalValue: "Total value",
    claim: "Claim daily box",
    claimed: "Daily box claimed",
    open: "Open box",
    opening: "Opening box...",
    noBox: "You have no boxes to open.",
    won: "Item found",
    inventory: "DropTech Collection",
    odds: "Odds",
    all: "All",
    owned: "Owned",
    empty: "No items yet. Claim and open your daily box.",
    add: "Added to inventory",
    valueNote: "This is collection value only; opening a box does not add Tech Coin to your wallet.",
  }, [tr]);

  const visibleInventory = useMemo(() => {
    const rows = state?.inventory || [];
    return filter === "all" ? rows : rows.filter((item) => item.rarity === filter);
  }, [state?.inventory, filter]);

  async function loadState() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "DropTech verisi alınamadı.");
      setState(data);
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "DropTech verisi alınamadı." });
    } finally {
      setLoading(false);
    }
  }

  async function claimDaily() {
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_daily" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Günlük kutu alınamadı.");
      setState(data);
      setMessage({ type: data.claimed ? "success" : "error", text: data.message || (data.claimed ? copy.claim : copy.claimed) });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Günlük kutu alınamadı." });
    }
  }

  async function openBox() {
    if (!state || state.box_count <= 0 || opening) {
      setMessage({ type: "error", text: copy.noBox });
      return;
    }
    setOpening(true);
    setWon(null);
    setMessage(null);

    try {
      const response = await fetch("/api/droptech", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Kutu açılamadı.");
      const found = data.won as DropItem;
      window.dispatchEvent(new CustomEvent("ekatech-off-sound", { detail: { key: found?.rarity === "legendary" || found?.rarity === "glitch" ? "win" : "coin" } }));
      setWon(found);
      window.setTimeout(() => {
        setState(data);
        setOpening(false);
      }, 2600);
    } catch (caught) {
      setOpening(false);
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Kutu açılamadı." });
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  if (loading && !state) {
    return (
      <main className="relative min-h-screen bg-black px-4 pb-24 pt-32 text-white sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">{copy.loading}</div>
      </main>
    );
  }

  const strip = buildStrip(state?.items || [], won);
  const boxCount = Number(state?.box_count || 0);
  const collectionValue = Number(state?.collection_value || 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-20 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute right-0 top-72 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-sm text-purple-100">
                <Gift className="h-4 w-4" /> OFF COLLECTION
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight sm:text-7xl">{copy.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{copy.subtitle}</p>
            </div>
            <button onClick={loadState} disabled={loading || opening} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1] disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "..." : "Refresh"}
            </button>
          </div>
          {message && <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{message.text}</div>}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label={copy.boxes} value={formatNumber(boxCount, locale)} />
              <Stat label={copy.opened} value={formatNumber(Number(state?.lifetime_opened || 0), locale)} />
              <Stat label={copy.collection} value={`${formatNumber(Number(state?.owned_count || 0), locale)}/${formatNumber(Number(state?.collection_total || 0), locale)}`} />
              <Stat label={copy.collectionValue} value={`${formatNumber(collectionValue, locale)} TC`} featured />
            </div>
            <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100/80">{copy.valueNote}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={claimDaily} disabled={!state?.can_claim_daily || opening} className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-40">
                <PackageOpen className="h-4 w-4" /> {state?.can_claim_daily ? copy.claim : copy.claimed}
              </button>
              <button onClick={openBox} disabled={boxCount <= 0 || opening} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40">
                <Sparkles className="h-4 w-4" /> {opening ? copy.opening : copy.open}
              </button>
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
              <p className="text-sm font-medium text-white/75">{copy.odds}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {rarityOrder.map((rarity) => <div key={rarity} className={`rounded-2xl border px-3 py-2 text-xs ${rarityClass[rarity]}`}><p className="font-semibold">{rarityText[rarity]}</p><p className="mt-1 opacity-70">%{state?.odds?.[rarity] ?? 0}</p></div>)}
              </div>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 p-5 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-6">
            <div className={`absolute inset-0 opacity-40 ${opening ? "animate-pulse" : ""}`}>
              <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-3xl" />
              <div className="absolute left-1/3 top-1/3 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
              <div className="absolute right-1/4 bottom-1/4 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
            </div>

            <div className="relative z-10 flex min-h-[380px] flex-col items-center justify-center gap-6 text-center">
              {!opening && !won && <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-5">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-[2rem] border border-purple-300/25 bg-purple-300/10 shadow-2xl shadow-purple-500/20">
                  <Box className="h-20 w-20 text-purple-100" />
                  <span className="absolute -right-3 -top-3 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">x{boxCount}</span>
                </div>
                <p className="max-w-sm text-sm leading-6 text-white/50">{boxCount > 0 ? (tr ? "Kutuyu açınca soldan sağa kayan şerit duracak ve çıkan item koleksiyona eklenecek." : "Open a box to stop the moving strip and add the item to your collection.") : copy.noBox}</p>
              </motion.div>}

              {opening && <div className="w-full space-y-8">
                <motion.div animate={{ rotate: [0, -3, 3, -2, 2, 0], scale: [1, 1.04, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] border border-purple-300/30 bg-purple-300/10 shadow-2xl shadow-purple-500/30">
                  <Box className="h-16 w-16 text-purple-100" />
                </motion.div>
                <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/55 py-4">
                  <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-full w-px bg-white/80 shadow-[0_0_30px_rgba(255,255,255,.7)]" />
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-black to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-black to-transparent" />
                  <motion.div animate={{ x: [0, -1660] }} transition={{ duration: 2.35, ease: [0.12, 0.72, 0.18, 1] }} className="flex gap-3 px-8">
                    {strip.map((item, index) => <div key={`${item.id}-${index}`} className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border text-center shadow-xl ${rarityClass[item.rarity]} ${rarityGlow[item.rarity]}`}><span className="text-3xl">{item.emoji}</span><span className="mt-1 max-w-20 truncate text-[10px]">{itemName(item, tr)}</span></div>)}
                  </motion.div>
                </div>
              </div>}

              <AnimatePresence>
                {!opening && won && <motion.div initial={{ opacity: 0, scale: 0.78, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className={`w-full max-w-md rounded-[2rem] border p-6 shadow-2xl ${rarityClass[won.rarity]} ${rarityGlow[won.rarity]}`}>
                  <p className="text-xs uppercase tracking-[0.24em] opacity-65">{copy.won}</p>
                  <div className="mt-4 text-7xl">{won.emoji}</div>
                  <h2 className="mt-4 text-3xl font-semibold">{itemName(won, tr)}</h2>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] opacity-70">{rarityText[won.rarity]}</p>
                  <p className="mt-4 text-sm leading-6 opacity-75">{itemDescription(won, tr)}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/20 px-4 py-2 text-sm font-semibold">
                    <CoinIcon /> {formatNumber(Number(won.tech_coin_value || 0), locale)} TC
                  </div>
                  <button onClick={() => setWon(null)} className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.add}</button>
                </motion.div>}
              </AnimatePresence>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-medium">{copy.inventory}</h2>
              <p className="mt-2 text-sm text-white/45">{copy.owned}: {formatNumber(Number(state?.total_quantity || 0), locale)} · {copy.collectionValue}: {formatNumber(collectionValue, locale)} TC</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>{copy.all}</FilterButton>
              {rarityOrder.map((rarity) => <FilterButton key={rarity} active={filter === rarity} onClick={() => setFilter(rarity)}>{rarityText[rarity]}</FilterButton>)}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {visibleInventory.map((item) => <div key={item.item_id || item.id} className={`rounded-[1.5rem] border p-4 ${rarityClass[item.rarity]}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-4xl">{item.emoji}</span>
                <span className="rounded-full bg-black/25 px-3 py-1 text-xs">x{formatNumber(Number(item.quantity || 0), locale)}</span>
              </div>
              <h3 className="mt-4 font-semibold">{itemName(item, tr)}</h3>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] opacity-60">{rarityText[item.rarity]}</p>
              <p className="mt-3 text-sm leading-6 opacity-70">{itemDescription(item, tr)}</p>
              <div className="mt-4 grid gap-2 text-xs">
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2">
                  <span className="opacity-65">{copy.itemValue}</span>
                  <span className="inline-flex items-center gap-1 font-semibold"><CoinIcon small /> {formatNumber(Number(item.tech_coin_value || 0), locale)} TC</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2">
                  <span className="opacity-65">{copy.totalValue}</span>
                  <span className="inline-flex items-center gap-1 font-semibold"><CoinIcon small /> {formatNumber(Number(item.total_tech_coin_value || 0), locale)} TC</span>
                </div>
              </div>
            </div>)}
            {!visibleInventory.length && <div className="col-span-full rounded-[1.5rem] border border-white/10 bg-black/25 p-6 text-white/45">{copy.empty}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, featured = false }: { label: string; value: string; featured?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${featured ? "border-amber-300/20 bg-amber-300/10" : "border-white/10 bg-black/35"}`}><p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>;
}

function CoinIcon({ small = false }: { small?: boolean }) {
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-300/25 bg-black/40 ${small ? "h-4 w-4" : "h-5 w-5"}`}><img src={coinIcon} alt="Tech Coin" className="h-full w-full object-cover" /></span>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-4 py-2 text-xs font-medium transition ${active ? "border-white/40 bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"}`}>{children}</button>;
}
