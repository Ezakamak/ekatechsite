import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { CircleDollarSign, Clock3, Database, Dice5, History, LockKeyhole, MessageCircle, Play, Send, ShieldCheck, Touchpad } from "lucide-react";
import { useLanguage } from "../i18n";
import { TechCoinWalletBadge } from "./TechCoinWalletBadge";
import { playOffSound } from "./OffSoundEngine";

type BetType = "straight" | "red" | "black" | "odd" | "even" | "low" | "high" | "column" | "dozen";

type RouletteResult = {
  id?: number;
  winning_number: number;
  winning_color: "green" | "red" | "black";
  winning_parity?: "none" | "odd" | "even";
  resolved_at?: string;
};

type RouletteLog = {
  id: number;
  round_id?: number;
  bet_type: string;
  bet_value?: string | null;
  bet_amount: number;
  winning_number: number;
  winning_color: string;
  payout_amount: number;
  profit_amount: number;
  status: string;
  created_at: string;
};

type BoardBet = {
  type: BetType;
  value?: number;
  label: string;
  multiplier: string;
};

type RouletteRound = {
  id: number;
  status: "betting" | "resolved";
  betting_started_at: number;
  spins_at: number;
  secondsLeft: number;
};

type TableBet = {
  bet_type: BetType;
  bet_value?: string | null;
  chip_count: number;
  total_amount: number;
  users?: string | null;
  item_labels?: string | null;
};

type RouletteInventoryItem = {
  id: number;
  item_name: string;
  emoji: string;
  roulette_value: number;
  status: string;
};

type RouletteChatMessage = {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar_url?: string;
  user_role?: string;
  message: string;
  created_at?: string;
};

const QUICK_BETS = [
  { label: "10", value: 10 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "1K", value: 1_000 },
  { label: "5K", value: 5_000 },
  { label: "10K", value: 10_000 },
];

