import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type User = { id: number; name: string; email: string; avatar_url?: string; role?: string };
type DuelMode = "classic" | "best_focus" | "what_the_hold";
type Lobby = {
  id: number;
  creator_user_id: number;
  opponent_user_id?: number | null;
  mode?: DuelMode;
  reward_amount: number;
  round_count: number;
  status: "open" | "in_progress" | "completed" | "expired";
  winner_user_id?: number | null;
  creator_name: string;
  creator_email: string;
  creator_avatar_url?: string;
  opponent_name?: string | null;
  opponent_email?: string | null;
  opponent_avatar_url?: string | null;
  winner_name?: string | null;
};
type Round = {
  round_number: number;
  signal_at: string;
  status: "active" | "completed";
  winner_user_id?: number | null;
  winner_name?: string | null;
};
type Submission = { user_id: number; ms?: number | null; too_early?: number; score_ms?: number; name?: string };
type ReadyRow = { user_id: number; name?: string };
type RoundPayload = {
  server_time: string;
  lobby: Lobby;
  current_round: Round | null;
  rounds: Round[];
  submissions: Submission[];
  my_submission?: Submission | null;
  score: Record<string, number>;
  target_wins: number;
  ready?: ReadyRow[];
  ready_count?: number;
  pending_round_number?: number;
};

const FIXED_REWARD = 50;
const FAKE_SIGNALS = ["DRA...", "DR4W", "DROW", "DRAW?", "NOW", "FIRE", "READY?", "DANGER"];

function toMs(value?: string | null) {
  if (!value) return 0;
  return Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
}

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "P";
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P";
}

function Avatar({ name, email, avatarUrl }: { name?: string | null; email?: string | null; avatarUrl?: string | null }) {
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-black">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(name, email)}</span>;
}

function modeTitle(mode?: DuelMode) {
  if (mode === "best_focus") return "Best Focus";
  if (mode === "what_the_hold") return "What The Hold";
  return "Classic Mode";
}

