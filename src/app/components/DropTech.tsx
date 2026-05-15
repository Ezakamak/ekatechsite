import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Gift, PackageOpen, RefreshCw, Sparkles } from "lucide-react";
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

type InventoryItem = DropItem & { item_id?: string; quantity: number; total_tech_coin_value?: number };

type DropBox = {
  id: string;
  emoji: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  accent: string;
  quantity: number;
  odds: Record<Rarity, number>;
  tech_coin_value?: number;
  open_cost?: number;
};

type TechCoinWallet = {
  balance: number;
  lifetime_earned?: number;
  lifetime_spent?: number;
  best_round?: number;
  perfect_clears?: number;
  total_rounds?: number;
};

type DropTechState = {
  box_count: number;
  boxes?: DropBox[];
  tech_coin_wallet?: TechCoinWallet;
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
  opened_box?: DropBox;
  spent?: number;
};

const rarityOrder: Rarity[] = ["common", "rare", "epic", "legendary", "glitch"];
const rarityText: Record<Rarity, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary", glitch: "Glitch" };
const rarityClass: Record<Rarity, string> = {
  common: "border-white/15 bg-white/[0.055] text-white",
  rare: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  epic: "border-purple-300/30 bg-purple-300/10 text-purple-100",
  legendary: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  glitch: "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100",
};
const boxClass: Record<string, string> = {
  white: "border-white/15 bg-white/[0.055] text-white",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  purple: "border-purple-300/25 bg-purple-300/10 text-purple-100",
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  rose: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  fuchsia: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100",
};

const STRIP_TARGET_INDEX = 26;
const STRIP_ITEM_WIDTH = 96;
const STRIP_GAP = 12;
const STRIP_PADDING_LEFT = 32;
const STRIP_ITEM_CENTER = STRIP_ITEM_WIDTH / 2;
const STRIP_STEP = STRIP_ITEM_WIDTH + STRIP_GAP;
const STRIP_STOP_OFFSET = STRIP_PADDING_LEFT + STRIP_TARGET_INDEX * STRIP_STEP + STRIP_ITEM_CENTER;

function nameOf(item: DropItem | InventoryItem | DropBox | null | undefined, tr: boolean) {
  if (!item) return "";
  return tr ? item.name_tr : item.name_en;
}
function descOf(item: DropItem | InventoryItem | DropBox | null | undefined, tr: boolean) {
  if (!item) return "";
  return tr ? item.description_tr : item.description_en;
}
function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value || 0));
}
function buildStrip(items: DropItem[], won?: DropItem | null) {
  const source = items.length ? items : won ? [won] : [];
  if (!source.length) return [];
  const strip: DropItem[] = [];
  const offset = won ? won.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) : 0;
  for (let i = 0; i < 44; i += 1) {
    strip.push(source[(i * 7 + offset) % source.length]);
  }
  if (won) strip[STRIP_TARGET_INDEX] = won;
  return strip;
}

