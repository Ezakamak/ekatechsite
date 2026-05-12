import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type User = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  role?: string;
};

type DuelMode = "classic" | "best_focus" | "what_the_hold";

type DuelLobby = {
  id: number;
  creator_user_id: number;
  opponent_user_id?: number | null;
  mode?: DuelMode;
  reward_amount: number;
  round_count: number;
  status: "open" | "in_progress" | "completed" | "expired";
  winner_user_id?: number | null;
  created_at?: string;
  creator_name: string;
  creator_email: string;
  creator_avatar_url?: string;
  opponent_name?: string | null;
  opponent_email?: string | null;
  opponent_avatar_url?: string | null;
  winner_name?: string | null;
  my_average_ms?: number | null;
  my_best_ms?: number | null;
  my_too_early_count?: number | null;
  my_round_wins?: number | null;
};

type RoundResult = {
  ms: number | null;
  tooEarly: boolean;
};

type GameState = "idle" | "arming" | "waiting" | "draw" | "round_result" | "finished";

const FIXED_REWARD = 50;
const FAKE_SIGNALS = ["DRA...", "DR4W", "DROW", "DRAW?", "NOW", "FIRE", "READY?", "DANGER"];

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "P";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

function Avatar({ name, email, avatarUrl }: { name?: string | null; email?: string | null; avatarUrl?: string | null }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white text-sm font-semibold text-black">
      {avatarUrl ? <img src={avatarUrl} alt="Player" className="h-full w-full object-cover" /> : getInitials(name, email)}
    </div>
  );
}

function summarize(rounds: RoundResult[]) {
  const valid = rounds.filter((round) => !round.tooEarly && typeof round.ms === "number").map((round) => Number(round.ms));
  const tooEarly = rounds.filter((round) => round.tooEarly).length;
  const average = valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 9999;
  const best = valid.length ? Math.min(...valid) : 9999;
  return { average, best, tooEarly };
}

function modeTitle(mode: DuelMode | undefined, tr: boolean) {
  if (mode === "best_focus") return "Best Focus";
  if (mode === "what_the_hold") return "What The Hold";
  return tr ? "Classic Mode" : "Classic Mode";
}