export function TechDuelSync() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [openLobbies, setOpenLobbies] = useState<Lobby[]>([]);
  const [myLobbies, setMyLobbies] = useState<Lobby[]>([]);
  const [mode, setMode] = useState<DuelMode>("classic");
  const [roundCount, setRoundCount] = useState(5);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [roundPayload, setRoundPayload] = useState<RoundPayload | null>(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const c = useMemo(() => tr ? {
    title: "Tech Duel",
    subtitle: "Round geri sayımı sadece iki oyuncu da maça girince başlar. Geç giren oyuncuya 5000ms yazmaz.",
    create: "Lobby oluştur",
    createTitle: "Create Lobby",
    active: "Aktif düellolar",
    mine: "Düellolarım",
    mode: "Oyun modu",
    round: "Round",
    reward: "Sabit ödül",
    fixed: "50 Tech Coin sabit ödül · kaybedenden coin kesilmez",
    join: "Join",
    enter: "Maça gir",
    refresh: "Yenile",
    ready: "Hazır",
    readyWaiting: "Hazırsın · rakip bekleniyor",
    waitingBoth: "İki oyuncu da maça girince round başlayacak",
    wait: "WAIT...",
    draw: "DRAW!",
    release: "RELEASE!",
    hold: "HOLD...",
    pressHold: "PRESS & HOLD",
    tooEarly: "TOO EARLY",
    dontClick: "Basılmayacak",
    clickNow: "Şimdi bas",
    holdStart: "Başlamak için basılı tut",
    keepHolding: "Basılı tutmaya devam et",
    releaseNow: "Şimdi bırak",
    waitingOpponent: "Rakibin sonucu bekleniyor",
    roundWinner: "Tur kazananı",
    nextRound: "Sonraki round için hazır ol",
    matchOver: "Maç tamamlandı",
    score: "Skor",
    player2: "Player 2",
    waitingPlayer: "Player 2 bekleniyor",
    empty: "Açık lobby yok.",
    emptyMine: "Henüz düellon yok.",
    classic: "WAIT → DRAW. DRAW’dan önce basarsan round kaybı.",
    focus: "Sahte sinyaller gelir. Sadece gerçek DRAW! anında bas.",
    what: "Basılı tut. RELEASE! çıkınca ilk elini çeken round’u alır.",
    login: "Tech Duel için giriş yapman gerekiyor.",
  } : {
    title: "Tech Duel",
    subtitle: "The countdown starts only after both players enter the match. A late player will not get a 5000ms result.",
    create: "Create lobby",
    createTitle: "Create Lobby",
    active: "Active duels",
    mine: "My duels",
    mode: "Game mode",
    round: "Round",
    reward: "Fixed reward",
    fixed: "50 Tech Coin fixed reward · loser coins are not deducted",
    join: "Join",
    enter: "Enter match",
    refresh: "Refresh",
    ready: "Ready",
    readyWaiting: "Ready · waiting for opponent",
    waitingBoth: "Round starts after both players enter the match",
    wait: "WAIT...",
    draw: "DRAW!",
    release: "RELEASE!",
    hold: "HOLD...",
    pressHold: "PRESS & HOLD",
    tooEarly: "TOO EARLY",
    dontClick: "Do not click",
    clickNow: "Click now",
    holdStart: "Hold down to start",
    keepHolding: "Keep holding",
    releaseNow: "Release now",
    waitingOpponent: "Waiting for opponent result",
    roundWinner: "Round winner",
    nextRound: "Ready for next round",
    matchOver: "Match completed",
    score: "Score",
    player2: "Player 2",
    waitingPlayer: "Waiting for Player 2",
    empty: "No open lobbies.",
    emptyMine: "No duels yet.",
    classic: "WAIT → DRAW. Clicking before DRAW loses the round.",
    focus: "Fake signals appear. Only click on the real DRAW! signal.",
    what: "Hold down. Release after RELEASE!; first release wins the round.",
    login: "You need to sign in for Tech Duel.",
  }, [tr]);

  const loadDuels = async (silent = false) => {
    if (!silent) setBusy(true);
    if (!silent) setNotice(null);
    try {
      const r = await fetch("/api/duels", { credentials: "same-origin", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || c.login);
      setUser(d.user || null);
      setOpenLobbies(d.open || []);
      setMyLobbies(d.mine || []);
    } catch (e) {
      if (!silent) setNotice({ type: "error", text: e instanceof Error ? e.message : c.login });
    } finally {
      if (!silent) setBusy(false);
    }
  };

  const loadRound = async (id = activeLobby?.id, silent = true) => {
    if (!id) return;
    try {
      const r = await fetch(`/api/duels/round?lobby_id=${id}`, { credentials: "same-origin", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Round alınamadı.");
      setRoundPayload(d);
      setSyncedAt(Date.now());
      if (d?.lobby) setActiveLobby(d.lobby);
    } catch (e) {
      if (!silent) setNotice({ type: "error", text: e instanceof Error ? e.message : "Round alınamadı." });
    }
  };

  useEffect(() => {
    loadDuels();
    const tickTimer = window.setInterval(() => setNow(Date.now()), 100);
    const pollTimer = window.setInterval(() => activeLobby ? loadRound(activeLobby.id, true) : loadDuels(true), 1200);
    return () => { window.clearInterval(tickTimer); window.clearInterval(pollTimer); };
  }, [language, activeLobby?.id]);

  const createLobby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch("/api/duels", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, round_count: roundCount }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Lobby oluşturulamadı.");
      setNotice({ type: "success", text: d?.message || "Lobby oluşturuldu." });
      await loadDuels(true);
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Lobby oluşturulamadı." });
    } finally { setBusy(false); }
  };

  const joinLobby = async (id: number) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch("/api/duels/join", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: id }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Düelloya katılınamadı.");
      await loadDuels(true);
      const lobby = [...openLobbies, ...myLobbies].find((x) => x.id === id);
      if (lobby) setActiveLobby({ ...lobby, status: "in_progress" });
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Düelloya katılınamadı." });
    } finally { setBusy(false); }
  };

  const enterMatch = async (lobby: Lobby) => {
    setActiveLobby(lobby);
    setHolding(false);
    setRoundPayload(null);
    await loadRound(lobby.id, false);
  };

  const submit = async (tooEarly: boolean, ms: number | null) => {
    if (!roundPayload?.lobby || !roundPayload.current_round || roundPayload.my_submission || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/duels/submit", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: roundPayload.lobby.id, round_number: roundPayload.current_round.round_number, ms, tooEarly }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Sonuç gönderilemedi.");
      await loadRound(roundPayload.lobby.id, true);
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Sonuç gönderilemedi." });
    } finally { setSubmitting(false); }
  };

  const readyForNextRound = async () => {
    if (!roundPayload?.lobby) return;
    setBusy(true);
    setHolding(false);
    try {
      const r = await fetch("/api/duels/round", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: roundPayload.lobby.id, action: "next_round" }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Sonraki round başlatılamadı.");
      setRoundPayload(d);
      setSyncedAt(Date.now());
      setActiveLobby(d.lobby || roundPayload.lobby);
      await loadDuels(true);
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Sonraki round başlatılamadı." });
    } finally { setBusy(false); }
  };

  const lobby = roundPayload?.lobby || activeLobby;
  const current = roundPayload?.current_round || null;
  const currentMode = (lobby?.mode || "classic") as DuelMode;
  const serverNow = roundPayload?.server_time ? toMs(roundPayload.server_time) + (now - syncedAt) : 0;
  const signalAt = toMs(current?.signal_at);
  const signalPassed = Boolean(current && serverNow >= signalAt);
  const ms = signalPassed ? Math.max(0, Math.round(serverNow - signalAt)) : null;
  const roundCompleted = current?.status === "completed";
  const submitted = Boolean(roundPayload?.my_submission) || submitting;
  const secondsLeft = current && !signalPassed ? Math.max(0, Math.ceil((signalAt - serverNow) / 1000)) : 0;
  const creatorWins = Number(roundPayload?.score?.[String(lobby?.creator_user_id || "")] || 0);
  const opponentWins = Number(roundPayload?.score?.[String(lobby?.opponent_user_id || "")] || 0);
  const readyRows = roundPayload?.ready || [];
  const pendingRoundNumber = Number(roundPayload?.pending_round_number || 1);
  const selfReady = Boolean(user && readyRows.some((row) => Number(row.user_id) === Number(user.id)));
  const readyLabel = `${readyRows.length}/2 ${c.ready}`;

  const arenaText = () => {
    if (!current) return selfReady ? c.readyWaiting : c.waitingBoth;
    if (roundCompleted) return current.winner_name ? `${c.roundWinner}: ${current.winner_name}` : c.roundWinner;
    if (submitted) return c.waitingOpponent;
    if (currentMode === "what_the_hold") {
      if (!holding) return c.pressHold;
      return signalPassed ? c.release : c.hold;
    }
    if (signalPassed) return c.draw;
    if (currentMode === "best_focus" && secondsLeft <= 4) return FAKE_SIGNALS[Math.floor(now / 550) % FAKE_SIGNALS.length];
    return c.wait;
  };

  const arenaHint = () => {
    if (!current) return `${c.round} ${pendingRoundNumber} · ${readyLabel}`;
    if (roundCompleted) return c.roundWinner;
    if (submitted) return c.waitingOpponent;
    if (currentMode === "what_the_hold") {
      if (!holding) return c.holdStart;
      return signalPassed ? c.releaseNow : c.keepHolding;
    }
    return signalPassed ? c.clickNow : `${c.dontClick}${secondsLeft ? ` · ${secondsLeft}` : ""}`;
  };

  const clickArena = () => {
    if (!current || roundCompleted || submitted || currentMode === "what_the_hold") return;
    submit(!signalPassed, signalPassed ? ms : null);
  };

  const holdStart = () => {
    if (!current || roundCompleted || submitted || currentMode !== "what_the_hold") return;
    setHolding(true);
  };

  const holdEnd = () => {
    if (!current || roundCompleted || submitted || currentMode !== "what_the_hold" || !holding) return;
    setHolding(false);
    submit(!signalPassed, signalPassed ? ms : null);
  };

  return <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
    <div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
    <div className="relative mx-auto max-w-7xl space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm uppercase tracking-[0.28em] text-cyan-100/60">EkaTech OFF Arena</p><h1 className="mt-3 text-4xl font-medium tracking-tight text-white sm:text-6xl">{c.title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-white/55">{c.subtitle}</p></div><button onClick={() => activeLobby ? loadRound(activeLobby.id, false) : loadDuels()} disabled={busy} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50">{busy ? "..." : c.refresh}</button></div>
        {notice && <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}
      </section>

      {activeLobby && lobby ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4"><p className="text-sm uppercase tracking-[0.22em] text-white/35">{current ? `${c.round} ${current.round_number} / ${lobby.round_count}` : `${c.round} ${pendingRoundNumber} · ${readyLabel}`}</p><h2 className="text-3xl font-medium text-white">#{lobby.id} · {modeTitle(currentMode)}</h2><div className="grid grid-cols-3 items-center gap-3 rounded-3xl border border-white/10 bg-black/35 p-4"><Player name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} wins={creatorWins} target={roundPayload?.target_wins || 0} /><div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-2 text-sm text-white/45">{c.score}: {creatorWins}-{opponentWins}</p></div><Player name={lobby.opponent_name || c.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} wins={opponentWins} target={roundPayload?.target_wins || 0} /></div><RoundHistory rounds={roundPayload?.rounds || []} /></div>
          <button type="button" onClick={clickArena} onPointerDown={currentMode === "what_the_hold" ? holdStart : undefined} onPointerUp={currentMode === "what_the_hold" ? holdEnd : undefined} onPointerCancel={currentMode === "what_the_hold" ? holdEnd : undefined} disabled={!current || roundCompleted || submitted || lobby.status === "completed"} className={`min-h-[320px] touch-none select-none rounded-[2rem] border p-8 text-center transition-all ${signalPassed && !roundCompleted ? "border-cyan-300/40 bg-cyan-300/10 shadow-2xl shadow-cyan-500/20" : roundCompleted ? "border-emerald-300/30 bg-emerald-300/10" : submitted ? "border-white/10 bg-white/[0.035]" : "border-white/10 bg-black/50"}`}><p className={`text-5xl font-semibold tracking-tight sm:text-7xl ${roundCompleted ? "text-emerald-100" : signalPassed ? "text-cyan-100" : "text-white"}`}>{arenaText()}</p><p className="mt-6 text-sm uppercase tracking-[0.28em] text-white/35">{arenaHint()}</p>{roundPayload?.my_submission && <p className="mt-6 text-sm text-white/55">{Number(roundPayload.my_submission.too_early) === 1 ? c.tooEarly : `${roundPayload.my_submission.ms}ms`}</p>}</button>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">{roundCompleted && lobby.status !== "completed" && <button onClick={readyForNextRound} disabled={busy || selfReady} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : selfReady ? c.readyWaiting : c.nextRound}</button>}{!current && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-6 py-3 text-sm font-medium text-cyan-100">{readyLabel}</span>}{lobby.status === "completed" && <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-6 py-3 text-sm font-medium text-emerald-100">{c.matchOver}: {lobby.winner_name}</span>}<button onClick={() => { setActiveLobby(null); setRoundPayload(null); setHolding(false); loadDuels(true); }} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1]">Lobby</button></div>
      </section> : <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl"><h2 className="text-2xl font-medium text-white">{c.createTitle}</h2><form onSubmit={createLobby} className="mt-5 space-y-4"><div><p className="mb-2 text-sm text-white/45">{c.mode}</p><div className="space-y-2">{[{ v: "classic", t: "Classic Mode", d: c.classic }, { v: "best_focus", t: "Best Focus", d: c.focus }, { v: "what_the_hold", t: "What The Hold", d: c.what }].map((x) => <button key={x.v} type="button" onClick={() => setMode(x.v as DuelMode)} className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all ${mode === x.v ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"}`}><span className="block font-medium text-white">{x.t}</span><span className="mt-1 block text-xs text-white/45">{x.d}</span></button>)}</div></div><div><p className="mb-2 text-sm text-white/45">{c.round}</p><div className="grid grid-cols-3 gap-2">{[3, 5, 7].map((v) => <button key={v} type="button" onClick={() => setRoundCount(v)} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${roundCount === v ? "border-purple-300/30 bg-purple-300/10 text-purple-100" : "border-white/10 bg-white/[0.04] text-white/60"}`}>Best of {v}</button>)}</div></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{c.fixed}</div><button type="submit" disabled={busy || !user} className="w-full rounded-full bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : c.create}</button></form></section><section className="space-y-6"><LobbyList title={c.active} empty={c.empty} lobbies={openLobbies} user={user} c={c} onJoin={joinLobby} onPlay={enterMatch} /><LobbyList title={c.mine} empty={c.emptyMine} lobbies={myLobbies} user={user} c={c} onJoin={joinLobby} onPlay={enterMatch} mine /></section></div>}
    </div>
  </main>;
}

