import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Coins, Gift, PackageOpen, RefreshCw, Repeat2, Send, Sparkles, Swords } from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";
import { playOffSound } from "./OffSoundEngine";

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
  series_id?: string;
  series_name_tr?: string;
  series_name_en?: string;
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
  value_ratio?: number;
  series_count?: number;
  base_fee?: number;
  edge?: number;
};

type TechCoinWallet = {
  balance: number;
  lifetime_earned?: number;
  lifetime_spent?: number;
  best_round?: number;
  perfect_clears?: number;
  total_rounds?: number;
};

type OnlineUser = { id: number; name: string; avatar_url?: string | null; last_seen_at?: string };
type BattleState = "lobby" | "countdown" | "opening_round" | "revealing_result" | "score_update" | "next_round_transition" | "finished" | "cancelled";
type BattleRound = { round_number: number; box_type: string; creator_points: number; opponent_points: number; creator_item?: DropItem | null; opponent_item?: DropItem | null };
type BattleLobby = { id: number; creator_user_id: number; opponent_user_id?: number | null; opponent_is_bot?: number; status: "waiting" | "in_progress" | "completed" | "cancelled"; battle_state?: BattleState | null; current_round?: number | null; creator_name: string; creator_avatar_url?: string | null; opponent_name?: string | null; opponent_avatar_url?: string | null; box_sequence: string[]; boxes?: DropBox[]; cost: number; creator_score?: number; opponent_score?: number; winner_user_id?: number | null; winner_side?: "creator" | "opponent" | null; rounds?: BattleRound[]; emotes?: { id: number; user_id: number; name: string; emoji: string; created_at: string }[] };

type TradeOffer = {
  id: number;
  proposer_id: number;
  recipient_id: number;
  proposer_name: string;
  recipient_name: string;
  offer_quantity: number;
  request_quantity: number;
  status: "pending_request" | "pending" | "active" | "ready" | "completed" | "accepted" | "declined" | "cancelled";
  proposer_ready?: number;
  recipient_ready?: number;
  proposer_confirmed?: number;
  recipient_confirmed?: number;
  offer_item?: DropItem | null;
  request_item?: DropItem | null;
};

