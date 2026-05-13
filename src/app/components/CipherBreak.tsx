import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n";

type User = { id: number; name: string; email: string; avatar_url?: string | null };
type Lobby = {
  id: number;
  creator_user_id: number;
  opponent_user_id?: number | null;
  reward_amount: number;
  round_count: number;
  status: string;
  winner_user_id?: number | null;
  creator_name: string;
  creator_email: string;
  creator_avatar_url?: string | null;
  opponent_name?: string | null;
  opponent_email?: string | null;
  opponent_avatar_url?: string | null;
  winner_name?: string | null;
};
type LockItem = { target: string; options: string[] };
type Round = {
  round_number: number;
  target_code: string;
  options_json: string;
  tick_ms: number;
  started_at: string;
  status: string;
  winner_user_id?: number | null;
  winner_name?: string | null;
};
type State = {
  user_id: number;
  lobby: Lobby;
  current_round: Round | null;
  rounds: Round[];
  submissions: any[];
  my_submission?: any;
  score: Record<string, number>;
  target_wins: number;
  server_time: string;
  lock_goal?: number;
};

function toMs(value?: string | null) {
  if (!value) return 0;
  return Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
}

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "P";
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P";
}

function Avatar({ name, email, url }: { name?: string | null; email?: string | null; url?: string | null }) {
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-black">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name, email)}</span>;
}

function parseLocks(round: Round | null): LockItem[] {
  if (!round) return [];
  try {
    const raw = JSON.parse(round.options_json || "[]");
    if (raw && Array.isArray(raw.locks)) return raw.locks;
    if (Array.isArray(raw) && raw[0]?.target && Array.isArray(raw[0]?.options)) return raw as LockItem[];
    if (Array.isArray(raw)) return [{ target: round.target_code, options: raw }];
  } catch {}
  return [{ target: round.target_code, options: [] }];
}