export function DropTech() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const [state, setState] = useState<DropTechState | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState("standard_cache");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [won, setWon] = useState<DropItem | null>(null);
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = useMemo(() => tr ? {
    loading: "DropTech yükleniyor...",
    title: "DropTech",
    subtitle: "11 farklı kutu türünden birini seç, OFF'a özel koleksiyon parçalarını topla.",
    boxes: "Kutular",
    boxTypes: "Kutu türleri",
    opened: "Açılan",
    collection: "Koleksiyon",
    collectionValue: "Koleksiyon değeri",
    boxValue: "Kutu değeri",
    openCost: "Açma bedeli",
    balance: "Cüzdan bakiyesi",
    expectedValue: "Beklenen değer",
    itemValue: "Eşya değeri",
    totalValue: "Toplam değer",
    claim: "Günlük kutuyu al",
    claimed: "Bugünkü kutu alındı",
    buyAndOpen: "Tech Coin ile al ve aç",
    open: "Seçili kutuyu aç",
    opening: "Kutu açılıyor...",
    preparing: "Sonuç hazırlanıyor...",
    notEnough: "Yeterli Tech Coin yok.",
    won: "Çıkan eşya",
    inventory: "DropTech Collection",
    odds: "Seçili kutu oranları",
    all: "Tümü",
    owned: "Sahip olunan",
    empty: "Henüz eşya yok. Günlük kutunu alıp aç veya Tech Coin ile kutu aç.",
    add: "Envantere eklendi",
    valueNote: "Kutun varsa ücretsiz açılır. Kutun yoksa seçili kutu Tech Coin bakiyenle satın alınıp açılır.",
  } : {
    loading: "Loading DropTech...",
    title: "DropTech",
    subtitle: "Choose one of 11 box types and collect OFF-exclusive items.",
    boxes: "Boxes",
    boxTypes: "Box types",
    opened: "Opened",
    collection: "Collection",
    collectionValue: "Collection value",
    boxValue: "Box value",
    openCost: "Open cost",
    balance: "Wallet balance",
    expectedValue: "Expected value",
    itemValue: "Item value",
    totalValue: "Total value",
    claim: "Claim daily box",
    claimed: "Daily box claimed",
    buyAndOpen: "Buy and open with Tech Coin",
    open: "Open selected box",
    opening: "Opening box...",
    preparing: "Preparing result...",
    notEnough: "Not enough Tech Coin.",
    won: "Item found",
    inventory: "DropTech Collection",
    odds: "Selected box odds",
    all: "All",
    owned: "Owned",
    empty: "No items yet. Claim your daily box or open a box with Tech Coin.",
    add: "Added to inventory",
    valueNote: "Owned boxes open for free. If you do not own the selected box, it is bought and opened with your Tech Coin balance.",
  }, [tr]);

  const boxes = state?.boxes || [];
  const selectedBox = boxes.find((box) => box.id === selectedBoxId) || boxes[0] || null;
  const selectedOdds = selectedBox?.odds || state?.odds || { common: 0, rare: 0, epic: 0, legendary: 0, glitch: 0 };
  const selectedQuantity = Number(selectedBox?.quantity || 0);
  const selectedBoxValue = Number(selectedBox?.tech_coin_value || 0);
  const selectedOpenCost = Number(selectedBox?.open_cost || Math.max(1, Math.ceil(selectedBoxValue)));
  const walletBalance = Number(state?.tech_coin_wallet?.balance || 0);
  const hasOwnedSelectedBox = selectedQuantity > 0;
  const canAffordSelectedBox = walletBalance >= selectedOpenCost;
  const canOpenSelectedBox = hasOwnedSelectedBox || canAffordSelectedBox;
  const visibleInventory = (state?.inventory || []).filter((item) => filter === "all" || item.rarity === filter);

  async function loadState() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "DropTech verisi alınamadı.");
      setState(data);
      if (data?.boxes?.[0]?.id && !data.boxes.some((box: DropBox) => box.id === selectedBoxId)) setSelectedBoxId(data.boxes[0].id);
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "DropTech verisi alınamadı." });
    } finally {
      setLoading(false);
    }
  }

  async function claimDaily() {
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim_daily" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Günlük kutu alınamadı.");
      setState(data);
      setSelectedBoxId("standard_cache");
      setMessage({ type: data.claimed ? "success" : "error", text: data.message || (data.claimed ? copy.claim : copy.claimed) });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Günlük kutu alınamadı." });
    }
  }

  async function openBox() {
    if (!selectedBox || opening) return;
    if (!canOpenSelectedBox) {
      setMessage({ type: "error", text: `${copy.notEnough} ${copy.openCost}: ${formatNumber(selectedOpenCost, locale)} TC · ${copy.balance}: ${formatNumber(walletBalance, locale)} TC` });
      return;
    }
    setOpening(true);
    setWon(null);
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "open", box_type: selectedBox.id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Kutu açılamadı.");
      const found = data.won as DropItem;
      window.dispatchEvent(new CustomEvent("ekatech-off-sound", { detail: { key: found?.rarity === "legendary" || found?.rarity === "glitch" ? "win" : "coin" } }));
      setWon(found);
      window.setTimeout(() => { setState(data); setOpening(false); }, 2700);
    } catch (caught) {
      setOpening(false);
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Kutu açılamadı." });
    }
  }

  useEffect(() => { loadState(); }, []);

  if (loading && !state) return <main className="relative min-h-screen bg-black px-4 pb-24 pt-32 text-white sm:px-6"><div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">{copy.loading}</div></main>;

  const strip = buildStrip(state?.items || [], won);
  const boxCount = Number(state?.box_count || 0);
  const collectionValue = Number(state?.collection_value || 0);
  const openButtonDisabled = opening || !canOpenSelectedBox;
  const openButtonText = opening ? copy.opening : hasOwnedSelectedBox ? copy.open : canAffordSelectedBox ? copy.buyAndOpen : copy.notEnough;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-20 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-sm text-purple-100"><Gift className="h-4 w-4" /> OFF COLLECTION</div><h1 className="mt-5 text-5xl font-medium tracking-tight sm:text-7xl">{copy.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{copy.subtitle}</p></div>
            <button onClick={loadState} disabled={loading || opening} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
          </div>
          {message && <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{message.text}</div>}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-medium">{copy.boxTypes}</h2>
              <p className="mt-2 text-sm text-white/45">{nameOf(selectedBox, tr)} · x{selectedQuantity} · {copy.openCost}: {formatNumber(selectedOpenCost, locale)} TC · {copy.balance}: {formatNumber(walletBalance, locale)} TC</p>
            </div>
            <button onClick={claimDaily} disabled={!state?.can_claim_daily || opening} className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-40"><PackageOpen className="h-4 w-4" /> {state?.can_claim_daily ? copy.claim : copy.claimed}</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {boxes.map((box) => {
              const openCost = Number(box.open_cost || Math.max(1, Math.ceil(Number(box.tech_coin_value || 0))));
              return <button key={box.id} type="button" onClick={() => setSelectedBoxId(box.id)} className={`rounded-[1.35rem] border p-4 text-left transition ${boxClass[box.accent] || boxClass.white} ${box.id === selectedBoxId ? "ring-2 ring-white/60" : "opacity-80 hover:opacity-100"}`}><div className="flex items-start justify-between"><span className="text-3xl">{box.emoji}</span><span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold">x{formatNumber(Number(box.quantity || 0), locale)}</span></div><h3 className="mt-3 font-semibold">{nameOf(box, tr)}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 opacity-65">{descOf(box, tr)}</p><div className="mt-3 inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold"><CoinIcon small /> {formatNumber(openCost, locale)} TC</div></button>;
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="grid gap-3 sm:grid-cols-4"><Stat label={copy.boxes} value={formatNumber(boxCount, locale)} /><Stat label={copy.balance} value={`${formatNumber(walletBalance, locale)} TC`} /><Stat label={copy.collection} value={`${formatNumber(Number(state?.owned_count || 0), locale)}/${formatNumber(Number(state?.collection_total || 0), locale)}`} /><Stat label={copy.openCost} value={`${formatNumber(selectedOpenCost, locale)} TC`} featured /></div>
            <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100/80">{copy.valueNote}</p>
            <button onClick={openBox} disabled={openButtonDisabled} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40"><Sparkles className="h-4 w-4" /> {openButtonText}</button>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/35 p-4"><p className="text-sm font-medium text-white/75">{copy.odds}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{rarityOrder.map((rarity) => <div key={rarity} className={`rounded-2xl border px-3 py-2 text-xs ${rarityClass[rarity]}`}><p className="font-semibold">{rarityText[rarity]}</p><p className="mt-1 opacity-70">%{selectedOdds?.[rarity] ?? 0}</p></div>)}</div></div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 p-5 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-6">
            <div className="relative z-10 flex min-h-[380px] flex-col items-center justify-center gap-6 text-center">
              {!opening && !won && <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-5"><div className={`relative flex h-40 w-40 items-center justify-center rounded-[2rem] border shadow-2xl ${boxClass[selectedBox?.accent || "purple"] || boxClass.purple}`}><span className="text-7xl">{selectedBox?.emoji || "📦"}</span><span className="absolute -right-3 -top-3 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">x{selectedQuantity}</span></div><div><p className="font-medium">{nameOf(selectedBox, tr)}</p><p className="mt-2 max-w-sm text-sm leading-6 text-white/50">{descOf(selectedBox, tr)}</p><div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm"><CoinIcon /> {copy.openCost}: {formatNumber(selectedOpenCost, locale)} TC</div></div></motion.div>}
              {opening && !won && <div className="flex flex-col items-center gap-5"><motion.div animate={{ rotate: [0, -4, 4, -2, 2, 0], scale: [1, 1.06, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className={`mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] border shadow-2xl ${boxClass[selectedBox?.accent || "purple"] || boxClass.purple}`}><span className="text-6xl">{selectedBox?.emoji || "📦"}</span></motion.div><p className="text-sm text-white/45">{copy.preparing}</p></div>}
              {opening && won && <div className="w-full space-y-8"><motion.div animate={{ rotate: [0, -3, 3, -2, 2, 0], scale: [1, 1.04, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className={`mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] border shadow-2xl ${boxClass[selectedBox?.accent || "purple"] || boxClass.purple}`}><span className="text-6xl">{selectedBox?.emoji || "📦"}</span></motion.div><div className="relative mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/55 py-4"><div className="pointer-events-none absolute left-1/2 top-0 z-20 h-full w-px bg-white/80 shadow-[0_0_30px_rgba(255,255,255,.7)]" /><motion.div key={`${won.id}-${Date.now()}`} animate={{ x: ["0px", `calc(50% - ${STRIP_STOP_OFFSET}px)`] }} transition={{ duration: 2.45, ease: [0.12, 0.72, 0.18, 1] }} className="flex gap-3 px-8" style={{ width: "max-content" }}>{strip.map((item, index) => <div key={`${item.id}-${index}`} className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border text-center shadow-xl ${index === STRIP_TARGET_INDEX ? "ring-2 ring-white/80" : ""} ${rarityClass[item.rarity]}`}><span className="text-3xl">{item.emoji}</span><span className="mt-1 max-w-20 truncate text-[10px]">{nameOf(item, tr)}</span></div>)}</motion.div></div></div>}
              <AnimatePresence>{!opening && won && <motion.div initial={{ opacity: 0, scale: 0.78, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className={`w-full max-w-md rounded-[2rem] border p-6 shadow-2xl ${rarityClass[won.rarity]}`}><p className="text-xs uppercase tracking-[0.24em] opacity-65">{copy.won}</p><div className="mt-4 text-7xl">{won.emoji}</div><h2 className="mt-4 text-3xl font-semibold">{nameOf(won, tr)}</h2><p className="mt-2 text-sm uppercase tracking-[0.18em] opacity-70">{rarityText[won.rarity]}</p><p className="mt-4 text-sm leading-6 opacity-75">{descOf(won, tr)}</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/20 px-4 py-2 text-sm font-semibold"><CoinIcon /> {copy.itemValue}: {formatNumber(Number(won.tech_coin_value || 0), locale)} TC</div><button onClick={() => setWon(null)} className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.add}</button></motion.div>}</AnimatePresence>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-3xl font-medium">{copy.inventory}</h2><p className="mt-2 text-sm text-white/45">{copy.owned}: {formatNumber(Number(state?.total_quantity || 0), locale)} · {copy.collectionValue}: {formatNumber(collectionValue, locale)} TC</p></div><div className="flex flex-wrap gap-2"><FilterButton active={filter === "all"} onClick={() => setFilter("all")}>{copy.all}</FilterButton>{rarityOrder.map((rarity) => <FilterButton key={rarity} active={filter === rarity} onClick={() => setFilter(rarity)}>{rarityText[rarity]}</FilterButton>)}</div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{visibleInventory.map((item) => <div key={item.item_id || item.id} className={`rounded-[1.5rem] border p-4 ${rarityClass[item.rarity]}`}><div className="flex items-start justify-between gap-3"><span className="text-4xl">{item.emoji}</span><span className="rounded-full bg-black/25 px-3 py-1 text-xs">x{formatNumber(Number(item.quantity || 0), locale)}</span></div><h3 className="mt-4 font-semibold">{nameOf(item, tr)}</h3><p className="mt-1 text-xs uppercase tracking-[0.16em] opacity-60">{rarityText[item.rarity]}</p><p className="mt-3 text-sm leading-6 opacity-70">{descOf(item, tr)}</p><div className="mt-4 grid gap-2 text-xs"><ValueRow label={copy.itemValue} value={Number(item.tech_coin_value || 0)} locale={locale} /><ValueRow label={copy.totalValue} value={Number(item.total_tech_coin_value || 0)} locale={locale} /></div></div>)}{!visibleInventory.length && <div className="col-span-full rounded-[1.5rem] border border-white/10 bg-black/25 p-6 text-white/45">{copy.empty}</div>}</div>
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
function ValueRow({ label, value, locale }: { label: string; value: number; locale: string }) {
  return <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2"><span className="opacity-65">{label}</span><span className="inline-flex items-center gap-1 font-semibold"><CoinIcon small /> {formatNumber(value, locale)} TC</span></div>;
}
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-4 py-2 text-xs font-medium transition ${active ? "border-white/40 bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"}`}>{children}</button>;
}