function Player({ name, email, avatarUrl, wins, target }: { name?: string | null; email?: string | null; avatarUrl?: string | null; wins: number; target: number }) {
  return <div className="flex flex-col items-center gap-2 text-center"><Avatar name={name} email={email} avatarUrl={avatarUrl} /><p className="max-w-28 truncate text-sm text-white">{name}</p><div className="flex gap-1">{Array.from({ length: target || 1 }).map((_, i) => <span key={i} className={`h-2 w-5 rounded-full ${i < wins ? "bg-cyan-200" : "bg-white/15"}`} />)}</div></div>;
}

function RoundHistory({ rounds }: { rounds: Round[] }) {
  if (!rounds.length) return null;
  return <div className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="flex flex-wrap gap-2">{rounds.map((r) => <span key={r.round_number} className={`rounded-full px-3 py-1 text-xs ${r.status === "completed" ? "bg-emerald-300/10 text-emerald-100" : "bg-cyan-300/10 text-cyan-100"}`}>R{r.round_number}: {r.status === "completed" ? r.winner_name || "Winner" : "Live"}</span>)}</div></div>;
}

function LobbyList({ title, empty, lobbies, user, c, onJoin, onPlay }: { title: string; empty: string; lobbies: Lobby[]; user: User | null; c: any; onJoin: (id: number) => void; onPlay: (lobby: Lobby) => void; mine?: boolean }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"><h2 className="text-2xl font-medium text-white">{title}</h2><div className="mt-5 space-y-3">{lobbies.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{empty}</p>}{lobbies.map((lobby) => { const isCreator = user?.id === lobby.creator_user_id; const isOpponent = user?.id === lobby.opponent_user_id; const canJoin = lobby.status === "open" && !isCreator; const canPlay = lobby.status === "in_progress" && (isCreator || isOpponent); const statusText = lobby.status === "open" ? "Open" : lobby.status === "in_progress" ? "Live" : lobby.status; return <motion.div key={lobby.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="flex items-center gap-3"><Avatar name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} /><div className="min-w-0"><p className="truncate font-medium text-white">{lobby.creator_name}</p><p className="text-sm text-white/40">#{lobby.id}</p></div></div><div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/45">{statusText}</p></div><div className="flex items-center gap-3 md:justify-end"><div className="min-w-0 text-right"><p className="truncate font-medium text-white">{lobby.opponent_name || c.player2}</p><p className="text-sm text-white/40">{lobby.opponent_name ? lobby.opponent_email : c.waitingPlayer}</p></div><Avatar name={lobby.opponent_name || c.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} /></div></div><div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/55"><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-100">{c.mode}: {modeTitle(lobby.mode)}</span><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{c.reward}: {lobby.reward_amount || FIXED_REWARD}</span><span className="rounded-full bg-purple-300/10 px-3 py-1 text-purple-100">Best of {lobby.round_count}</span>{lobby.winner_name && <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">Winner: {lobby.winner_name}</span>}</div><div className="mt-4 flex flex-wrap gap-2">{canJoin && <button type="button" onClick={() => onJoin(lobby.id)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200">{c.join}</button>}{canPlay && <button type="button" onClick={() => onPlay(lobby)} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15">{c.enter}</button>}</div></motion.div>; })}</div></div>;
}