const MIN_BET = 10;
const MAX_BET = 10_000;
const ROULETTE_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const TABLE_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function formatTc(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function parseBetInput(value: string) {
  return Math.floor(Number(value.replace(/[^0-9]/g, "")) || 0);
}

function numberColor(number: number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function buildWheelGradient() {
  const sector = 360 / ROULETTE_WHEEL.length;
  return `conic-gradient(${ROULETTE_WHEEL.map((number, index) => {
    const color = numberColor(number) === "green" ? "#16a34a" : numberColor(number) === "red" ? "#dc2626" : "#111827";
    const start = (index * sector).toFixed(3);
    const end = ((index + 1) * sector).toFixed(3);
    return `${color} ${start}deg ${end}deg`;
  }).join(", ")})`;
}

function tableBetKey(type: string, value?: number | string | null) {
  return `${type}:${value == null ? "" : value}`;
}

function describeBet(type: BetType, value?: number) {
  if (type === "straight") return `Sayı ${value}`;
  if (type === "red") return "Kırmızı";
  if (type === "black") return "Siyah";
  if (type === "odd") return "Tek";
  if (type === "even") return "Çift";
  if (type === "low") return "1-18";
  if (type === "high") return "19-36";
  if (type === "column") return `${value}. Sütun`;
  return `${value}. 12'li`;
}

export function TechRoulette() {
  const { language } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const [wallet, setWallet] = useState(0);
  const [betInput, setBetInput] = useState(String(100));
  const [betType, setBetType] = useState<BetType>("red");
  const [straightNumber, setStraightNumber] = useState(7);
  const [column, setColumn] = useState(1);
  const [dozen, setDozen] = useState(1);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recent, setRecent] = useState<RouletteLog[]>([]);
  const [recentNumbers, setRecentNumbers] = useState<RouletteResult[]>([]);
  const [currentRound, setCurrentRound] = useState<RouletteRound | null>(null);
  const [tableBets, setTableBets] = useState<TableBet[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [lastAnimatedRoundId, setLastAnimatedRoundId] = useState<number | null>(null);
  const [message, setMessage] = useState("SQL ekatechwallet bakiyesi yükleniyor...");
  const [inventory, setInventory] = useState<RouletteInventoryItem[]>([]);
  const [stakeMode, setStakeMode] = useState<"coin" | "item">("coin");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const selectedItem = inventory.find((item) => item.id === selectedItemId && item.status === "available") || null;
  const betAmount = stakeMode === "item" ? Number(selectedItem?.roulette_value || 0) : parseBetInput(betInput);
  const wheelGradient = useMemo(buildWheelGradient, []);
  const betAmountValid = stakeMode === "item" ? !!selectedItem : betAmount >= MIN_BET && betAmount <= MAX_BET;
  const betChips = useMemo(() => {
    const chips: Record<string, TableBet> = {};
    tableBets.forEach((bet) => {
      chips[tableBetKey(bet.bet_type, bet.bet_value)] = bet;
    });
    return chips;
  }, [tableBets]);

  const betValue = useMemo(() => {
    if (betType === "straight") return straightNumber;
    if (betType === "column") return column;
    if (betType === "dozen") return dozen;
    return undefined;
  }, [betType, column, dozen, straightNumber]);

  const selectedBetLabel = describeBet(betType, betValue);

  const selectBet = (bet: BoardBet) => {
    setBetType(bet.type);
    if (bet.type === "straight" && typeof bet.value === "number") setStraightNumber(bet.value);
    if (bet.type === "column" && typeof bet.value === "number") setColumn(bet.value);
    if (bet.type === "dozen" && typeof bet.value === "number") setDozen(bet.value);
    playOffSound("click");
  };

  const loadState = () => {
    fetch("/api/tech-roulette", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Tech Roulette yüklenemedi.");
        return data;
      })
      .then((data) => {
        setWallet(Number(data?.ekatechwallet || data?.wallet?.balance || 0));
        setRecent(Array.isArray(data?.recent) ? data.recent : []);
        const numbers = Array.isArray(data?.recentNumbers) ? data.recentNumbers : [];
        setRecentNumbers(numbers);
        if (numbers[0]) setResult(numbers[0]);
        setCurrentRound(data?.currentRound || null);
        setTableBets(Array.isArray(data?.tableBets) ? data.tableBets : []);
        setInventory(Array.isArray(data?.inventory) ? data.inventory : []);
        setSecondsLeft(Math.max(0, Number(data?.currentRound?.secondsLeft || 0)));
        if (data?.lastResolvedRound?.winning_number != null && data.lastResolvedRound.id !== lastAnimatedRoundId) {
          setResult(data.lastResolvedRound);
          setLastAnimatedRoundId(data.lastResolvedRound.id);
          animateWheelTo(Number(data.lastResolvedRound.winning_number));
        }
        setMessage("SQL senkronlu masa, geri sayım ve ortak çipler hazır.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Tech Roulette yüklenemedi."));
  };

  useEffect(() => {
    loadState();
    const poll = window.setInterval(loadState, 2500);
    return () => window.clearInterval(poll);
  }, [lastAnimatedRoundId]);

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const animateWheelTo = (winningNumber: number) => {
    const wheelIndex = Math.max(0, ROULETTE_WHEEL.indexOf(winningNumber));
    const sector = 360 / ROULETTE_WHEEL.length;
    const pocketCenter = (wheelIndex + 0.5) * sector;
    setWheelRotation((current) => Math.ceil(current / 360) * 360 + 360 * 5 - pocketCenter);
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 3200);
    playOffSound("reel");
  };

  const playRound = async () => {
    if (spinning || !betAmountValid || secondsLeft <= 1) return;
    setMessage("Bahis SQL masasına yazılıyor ve tüm kullanıcılara senkronlanıyor...");
    playOffSound("bet");

    try {
      const response = await fetch("/api/tech-roulette", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stakeMode === "item" ? { type: betType, value: betValue, stakeItemId: selectedItemId } : { type: betType, value: betValue, amount: betAmount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Rulet bahsi tamamlanamadı.");

      setWallet(Number(data.ekatechwallet || 0));
      setCurrentRound(data?.currentRound || currentRound);
      setTableBets(Array.isArray(data?.tableBets) ? data.tableBets : []);
      setSecondsLeft(Math.max(0, Number(data?.currentRound?.secondsLeft || secondsLeft)));
      setMessage(`${selectedBetLabel} üzerine ${stakeMode === "item" && selectedItem ? `${selectedItem.emoji} ${selectedItem.item_name}` : `${formatTc(betAmount, locale)} TC`} koyuldu. Çipler ortak SQL masasından herkese görünür.`);
      if (stakeMode === "item") setSelectedItemId(null);
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      window.setTimeout(loadState, 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rulet bahsi tamamlanamadı.");
      playOffSound("error");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050806] px-4 pb-24 pt-28 text-white sm:px-6">
      <div className="absolute left-1/2 top-28 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-80 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="sticky top-20 z-30 rounded-full border border-white/10 bg-black/60 px-4 py-2 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 overflow-x-auto text-xs text-white/55">
            <span className="shrink-0 font-semibold uppercase tracking-[0.18em] text-amber-100/80">Son sayılar</span>
            {recentNumbers.length === 0 ? <span>Henüz sonuç yok</span> : recentNumbers.map((item) => (
              <span key={item.id || `${item.winning_number}-${item.resolved_at}`} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${item.winning_color === "green" ? "bg-emerald-500" : item.winning_color === "red" ? "bg-red-600" : "bg-zinc-950 ring-1 ring-white/20"}`}>
                {item.winning_number}
              </span>
            ))}
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                  <ShieldCheck className="h-4 w-4" /> Backend RNG + SQL ekatechwallet
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">Tech Roulette</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                  Avrupa ruleti: halıdan istediğin bahis alanına dokun, kendi Tech Coin miktarını yaz ve sunucu tarafı RNG ile turu başlat.
                </p>
              </div>
              <TechCoinWalletBadge />
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(18rem,27rem)_1fr]">
              <div className="relative flex min-h-[26rem] items-center justify-center overflow-hidden rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),rgba(0,0,0,0.82)_62%)] p-5">
                <div className="absolute top-4 z-20 h-0 w-0 border-x-[13px] border-t-[24px] border-x-transparent border-t-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                <motion.div
                  animate={{ rotate: wheelRotation }}
                  transition={{ duration: 2.4, ease: [0.2, 0.85, 0.2, 1] }}
                  className="relative aspect-square w-full max-w-[24rem] rounded-full border-[12px] border-amber-300 bg-zinc-950 shadow-2xl shadow-black before:absolute before:inset-[12%] before:rounded-full before:border before:border-white/15 before:bg-[radial-gradient(circle,#202020_0_38%,transparent_39%)] after:absolute after:inset-[43%] after:rounded-full after:bg-amber-100 after:shadow-[0_0_24px_rgba(251,191,36,0.8)]"
                  style={{ background: wheelGradient }}
                >
                  <div className="absolute inset-[5%] rounded-full border-4 border-black/50" />
                  {ROULETTE_WHEEL.map((number, index) => {
                    const angle = ((index + 0.5) * 360) / ROULETTE_WHEEL.length;
                    return (
                      <span
                        key={number}
                        className="absolute left-1/2 top-1/2 z-10 flex h-5 w-5 origin-center -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[0.56rem] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-10.1rem) rotate(90deg)` }}
                      >
                        {number}
                      </span>
                    );
                  })}
                </motion.div>
                <div className="pointer-events-none absolute aspect-square w-[78%] max-w-[19rem] rounded-full">
                  <motion.span
                    animate={spinning ? { scale: [1, 0.86, 1.08, 0.94, 1], y: [0, 7, -5, 3, 0] } : { scale: 1, y: 0 }}
                    transition={{ duration: 0.65, repeat: spinning ? Infinity : 0, ease: "easeInOut" }}
                    className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.95),inset_-3px_-4px_5px_rgba(0,0,0,0.35)]"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard icon={<CircleDollarSign className="h-4 w-4" />} label="ekatechwallet" value={`${formatTc(wallet, locale)} TC`} />
                  <StatCard icon={<Dice5 className="h-4 w-4" />} label="Bahis" value={stakeMode === "item" && selectedItem ? `${selectedItem.emoji} ${formatTc(selectedItem.roulette_value, locale)} TC` : `${formatTc(betAmount, locale)} TC`} />
                  <StatCard icon={<Database className="h-4 w-4" />} label="SQL durum" value={spinning ? "Çevriliyor" : "Hazır"} />
                </div>

                <div className="rounded-[1.5rem] border border-cyan-200/20 bg-cyan-300/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-50/55">Ortak tur #{currentRound?.id || "..."}</p>
                      <p className="mt-2 text-sm text-white/60">Kimse bahis koymasa bile sayaç bitince SQL turu kapatır ve çark döner.</p>
                    </div>
                    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border border-cyan-100/30 bg-black/30">
                      <Clock3 className="h-5 w-5 text-cyan-100" />
                      <span className="mt-1 font-mono text-2xl font-black text-white">{secondsLeft}s</span>
                    </div>
                  </div>
                </div>

                {result && (
                  <div className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">Son çıkan sayı</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black ${result.winning_color === "green" ? "bg-emerald-500" : result.winning_color === "red" ? "bg-red-600" : "bg-zinc-950 ring-1 ring-white/20"}`}>{result.winning_number}</span>
                      <div>
                        <p className="text-2xl font-semibold">SQL tur sonucu</p>
                        <p className="text-sm text-white/55">Tüm kullanıcılar aynı round, aynı geri sayım ve aynı kazanan sayıyı görür.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-sm text-white/65">
                  <LockKeyhole className="mr-2 inline h-4 w-4 text-emerald-200" /> {message}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-emerald-200/15 bg-[linear-gradient(135deg,rgba(8,82,45,0.72),rgba(4,33,22,0.9))] p-4 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Rulet Halısı</h2>
                <p className="mt-2 text-sm text-emerald-50/65">Bahis yapmak için renkli halıdaki sayı veya dış bahis alanına bas.</p>
              </div>
              <div className="rounded-2xl border border-amber-200/40 bg-black/25 px-4 py-3 text-sm text-amber-100">
                Seçim: <strong>{selectedBetLabel}</strong>
              </div>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-emerald-950/70 p-3 shadow-inner shadow-black/40">
              <RouletteTable selectedType={betType} selectedValue={betValue} betChips={betChips} onSelect={selectBet} />
            </div>

            <div className="mt-5 grid gap-4 rounded-[1.6rem] border border-white/10 bg-black/25 p-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">Kendi bahis miktarın (TC)</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-4 py-3 text-lg font-black text-emerald-950 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-200/20"
                  inputMode="numeric"
                  min={MIN_BET}
                  max={MAX_BET}
                  value={betInput}
                  onChange={(event) => setBetInput(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="100"
                />
                <span className={`mt-2 block text-xs ${betAmountValid ? "text-emerald-100/60" : "text-amber-200"}`}>Limit: {formatTc(MIN_BET, locale)} - {formatTc(MAX_BET, locale)} TC</span>
              </label>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-sm font-semibold">
                <button type="button" onClick={() => setStakeMode("coin")} className={`rounded-xl px-3 py-2 ${stakeMode === "coin" ? "bg-amber-200 text-black" : "text-white/70 hover:bg-white/10"}`}>TC ile koy</button>
                <button type="button" onClick={() => setStakeMode("item")} className={`rounded-xl px-3 py-2 ${stakeMode === "item" ? "bg-amber-200 text-black" : "text-white/70 hover:bg-white/10"}`}>Racon eşyası</button>
              </div>

              {stakeMode === "item" && (
                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Rulet eşyası</p>
                  <div className="grid gap-2">
                    {inventory.filter((item) => item.status === "available").length === 0 ? (
                      <p className="rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-sm text-amber-100">OFF Hub Mağaza'dan tesbih, çakı veya racon eşyası al; burada para yerine masaya koy.</p>
                    ) : inventory.filter((item) => item.status === "available").map((item) => (
                      <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${selectedItemId === item.id ? "border-amber-200 bg-amber-200 text-black" : "border-white/10 bg-white/10 text-white hover:bg-white/15"}`}>
                        <span><span className="mr-2 text-xl">{item.emoji}</span>{item.item_name}</span>
                        <strong>{formatTc(item.roulette_value, locale)} TC</strong>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-3 text-xs leading-5 text-emerald-50/75">Racon eşyası kazanırsa değeri kadar TC cüzdanına eklenir ve eşya envanterde kalır; kaybederse eşya gider, TC kazanılmaz.</p>
                </div>
              )}

              {stakeMode === "coin" && <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Hızlı miktar</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5">
                  {QUICK_BETS.map((chip) => (
                    <button key={chip.value} type="button" onClick={() => setBetInput(String(chip.value))} className={`rounded-full border px-3 py-3 font-semibold transition-all ${betAmount === chip.value ? "border-amber-200 bg-amber-200 text-black shadow-lg shadow-amber-500/20" : "border-white/10 bg-white/10 text-white hover:bg-white/20"}`}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>}

              <button type="button" disabled={spinning || !betAmountValid || secondsLeft <= 1} onClick={playRound} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45">
                <Play className="h-5 w-5" /> {spinning ? "Çark dönüyor..." : secondsLeft <= 1 ? "Tur kapanıyor..." : "Çipi Koy"}
              </button>
            </div>
          </aside>
        </section>

        <RouletteLiveChat />

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-7">
          <div className="mb-4 flex items-center gap-2 text-white/80"><History className="h-5 w-5" /> Son SQL logları</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.length === 0 ? <p className="text-sm text-white/45">Henüz rulet logu yok.</p> : recent.map((log) => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">{log.bet_type}{log.bet_value ? `:${log.bet_value}` : ""}</span>
                  <span className={log.status === "won" ? "text-emerald-200" : "text-red-200"}>{log.status}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-white/45">
                  <span>No {log.winning_number}</span>
                  <span>{formatTc(log.profit_amount, locale)} TC</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}


function RouletteLiveChat() {
  const [messages, setMessages] = useState<RouletteChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = async () => {
    try {
      const response = await fetch("/api/tech-roulette-chat?limit=45", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Rulet sohbeti yüklenemedi.");
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rulet sohbeti yüklenemedi.");
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = draft.trim();
    if (!nextMessage) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/tech-roulette-chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextMessage }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Mesaj gönderilemedi.");
      setDraft("");
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 3500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.62),rgba(5,8,6,0.92))] backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white"><MessageCircle className="h-5 w-5 text-cyan-100" /> Rulet canlı sohbet</h2>
          <p className="mt-2 text-sm text-white/50">Admin chat mantığındaki canlı yenileme burada rulet masasına özel çalışır; OFF oyuncuları aynı masada konuşur.</p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">Canlı</span>
      </div>
      {error && <div className="mx-5 mt-4 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100 sm:mx-6">{error}</div>}
      <div ref={listRef} className="max-h-72 space-y-3 overflow-y-auto bg-black/25 p-4 sm:p-5">
        {messages.length === 0 ? <p className="py-6 text-center text-sm text-white/40">Henüz rulet sohbeti yok. Masaya ilk lafı sen bırak.</p> : messages.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/38">
              <span className="font-semibold text-cyan-100/80">{item.user_name}</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{item.user_role || "off"}</span>
              <span>{item.created_at ? new Date(item.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/82">{item.message}</p>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex flex-col gap-3 border-t border-white/10 bg-black/35 p-4 sm:flex-row sm:p-5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 600))}
          placeholder="Rulet masasına mesaj yaz..."
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-cyan-200/40"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
          <Send className="h-4 w-4" /> {sending ? "Gönderiliyor..." : "Gönder"}
        </button>
      </form>
    </section>
  );
}

function RouletteTable({ selectedType, selectedValue, betChips, onSelect }: { selectedType: BetType; selectedValue?: number; betChips: Record<string, TableBet>; onSelect: (bet: BoardBet) => void }) {
  const isSelected = (type: BetType, value?: number) => selectedType === type && (value === undefined || selectedValue === value);
  const chipFor = (type: BetType, value?: number) => betChips[tableBetKey(type, value)];
  return (
    <div className="min-w-0 overflow-x-auto pb-2">
      <div className="min-w-[46rem] select-none">
        <div className="grid grid-cols-[4.5rem_repeat(12,minmax(3.1rem,1fr))_4.5rem] gap-1.5">
          <button type="button" onClick={() => onSelect({ type: "straight", value: 0, label: "0", multiplier: "35:1" })} className={`relative row-span-3 rounded-l-[1.3rem] border-2 text-2xl font-black transition-all ${isSelected("straight", 0) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-500 text-white hover:border-amber-200"}`}>
            0
            <ChipPile chip={chipFor("straight", 0)} />
          </button>
          {TABLE_ROWS.map((row, rowIndex) => row.map((number) => (
            <NumberCell key={number} number={number} selected={isSelected("straight", number)} chip={chipFor("straight", number)} onClick={() => onSelect({ type: "straight", value: number, label: String(number), multiplier: "35:1" })} />
          )).concat(
            <button key={`column-${rowIndex}`} type="button" onClick={() => onSelect({ type: "column", value: 3 - rowIndex, label: `${3 - rowIndex}. Sütun`, multiplier: "2:1" })} className={`relative rounded-r-xl border-2 px-2 text-sm font-black transition-all ${isSelected("column", 3 - rowIndex) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-800 text-white hover:border-amber-200"}`}>
              2:1
              <ChipPile chip={chipFor("column", 3 - rowIndex)} />
            </button>,
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-[4.5rem_repeat(3,1fr)_4.5rem] gap-1.5">
          <div />
          {[1, 2, 3].map((value) => (
            <button key={value} type="button" onClick={() => onSelect({ type: "dozen", value, label: `${value}. 12'li`, multiplier: "2:1" })} className={`relative rounded-xl border-2 py-3 text-sm font-black transition-all ${isSelected("dozen", value) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-700 text-white hover:border-amber-200"}`}>
              {value === 1 ? "1-12" : value === 2 ? "13-24" : "25-36"}
              <ChipPile chip={chipFor("dozen", value)} />
            </button>
          ))}
          <div />
        </div>

        <div className="mt-1.5 grid grid-cols-[4.5rem_repeat(6,1fr)_4.5rem] gap-1.5">
          <div />
          <OutsideBet active={isSelected("low")} chip={chipFor("low")} onClick={() => onSelect({ type: "low", label: "1-18", multiplier: "1:1" })}>1-18</OutsideBet>
          <OutsideBet active={isSelected("even")} chip={chipFor("even")} onClick={() => onSelect({ type: "even", label: "Çift", multiplier: "1:1" })}>ÇİFT</OutsideBet>
          <OutsideBet active={isSelected("red")} chip={chipFor("red")} tone="red" onClick={() => onSelect({ type: "red", label: "Kırmızı", multiplier: "1:1" })}>KIRMIZI</OutsideBet>
          <OutsideBet active={isSelected("black")} chip={chipFor("black")} tone="black" onClick={() => onSelect({ type: "black", label: "Siyah", multiplier: "1:1" })}>SİYAH</OutsideBet>
          <OutsideBet active={isSelected("odd")} chip={chipFor("odd")} onClick={() => onSelect({ type: "odd", label: "Tek", multiplier: "1:1" })}>TEK</OutsideBet>
          <OutsideBet active={isSelected("high")} chip={chipFor("high")} onClick={() => onSelect({ type: "high", label: "19-36", multiplier: "1:1" })}>19-36</OutsideBet>
          <div />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-50/60">
          <Touchpad className="h-4 w-4" /> Mobilde halıyı yana kaydırıp tüm sayılara dokunabilirsin.
        </div>
      </div>
    </div>
  );
}

function NumberCell({ number, selected, chip, onClick }: { number: number; selected: boolean; chip?: TableBet; onClick: () => void }) {
  const color = numberColor(number);
  return (
    <button type="button" onClick={onClick} className={`relative min-h-14 rounded-lg border-2 text-lg font-black shadow-inner transition-all ${selected ? "border-amber-200 bg-amber-200 text-black shadow-amber-950/30" : color === "red" ? "border-white/25 bg-red-600 text-white hover:border-amber-200" : "border-white/25 bg-zinc-950 text-white hover:border-amber-200"}`}>
      {number}
      <ChipPile chip={chip} />
    </button>
  );
}

function OutsideBet({ active, chip, tone = "green", onClick, children }: { active: boolean; chip?: TableBet; tone?: "green" | "red" | "black"; onClick: () => void; children: ReactNode }) {
  const base = tone === "red" ? "bg-red-600" : tone === "black" ? "bg-zinc-950" : "bg-emerald-700";
  return (
    <button type="button" onClick={onClick} className={`relative rounded-xl border-2 py-3 text-sm font-black transition-all ${active ? "border-amber-200 bg-amber-200 text-black" : `border-white/25 ${base} text-white hover:border-amber-200`}`}>
      {children}
      <ChipPile chip={chip} />
    </button>
  );
}

function ChipPile({ chip }: { chip?: TableBet }) {
  if (!chip) return null;
  return (
    <span title={`${chip.users || "Oyuncular"} · ${formatTc(Number(chip.total_amount || 0), "tr-TR")} TC`} className="pointer-events-none absolute -right-2 -top-2 z-20 flex min-w-9 items-center justify-center rounded-full border-2 border-amber-100 bg-[radial-gradient(circle_at_35%_30%,#fff7ad,#f59e0b_58%,#92400e)] px-2 py-1 text-[0.62rem] font-black text-black shadow-lg shadow-black/35 ring-2 ring-black/25">
      {Math.min(99, Number(chip.chip_count || 1))}×
    </span>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/35">{icon} {label}</div>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