export function CipherBreak() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState<Lobby[]>([]);
  const [mine, setMine] = useState<Lobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [syncedAt, setSyncedAt] = useState(Date.now());

  const c = useMemo(() => tr ? {
    title: "Cipher Break",
    subtitle: "1 round içinde 3 farklı üçlü kod kilitle. 14 kod sırayla yanar; hedef kod yandığı anda bas.",
    create: "Lobby oluştur",
    active: "Aktif Cipher lobileri",
    mine: "Cipher maçlarım",
    join: "Join",
    enter: "Maça gir",
    refresh: "Yenile",
    target: "Hedef kod",
    lock: "Kodu kilitle",
    waiting: "Rakip bekleniyor",
    waitingResult: "Rakibin hamlesi bekleniyor",
    correct: "Doğru kilit",
    wrong: "Yanlış kod",
    nextRound: "Sonraki round",
    matchOver: "Maç tamamlandı",
    score: "Skor",
    reward: "Ödül",
    empty: "Açık lobby yok.",
    emptyMine: "Henüz Cipher maçın yok.",
    player2: "Player 2",
    cancelled: "İptal edildi",
    back: "Lobby listesi",
    rule: "Bu roundu almak için 3 kodu sırayla kilitle.",
    scan: "Scan...",
    lockProgress: "Kilit",
  } : {
    title: "Cipher Break",
    subtitle: "Lock 3 different three-character codes in one round. Fourteen codes light up in sequence; press when the target is active.",
    create: "Create lobby",
    active: "Active Cipher lobbies",
    mine: "My Cipher matches",
    join: "Join",
    enter: "Enter match",
    refresh: "Refresh",
    target: "Target code",
    lock: "Lock code",
    waiting: "Waiting for opponent",
    waitingResult: "Waiting for opponent move",
    correct: "Correct lock",
    wrong: "Wrong code",
    nextRound: "Next round",
    matchOver: "Match completed",
    score: "Score",
    reward: "Reward",
    empty: "No open lobbies.",
    emptyMine: "No Cipher matches yet.",
    player2: "Player 2",
    cancelled: "Cancelled",
    back: "Lobby list",
    rule: "Lock 3 codes in order to win this round.",
    scan: "Scan...",
    lockProgress: "Lock",
  }, [tr]);

  const loadList = async (silent = false) => {
    if (!silent) setBusy(true);
    if (!silent) setNotice(null);
    try {
      const r = await fetch("/cipher", { credentials: "same-origin", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Cipher yüklenemedi.");
      setUser(d.user || null);
      setOpen(d.open || []);
      setMine(d.mine || []);
    } catch (error) {
      if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Cipher yüklenemedi." });
    } finally {
      if (!silent) setBusy(false);
    }
  };

  const loadState = async (id = activeLobby?.id, silent = true) => {
    if (!id) return;
    try {
      const r = await fetch(`/cipher?lobby_id=${id}`, { credentials: "same-origin", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok || d?.error) throw new Error(d?.error || "Maç yüklenemedi.");
      setState(d);
      setSyncedAt(Date.now());
      if (d?.lobby) setActiveLobby(d.lobby);
    } catch (error) {
      if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Maç yüklenemedi." });
    }
  };

  const post = async (body: any, silent = false) => {
    if (!silent) setBusy(true);
    if (!silent) setNotice(null);
    try {
      const r = await fetch("/cipher", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => null);
      if (!r.ok || d?.error) throw new Error(d?.error || "İşlem başarısız.");
      if (d?.lobby) {
        setState(d);
        setSyncedAt(Date.now());
        setActiveLobby(d.lobby);
      }
      await loadList(true);
      return d;
    } catch (error) {
      if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "İşlem başarısız." });
      return null;
    } finally {
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    loadList();
    const tick = window.setInterval(() => setNow(Date.now()), 120);
    const poll = window.setInterval(() => activeLobby ? loadState(activeLobby.id, true) : loadList(true), 1400);
    return () => { window.clearInterval(tick); window.clearInterval(poll); };
  }, [activeLobby?.id, language]);

  const createLobby = async () => {
    await post({ action: "create" });
  };

  const joinLobby = async (id: number) => {
    const d = await post({ action: "join", lobby_id: id });
    if (d?.lobby) setActiveLobby(d.lobby);
  };

  const enter = async (lobby: Lobby) => {
    setActiveLobby(lobby);
    setState(null);
    await loadState(lobby.id, false);
  };

  const lobby = state?.lobby || activeLobby;
  const round = state?.current_round || null;
  const locks = useMemo(() => parseLocks(round), [round?.options_json, round?.target_code]);
  const lockGoal = Number(state?.lock_goal || Math.max(1, locks.length || 1));
  const rawProgress = Number(state?.my_submission?.correct ?? 0);
  const myProgress = rawProgress > 0 ? rawProgress : 0;
  const eliminated = rawProgress < 0;
  const currentLockIndex = Math.min(myProgress, Math.max(0, locks.length - 1));
  const currentLock = locks[currentLockIndex] || locks[0];
  const options = currentLock?.options || [];
  const currentTarget = currentLock?.target || round?.target_code || "---";
  const serverNow = state?.server_time ? toMs(state.server_time) + (now - syncedAt) : now;
  const startedAt = toMs(round?.started_at);
  const tickMs = Number(round?.tick_ms || 650);
  const activeIndex = options.length ? Math.floor(Math.max(0, serverNow - startedAt) / tickMs) % options.length : 0;
  const activeCode = options[activeIndex] || "---";
  const mySubmission = state?.my_submission;
  const creatorWins = Number(state?.score?.[String(lobby?.creator_user_id || "")] || 0);
  const opponentWins = Number(state?.score?.[String(lobby?.opponent_user_id || "")] || 0);
  const roundCompleted = round?.status === "completed";
  const matchCompleted = lobby?.status === "completed";
  const cancelled = lobby?.status === "cancelled" || lobby?.status === "İptal edildi";

  const submitCode = async () => {
    if (!lobby || !round || eliminated || myProgress >= lockGoal || round.status !== "active") return;
    await post({ action: "submit", lobby_id: lobby.id, selected_code: activeCode }, true);
  };

  const nextRound = async () => {
    if (!lobby) return;
    await post({ action: "next_round", lobby_id: lobby.id });
  };

  return <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
    <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="absolute right-0 top-72 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
    <div className="relative mx-auto max-w-7xl space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/60">EkaTech Security Arena</p>
            <h1 className="mt-3 text-4xl font-medium tracking-tight text-white sm:text-6xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/55">{c.subtitle}</p>
          </div>
          <button onClick={() => activeLobby ? loadState(activeLobby.id, false) : loadList()} disabled={busy} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50">{busy ? "..." : c.refresh}</button>
        </div>
        {notice && <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}
      </section>

      {activeLobby && lobby ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.22em] text-white/35">Round {round?.round_number || "-"} / {lobby.round_count}</p>
            <h2 className="text-3xl font-medium text-white">#{lobby.id} · Cipher Break</h2>
            <div className="grid grid-cols-3 items-center gap-3 rounded-3xl border border-white/10 bg-black/35 p-4">
              <Player name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} wins={creatorWins} target={state?.target_wins || 3} />
              <div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-2 text-sm text-white/45">{c.score}: {creatorWins}-{opponentWins}</p></div>
              <Player name={lobby.opponent_name || c.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} wins={opponentWins} target={state?.target_wins || 3} />
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
              <div className="flex flex-wrap gap-2">{state?.rounds?.map((item) => <span key={item.round_number} className={`rounded-full px-3 py-1 text-xs ${item.status === "completed" ? "bg-emerald-300/10 text-emerald-100" : "bg-cyan-300/10 text-cyan-100"}`}>R{item.round_number}: {item.winner_name || (item.status === "completed" ? "Draw" : "Live")}</span>)}</div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-300/20 bg-black/50 p-6 text-center shadow-2xl shadow-cyan-500/10">
            {!round ? <div className="flex min-h-[320px] items-center justify-center text-white/45">{c.waiting}</div> : <>
              <p className="text-xs uppercase tracking-[0.28em] text-white/35">{c.target}</p>
              <div className="mx-auto mt-3 inline-flex rounded-3xl border border-purple-300/25 bg-purple-300/10 px-8 py-4 font-mono text-4xl font-semibold tracking-[0.35em] text-purple-100 shadow-2xl shadow-purple-500/10">{currentTarget}</div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {Array.from({ length: lockGoal }).map((_, i) => <span key={i} className={`h-2 w-12 rounded-full ${i < myProgress ? "bg-emerald-300" : eliminated ? "bg-red-300/40" : "bg-white/15"}`} />)}
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/35">{c.lockProgress} {Math.min(myProgress + 1, lockGoal)} / {lockGoal}</p>
              <div className="relative mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 overflow-hidden sm:p-5">
                <p className="relative text-xs uppercase tracking-[0.22em] text-white/35 sm:tracking-[0.28em]">{c.rule}</p>
                <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-7">
                  {options.map((code, index) => {
                    const active = index === activeIndex;
                    const targetActive = active && code === currentTarget;
                    return <div key={`${code}-${index}-${myProgress}`} className={`transform-gpu rounded-2xl border px-2 py-4 font-mono text-xl font-semibold tracking-[0.18em] transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 ease-out sm:px-3 sm:py-5 sm:text-2xl ${targetActive ? "scale-[1.04] border-emerald-300/60 bg-emerald-300/15 text-emerald-100 shadow-2xl shadow-emerald-500/20" : active ? "scale-[1.035] border-cyan-300/60 bg-cyan-300/15 text-cyan-100 shadow-2xl shadow-cyan-500/20" : "scale-100 border-white/10 bg-black/35 text-white/50 opacity-80"}`}>{code}</div>;
                  })}
                </div>
              </div>
              <button onClick={submitCode} disabled={eliminated || myProgress >= lockGoal || roundCompleted || matchCompleted || cancelled} className="mt-6 w-full rounded-full bg-white px-6 py-4 text-sm font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45">{eliminated ? c.wrong : myProgress >= lockGoal ? c.waitingResult : c.lock}</button>
              <p className="mt-4 text-sm text-white/45">{eliminated ? c.wrong : myProgress >= lockGoal && !roundCompleted ? c.waitingResult : roundCompleted ? `${c.roundWinner}: ${round.winner_name || "Draw"}` : activeCode === currentTarget ? c.lock : c.scan}</p>
            </>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {roundCompleted && !matchCompleted && <button onClick={nextRound} disabled={busy} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : c.nextRound}</button>}
          {matchCompleted && <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-6 py-3 text-sm font-medium text-emerald-100">{c.matchOver}: {lobby.winner_name || "Draw"}</span>}
          {cancelled && <span className="rounded-full border border-red-300/20 bg-red-300/10 px-6 py-3 text-sm font-medium text-red-100">{c.cancelled}</span>}
          <button onClick={() => { setActiveLobby(null); setState(null); loadList(true); }} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1]">{c.back}</button>
        </div>
      </section> : <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
          <h2 className="text-2xl font-medium text-white">Cipher Break</h2>
          <p className="mt-3 text-sm leading-6 text-white/50">{c.subtitle}</p>
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{c.reward}: 40 Tech Coin · kaybedenden kesinti yok</div>
          <button onClick={createLobby} disabled={busy || !user} className="mt-5 w-full rounded-full bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : c.create}</button>
        </section>
        <section className="space-y-6">
          <LobbyList title={c.active} empty={c.empty} lobbies={open} user={user} c={c} onJoin={joinLobby} onPlay={enter} />
          <LobbyList title={c.mine} empty={c.emptyMine} lobbies={mine} user={user} c={c} onJoin={joinLobby} onPlay={enter} />
        </section>
      </div>}
    </div>
  </main>;
}

