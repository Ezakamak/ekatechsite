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
};

type DuelRound = {
  id: number;
  lobby_id: number;
  round_number: number;
  signal_at: string;
  status: "active" | "completed";
  winner_user_id?: number | null;
  winner_name?: string | null;
  completed_at?: string | null;
};

type RoundSubmission = {
  user_id: number;
  round_number: number;
  ms?: number | null;
  too_early?: number;
  score_ms?: number;
  name?: string;
  avatar_url?: string;
};

type RoundState = {
  server_time: string;
  lobby: DuelLobby;
  current_round: DuelRound | null;
  rounds: DuelRound[];
  submissions: RoundSubmission[];
  my_submission?: RoundSubmission | null;
  score: Record<string, number>;
  target_wins: number;
};

const FIXED_REWARD = 50;
const FAKE_SIGNALS = ["DRA...", "DR4W", "DROW", "DRAW?", "NOW", "FIRE", "READY?", "DANGER"];

function parseServerTime(value?: string | null) {
  if (!value) return 0;
  if (value.includes("T")) return Date.parse(value);
  return Date.parse(value.replace(" ", "T") + "Z");
}

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

function modeTitle(mode?: DuelMode) {
  if (mode === "best_focus") return "Best Focus";
  if (mode === "what_the_hold") return "What The Hold";
  return "Classic Mode";
}