export function TechDuel() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [openLobbies, setOpenLobbies] = useState<DuelLobby[]>([]);
  const [myLobbies, setMyLobbies] = useState<DuelLobby[]>([]);
  const [selectedMode, setSelectedMode] = useState<DuelMode>("classic");
  const [roundCount, setRoundCount] = useState(5);
  const [selectedLobby, setSelectedLobby] = useState<DuelLobby | null>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentRound, setCurrentRound] = useState(1);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [drawAt, setDrawAt] = useState(0);
  const [roundMessage, setRoundMessage] = useState("");
  const [holding, setHolding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playingLock, setPlayingLock] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);

  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Tech Duel",
            subtitle: "OFF Hub içindeki refleks düellosu. Ödül sabit 50 Tech Coin; kaybedenden coin kesilmez. Modu seç, lobby oluştur, rakibini bekle.",
            createLobby: "Create Lobby",
            activeDuels: "Aktif düellolar",
            myDuels: "Düellolarım",
            reward: "Sabit ödül",
            mode: "Oyun modu",
            round: "Round",
            join: "Join",
            play: "Oyna",
            waitingPlayer: "Player 2 bekleniyor",
            player2: "Player 2",
            create: "Lobby oluştur",
            noOpen: "Açık lobby yok.",
            noMine: "Henüz düellon yok.",
            wait: "WAIT...",
            draw: "DRAW!",
            release: "RELEASE!",
            pressHold: "PRESS & HOLD",
            hold: "HOLD...",
            tooEarly: "TOO EARLY",
            nextRound: "Sonraki round",
            submit: "Sonucu gönder",
            finished: "Roundlar tamamlandı",
            average: "Ortalama",
            best: "En iyi",
            early: "Erken hata",
            winner: "Kazanan",
            statusOpen: "Açık",
            statusProgress: "Aktif",
            statusCompleted: "Tamamlandı",
            statusExpired: "Süresi doldu",
            refresh: "Yenile",
            loginNeeded: "Tech Duel için giriş yapman gerekiyor.",
            classicDesc: "WAIT → DRAW. DRAW’dan önce basarsan round kaybı.",
            focusDesc: "Sahte sinyaller gelir. Sadece gerçek DRAW! anında bas.",
            holdDesc: "Basılı tut. RELEASE! çıkınca ilk elini çeken round’u alır.",
            fixedRewardNote: "50 Tech Coin sabit sistem ödülü",
            dontClick: "Basılmayacak",
            clickNow: "Şimdi bas",
            holdStart: "Başlamak için basılı tut",
            releaseNow: "Şimdi bırak",
            keepHolding: "Basılı tutmaya devam et",
          }
        : {
            title: "Tech Duel",
            subtitle: "A reflex duel inside OFF Hub. Fixed reward is 50 Tech Coin; loser coins are not deducted. Pick a mode, create a lobby, wait for an opponent.",
            createLobby: "Create Lobby",
            activeDuels: "Active duels",
            myDuels: "My duels",
            reward: "Fixed reward",
            mode: "Game mode",
            round: "Round",
            join: "Join",
            play: "Play",
            waitingPlayer: "Waiting for Player 2",
            player2: "Player 2",
            create: "Create lobby",
            noOpen: "No open lobbies.",
            noMine: "No duels yet.",
            wait: "WAIT...",
            draw: "DRAW!",
            release: "RELEASE!",
            pressHold: "PRESS & HOLD",
            hold: "HOLD...",
            tooEarly: "TOO EARLY",
            nextRound: "Next round",
            submit: "Submit result",
            finished: "Rounds completed",
            average: "Average",
            best: "Best",
            early: "Early errors",
            winner: "Winner",
            statusOpen: "Open",
            statusProgress: "In progress",
            statusCompleted: "Completed",
            statusExpired: "Expired",
            refresh: "Refresh",
            loginNeeded: "You need to sign in for Tech Duel.",
            classicDesc: "WAIT → DRAW. Clicking before DRAW loses the round.",
            focusDesc: "Fake signals appear. Only click on the real DRAW! signal.",
            holdDesc: "Hold down. Release after RELEASE!; first release wins the round.",
            fixedRewardNote: "50 Tech Coin fixed system reward",
            dontClick: "Do not click",
            clickNow: "Click now",
            holdStart: "Hold down to start",
            releaseNow: "Release now",
            keepHolding: "Keep holding",
          },
    [tr]
  );

  const modeOptions = [
    { value: "classic" as DuelMode, title: "Classic Mode", desc: copy.classicDesc },
    { value: "best_focus" as DuelMode, title: "Best Focus", desc: copy.focusDesc },
    { value: "what_the_hold" as DuelMode, title: "What The Hold", desc: copy.holdDesc },
  ];

  const clearRoundTimers = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    timeoutRef.current = undefined;
    intervalRef.current = undefined;
  };

  const loadDuels = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setStatus(null);

    try {
      const response = await fetch("/api/duels", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.loginNeeded);
      setUser(data.user || null);
      setOpenLobbies(data.open || []);
      setMyLobbies(data.mine || []);
    } catch (error) {
      if (!silent) setStatus({ type: "error", message: error instanceof Error ? error.message : copy.loginNeeded });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDuels();
    const timer = window.setInterval(() => loadDuels(true), 10000);
    return () => {
      window.clearInterval(timer);
      clearRoundTimers();
    };
  }, [language]);

  const createLobby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/duels", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode, round_count: roundCount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Lobby oluşturulamadı.");
      setStatus({ type: "success", message: data?.message || "Lobby oluşturuldu." });
      await loadDuels(true);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Lobby oluşturulamadı." });
    } finally {
      setLoading(false);
    }
  };

  const joinLobby = async (lobbyId: number) => {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/duels/join", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobby_id: lobbyId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Düelloya katılınamadı.");
      setStatus({ type: "success", message: data?.message || "Düelloya katıldın." });
      await loadDuels(true);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Düelloya katılınamadı." });
    } finally {
      setLoading(false);
    }
  };

  const startGame = (lobby: DuelLobby) => {
    clearRoundTimers();
    setSelectedLobby({ ...lobby, mode: lobby.mode || "classic" });
    setRounds([]);
    setCurrentRound(1);
    setRoundMessage("");
    setGameState("idle");
    setHolding(false);
    setTimeout(() => beginRound(lobby.mode || "classic"), 80);
  };

  const beginRound = (mode = selectedLobby?.mode || "classic") => {
    clearRoundTimers();
    setPlayingLock(false);
    setHolding(false);

    if (mode === "what_the_hold") {
      setGameState("arming");
      setRoundMessage(copy.pressHold);
      return;
    }

    setGameState("waiting");
    setRoundMessage(copy.wait);
    const delay = 1800 + Math.floor(Math.random() * 3200);

    if (mode === "best_focus") {
      intervalRef.current = window.setInterval(() => {
        const fake = FAKE_SIGNALS[Math.floor(Math.random() * FAKE_SIGNALS.length)];
        setRoundMessage(fake);
      }, 520);
    }

    timeoutRef.current = window.setTimeout(() => {
      clearRoundTimers();
      const now = performance.now();
      setDrawAt(now);
      setGameState("draw");
      setRoundMessage(copy.draw);
    }, delay);
  };

  const finishRound = (result: RoundResult, message: string) => {
    if (!selectedLobby) return;
    clearRoundTimers();
    setPlayingLock(true);
    setHolding(false);
    setRounds((value) => [...value, result]);
    setRoundMessage(message);
    setGameState(currentRound >= selectedLobby.round_count ? "finished" : "round_result");
  };

  const handleDuelClick = () => {
    if (playingLock || !selectedLobby || selectedLobby.mode === "what_the_hold") return;

    if (gameState === "waiting") {
      finishRound({ ms: null, tooEarly: true }, copy.tooEarly);
      return;
    }

    if (gameState === "draw") {
      const ms = Math.max(0, Math.round(performance.now() - drawAt));
      finishRound({ ms, tooEarly: false }, `${ms}ms`);
    }
  };

  const handleHoldStart = () => {
    if (!selectedLobby || selectedLobby.mode !== "what_the_hold" || gameState !== "arming" || playingLock) return;
    setHolding(true);
    setGameState("waiting");
    setRoundMessage(copy.hold);
    const delay = 1800 + Math.floor(Math.random() * 3200);
    timeoutRef.current = window.setTimeout(() => {
      const now = performance.now();
      setDrawAt(now);
      setGameState("draw");
      setRoundMessage(copy.release);
    }, delay);
  };

  const handleHoldEnd = () => {
    if (!selectedLobby || selectedLobby.mode !== "what_the_hold" || playingLock || !holding) return;

    if (gameState === "waiting") {
      finishRound({ ms: null, tooEarly: true }, copy.tooEarly);
      return;
    }

    if (gameState === "draw") {
      const ms = Math.max(0, Math.round(performance.now() - drawAt));
      finishRound({ ms, tooEarly: false }, `${ms}ms`);
    }
  };

  const nextRound = () => {
    if (!selectedLobby) return;
    setCurrentRound((value) => value + 1);
    setTimeout(() => beginRound(selectedLobby.mode || "classic"), 80);
  };

  const submitResult = async () => {
    if (!selectedLobby) return;
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/duels/submit", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobby_id: selectedLobby.id, rounds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Sonuç gönderilemedi.");
      setStatus({ type: "success", message: data?.message || "Sonuç gönderildi." });
      setSelectedLobby(null);
      setGameState("idle");
      await loadDuels(true);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Sonuç gönderilemedi." });
    } finally {
      setLoading(false);
    }
  };

  const stats = summarize(rounds);
  const activeMode = selectedLobby?.mode || "classic";
  const isHoldMode = activeMode === "what_the_hold";

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/60">EkaTech OFF Arena</p>
              <h1 className="mt-3 text-4xl font-medium tracking-tight text-white sm:text-6xl">{copy.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/55">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => loadDuels()}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/[0.1] disabled:opacity-50"
            >
              {loading ? "..." : copy.refresh}
            </button>
          </div>
          {status && (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
              {status.message}
            </div>
          )}
        </section>

        {selectedLobby ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.22em] text-white/35">{copy.round} {currentRound} / {selectedLobby.round_count}</p>
                <h2 className="text-3xl font-medium text-white">#{selectedLobby.id} · {modeTitle(activeMode, tr)}</h2>
                <div className="grid grid-cols-3 items-center gap-3 rounded-3xl border border-white/10 bg-black/35 p-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Avatar name={selectedLobby.creator_name} email={selectedLobby.creator_email} avatarUrl={selectedLobby.creator_avatar_url} />
                    <p className="max-w-28 truncate text-sm text-white">{selectedLobby.creator_name}</p>
                  </div>
                  <p className="text-center text-2xl font-semibold text-white/35">VS</p>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Avatar name={selectedLobby.opponent_name || copy.player2} email={selectedLobby.opponent_email || ""} avatarUrl={selectedLobby.opponent_avatar_url || ""} />
                    <p className="max-w-28 truncate text-sm text-white">{selectedLobby.opponent_name || copy.player2}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label={copy.average} value={stats.average === 9999 ? "-" : `${stats.average}ms`} />
                  <Stat label={copy.best} value={stats.best === 9999 ? "-" : `${stats.best}ms`} />
                  <Stat label={copy.early} value={String(stats.tooEarly)} />
                </div>
              </div>

              <button
                type="button"
                onClick={isHoldMode ? undefined : handleDuelClick}
                onPointerDown={isHoldMode ? handleHoldStart : undefined}
                onPointerUp={isHoldMode ? handleHoldEnd : undefined}
                onPointerCancel={isHoldMode ? handleHoldEnd : undefined}
                disabled={!isHoldMode && (gameState === "idle" || gameState === "round_result" || gameState === "finished")}
                className={`min-h-[320px] touch-none select-none rounded-[2rem] border p-8 text-center transition-all ${gameState === "draw" ? "border-cyan-300/40 bg-cyan-300/10 shadow-2xl shadow-cyan-500/20" : gameState === "waiting" ? "border-white/10 bg-black/50" : roundMessage === copy.tooEarly ? "border-red-300/30 bg-red-300/10" : "border-white/10 bg-white/[0.035]"}`}
              >
                <p className={`text-5xl font-semibold tracking-tight sm:text-7xl ${gameState === "draw" ? "text-cyan-100" : roundMessage === copy.tooEarly ? "text-red-100" : "text-white"}`}>{roundMessage || copy.wait}</p>
                <p className="mt-6 text-sm uppercase tracking-[0.28em] text-white/35">
                  {isHoldMode
                    ? gameState === "arming"
                      ? copy.holdStart
                      : gameState === "waiting"
                        ? copy.keepHolding
                        : gameState === "draw"
                          ? copy.releaseNow
                          : copy.finished
                    : gameState === "waiting"
                      ? copy.dontClick
                      : gameState === "draw"
                        ? copy.clickNow
                        : copy.finished}
                </p>
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {gameState === "round_result" && (
                <button type="button" onClick={nextRound} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-200">
                  {copy.nextRound}
                </button>
              )}
              {gameState === "finished" && (
                <button type="button" onClick={submitResult} disabled={loading} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50">
                  {loading ? "..." : copy.submit}
                </button>
              )}
              <button type="button" onClick={() => setSelectedLobby(null)} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1]">
                Lobby
              </button>
            </div>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
              <h2 className="text-2xl font-medium text-white">{copy.createLobby}</h2>
              <form onSubmit={createLobby} className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-sm text-white/45">{copy.mode}</p>
                  <div className="space-y-2">
                    {modeOptions.map((mode) => (
                      <button key={mode.value} type="button" onClick={() => setSelectedMode(mode.value)} className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all ${selectedMode === mode.value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"}`}>
                        <span className="block font-medium text-white">{mode.title}</span>
                        <span className="mt-1 block text-xs text-white/45">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm text-white/45">{copy.round}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 5, 7].map((value) => (
                      <button key={value} type="button" onClick={() => setRoundCount(value)} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${roundCount === value ? "border-purple-300/30 bg-purple-300/10 text-purple-100" : "border-white/10 bg-white/[0.04] text-white/60"}`}>Best of {value}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
                  {copy.fixedRewardNote}
                </div>
                <button type="submit" disabled={loading || !user} className="w-full rounded-full bg-white px-6 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-50">
                  {loading ? "..." : copy.create}
                </button>
              </form>
            </section>

            <section className="space-y-6">
              <LobbyList title={copy.activeDuels} empty={copy.noOpen} lobbies={openLobbies} user={user} copy={copy} onJoin={joinLobby} onPlay={startGame} />
              <LobbyList title={copy.myDuels} empty={copy.noMine} lobbies={myLobbies} user={user} copy={copy} onJoin={joinLobby} onPlay={startGame} mine />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-xl font-medium text-white">{value}</p>
    </div>
  );
}

function LobbyList({ title, empty, lobbies, user, copy, onJoin, onPlay, mine = false }: { title: string; empty: string; lobbies: DuelLobby[]; user: User | null; copy: any; onJoin: (id: number) => void; onPlay: (lobby: DuelLobby) => void; mine?: boolean }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <h2 className="text-2xl font-medium text-white">{title}</h2>
      <div className="mt-5 space-y-3">
        {lobbies.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{empty}</p>}
        {lobbies.map((lobby) => {
          const isCreator = user?.id === lobby.creator_user_id;
          const isOpponent = user?.id === lobby.opponent_user_id;
          const canJoin = lobby.status === "open" && !isCreator;
          const canPlay = lobby.status === "in_progress" && (isCreator || isOpponent) && !lobby.my_average_ms;
          const statusLabel = lobby.status === "open" ? copy.statusOpen : lobby.status === "in_progress" ? copy.statusProgress : lobby.status === "completed" ? copy.statusCompleted : copy.statusExpired;

          return (
            <motion.div key={`${mine ? "mine" : "open"}-${lobby.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-black/35 p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="flex items-center gap-3">
                  <Avatar name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{lobby.creator_name}</p>
                    <p className="text-sm text-white/40">#{lobby.id}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-white/35">VS</p>
                  <p className="mt-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/45">{statusLabel}</p>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <div className="min-w-0 text-right">
                    <p className="truncate font-medium text-white">{lobby.opponent_name || copy.player2}</p>
                    <p className="text-sm text-white/40">{lobby.opponent_name ? lobby.opponent_email : copy.waitingPlayer}</p>
                  </div>
                  <Avatar name={lobby.opponent_name || copy.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/55">
                <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-100">{copy.mode}: {modeTitle(lobby.mode || "classic", true)}</span>
                <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{copy.reward}: {lobby.reward_amount || FIXED_REWARD}</span>
                <span className="rounded-full bg-purple-300/10 px-3 py-1 text-purple-100">Best of {lobby.round_count}</span>
                {lobby.winner_name && <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{copy.winner}: {lobby.winner_name}</span>}
                {lobby.my_average_ms && <span className="rounded-full bg-white/[0.06] px-3 py-1">{copy.average}: {lobby.my_average_ms}ms</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {canJoin && (
                  <button type="button" onClick={() => onJoin(lobby.id)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200">
                    {copy.join}
                  </button>
                )}
                {canPlay && (
                  <button type="button" onClick={() => onPlay(lobby)} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15">
                    {copy.play}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
