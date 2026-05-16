import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { CircleDollarSign, Database, Dice5, History, LockKeyhole, Play, ShieldCheck, Touchpad } from "lucide-react";
import { useLanguage } from "../i18n";
import { TechCoinWalletBadge } from "./TechCoinWalletBadge";
import { playOffSound } from "./OffSoundEngine";

type BetType = "straight" | "red" | "black" | "odd" | "even" | "low" | "high" | "column" | "dozen";

type RouletteResult = {
  winningNumber: number;
  color: "green" | "red" | "black";
  parity: "none" | "odd" | "even";
  won: boolean;
  payoutMultiplier: number;
  payoutAmount: number;
  profitAmount: number;
  ekatechwallet: number;
};

type RouletteLog = {
  id: number;
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

const QUICK_BETS = [
  { label: "1M", value: 1_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "100M", value: 100_000_000 },
  { label: "1B", value: 1_000_000_000 },
  { label: "10B", value: 10_000_000_000 },
];

const MIN_BET = 1_000_000;
const MAX_BET = 10_000_000_000;
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
  const [betInput, setBetInput] = useState(String(1_000_000));
  const [betType, setBetType] = useState<BetType>("red");
  const [straightNumber, setStraightNumber] = useState(7);
  const [column, setColumn] = useState(1);
  const [dozen, setDozen] = useState(1);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recent, setRecent] = useState<RouletteLog[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [message, setMessage] = useState("SQL ekatechwallet bakiyesi yükleniyor...");

  const betAmount = parseBetInput(betInput);
  const wheelGradient = useMemo(buildWheelGradient, []);
  const betAmountValid = betAmount >= MIN_BET && betAmount <= MAX_BET;

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
        setMessage("Sunucu tarafı RNG ve SQL cüzdan kilidi hazır.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Tech Roulette yüklenemedi."));
  };

  useEffect(() => {
    loadState();
  }, []);

  const playRound = async () => {
    if (spinning || !betAmountValid) return;
    setSpinning(true);
    setMessage("SQL'den güncel ekatechwallet çekiliyor ve bahis kilitleniyor...");
    playOffSound("bet");

    try {
      const response = await fetch("/api/tech-roulette", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: betType, value: betValue, amount: betAmount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Rulet turu tamamlanamadı.");

      const wheelIndex = Math.max(0, ROULETTE_WHEEL.indexOf(Number(data.winningNumber)));
      const sector = 360 / ROULETTE_WHEEL.length;
      const targetRotation = 360 * 5 + (360 - wheelIndex * sector);
      setWheelRotation((current) => current + targetRotation);
      setResult(data);
      setWallet(Number(data.ekatechwallet || 0));
      setMessage(data.won ? `Kazanan sayı ${data.winningNumber}. ${formatTc(data.payoutAmount, locale)} TC ödeme SQL'e yazıldı.` : `Kazanan sayı ${data.winningNumber}. Bahis loglandı, ödeme yok.`);
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      window.setTimeout(loadState, 900);
      window.setTimeout(() => setSpinning(false), 2600);
    } catch (error) {
      setSpinning(false);
      setMessage(error instanceof Error ? error.message : "Rulet turu tamamlanamadı.");
      playOffSound("error");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050806] px-4 pb-24 pt-28 text-white sm:px-6">
      <div className="absolute left-1/2 top-28 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-80 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
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
                    const angle = (index * 360) / ROULETTE_WHEEL.length;
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
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard icon={<CircleDollarSign className="h-4 w-4" />} label="ekatechwallet" value={`${formatTc(wallet, locale)} TC`} />
                  <StatCard icon={<Dice5 className="h-4 w-4" />} label="Bahis" value={`${formatTc(betAmount, locale)} TC`} />
                  <StatCard icon={<Database className="h-4 w-4" />} label="SQL durum" value={spinning ? "Kilitli" : "Hazır"} />
                </div>

                {result && (
                  <div className={`rounded-[1.5rem] border p-5 ${result.won ? "border-emerald-300/30 bg-emerald-300/10" : "border-red-300/25 bg-red-300/10"}`}>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">Sonuç</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black ${result.color === "green" ? "bg-emerald-500" : result.color === "red" ? "bg-red-600" : "bg-zinc-950 ring-1 ring-white/20"}`}>{result.winningNumber}</span>
                      <div>
                        <p className="text-2xl font-semibold">{result.won ? "Kazandın" : "Kaybettin"}</p>
                        <p className="text-sm text-white/55">Çarpan {result.payoutMultiplier}:1 · Ödeme {formatTc(result.payoutAmount, locale)} TC · Yeni bakiye {formatTc(result.ekatechwallet, locale)} TC</p>
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
              <RouletteTable selectedType={betType} selectedValue={betValue} onSelect={selectBet} />
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
                  placeholder="1000000"
                />
                <span className={`mt-2 block text-xs ${betAmountValid ? "text-emerald-100/60" : "text-amber-200"}`}>Limit: {formatTc(MIN_BET, locale)} - {formatTc(MAX_BET, locale)} TC</span>
              </label>

              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Hızlı miktar</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5">
                  {QUICK_BETS.map((chip) => (
                    <button key={chip.value} type="button" onClick={() => setBetInput(String(chip.value))} className={`rounded-full border px-3 py-3 font-semibold transition-all ${betAmount === chip.value ? "border-amber-200 bg-amber-200 text-black shadow-lg shadow-amber-500/20" : "border-white/10 bg-white/10 text-white hover:bg-white/20"}`}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" disabled={spinning || !betAmountValid} onClick={playRound} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45">
                <Play className="h-5 w-5" /> {spinning ? "Çark dönüyor..." : "Bahsi Oyna"}
              </button>
            </div>
          </aside>
        </section>

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

function RouletteTable({ selectedType, selectedValue, onSelect }: { selectedType: BetType; selectedValue?: number; onSelect: (bet: BoardBet) => void }) {
  const isSelected = (type: BetType, value?: number) => selectedType === type && (value === undefined || selectedValue === value);
  return (
    <div className="min-w-0 overflow-x-auto pb-2">
      <div className="min-w-[46rem] select-none">
        <div className="grid grid-cols-[4.5rem_repeat(12,minmax(3.1rem,1fr))_4.5rem] gap-1.5">
          <button type="button" onClick={() => onSelect({ type: "straight", value: 0, label: "0", multiplier: "35:1" })} className={`row-span-3 rounded-l-[1.3rem] border-2 text-2xl font-black transition-all ${isSelected("straight", 0) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-500 text-white hover:border-amber-200"}`}>
            0
          </button>
          {TABLE_ROWS.map((row, rowIndex) => row.map((number) => (
            <NumberCell key={number} number={number} selected={isSelected("straight", number)} onClick={() => onSelect({ type: "straight", value: number, label: String(number), multiplier: "35:1" })} />
          )).concat(
            <button key={`column-${rowIndex}`} type="button" onClick={() => onSelect({ type: "column", value: 3 - rowIndex, label: `${3 - rowIndex}. Sütun`, multiplier: "2:1" })} className={`rounded-r-xl border-2 px-2 text-sm font-black transition-all ${isSelected("column", 3 - rowIndex) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-800 text-white hover:border-amber-200"}`}>
              2:1
            </button>,
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-[4.5rem_repeat(3,1fr)_4.5rem] gap-1.5">
          <div />
          {[1, 2, 3].map((value) => (
            <button key={value} type="button" onClick={() => onSelect({ type: "dozen", value, label: `${value}. 12'li`, multiplier: "2:1" })} className={`rounded-xl border-2 py-3 text-sm font-black transition-all ${isSelected("dozen", value) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-700 text-white hover:border-amber-200"}`}>
              {value === 1 ? "1-12" : value === 2 ? "13-24" : "25-36"}
            </button>
          ))}
          <div />
        </div>

        <div className="mt-1.5 grid grid-cols-[4.5rem_repeat(6,1fr)_4.5rem] gap-1.5">
          <div />
          <OutsideBet active={isSelected("low")} onClick={() => onSelect({ type: "low", label: "1-18", multiplier: "1:1" })}>1-18</OutsideBet>
          <OutsideBet active={isSelected("even")} onClick={() => onSelect({ type: "even", label: "Çift", multiplier: "1:1" })}>ÇİFT</OutsideBet>
          <OutsideBet active={isSelected("red")} tone="red" onClick={() => onSelect({ type: "red", label: "Kırmızı", multiplier: "1:1" })}>KIRMIZI</OutsideBet>
          <OutsideBet active={isSelected("black")} tone="black" onClick={() => onSelect({ type: "black", label: "Siyah", multiplier: "1:1" })}>SİYAH</OutsideBet>
          <OutsideBet active={isSelected("odd")} onClick={() => onSelect({ type: "odd", label: "Tek", multiplier: "1:1" })}>TEK</OutsideBet>
          <OutsideBet active={isSelected("high")} onClick={() => onSelect({ type: "high", label: "19-36", multiplier: "1:1" })}>19-36</OutsideBet>
          <div />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-50/60">
          <Touchpad className="h-4 w-4" /> Mobilde halıyı yana kaydırıp tüm sayılara dokunabilirsin.
        </div>
      </div>
    </div>
  );
}

function NumberCell({ number, selected, onClick }: { number: number; selected: boolean; onClick: () => void }) {
  const color = numberColor(number);
  return (
    <button type="button" onClick={onClick} className={`min-h-14 rounded-lg border-2 text-lg font-black shadow-inner transition-all ${selected ? "border-amber-200 bg-amber-200 text-black shadow-amber-950/30" : color === "red" ? "border-white/25 bg-red-600 text-white hover:border-amber-200" : "border-white/25 bg-zinc-950 text-white hover:border-amber-200"}`}>
      {number}
    </button>
  );
}

function OutsideBet({ active, tone = "green", onClick, children }: { active: boolean; tone?: "green" | "red" | "black"; onClick: () => void; children: ReactNode }) {
  const base = tone === "red" ? "bg-red-600" : tone === "black" ? "bg-zinc-950" : "bg-emerald-700";
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border-2 py-3 text-sm font-black transition-all ${active ? "border-amber-200 bg-amber-200 text-black" : `border-white/25 ${base} text-white hover:border-amber-200`}`}>
      {children}
    </button>
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