export function TechDuelLive() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [openLobbies, setOpenLobbies] = useState<DuelLobby[]>([]);
  const [myLobbies, setMyLobbies] = useState<DuelLobby[]>([]);
  const [selectedMode, setSelectedMode] = useState<DuelMode>("classic");
  const [roundCount, setRoundCount] = useState(5);
  const [activeLobby, setActiveLobby] = useState<DuelLobby | null>(null);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [syncAt, setSyncAt] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [holding, setHolding] = useState(false);
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fakeIndexRef = useRef(0);

  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Tech Duel",
            subtitle: "Roundlar iki oyuncuda aynı anda başlar. Her turda iki tarafın sonucu beklenir, kazanan gösterilir, sonra yeni tura geçilir.",
            createLobby: "Create Lobby",
            activeDuels: "Aktif düellolar",
            myDuels: "Düellolarım",
            reward: "Sabit ödül",
            mode: "Oyun modu",
            round: "Round",
            join: "Join",
            play: "Maça gir",
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
            nextRound: "Sonraki roundu başlat",
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
            waitingOpponent: "Rakibin sonucu bekleniyor",
            bothResults: "İki oyuncunun sonucu geldi",
            matchOver: "Maç tamamlandı",
            score: "Skor",
          }
        : {
            title: "Tech Duel",
            subtitle: "Rounds start at the same server time for both players. Each round waits for both results, shows the winner, then moves to the next round.",
            createLobby: "Create Lobby",
            activeDuels: "Active duels",
            myDuels: "My duels",
            reward: "Fixed reward",
            mode: "Game mode",
            round: "Round",
            join: "Join",
            play: "Enter match",
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
            nextRound: "Start next round",
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
            waitingOpponent: "Waiting for opponent result",
            bothResults: "Both results received",
            matchOver: "Match completed",
            score: "Score",
          },
    [tr]
  );

  const modeOptions = [
    { value: "classic" as DuelMode, title: "Classic Mode", desc: copy.classicDesc },
    { value: "best_focus" as DuelMode, title: "Best Focus", desc: copy.focusDesc },
    { value: "what_the_hold" as DuelMode, title: "What The Hold", desc: copy.holdDesc },
  ];

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

  const loadRound = async (lobbyId = activeLobby?.id, silent = true) => {
    if (!lobbyId) return;
    try {
      const response = await fetch(`/api/duels/round?lobby_id=${lobbyId}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Round alınamadı.");
      setRoundState(data);
      setSyncAt(Date.now());
      if (data?.my_submission) setLocalSubmitted(true);
    } catch (error) {
      if (!silent) setStatus({ type: "error", message: error instanceof Error ? error.message : "Round alınamadı." });
    }
  };

  useEffect(() => {
    loadDuels();
    const listTimer = window.setInterval(() => loadDuels(true), 10000);
    const tickTimer = window.setInterval(() => setTick(Date.now()), 100);
    return () => {
      window.clearInterval(listTimer);
      window.clearInterval(tickTimer);
    };
  }, [language]);

  useEffect(() => {
    if (!activeLobby) return;
    setLocalSubmitted(false);
    loadRound(activeLobby.id, false);
    const timer = window.setInterval(() => loadRound(activeLobby.id, true), 1200);
    return () => window.clearInterval(timer);
  }, [activeLobby?.id]);

  useEffect(() => {
    fakeIndexRef.current = Math.floor(tick / 550) % FAKE_SIGNALS.length;
  }, [tick]);

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
      const joined = [...openLobbies, ...myLobbies].find((item) => item.id === lobbyId);
      if (joined) setActiveLobby({ ...joined, status: "in_progress" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Düelloya katılınamadı." });
    } finally {
      setLoading(false);
    }
  };

  const submitRound = async (tooEarly: boolean, ms: number | null) => {
    if (!roundState?.lobby || !roundState.current_round || localSubmitted) return;
    setLocalSubmitted(true);

    try {
      const response = await fetch("/api/duels/submit", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobby_id: roundState.lobby.id,
          round_number: roundState.current_round.round_number,
          ms,
          tooEarly,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Sonuç gönderilemedi.");
      await loadRound(roundState.lobby.id, true);
    } catch (error) {
      setLocalSubmitted(false);
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Sonuç gönderilemedi." });
    }
  };

  const startNextRound = async () => {
    if (!roundState?.lobby) return;
    setLoading(true);
    setLocalSubmitted(false);
    setHolding(false);

    try {
      const response = await fetch("/api/duels/round", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobby_id: roundState.lobby.id, action: "next_round" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Sonraki round başlatılamadı.");
      setRoundState(data);
      setSyncAt(Date.now());
      if (data?.lobby?.status === "completed") await loadDuels(true);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Sonraki round başlatılamadı." });
    } finally {
      setLoading(false);
    }
  };

  const current = roundState?.current_round;
  const lobby = roundState?.lobby || activeLobby;
  const mode = (lobby?.mode || "classic") as DuelMode;
  const serverNow = roundState?.server_time ? parseServerTime(roundState.server_time) + (Date.now() - syncAt) : 0;
  const signalAt = parseServerTime(current?.signal_at);
  const signalPassed = Boolean(current && serverNow >= signalAt);
  const msSinceSignal = signalPassed ? Math.max(0, Math.round(serverNow - signalAt)) : null;
  const secondsLeft = current && !signalPassed ? Math.max(0, Math.ceil((signalAt - serverNow) / 1000)) : 0;
  const roundCompleted = current?.status === "completed";
  const mySubmission = roundState?.my_submission || null;
  const submitted = Boolean(mySubmission) || localSubmitted;
  const creatorWins = Number(roundState?.score?.[String(lobby?.creator_user_id || "")] || 0);
  const opponentWins = Number(roundState?.score?.[String(lobby?.opponent_user_id || "")] || 0);

  const showText = () => {
    if (!current) return copy.waitingPlayer;
    if (roundCompleted) return current.winner_name ? `${copy.winner}: ${current.winner_name}` : copy.bothResults;
    if (submitted) return copy.waitingOpponent;
    if (mode === "what_the_hold") {
      if (!holding) return copy.pressHold;
      return signalPassed ? copy.release : copy.hold;
    }
    if (signalPassed) return copy.draw;
    if (mode === "best_focus" && secondsLeft <= 4) return FAKE_SIGNALS[fakeIndexRef.current];
    return copy.wait;
  };

  const actionHint = () => {
    if (!current) return "";
    if (roundCompleted) return copy.bothResults;
    if (submitted) return copy.waitingOpponent;
    if (mode === "what_the_hold") {
      if (!holding) return copy.holdStart;
      return signalPassed ? copy.releaseNow : copy.keepHolding;
    }
    return signalPassed ? copy.clickNow : `${copy.dontClick}${secondsLeft ? ` · ${secondsLeft}` : ""}`;
  };

  const handleActionClick = () => {
    if (!current || roundCompleted || submitted || mode === "what_the_hold") return;
    if (!signalPassed) submitRound(true, null);
    else submitRound(false, msSinceSignal);
  };

  const handleHoldStart = () => {
    if (!current || roundCompleted || submitted || mode !== "what_the_hold") return;
    setHolding(true);
  };

  const handleHoldEnd = () => {
    if (!current || roundCompleted || submitted || mode !== "what_the_hold" || !holding) return;
    setHolding(false);
    if (!signalPassed) submitRound(true, null);
    else submitRound(false, msSinceSignal);
  };

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
            <button type="button" onClick={() => (activeLobby ? loadRound(activeLobby.id, false) : loadDuels())} disabled={loading} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/[0.1] disabled:opacity-50">
              {loading ? "..." : copy.refresh}
            </button>
          </div>
          {status && <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{status.message}</div>}
        </section>

        {activeLobby && lobby ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.22em] text-white/35">{current ? `${copy.round} ${current.round_number} / ${lobby.round_count}` : copy.waitingPlayer}</p>
                <h2 className="text-3xl font-medium text-white">#{lobby.id} · {modeTitle(mode)}</h2>
                <div className="grid grid-cols-3 items-center gap-3 rounded-3xl border border-white/10 bg-black/35 p-4">
                  <PlayerBlock name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} wins={creatorWins} target={roundState?.target_wins || 0} />
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-white/35">VS</p>
                    <p className="mt-2 text-sm text-white/45">{copy.score}: {creatorWins}-{opponentWins}</p>
                  </div>
                  <PlayerBlock name={lobby.opponent_name || copy.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} wins={opponentWins} target={roundState?.target_wins || 0} />
                </div>
                <RoundHistory rounds={roundState?.rounds || []} />
              </div>

              <button
                type="button"
                onClick={handleActionClick}
                onPointerDown={mode === "what_the_hold" ? handleHoldStart : undefined}
                onPointerUp={mode === "what_the_hold" ? handleHoldEnd : undefined}
                onPointerCancel={mode === "what_the_hold" ? handleHoldEnd : undefined}
                disabled={!current || roundCompleted || submitted || lobby.status === "completed"}
                className={`min-h-[320px] touch-none select-none rounded-[2rem] border p-8 text-center transition-all ${signalPassed && !roundCompleted ? "border-cyan-300/40 bg-cyan-300/10 shadow-2xl shadow-cyan-500/20" : roundCompleted ? "border-emerald-300/30 bg-emerald-300/10" : submitted ? "border-white/10 bg-white/[0.035]" : "border-white/10 bg-black/50"}`}
              >
                <p className={`text-5xl font-semibold tracking-tight sm:text-7xl ${roundCompleted ? "text-emerald-100" : signalPassed ? "text-cyan-100" : "text-white"}`}>{showText()}</p>
                <p className="mt-6 text-sm uppercase tracking-[0.28em] text-white/35">{actionHint()}</p>
                {submitted && mySubmission && <p className="mt-6 text-sm text-white/55">{Number(mySubmission.too_early) === 1 ? copy.tooEarly : `${mySubmission.ms}ms`}</p>}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {roundCompleted && lobby.status !== "completed" && (
                <button type="button" onClick={startNextRound} disabled={loading} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50">
                  {loading ? "..." : copy.nextRound}
                </button>
              )}
              {lobby.status === "completed" && <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-6 py-3 text-sm font-medium text-emerald-100">{copy.matchOver}: {lobby.winner_name}</span>}
              <button type="button" onClick={() => { setActiveLobby(null); setRoundState(null); setLocalSubmitted(false); loadDuels(true); }} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1]">
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
                    {modeOptions.map((modeItem) => (
                      <button key={modeItem.value} type="button" onClick={() => setSelectedMode(modeItem.value)} className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all ${selectedMode === modeItem.value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"}`}>
                        <span className="block font-medium text-white">{modeItem.title}</span>
                        <span className="mt-1 block text-xs text-white/45">{modeItem.desc}</span>
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
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{copy.fixedRewardNote}</div>
                <button type="submit" disabled={loading || !user} className="w-full rounded-full bg-white px-6 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-50">{loading ? "..." : copy.create}</button>
              </form>
            </section>

            <section className="space-y-6">
              <LobbyList title={copy.activeDuels} empty={copy.noOpen} lobbies={openLobbies} user={user} copy={copy} onJoin={joinLobby} onPlay={setActiveLobby} />
              <LobbyList title={copy.myDuels} empty={copy.noMine} lobbies={myLobbies} user={user} copy={copy} onJoin={joinLobby} onPlay={setActiveLobby} mine />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function PlayerBlock({ name, email, avatarUrl, wins, target }: { name?: string | null; email?: string | null; avatarUrl?: string | null; wins: number; target: number }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Avatar name={name} email={email} avatarUrl={avatarUrl} />
      <p className="max-w-28 truncate text-sm text-white">{name}</p>
      <div className="flex gap-1">
        {Array.from({ length: target || 1 }).map((_, index) => <span key={index} className={`h-2 w-5 rounded-full ${index < wins ? "bg-cyan-200" : "bg-white/15"}`} />)}
      </div>
    </div>
  );
}

function RoundHistory({ rounds }: { rounds: DuelRound[] }) {
  if (!rounds.length) return null;
  return (
    <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
      <div className="flex flex-wrap gap-2">
        {rounds.map((round) => (
          <span key={round.round_number} className={`rounded-full px-3 py-1 text-xs ${round.status === "completed" ? "bg-emerald-300/10 text-emerald-100" : "bg-cyan-300/10 text-cyan-100"}`}>
            R{round.round_number}: {round.status === "completed" ? round.winner_name || "Winner" : "Live"}
          </span>
        ))}
      </div>
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
          const canPlay = lobby.status === "in_progress" && (isCreator || isOpponent);
          const statusLabel = lobby.status === "open" ? copy.statusOpen : lobby.status === "in_progress" ? copy.statusProgress : lobby.status === "completed" ? copy.statusCompleted : copy.statusExpired;

          return (
            <motion.div key={`${mine ? "mine" : "open"}-${lobby.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-black/35 p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="flex items-center gap-3"><Avatar name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} /><div className="min-w-0"><p className="truncate font-medium text-white">{lobby.creator_name}</p><p className="text-sm text-white/40">#{lobby.id}</p></div></div>
                <div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/45">{statusLabel}</p></div>
                <div className="flex items-center gap-3 md:justify-end"><div className="min-w-0 text-right"><p className="truncate font-medium text-white">{lobby.opponent_name || copy.player2}</p><p className="text-sm text-white/40">{lobby.opponent_name ? lobby.opponent_email : copy.waitingPlayer}</p></div><Avatar name={lobby.opponent_name || copy.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} /></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/55">
                <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-100">{copy.mode}: {modeTitle(lobby.mode || "classic")}</span>
                <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{copy.reward}: {lobby.reward_amount || FIXED_REWARD}</span>
                <span className="rounded-full bg-purple-300/10 px-3 py-1 text-purple-100">Best of {lobby.round_count}</span>
                {lobby.winner_name && <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{copy.winner}: {lobby.winner_name}</span>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {canJoin && <button type="button" onClick={() => onJoin(lobby.id)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200">{copy.join}</button>}
                {canPlay && <button type="button" onClick={() => onPlay(lobby)} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15">{copy.play}</button>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
