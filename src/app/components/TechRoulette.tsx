import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { CircleDollarSign, Database, Dice5, History, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { useLanguage } from "../i18n";
import { TechCoinWalletBadge } from "./TechCoinWalletBadge";
import { playOffSound } from "./OffSoundEngine";

type BetType = "straight" | "red" | "black" | "odd" | "even" | "column" | "dozen";

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

const CHIP_VALUES = [
  { label: "1M", value: 1_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "100M", value: 100_000_000 },
  { label: "1B", value: 1_000_000_000 },
];

const ROULETTE_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function formatTc(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function numberColor(number: number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

export function TechRoulette() {
  const { language } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const [wallet, setWallet] = useState(0);
  const [selectedChip, setSelectedChip] = useState(CHIP_VALUES[0].value);
  const [chipCount, setChipCount] = useState(1);
  const [betType, setBetType] = useState<BetType>("red");
  const [straightNumber, setStraightNumber] = useState(7);
  const [column, setColumn] = useState(1);
  const [dozen, setDozen] = useState(1);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recent, setRecent] = useState<RouletteLog[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [message, setMessage] = useState("SQL ekatechwallet bakiyesi yükleniyor...");

  const betAmount = selectedChip * chipCount;

  const betValue = useMemo(() => {
    if (betType === "straight") return straightNumber;
    if (betType === "column") return column;
    if (betType === "dozen") return dozen;
    return undefined;
  }, [betType, column, dozen, straightNumber]);

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
    if (spinning) return;
    setSpinning(true);
    setMessage("SQL'den güncel ekatechwallet çekiliyor ve bahis kilitleniyor...");
    playOffSound("bet");

    try {
      const response = await fetch("/api/tech-roulette", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: betType, value: betValue, amount: betAmount, chipAmount: selectedChip, chipCount }),
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
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-28 text-white sm:px-6">
      <div className="absolute left-1/2 top-28 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-80 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                  <ShieldCheck className="h-4 w-4" /> Backend RNG + SQL ekatechwallet
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">Tech Roulette</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                  Avrupa ruleti: 37 sayı (0-36). Play sonrası bahis önce SQL cüzdandan düşülür, kazanan sayı sadece sunucuda üretilir ve sonuç log tablosuna yazılır.
                </p>
              </div>
              <TechCoinWalletBadge />
            </div>

            <div className="mt-8 flex flex-col items-center gap-6 xl:flex-row xl:items-stretch">
              <div className="relative flex w-full max-w-[30rem] items-center justify-center rounded-[2rem] border border-white/10 bg-black/40 p-6">
                <div className="absolute top-3 z-10 h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                <motion.div
                  animate={{ rotate: wheelRotation }}
                  transition={{ duration: 2.4, ease: [0.2, 0.85, 0.2, 1] }}
                  className="relative aspect-square w-full max-w-[25rem] rounded-full border-[14px] border-amber-200/80 bg-zinc-950 shadow-2xl shadow-black"
                >
                  {ROULETTE_WHEEL.map((number, index) => {
                    const angle = (index * 360) / ROULETTE_WHEEL.length;
                    const color = numberColor(number);
                    const colorClass = color === "green" ? "bg-emerald-500 text-white" : color === "red" ? "bg-red-600 text-white" : "bg-zinc-950 text-white";
                    return (
                      <span
                        key={number}
                        className={`absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-[0.65rem] font-bold ${colorClass}`}
                        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-10.6rem) rotate(${-angle}deg)` }}
                      >
                        {number}
                      </span>
                    );
                  })}
                  <div className="absolute inset-[31%] rounded-full border border-white/10 bg-gradient-to-br from-white/15 to-white/[0.03]" />
                  <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.8)]" />
                </motion.div>
              </div>

              <div className="grid flex-1 gap-4">
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

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-7">
            <h2 className="text-2xl font-semibold">Bahis Paneli</h2>
            <p className="mt-2 text-sm text-white/50">Çip miktarını ve bahis türünü seç, sonra Play ile sunucu tarafı turu başlat.</p>

            <div className="mt-6 space-y-5">
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/40">Çipler</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {CHIP_VALUES.map((chip) => (
                    <button key={chip.value} type="button" onClick={() => setSelectedChip(chip.value)} className={`rounded-full border px-4 py-3 font-semibold transition-all ${selectedChip === chip.value ? "border-amber-200 bg-amber-200 text-black shadow-lg shadow-amber-500/20" : "border-white/10 bg-black/30 text-white hover:bg-white/10"}`}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-white/40">Çip adedi: {chipCount}</span>
                <input className="mt-3 w-full accent-amber-200" type="range" min="1" max="10" value={chipCount} onChange={(event) => setChipCount(Number(event.target.value))} />
              </label>

              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/40">Bahis türü</p>
                <div className="grid grid-cols-2 gap-2">
                  <BetButton active={betType === "straight"} onClick={() => setBetType("straight")}>Tek sayı</BetButton>
                  <BetButton active={betType === "red"} onClick={() => setBetType("red")}>Kırmızı</BetButton>
                  <BetButton active={betType === "black"} onClick={() => setBetType("black")}>Siyah</BetButton>
                  <BetButton active={betType === "odd"} onClick={() => setBetType("odd")}>Tek</BetButton>
                  <BetButton active={betType === "even"} onClick={() => setBetType("even")}>Çift</BetButton>
                  <BetButton active={betType === "column"} onClick={() => setBetType("column")}>Sütun</BetButton>
                  <BetButton active={betType === "dozen"} onClick={() => setBetType("dozen")}>Deste</BetButton>
                </div>
              </div>

              {betType === "straight" && (
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-white/40">Sayı: {straightNumber}</span>
                  <input className="mt-3 w-full accent-emerald-300" type="range" min="0" max="36" value={straightNumber} onChange={(event) => setStraightNumber(Number(event.target.value))} />
                </label>
              )}

              {betType === "column" && <SegmentedPicker label="Sütun" value={column} onChange={setColumn} options={[1, 2, 3]} />}
              {betType === "dozen" && <SegmentedPicker label="Deste" value={dozen} onChange={setDozen} options={[1, 2, 3]} suffix=". 12" />}

              <button type="button" disabled={spinning} onClick={playRound} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45">
                <Play className="h-5 w-5" /> {spinning ? "Spinning..." : "Play"}
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

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/35">{icon} {label}</div>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function BetButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${active ? "border-emerald-200 bg-emerald-200 text-black" : "border-white/10 bg-black/25 text-white/70 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function SegmentedPicker({ label, value, onChange, options, suffix = "" }: { label: string; value: number; onChange: (value: number) => void; options: number[]; suffix?: string }) {
  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/40">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${value === option ? "border-cyan-200 bg-cyan-200 text-black" : "border-white/10 bg-black/25 text-white/70 hover:bg-white/10"}`}>
            {option}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}