function Player({ name, email, avatarUrl, wins, target }: { name?: string | null; email?: string | null; avatarUrl?: string | null; wins: number; target: number }) {
  return <div className="flex flex-col items-center gap-2 text-center"><Avatar name={name} email={email} url={avatarUrl} /><p className="max-w-28 truncate text-sm text-white">{name}</p><div className="flex gap-1">{Array.from({ length: target || 1 }).map((_, i) => <span key={i} className={`h-2 w-5 rounded-full ${i < wins ? "bg-cyan-200" : "bg-white/15"}`} />)}</div></div>;
}

function LobbyList({ title, empty, lobbies, user, c, onJoin, onPlay }: { title: string; empty: string; lobbies: Lobby[]; user: User | null; c: any; onJoin: (id: number) => void; onPlay: (lobby: Lobby) => void }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"><h2 className="text-2xl font-medium text-white">{title}</h2><div className="mt-5 space-y-3">{lobbies.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{empty}</p>}{lobbies.map((lobby) => { const isCreator = user?.id === lobby.creator_user_id; const isOpponent = user?.id === lobby.opponent_user_id; const canJoin = lobby.status === "open" && !isCreator; const canPlay = lobby.status === "in_progress" && (isCreator || isOpponent); const label = lobby.status === "open" ? "Open" : lobby.status === "in_progress" ? "Live" : lobby.status === "completed" ? "Completed" : lobby.status === "cancelled" || lobby.status === "İptal edildi" ? c.cancelled : lobby.status; return <div key={lobby.id} className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="flex items-center gap-3"><Avatar name={lobby.creator_name} email={lobby.creator_email} url={lobby.creator_avatar_url} /><div className="min-w-0"><p className="truncate font-medium text-white">{lobby.creator_name}</p><p className="text-sm text-white/40">#{lobby.id}</p></div></div><div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/45">{label}</p></div><div className="flex items-center gap-3 md:justify-end"><div className="min-w-0 text-right"><p className="truncate font-medium text-white">{lobby.opponent_name || c.player2}</p><p className="text-sm text-white/40">{lobby.opponent_name ? lobby.opponent_email : c.waitingPlayer}</p></div><Avatar name={lobby.opponent_name || c.player2} email={lobby.opponent_email || ""} url={lobby.opponent_avatar_url || ""} /></div></div><div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/55"><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-100">Cipher Break</span><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{c.reward}: {lobby.reward_amount || 40}</span><span className="rounded-full bg-purple-300/10 px-3 py-1 text-purple-100">Best of {lobby.round_count}</span>{lobby.winner_name && <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">Winner: {lobby.winner_name}</span>}</div><div className="mt-4 flex flex-wrap gap-2">{canJoin && <button type="button" onClick={() => onJoin(lobby.id)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200">{c.join}</button>}{canPlay && <button type="button" onClick={() => onPlay(lobby)} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15">{c.enter}</button>}</div></div>; })}</div></div>;
}
