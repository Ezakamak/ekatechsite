import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Coins, Sparkles, Volume2 } from "lucide-react";

const REWARD_PER_CLICK = 2;

const soundModules = import.meta.glob("../../imports/sounds/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

type MemeSound = {
  id: string;
  url: string;
  fileName: string;
  displayName: string;
  sensitive: boolean;
};

type WalletPayload = {
  wallet?: {
    balance?: number;
    lifetime_earned?: number;
    updated_at?: string | null;
  };
  balance?: number;
  lifetime_earned?: number;
  updated_at?: string | null;
  message?: string;
  error?: string;
};

export function MemeClicker({ onBack }: { onBack: () => void }) {
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSound, setActiveSound] = useState<MemeSound | null>(null);
  const [message, setMessage] = useState("Hazır: büyük butona bas ve meme sesini patlat.");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState("");
  const [pulseKey, setPulseKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const sounds = useMemo(
    () =>
      Object.entries(soundModules)
        .map(([path, url]) => {
          const fileName = getFileName(path);
          return {
            id: path,
            url,
            fileName,
            displayName: cleanDisplayName(fileName),
            sensitive: fileName.startsWith("z"),
          } satisfies MemeSound;
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "tr")),
    [],
  );

  const playableSounds = useMemo(
    () =>
      includeSensitive ? sounds : sounds.filter((sound) => !sound.sensitive),
    [includeSensitive, sounds],
  );

  useEffect(() => {
    let active = true;

    fetch("/api/coins", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.json().catch(() => null))
      .then((data: WalletPayload | null) => {
        if (!active || !data) return;
        const balance = Number(data.wallet?.balance ?? data.balance);
        if (Number.isFinite(balance)) setWalletBalance(balance);
      })
      .catch(() => {
        if (active) setWalletError("Cüzdan bakiyesi alınamadı.");
      });

    const refreshWallet = () => {
      fetch("/api/coins", { credentials: "same-origin", cache: "no-store" })
        .then(async (response) => response.json().catch(() => null))
        .then((data: WalletPayload | null) => {
          if (!active || !data) return;
          const balance = Number(data.wallet?.balance ?? data.balance);
          if (Number.isFinite(balance)) setWalletBalance(balance);
        })
        .catch(() => undefined);
    };

    window.addEventListener("ekatech-techcoin-refresh", refreshWallet);

    return () => {
      active = false;
      window.removeEventListener("ekatech-techcoin-refresh", refreshWallet);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const stopCurrentAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.onended = null;
    audioRef.current.onerror = null;
    audioRef.current.src = "";
    audioRef.current = null;
  };

  const awardTechCoin = async () => {
    try {
      const response = await fetch("/api/coins", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "meme-clicker-reward" }),
      });
      const data: WalletPayload | null = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Tech Coin eklenemedi.");

      const balance = Number(data?.wallet?.balance ?? data?.balance);
      if (Number.isFinite(balance)) setWalletBalance(balance);
      setWalletError("");
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      setMessage(`+${REWARD_PER_CLICK} Tech Coin kazandın`);
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : "Tech Coin eklenemedi.",
      );
      setMessage("Ses çalıyor ama Tech Coin cüzdanı güncellenemedi.");
    }
  };

  const handlePlay = async () => {
    if (isPlaying) return;
    if (sounds.length === 0) {
      setMessage("Henüz ses dosyası eklenmemiş.");
      return;
    }
    if (playableSounds.length === 0) {
      setMessage("Güvenli modda çalınabilecek ses yok.");
      return;
    }

    const selected = playableSounds[Math.floor(Math.random() * playableSounds.length)];
    const audio = new Audio(selected.url);
    audioRef.current = audio;
    setActiveSound(selected);
    setIsPlaying(true);
    setPulseKey((current) => current + 1);
    setMessage(`${selected.displayName} yükleniyor...`);

    audio.onended = () => {
      setIsPlaying(false);
      setMessage("Ses bitti. Tech Coin aktarılıyor...");
      audioRef.current = null;
      void awardTechCoin();
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setMessage("Ses oynatılamadı.");
      audioRef.current = null;
    };

    try {
      await audio.play();
      setMessage(`${selected.displayName} çalıyor...`);
    } catch {
      stopCurrentAudio();
      setIsPlaying(false);
      setMessage("Ses oynatılamadı.");
    }
  };

  const toggleSensitive = () => {
    const next = !includeSensitive;
    setIncludeSensitive(next);
    setMessage(
      next
        ? "Hassas sesler açıldı. z ile başlayan dosyalar havuza eklendi."
        : "Hassas sesler kapandı. z ile başlayan dosyalar filtrelendi.",
    );
  };

  const emptyMessage =
    sounds.length === 0
      ? "Henüz ses dosyası eklenmemiş."
      : playableSounds.length === 0
        ? "Güvenli modda çalınabilecek ses yok."
        : "";
  const buttonDisabled = isPlaying || Boolean(emptyMessage);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-16 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="absolute -right-24 top-56 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -bottom-20 left-10 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-xl transition hover:border-cyan-200/40 hover:bg-cyan-300/10 hover:text-cyan-100"
          >
            <ArrowLeft className="h-4 w-4" /> OFF Hub'a dön
          </button>
          <button
            type="button"
            onClick={toggleSensitive}
            className={`rounded-full border px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition ${
              includeSensitive
                ? "border-pink-300/40 bg-pink-400/15 text-pink-100 shadow-lg shadow-pink-500/10"
                : "border-white/10 bg-white/[0.06] text-white/65 hover:border-purple-200/30 hover:text-purple-100"
            }`}
          >
            🔞 Hassas Sesler: {includeSensitive ? "Açık" : "Kapalı"}
          </button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-purple-500/20 backdrop-blur-2xl sm:p-8"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_50%_90%,rgba(168,85,247,0.16),transparent_42%)]" />
          <div className="relative text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <Volume2 className="h-4 w-4" /> Meme Clicker
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-tight text-white sm:text-7xl">
              Meme Clicker
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
              Büyük butona bas, rastgele meme sesi çalsın ve ses tamamlanınca
              {REWARD_PER_CLICK} Tech Coin kazan.
            </p>

            <div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
              <StatCard label="Toplam ses" value={sounds.length.toString()} />
              <StatCard label="Güvenli havuz" value={playableSounds.length.toString()} />
              <StatCard
                label="Bakiye"
                value={walletBalance === null ? "..." : `${walletBalance} TC`}
                icon={<Coins className="h-4 w-4 text-amber-100" />}
              />
            </div>

            <div className="relative mx-auto mt-10 flex h-72 max-w-2xl items-center justify-center rounded-[2rem] border border-white/10 bg-black/35 shadow-inner shadow-black/70">
              <div className="absolute inset-8 rounded-full bg-cyan-400/10 blur-3xl" />
              {pulseKey > 0 && (
                <motion.span
                  key={pulseKey}
                  initial={{ opacity: 0.9, scale: 0.68 }}
                  animate={{ opacity: 0, scale: 1.45 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="absolute h-56 w-56 rounded-full border-4 border-cyan-200/40 shadow-[0_0_60px_rgba(34,211,238,0.45)]"
                />
              )}
              <motion.button
                type="button"
                disabled={buttonDisabled}
                onClick={handlePlay}
                aria-label={isPlaying ? "Meme sesi çalıyor" : "Meme sesi çal"}
                title={isPlaying ? "Meme sesi çalıyor" : "Meme sesi çal"}
                whileTap={buttonDisabled ? undefined : { scale: 0.94, rotate: -1 }}
                animate={
                  isPlaying
                    ? { scale: [1, 1.035, 1], rotate: [0, -1.2, 1.2, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={isPlaying ? { repeat: Infinity, duration: 0.9 } : undefined}
                className="relative z-10 h-44 w-44 rounded-full border border-cyan-100/45 bg-[linear-gradient(145deg,#22d3ee,#a855f7_50%,#111827_52%,#0b1020)] p-2 text-center shadow-[0_24px_0_rgba(30,41,59,0.85),0_34px_80px_rgba(34,211,238,0.32),inset_0_8px_24px_rgba(255,255,255,0.32)] transition disabled:cursor-not-allowed disabled:opacity-55 sm:h-56 sm:w-56"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.55),transparent_18%),linear-gradient(145deg,rgba(255,255,255,0.24),rgba(0,0,0,0.18))] text-6xl drop-shadow sm:text-7xl">
                  {isPlaying ? (
                    <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  ) : (
                    <span aria-hidden="true"></span>
                  )}
                </span>
              </motion.button>
            </div>

            <div className="mx-auto mt-7 max-w-3xl rounded-[1.6rem] border border-white/10 bg-black/35 p-4 text-left backdrop-blur-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
                    Çalan ses
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {activeSound?.displayName || "Henüz seçim yok"}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/20 bg-purple-300/10 px-4 py-2 text-sm font-semibold text-purple-100">
                  <Sparkles className="h-4 w-4" /> +{REWARD_PER_CLICK} TC / biten ses
                </div>
              </div>
              <p className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50">
                {emptyMessage || message}
              </p>
              {walletError && (
                <p className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {walletError}
                </p>
              )}
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4 text-left backdrop-blur-xl">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
        {icon} {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function getFileName(path: string) {
  const rawName = path.split("/").pop() || path;
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function cleanDisplayName(fileName: string) {
  const withoutExtension = fileName.replace(/\.mp3$/i, "");
  const withoutSensitivePrefix = withoutExtension.startsWith("z")
    ? withoutExtension.slice(1).replace(/^[-_\s]+/, "")
    : withoutExtension;
  const spaced = withoutSensitivePrefix
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Meme Ses";

  return spaced.replace(/\p{L}+/gu, (word) => {
    const [first = "", ...rest] = Array.from(word);
    return `${first.toLocaleUpperCase("tr-TR")}${rest.join("").toLocaleLowerCase("tr-TR")}`;
  });
}