type DropTechState = {
  user_id?: number;
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
  online_users?: OnlineUser[];
  trades?: TradeOffer[];
  battles?: BattleLobby[];
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
  lime: "border-lime-300/25 bg-lime-300/10 text-lime-100",
  blue: "border-blue-300/25 bg-blue-300/10 text-blue-100",
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
  const [stripTravel, setStripTravel] = useState<number | null>(null);
  const stripViewportRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [tradeUserId, setTradeUserId] = useState("");
  const [battleSequence, setBattleSequence] = useState<string[]>(["standard_cache", "signal_crate", "circuit_box"]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = useMemo(() => tr ? {
    loading: "DropTech yükleniyor...",
    title: "DropTech",
    subtitle: "15 farklı kutu türünden birini seç, OFF'a özel koleksiyon parçalarını topla, eşyalarını bozdur veya online takas yap.",
    boxes: "Kutular",
    boxTypes: "Kutu türleri",
    opened: "Açılan",
    collection: "Koleksiyon",
    collectionValue: "Koleksiyon değeri",
    boxValue: "Kutu değeri",
    openCost: "Açma bedeli",
    balance: "Cüzdan bakiyesi",
    expectedValue: "Beklenen değer",
    valueRatio: "Beklenen değer / açma bedeli",
    itemCount: "Toplam item",
    seriesName: "Seri adı",
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
    sell: "Tech Coin'e çevir",
    sellAll: "Tümünü Tech Coin'e çevir",
    sellAllConfirm: "Envanterdeki tüm eşyalar Tech Coin'e çevrilsin mi?",
    sellAllEmpty: "Bozdurulacak eşya yok.",
    trade: "Online takas",
    online: "Online kullanıcılar",
    noOnline: "Şu an başka online kullanıcı yok.",
    offer: "Oyuncu A eşyası",
    request: "Oyuncu B eşyası",
    sendTrade: "Takas isteği gönder",
    incoming: "Takaslar",
    outgoing: "Giden istekler",
    accept: "İsteği kabul et",
    decline: "Reddet",
    cancel: "İptal et",
    qty: "Adet",
    tradeFlow: "1) İstek gönderilir  2) Karşı taraf kabul eder  3) İki taraf eşya koyar  4) İki taraf Hazır der  5) Son onayda ikisi de onaylar",
    selectItem: "Eşya seç",
    saveItem: "Eşyayı koy",
    ready: "Hazır",
    unready: "Hazırı kaldır",
    finalConfirm: "Son onay",
    confirm: "Onayla",
    waitingOther: "Diğer oyuncu bekleniyor",
    requestPending: "İstek bekliyor",
    activeTrade: "Eşya koyma aşaması",
    completed: "Tamamlandı",
    valueNote: "Kutun varsa ücretsiz açılır. Kutun yoksa seçili kutu Tech Coin bakiyenle satın alınıp açılır.",
  } : {
    loading: "Loading DropTech...",
    title: "DropTech",
    subtitle: "Choose one of 15 box types, collect OFF-exclusive items, redeem them or trade online.",
    boxes: "Boxes",
    boxTypes: "Box types",
    opened: "Opened",
    collection: "Collection",
    collectionValue: "Collection value",
    boxValue: "Box value",
    openCost: "Open cost",
    balance: "Wallet balance",
    expectedValue: "Expected value",
    valueRatio: "Expected value / open cost",
    itemCount: "Total items",
    seriesName: "Series name",
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
    sell: "Convert to Tech Coin",
    sellAll: "Convert all to Tech Coin",
    sellAllConfirm: "Convert every inventory item to Tech Coin?",
    sellAllEmpty: "No items to convert.",
    trade: "Online trade",
    online: "Online users",
    noOnline: "No other online users right now.",
    offer: "Player A item",
    request: "Player B item",
    sendTrade: "Send trade request",
    incoming: "Trades",
    outgoing: "Outgoing requests",
    accept: "Accept request",
    decline: "Decline",
    cancel: "Cancel",
    qty: "Qty",
    tradeFlow: "1) Request is sent  2) Other player accepts  3) Both add items  4) Both mark Ready  5) Both approve final confirmation",
    selectItem: "Select item",
    saveItem: "Add item",
    ready: "Ready",
    unready: "Unready",
    finalConfirm: "Final confirmation",
    confirm: "Confirm",
    waitingOther: "Waiting for other player",
    requestPending: "Request pending",
    activeTrade: "Adding items",
    completed: "Completed",
    valueNote: "Owned boxes open for free. If you do not own the selected box, it is bought and opened with your Tech Coin balance.",
  }, [tr]);

  const boxes = state?.boxes || [];
  const selectedBox = boxes.find((box) => box.id === selectedBoxId) || boxes[0] || null;
  const selectedOdds = selectedBox?.odds || state?.odds || { common: 0, rare: 0, epic: 0, legendary: 0, glitch: 0 };
  const selectedQuantity = Number(selectedBox?.quantity || 0);
  const selectedBoxValue = Number(selectedBox?.tech_coin_value || 0);
  const selectedOpenCost = Number(selectedBox?.open_cost || Math.max(1, Math.ceil(selectedBoxValue)));
  const selectedValueRatio = Number(selectedBox?.value_ratio ?? (selectedOpenCost ? selectedBoxValue / selectedOpenCost : 0));
  const selectedSeriesCount = Number(selectedBox?.series_count || 0);
  const walletBalance = Number(state?.tech_coin_wallet?.balance || 0);
  const hasOwnedSelectedBox = selectedQuantity > 0;
  const canAffordSelectedBox = walletBalance >= selectedOpenCost;
  const canOpenSelectedBox = hasOwnedSelectedBox || canAffordSelectedBox;
  const visibleInventory = (state?.inventory || []).filter((item) => filter === "all" || item.rarity === filter);
  const inventoryItems = state?.inventory || [];
  const onlineUsers = state?.online_users || [];
  const trades = state?.trades || [];
  const currentUserId = Number(state?.user_id || 0);
  const openStatuses = ["pending_request", "pending", "active", "ready"];
  const incomingTrades = trades.filter((trade) => openStatuses.includes(trade.status) && (Number(trade.recipient_id) === currentUserId || Number(trade.proposer_id) === currentUserId));

  async function loadState() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "DropTech verisi alınamadı.");
      setState(data);
      if (!tradeUserId && data?.online_users?.[0]?.id) setTradeUserId(String(data.online_users[0].id));
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

  async function postAction(body: Record<string, unknown>, fallback: string) {
    const response = await fetch("/api/droptech", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || fallback);
    setState(data);
    return data;
  }

  async function sellItem(item: InventoryItem) {
    setMessage(null);
    try {
      const data = await postAction({ action: "sell_item", item_id: item.item_id || item.id, quantity: 1 }, "Eşya bozdurulamadı.");
      setMessage({ type: "success", text: `${nameOf(item, tr)} +${formatNumber(Number(data?.sold?.payout || item.tech_coin_value || 0), locale)} TC` });
      playOffSound("coin");
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Eşya bozdurulamadı." });
    }
  }

  async function sellAllItems() {
    if (!inventoryItems.length) {
      setMessage({ type: "error", text: copy.sellAllEmpty });
      return;
    }
    if (!window.confirm(copy.sellAllConfirm)) return;
    setMessage(null);
    try {
      const data = await postAction({ action: "sell_all_items" }, "Envanter bozdurulamadı.");
      setMessage({ type: "success", text: `${copy.sellAll}: +${formatNumber(Number(data?.sold_all?.payout || 0), locale)} TC` });
      playOffSound("coin");
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Envanter bozdurulamadı." });
    }
  }

  async function createBattle() {
    setMessage(null);
    try {
      const data = await postAction({ action: "create_battle", box_sequence: battleSequence }, "Battle lobisi oluşturulamadı.");
      setMessage({ type: "success", text: tr ? "Kasa savaşı lobisi oluşturuldu." : "Case battle lobby created." });
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      if (data?.battles?.[0]?.id) playOffSound("coin");
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Battle lobisi oluşturulamadı." });
    }
  }

  async function openBattleRound(battleId: number) {
    return postAction({ action: "battle_next_round", battle_id: battleId }, "Battle round açılamadı.");
  }

  async function joinBattle(battleId: number, bot = false) {
    setMessage(null);
    try {
      await postAction({ action: bot ? "battle_bot" : "join_battle", battle_id: battleId }, "Battle başlatılamadı.");
      setMessage({ type: "success", text: bot ? (tr ? "Bot oyuna kilitlendi; savaş başladı." : "Bot locked in; battle started.") : (tr ? "Battle başladı; oyuncular kilitlendi." : "Battle started; players locked.") });
      playOffSound("win");
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Battle başlatılamadı." });
    }
  }

  async function sendBattleEmoji(battleId: number, emoji: string) {
    try {
      await postAction({ action: "battle_emoji", battle_id: battleId, emoji }, "Emoji gönderilemedi.");
      playOffSound("coin");
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Emoji gönderilemedi." });
    }
  }

  async function sendTrade() {
    setMessage(null);
    try {
      await postAction({ action: "create_trade", recipient_id: Number(tradeUserId) }, "Takas isteği gönderilemedi.");
      setMessage({ type: "success", text: tr ? "Takas isteği gönderildi." : "Trade request sent." });
      playOffSound("trade");
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Takas teklifi gönderilemedi." });
    }
  }

  async function respondTrade(tradeId: number, action: "accept_trade" | "decline_trade" | "cancel_trade" | "set_trade_ready" | "confirm_trade", extra: Record<string, unknown> = {}) {
    setMessage(null);
    try {
      await postAction({ action, trade_id: tradeId, ...extra }, "Takas güncellenemedi.");
      setMessage({ type: "success", text: tr ? "Takas güncellendi." : "Trade updated." });
      playOffSound(action === "confirm_trade" ? "success" : action === "decline_trade" || action === "cancel_trade" ? "click" : "trade");
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Takas güncellenemedi." });
    }
  }


  async function updateTradeItems(tradeId: number, itemId: string, quantity: number) {
    setMessage(null);
    try {
      await postAction({ action: "update_trade_items", trade_id: tradeId, item_id: itemId, quantity }, "Takas eşyası güncellenemedi.");
      setMessage({ type: "success", text: tr ? "Takas eşyası koyuldu." : "Trade item added." });
      playOffSound("trade");
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Takas eşyası güncellenemedi." });
    }
  }

  async function openBox() {
    if (!selectedBox || opening) return;
    if (!canOpenSelectedBox) {
      setMessage({ type: "error", text: `${copy.notEnough} ${copy.openCost}: ${formatNumber(selectedOpenCost, locale)} TC · ${copy.balance}: ${formatNumber(walletBalance, locale)} TC` });
      playOffSound("error");
      return;
    }
    setOpening(true);
    setWon(null);
    setStripTravel(null);
    setMessage(null);
    try {
      const response = await fetch("/api/droptech", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "open", box_type: selectedBox.id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Kutu açılamadı.");
      const found = data.won as DropItem;
      playOffSound(found?.rarity === "legendary" || found?.rarity === "glitch" ? "win" : "reel");
      setWon(found);
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      window.setTimeout(() => { setState(data); setOpening(false); }, 2700);
    } catch (caught) {
      setOpening(false);
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Kutu açılamadı." });
    }
  }

  useEffect(() => { loadState(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!opening) postAction({ action: "heartbeat" }, "Presence güncellenemedi.").catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [opening]);

  useLayoutEffect(() => {
    if (!opening || !won) {
      setStripTravel(null);
      return undefined;
    }

    const updateStripTravel = () => {
      const viewportWidth = stripViewportRef.current?.clientWidth || 0;
      setStripTravel(viewportWidth ? viewportWidth / 2 - STRIP_STOP_OFFSET : null);
    };

    updateStripTravel();
    window.addEventListener("resize", updateStripTravel);
    return () => window.removeEventListener("resize", updateStripTravel);
  }, [opening, won]);

  if (loading && !state) return <main className="relative min-h-screen bg-black px-4 pb-24 pt-32 text-white sm:px-6"><div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">{copy.loading}</div></main>;

  const strip = buildStrip(state?.items || [], won);
  const boxCount = Number(state?.box_count || 0);
  const collectionValue = Number(state?.collection_value || 0);
  const openButtonDisabled = opening || !canOpenSelectedBox;
  const openButtonText = opening ? copy.opening : hasOwnedSelectedBox ? copy.open : canAffordSelectedBox ? copy.buyAndOpen : copy.notEnough;
  const battles = state?.battles || [];
  const battleCost = battleSequence.reduce((sum, boxId) => sum + Number(boxes.find((box) => box.id === boxId)?.open_cost || 0), 0);

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
              const expectedValue = Number(box.tech_coin_value || 0);
              const valueRatio = Number(box.value_ratio ?? (openCost ? expectedValue / openCost : 0));
              return <button key={box.id} type="button" onClick={() => setSelectedBoxId(box.id)} className={`rounded-[1.35rem] border p-4 text-left transition ${boxClass[box.accent] || boxClass.white} ${box.id === selectedBoxId ? "ring-2 ring-white/60" : "opacity-80 hover:opacity-100"}`}><div className="flex items-start justify-between"><span className="text-3xl">{box.emoji}</span><span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold">x{formatNumber(Number(box.quantity || 0), locale)}</span></div><h3 className="mt-3 font-semibold">{nameOf(box, tr)}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 opacity-65">{descOf(box, tr)}</p><div className="mt-3 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold"><CoinIcon small /> {formatNumber(openCost, locale)} TC</span><span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold">EV {formatNumber(expectedValue, locale)} TC</span><span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold">{formatNumber(valueRatio * 100, locale)}%</span></div></button>;
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="grid gap-3 sm:grid-cols-4"><Stat label={copy.boxes} value={formatNumber(boxCount, locale)} /><Stat label={copy.balance} value={`${formatNumber(walletBalance, locale)} TC`} /><Stat label={copy.collection} value={`${formatNumber(Number(state?.owned_count || 0), locale)}/${formatNumber(Number(state?.collection_total || 0), locale)}`} /><Stat label={copy.openCost} value={`${formatNumber(selectedOpenCost, locale)} TC`} featured /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label={copy.expectedValue} value={`${formatNumber(selectedBoxValue, locale)} TC`} /><Stat label={copy.valueRatio} value={`${formatNumber(selectedValueRatio * 100, locale)}%`} featured={selectedValueRatio >= 0.9} /><Stat label={copy.itemCount} value={formatNumber(selectedSeriesCount, locale)} /><Stat label={copy.seriesName} value={nameOf(selectedBox, tr) || "—"} /></div>
            <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100/80">{copy.valueNote}</p>
            <button onClick={openBox} disabled={openButtonDisabled} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40"><Sparkles className="h-4 w-4" /> {openButtonText}</button>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/35 p-4"><p className="text-sm font-medium text-white/75">{copy.odds}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{rarityOrder.map((rarity) => <div key={rarity} className={`rounded-2xl border px-3 py-2 text-xs ${rarityClass[rarity]}`}><p className="font-semibold">{rarityText[rarity]}</p><p className="mt-1 opacity-70">%{selectedOdds?.[rarity] ?? 0}</p></div>)}</div></div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 p-5 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-6">
            <div className="relative z-10 flex min-h-[380px] flex-col items-center justify-center gap-6 text-center">
              {!opening && !won && <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-5"><div className={`relative flex h-40 w-40 items-center justify-center rounded-[2rem] border shadow-2xl ${boxClass[selectedBox?.accent || "purple"] || boxClass.purple}`}><span className="text-7xl">{selectedBox?.emoji || "📦"}</span><span className="absolute -right-3 -top-3 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">x{selectedQuantity}</span></div><div><p className="font-medium">{nameOf(selectedBox, tr)}</p><p className="mt-2 max-w-sm text-sm leading-6 text-white/50">{descOf(selectedBox, tr)}</p><div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm"><CoinIcon /> {copy.openCost}: {formatNumber(selectedOpenCost, locale)} TC</div></div></motion.div>}
              {opening && !won && <div className="flex flex-col items-center gap-5"><motion.div animate={{ rotate: [0, -4, 4, -2, 2, 0], scale: [1, 1.06, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className={`mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] border shadow-2xl ${boxClass[selectedBox?.accent || "purple"] || boxClass.purple}`}><span className="text-6xl">{selectedBox?.emoji || "📦"}</span></motion.div><p className="text-sm text-white/45">{copy.preparing}</p></div>}
              {opening && won && <div className="w-full space-y-8"><motion.div animate={{ rotate: [0, -3, 3, -2, 2, 0], scale: [1, 1.04, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className={`mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] border shadow-2xl ${boxClass[selectedBox?.accent || "purple"] || boxClass.purple}`}><span className="text-6xl">{selectedBox?.emoji || "📦"}</span></motion.div><div ref={stripViewportRef} className="relative mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/55 py-4"><div className="pointer-events-none absolute left-1/2 top-0 z-20 h-full w-px bg-white/80 shadow-[0_0_30px_rgba(255,255,255,.7)]" />{stripTravel === null ? <div className="h-24 text-sm text-white/45">{copy.preparing}</div> : <motion.div key={won.id} animate={{ x: [0, stripTravel] }} transition={{ duration: 2.45, ease: [0.12, 0.72, 0.18, 1] }} className="flex gap-3 px-8" style={{ width: "max-content" }}>{strip.map((item, index) => <div key={`${item.id}-${index}`} className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border text-center shadow-xl ${index === STRIP_TARGET_INDEX ? "ring-2 ring-white/80" : ""} ${rarityClass[item.rarity]}`}><span className="text-3xl">{item.emoji}</span><span className="mt-1 max-w-20 truncate text-[10px]">{nameOf(item, tr)}</span></div>)}</motion.div>}</div></div>}
              <AnimatePresence>{!opening && won && <motion.div initial={{ opacity: 0, scale: 0.78, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className={`w-full max-w-md rounded-[2rem] border p-6 shadow-2xl ${rarityClass[won.rarity]}`}><p className="text-xs uppercase tracking-[0.24em] opacity-65">{copy.won}</p><div className="mt-4 text-7xl">{won.emoji}</div><h2 className="mt-4 text-3xl font-semibold">{nameOf(won, tr)}</h2><p className="mt-2 text-sm uppercase tracking-[0.18em] opacity-70">{rarityText[won.rarity]}</p><p className="mt-4 text-sm leading-6 opacity-75">{descOf(won, tr)}</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/20 px-4 py-2 text-sm font-semibold"><CoinIcon /> {copy.itemValue}: {formatNumber(Number(won.tech_coin_value || 0), locale)} TC</div><button onClick={() => setWon(null)} className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.add}</button></motion.div>}</AnimatePresence>
            </div>
          </div>
        </section>


        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="text-3xl font-medium">{copy.trade}</h2><Repeat2 className="h-6 w-6 text-cyan-200" /></div>
            <p className="mt-2 text-sm leading-6 text-white/45">{copy.tradeFlow}</p>
            <p className="mt-3 text-sm text-white/45">{copy.online}: {formatNumber(onlineUsers.length, locale)}</p>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm text-white/60">{copy.online}
                <select value={tradeUserId} onChange={(event) => setTradeUserId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none">
                  <option value="">{copy.noOnline}</option>
                  {onlineUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </label>
              <button onClick={sendTrade} disabled={!tradeUserId} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40"><Repeat2 className="h-4 w-4" /> {copy.sendTrade}</button>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
            <h2 className="text-3xl font-medium">{copy.incoming}</h2>
            <div className="mt-4 grid gap-3">{incomingTrades.length ? incomingTrades.map((trade) => <TradeCard key={trade.id} trade={trade} currentUserId={currentUserId} inventoryItems={inventoryItems} tr={tr} locale={locale} copy={copy} onAccept={() => respondTrade(trade.id, "accept_trade")} onDecline={() => respondTrade(trade.id, "decline_trade")} onCancel={() => respondTrade(trade.id, "cancel_trade")} onUpdateItems={(itemId, quantity) => updateTradeItems(trade.id, itemId, quantity)} onReady={(ready) => respondTrade(trade.id, "set_trade_ready", { ready })} onConfirm={() => respondTrade(trade.id, "confirm_trade")} />) : <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">—</p>}</div>
          </div>
        </section>

        <BattleArena
          battles={battles}
          boxes={boxes}
          items={state?.items || []}
          currentUserId={currentUserId}
          sequence={battleSequence}
          setSequence={setBattleSequence}
          battleCost={battleCost}
          walletBalance={walletBalance}
          tr={tr}
          locale={locale}
          onCreate={createBattle}
          onJoin={(id) => joinBattle(id)}
          onBot={(id) => joinBattle(id, true)}
          onEmoji={sendBattleEmoji}
          onNextRound={openBattleRound}
        />

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-3xl font-medium">{copy.inventory}</h2><p className="mt-2 text-sm text-white/45">{copy.owned}: {formatNumber(Number(state?.total_quantity || 0), locale)} · {copy.collectionValue}: {formatNumber(collectionValue, locale)} TC</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={sellAllItems} disabled={!inventoryItems.length} className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/15 disabled:opacity-40"><Coins className="h-4 w-4" /> {copy.sellAll}</button><FilterButton active={filter === "all"} onClick={() => setFilter("all")}>{copy.all}</FilterButton>{rarityOrder.map((rarity) => <FilterButton key={rarity} active={filter === rarity} onClick={() => setFilter(rarity)}>{rarityText[rarity]}</FilterButton>)}</div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{visibleInventory.map((item) => <div key={item.item_id || item.id} className={`rounded-[1.5rem] border p-4 ${rarityClass[item.rarity]}`}><div className="flex items-start justify-between gap-3"><span className="text-4xl">{item.emoji}</span><span className="rounded-full bg-black/25 px-3 py-1 text-xs">x{formatNumber(Number(item.quantity || 0), locale)}</span></div><h3 className="mt-4 font-semibold">{nameOf(item, tr)}</h3><p className="mt-1 text-xs uppercase tracking-[0.16em] opacity-60">{rarityText[item.rarity]}</p><p className="mt-3 text-sm leading-6 opacity-70">{descOf(item, tr)}</p><div className="mt-4 grid gap-2 text-xs"><ValueRow label={copy.itemValue} value={Number(item.tech_coin_value || 0)} locale={locale} /><ValueRow label={copy.totalValue} value={Number(item.total_tech_coin_value || 0)} locale={locale} /></div><button onClick={() => sellItem(item)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/15"><Coins className="h-4 w-4" /> {copy.sell}</button></div>)}{!visibleInventory.length && <div className="col-span-full rounded-[1.5rem] border border-white/10 bg-black/25 p-6 text-white/45">{copy.empty}</div>}</div>
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
function BattleArena({ battles, boxes, items, currentUserId, sequence, setSequence, battleCost, walletBalance, tr, locale, onCreate, onJoin, onBot, onEmoji, onNextRound }: { battles: BattleLobby[]; boxes: DropBox[]; items: DropItem[]; currentUserId: number; sequence: string[]; setSequence: (value: string[]) => void; battleCost: number; walletBalance: number; tr: boolean; locale: string; onCreate: () => void; onJoin: (id: number) => void; onBot: (id: number) => void; onEmoji: (id: number, emoji: string) => void; onNextRound: (id: number) => Promise<DropTechState> }) {
  const openBattles = battles.filter((battle) => battle.status === "waiting");
  const myBattles = battles.filter((battle) => battle.creator_user_id === currentUserId || battle.opponent_user_id === currentUserId).slice(0, 4);
  const selectedBoxes = sequence.map((id) => boxes.find((box) => box.id === id)).filter(Boolean) as DropBox[];
  const canCreate = selectedBoxes.length > 0 && walletBalance >= battleCost;
  return <section className="rounded-[2rem] border border-fuchsia-300/20 bg-fuchsia-300/[0.055] p-5 shadow-2xl shadow-fuchsia-500/10 backdrop-blur-xl sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-black/30 px-4 py-2 text-sm text-fuchsia-100"><Swords className="h-4 w-4" /> {tr ? "Kasa Savaşı" : "Case Battle"}</div><h2 className="mt-3 text-3xl font-medium">{tr ? "Lobi kur, kasaları seç, kazanan hepsini alsın" : "Create a lobby, pick cases, winner takes all"}</h2><p className="mt-2 text-sm text-white/50">{tr ? "Son oyuncu veya bot katıldığı anda oyuncular kilitlenir; her round herkes aynı kasayı açar, pointValue skora eklenir." : "Players lock when the second seat joins; every round opens the same case and pointValue is scored."}</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65"><p>{tr ? "Toplam giriş" : "Total entry"}</p><p className="mt-1 inline-flex items-center gap-1 text-2xl font-semibold text-white"><CoinIcon small /> {formatNumber(battleCost, locale)} TC</p></div>
    </div>
    <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
      <div className="grid gap-3 sm:grid-cols-3">
        {sequence.map((boxId, index) => <select key={`${boxId}-${index}`} value={boxId} onChange={(event) => setSequence(sequence.map((entry, inner) => inner === index ? event.target.value : entry))} className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none">{boxes.map((box) => <option key={box.id} value={box.id}>{box.emoji} {nameOf(box, tr)} · {formatNumber(Number(box.open_cost || 0), locale)} TC</option>)}</select>)}
      </div>
      <div className="flex flex-wrap gap-2"><button onClick={() => sequence.length < 8 && setSequence([...sequence, boxes[0]?.id || "standard_cache"])} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/70">+ Round</button><button onClick={() => sequence.length > 1 && setSequence(sequence.slice(0, -1))} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/70">- Round</button><button onClick={onCreate} disabled={!canCreate} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-gray-200 disabled:opacity-40"><Sparkles className="h-4 w-4" /> {tr ? "Lobi oluştur" : "Create lobby"}</button></div>
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div><h3 className="text-sm uppercase tracking-[0.18em] text-white/40">{tr ? "Açık lobiler" : "Open lobbies"}</h3><div className="mt-3 grid gap-3">{openBattles.length ? openBattles.map((battle) => <BattleCard key={battle.id} battle={battle} allItems={items} currentUserId={currentUserId} tr={tr} locale={locale} onJoin={onJoin} onBot={onBot} onEmoji={onEmoji} onNextRound={onNextRound} />) : <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">{tr ? "Henüz açık battle yok." : "No open battles yet."}</p>}</div></div>
      <div><h3 className="text-sm uppercase tracking-[0.18em] text-white/40">{tr ? "Benim savaşlarım" : "My battles"}</h3><div className="mt-3 grid gap-3">{myBattles.length ? myBattles.map((battle) => <BattleCard key={battle.id} battle={battle} allItems={items} currentUserId={currentUserId} tr={tr} locale={locale} onJoin={onJoin} onBot={onBot} onEmoji={onEmoji} onNextRound={onNextRound} />) : <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">—</p>}</div></div>
    </div>
  </section>;
}

function BattleCard({ battle, allItems = [], currentUserId, tr, locale, onJoin, onBot, onEmoji, onNextRound }: { battle: BattleLobby; allItems?: DropItem[]; currentUserId: number; tr: boolean; locale: string; onJoin: (id: number) => void; onBot: (id: number) => void; onEmoji: (id: number, emoji: string) => void; onNextRound: (id: number) => Promise<DropTechState> }) {
  const isCreator = battle.creator_user_id === currentUserId;
  const isParticipant = isCreator || battle.opponent_user_id === currentUserId;
  const winnerText = battle.winner_side === "creator" ? battle.creator_name : battle.winner_user_id ? battle.opponent_name : (tr ? "Bot" : "Bot");
  if (battle.status === "in_progress" && isParticipant) return <LiveBattleCard battle={battle} allItems={allItems} tr={tr} locale={locale} onEmoji={onEmoji} onNextRound={onNextRound} />;
  return <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-fuchsia-400/20 blur-2xl" />
    <div className="relative flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-white/35">#{battle.id} · {battle.status}</p><h4 className="mt-1 font-semibold">{battle.creator_name} VS {battle.opponent_name || (tr ? "Bekleniyor" : "Waiting")}</h4></div><span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"><CoinIcon small /> {formatNumber(Number(battle.cost || 0), locale)} TC</span></div>
    <div className="relative mt-3 flex flex-wrap gap-2">{(battle.boxes || []).map((box, index) => <span key={`${box.id}-${index}`} className="rounded-full bg-white/[0.08] px-3 py-1 text-xs">{box.emoji} {nameOf(box, tr)}</span>)}</div>
    {battle.rounds?.length ? <div className="relative mt-4 grid gap-2">{battle.rounds.map((round) => <div key={round.round_number} className="grid grid-cols-[32px_1fr_1fr] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-xs"><span className="text-white/35">R{round.round_number}</span><span className="animate-pulse rounded-xl px-2 py-1">{round.creator_item?.emoji} {nameOf(round.creator_item, tr)} · {round.creator_points}</span><span className="animate-pulse rounded-xl px-2 py-1">{round.opponent_item?.emoji} {nameOf(round.opponent_item, tr)} · {round.opponent_points}</span></div>)}</div> : null}
    <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-white/55">{tr ? "Skor" : "Score"}: <b className="text-white">{Number(battle.creator_score || 0)}</b> - <b className="text-white">{Number(battle.opponent_score || 0)}</b>{battle.status === "completed" ? <> · 🏆 {winnerText || "—"}</> : null}</p><div className="flex flex-wrap gap-2">{battle.status === "waiting" && !isCreator && <button onClick={() => onJoin(battle.id)} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200">{tr ? "Katıl" : "Join"}</button>}{battle.status === "waiting" && isCreator && <button onClick={() => onBot(battle.id)} className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200"><Bot className="h-4 w-4" /> Bot</button>}{isParticipant && ["🔥", "😂", "😱", "💎", "🤖", "⚡", "🏆", "😭"].map((emoji) => <button key={emoji} onClick={() => onEmoji(battle.id, emoji)} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-sm hover:bg-white/[0.1]">{emoji}</button>)}</div></div>
    {battle.emotes?.length ? <div className="relative mt-3 flex flex-wrap gap-2 text-xs text-white/55"><Send className="h-4 w-4" /> {battle.emotes.slice(0, 6).map((emote) => <span key={emote.id} className="rounded-full bg-black/35 px-2 py-1">{emote.emoji} {emote.name}</span>)}</div> : null}
  </div>;
}


function LiveBattleCard({ battle, allItems, tr, locale, onEmoji, onNextRound }: { battle: BattleLobby; allItems: DropItem[]; tr: boolean; locale: string; onEmoji: (id: number, emoji: string) => void; onNextRound: (id: number) => Promise<DropTechState> }) {
  const totalRounds = battle.box_sequence.length || battle.boxes?.length || 1;
  const [phase, setPhase] = useState<BattleState>(battle.battle_state || "countdown");
  const [countdown, setCountdown] = useState(3);
  const [activeRound, setActiveRound] = useState<BattleRound | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastStartedRef = useRef(0);
  const previousRounds = (battle.rounds || []).filter((round) => !activeRound || round.round_number < activeRound.round_number);
  const displayedRounds = revealed && activeRound ? [...previousRounds, activeRound] : previousRounds;
  const creatorScore = displayedRounds.reduce((sum, round) => sum + Number(round.creator_points || 0), 0);
  const opponentScore = displayedRounds.reduce((sum, round) => sum + Number(round.opponent_points || 0), 0);
  const nextRoundNumber = Math.min((battle.rounds?.length || 0) + 1, totalRounds);
  const currentRoundNumber = activeRound?.round_number || nextRoundNumber;
  const currentBox = (battle.boxes || []).find((box) => box.id === (activeRound?.box_type || battle.box_sequence[currentRoundNumber - 1])) || battle.boxes?.[currentRoundNumber - 1] || null;
  const pool = allItems.filter((item) => item.series_id === (activeRound?.box_type || currentBox?.id));
  const creatorStrip = buildStrip(pool.length ? pool : allItems, activeRound?.creator_item || null);
  const opponentStrip = buildStrip(pool.length ? pool : allItems, activeRound?.opponent_item || null);
  const progress = Math.round((displayedRounds.length / totalRounds) * 100);

  useEffect(() => {
    if (battle.id) {
      setPhase("countdown");
      setCountdown(3);
      setActiveRound(null);
      setRevealed(false);
      lastStartedRef.current = battle.rounds?.length || 0;
    }
  }, [battle.id]);

  useEffect(() => {
    if (phase !== "countdown" || busy || activeRound || (battle.rounds?.length || 0) >= totalRounds) return undefined;
    setCountdown(3);
    const interval = window.setInterval(() => setCountdown((value) => Math.max(1, value - 1)), 1000);
    const timer = window.setTimeout(() => {
      window.clearInterval(interval);
      void startNextRound();
    }, 3000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [phase, busy, activeRound, battle.rounds?.length, totalRounds]);

  async function startNextRound() {
    const targetRound = (battle.rounds?.length || 0) + 1;
    if (busy || targetRound > totalRounds || lastStartedRef.current >= targetRound) return;
    lastStartedRef.current = targetRound;
    setBusy(true);
    setPhase("opening_round");
    setRevealed(false);
    try {
      const data = await onNextRound(battle.id);
      const refreshed = (data.battles || []).find((entry) => Number(entry.id) === Number(battle.id));
      const serverRound = refreshed?.rounds?.find((round) => Number(round.round_number) === targetRound) || null;
      if (!serverRound) throw new Error(tr ? "Server round sonucu alınamadı." : "Server round result was not returned.");
      setActiveRound(serverRound);
      window.setTimeout(() => {
        setPhase("revealing_result");
        setRevealed(true);
        playOffSound("coin");
        window.setTimeout(() => {
          setPhase("score_update");
          window.setTimeout(() => {
            if (targetRound >= totalRounds) {
              setPhase("finished");
              void onNextRound(battle.id).then(() => playOffSound("round")).catch(() => undefined);
            } else {
              setPhase("next_round_transition");
              window.setTimeout(() => {
                setActiveRound(null);
                setRevealed(false);
                setBusy(false);
                setPhase("countdown");
              }, 1100);
            }
          }, 1300);
        }, 1200);
      }, 4300);
    } catch {
      setBusy(false);
      setPhase("countdown");
      lastStartedRef.current = Math.max(0, targetRound - 1);
    }
  }

  const statusText = phase === "countdown" ? (tr ? `Round ${currentRoundNumber} geri sayım` : `Round ${currentRoundNumber} countdown`) : phase === "opening_round" ? (tr ? "Canlı açılış" : "Live opening") : phase === "revealing_result" ? (tr ? "Sonuç gösteriliyor" : "Revealing result") : phase === "score_update" ? (tr ? "Skor güncellendi" : "Score updated") : phase === "next_round_transition" ? (tr ? "Sonraki round hazırlanıyor" : "Preparing next round") : (tr ? "Final hesaplanıyor" : "Calculating final");

  return <div className="relative overflow-hidden rounded-[1.75rem] border border-fuchsia-300/25 bg-black/55 p-4 shadow-2xl shadow-fuchsia-500/10 sm:p-5">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.18),transparent_45%)]" />
    <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="text-xs uppercase tracking-[0.2em] text-fuchsia-100/55">#{battle.id} · {statusText}</p><h3 className="mt-1 text-2xl font-semibold text-white">Round {currentRoundNumber}/{totalRounds} · {currentBox ? `${currentBox.emoji} ${nameOf(currentBox, tr)}` : "Case"}</h3></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50"><span>{tr ? "Battle states" : "Battle states"}: countdown → opening_round → revealing_result → score_update</span>{["🔥", "😂", "😱", "💎", "🤖", "⚡", "🏆", "😭"].map((emoji) => <button key={emoji} onClick={() => onEmoji(battle.id, emoji)} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-sm hover:bg-white/[0.1]">{emoji}</button>)}</div>
    </div>
    {phase === "countdown" && <div className="relative mt-5 rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-8 text-center"><p className="text-sm uppercase tracking-[0.25em] text-cyan-100/60">{tr ? "Senkron başlangıç" : "Synchronized start"}</p><p className="mt-3 text-7xl font-black text-white">{countdown}</p></div>}
    <div className="relative mt-5 grid gap-4 lg:grid-cols-[1fr_0.08fr_1fr]">
      <BattlePlayerPanel label="Player 1" name={battle.creator_name} avatarUrl={battle.creator_avatar_url} score={creatorScore} item={activeRound?.creator_item || null} points={activeRound?.creator_points || 0} strip={creatorStrip} phase={phase} revealed={revealed} tr={tr} locale={locale} />
      <div className="hidden items-center justify-center text-2xl font-black text-white/30 lg:flex">VS</div>
      <BattlePlayerPanel label="Player 2" name={battle.opponent_name || (tr ? "Bot/Oyuncu" : "Bot/Player")} avatarUrl={battle.opponent_avatar_url} score={opponentScore} item={activeRound?.opponent_item || null} points={activeRound?.opponent_points || 0} strip={opponentStrip} phase={phase} revealed={revealed} tr={tr} locale={locale} />
    </div>
    <div className="relative mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/40"><span>{tr ? "Battle progress" : "Battle progress"}</span><span>{displayedRounds.length}/{totalRounds}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fuchsia-300 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
      <div className="mt-3 flex flex-wrap gap-2">{(battle.boxes || []).map((box, index) => <span key={`${box.id}-${index}`} className={`rounded-full px-3 py-1 text-xs ${index < displayedRounds.length ? "bg-emerald-300/15 text-emerald-100" : index === currentRoundNumber - 1 ? "bg-cyan-300/15 text-cyan-100" : "bg-white/[0.06] text-white/40"}`}>{index < displayedRounds.length ? "✓" : index === currentRoundNumber - 1 ? "●" : "○"} {box.emoji} {nameOf(box, tr)}</span>)}</div>
    </div>
  </div>;
}

function BattlePlayerPanel({ label, name, avatarUrl, score, item, points, strip, phase, revealed, tr, locale }: { label: string; name: string; avatarUrl?: string | null; score: number; item?: DropItem | null; points: number; strip: DropItem[]; phase: BattleState; revealed: boolean; tr: boolean; locale: string }) {
  const spinning = phase === "opening_round" && item;
  const reelRef = useRef<HTMLDivElement | null>(null);
  const [travel, setTravel] = useState<number | null>(null);
  useLayoutEffect(() => {
    const update = () => setTravel(reelRef.current ? reelRef.current.clientWidth / 2 - STRIP_STOP_OFFSET : null);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [strip, item]);
  return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white text-sm font-bold text-black">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p><p className="font-semibold text-white">{name}</p></div></div><div className="text-right"><p className="text-xs uppercase tracking-[0.16em] text-white/35">{tr ? "Toplam skor" : "Total score"}</p><p className="inline-flex items-center gap-1 text-2xl font-bold text-white"><CoinIcon small /> {formatNumber(score, locale)}</p></div></div>
    <div ref={reelRef} className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/60 py-4">
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" />
      <motion.div className="flex gap-3 pl-8" initial={{ x: 0 }} animate={spinning && travel !== null ? { x: travel } : { x: 0 }} transition={{ duration: 4.1, ease: [0.12, 0.76, 0.18, 1] }}>
        {strip.map((entry, index) => <div key={`${entry.id}-${index}`} className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border p-2 text-center ${rarityClass[entry.rarity]}`}><span className="text-3xl">{entry.emoji}</span><span className="mt-1 line-clamp-1 text-[10px] font-semibold">{nameOf(entry, tr)}</span></div>)}
      </motion.div>
    </div>
    <AnimatePresence>{revealed && item ? <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-4 rounded-2xl border p-4 ${rarityClass[item.rarity]}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="text-4xl">{item.emoji}</span><div><p className="font-semibold">{nameOf(item, tr)}</p><p className="text-xs uppercase tracking-[0.16em] opacity-65">{rarityText[item.rarity]}</p></div></div><span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-sm font-bold"><CoinIcon small /> +{formatNumber(points, locale)}</span></div></motion.div> : <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/40">{tr ? "Sonuç animasyon bitince gösterilir." : "Result appears after the reel lands."}</div>}</AnimatePresence>
  </div>;
}

function normalizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
}

function TradeCard({ trade, currentUserId, inventoryItems, tr, locale, copy, onAccept, onDecline, onCancel, onUpdateItems, onReady, onConfirm }: { trade: TradeOffer; currentUserId: number; inventoryItems: InventoryItem[]; tr: boolean; locale: string; copy: Record<string, string>; onAccept: () => void; onDecline: () => void; onCancel: () => void; onUpdateItems: (itemId: string, quantity: number) => void; onReady: (ready: boolean) => void; onConfirm: () => void }) {
  const isProposer = Number(trade.proposer_id) === currentUserId;
  const myReady = Boolean(Number(isProposer ? trade.proposer_ready : trade.recipient_ready));
  const otherReady = Boolean(Number(isProposer ? trade.recipient_ready : trade.proposer_ready));
  const myConfirmed = Boolean(Number(isProposer ? trade.proposer_confirmed : trade.recipient_confirmed));
  const [itemId, setItemId] = useState(isProposer ? (trade.offer_item?.id || "") : (trade.request_item?.id || ""));
  const [quantityInput, setQuantityInput] = useState(String(Number(isProposer ? trade.offer_quantity : trade.request_quantity || 1)));
  const quantity = Math.max(0, Math.floor(Number(quantityInput) || 0));
  const statusText = trade.status === "ready" ? copy.finalConfirm : trade.status === "active" ? copy.activeTrade : trade.status === "completed" || trade.status === "accepted" ? copy.completed : copy.requestPending;
  const canEdit = ["active", "ready"].includes(trade.status) && !myReady;
  const canReady = ["active", "ready"].includes(trade.status) && (isProposer ? Boolean(trade.offer_item) : Boolean(trade.request_item));
  const canConfirm = trade.status === "ready" && myReady && otherReady && !myConfirmed;
  const canAcceptRequest = ["pending_request", "pending"].includes(trade.status) && !isProposer;

  return <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{trade.proposer_name} → {trade.recipient_name}</p>
      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">{statusText}</span>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><MiniTradeItem label={copy.offer} item={trade.offer_item} quantity={Number(trade.offer_quantity || 0)} ready={Boolean(Number(trade.proposer_ready))} confirmed={Boolean(Number(trade.proposer_confirmed))} tr={tr} locale={locale} /><MiniTradeItem label={copy.request} item={trade.request_item} quantity={Number(trade.request_quantity || 0)} ready={Boolean(Number(trade.recipient_ready))} confirmed={Boolean(Number(trade.recipient_confirmed))} tr={tr} locale={locale} /></div>
    {canEdit && <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[1fr_96px_auto]">
      <label className="grid gap-2 text-xs text-white/55">{copy.selectItem}<select value={itemId} onChange={(event) => setItemId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-white outline-none"><option value="">—</option>{inventoryItems.map((item) => <option key={item.item_id || item.id} value={item.item_id || item.id}>{item.emoji} {nameOf(item, tr)} x{item.quantity}</option>)}</select></label>
      <label className="grid gap-2 text-xs text-white/55">{copy.qty}<input type="text" inputMode="numeric" min={1} value={quantityInput} onChange={(event) => setQuantityInput(normalizeIntegerInput(event.target.value))} className="rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-white outline-none" /></label>
      <button onClick={() => itemId && quantity > 0 && onUpdateItems(itemId, quantity)} disabled={!itemId || quantity <= 0} className="self-end rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200 disabled:opacity-40">{copy.saveItem}</button>
    </div>}
    {trade.status === "ready" && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100"><p className="font-semibold">{copy.finalConfirm}</p><p className="mt-1 text-xs opacity-75">{myConfirmed ? copy.waitingOther : copy.confirm}</p></div>}
    <div className="mt-4 flex flex-wrap gap-2">
      {canAcceptRequest && <button onClick={onAccept} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200">{copy.accept}</button>}
      {canReady && <button onClick={() => onReady(!myReady)} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200">{myReady ? copy.unready : copy.ready}</button>}
      {canConfirm && <button onClick={onConfirm} className="rounded-full bg-amber-200 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-100">{copy.confirm}</button>}
      {canAcceptRequest && <button onClick={onDecline} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.08]">{copy.decline}</button>}
      {trade.status !== "completed" && trade.status !== "accepted" && <button onClick={onCancel} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.08]">{copy.cancel}</button>}
    </div>
  </div>;
}
function MiniTradeItem({ label, item, quantity, ready, confirmed, tr, locale }: { label: string; item?: DropItem | null; quantity: number; ready?: boolean; confirmed?: boolean; tr: boolean; locale: string }) {
  return <div className={`rounded-2xl border p-3 ${item ? rarityClass[item.rarity] : "border-white/10 bg-white/[0.04]"}`}><div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.16em] opacity-55">{label}</p><p className="text-[10px] uppercase tracking-[0.16em] opacity-55">{confirmed ? (tr ? "Onaylandı" : "Confirmed") : ready ? (tr ? "Hazır" : "Ready") : ""}</p></div><div className="mt-2 flex items-center gap-2"><span className="text-2xl">{item?.emoji || "?"}</span><div><p className="text-sm font-semibold">{nameOf(item, tr) || "—"}</p><p className="text-xs opacity-65">x{formatNumber(quantity, locale)} · {item ? `${formatNumber(Number(item.tech_coin_value || 0) * quantity, locale)} TC` : ""}</p></div></div></div>;
}
