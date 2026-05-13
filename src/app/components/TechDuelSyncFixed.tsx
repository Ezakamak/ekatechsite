import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n";

type User = { id: number; name: string; email: string; avatar_url?: string | null };
type Mode = "classic" | "best_focus" | "what_the_hold";
type Lobby = { id: number; creator_user_id: number; opponent_user_id?: number | null; mode?: Mode; reward_amount: number; round_count: number; status: string; winner_user_id?: number | null; creator_name: string; creator_email: string; creator_avatar_url?: string | null; opponent_name?: string | null; opponent_email?: string | null; opponent_avatar_url?: string | null; winner_name?: string | null };
type Round = { round_number: number; signal_at: string; status: string; winner_user_id?: number | null; winner_name?: string | null };
type Payload = { server_time: string; lobby: Lobby; current_round: Round | null; rounds: Round[]; my_submission?: any; score: Record<string, number>; target_wins: number; ready?: any[]; hold_ready?: any[]; pending_round_number?: number };

const fakeSignals = ["DRA...", "DR4W", "DRAW?", "DROW", "DRAVV", "READY?", "NOW", "FIRE", "GO?", "DANGER", "WAIT!", "CLICK?"];
function randomFakeSignal(previous = "") {
  let next = previous;
  while (next === previous) next = fakeSignals[Math.floor(Math.random() * fakeSignals.length)];
  return next;
}
function toMs(v?: string | null) { return v ? Date.parse(v.includes("T") ? v : v.replace(" ", "T") + "Z") : 0; }
function initials(name?: string | null, email?: string | null) { return (name || email || "P").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P"; }
function Avatar({ name, email, url }: { name?: string | null; email?: string | null; url?: string | null }) { return <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-black">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name, email)}</span>; }
function modeTitle(mode?: Mode) { return mode === "best_focus" ? "Best Focus" : mode === "what_the_hold" ? "What The Hold" : "Classic Mode"; }

export function TechDuelSync() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [openLobbies, setOpenLobbies] = useState<Lobby[]>([]);
  const [myLobbies, setMyLobbies] = useState<Lobby[]>([]);
  const [mode, setMode] = useState<Mode>("classic");
  const [roundCount, setRoundCount] = useState(5);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [focusFakeSignal, setFocusFakeSignal] = useState(() => randomFakeSignal());

  const c = useMemo(() => tr ? {
    title: "Tech Duel", subtitle: "What The Hold’da iki taraf basılı tutmadan RELEASE başlamaz.", createTitle: "Create Lobby", create: "Lobby oluştur", active: "Aktif düellolar", mine: "Düellolarım", mode: "Oyun modu", round: "Round", reward: "Ödül", fixed: "50 Tech Coin sabit ödül · kaybedenden coin kesilmez", join: "Join", enter: "Maça gir", refresh: "Yenile", ready: "Hazır", readyWaiting: "Hazırsın · rakip bekleniyor", waitingBoth: "İki oyuncu da maça girince round başlayacak", wait: "WAIT...", draw: "DRAW!", release: "RELEASE!", hold: "HOLD...", pressHold: "PRESS & HOLD", tooEarly: "TOO EARLY", holdStart: "Başlamak için basılı tut", holdWaiting: "Basılı tut · rakip bekleniyor", holdBoth: "İki taraf da basılı tutunca RELEASE hazırlanacak", keepHolding: "Basılı tutmaya devam et", releaseNow: "Şimdi bırak", waitingOpponent: "Rakibin sonucu bekleniyor", roundWinner: "Tur sonucu", nextRound: "Sonraki round için hazır ol", matchOver: "Maç tamamlandı", cancelled: "İptal edildi", score: "Skor", player2: "Player 2", waitingPlayer: "Player 2 bekleniyor", empty: "Açık lobby yok.", emptyMine: "Henüz düellon yok.", classic: "WAIT → DRAW. DRAW’dan önce basarsan round kaybı.", focus: "Sahte sinyaller rastgele gelir. Sadece gerçek DRAW! anında bas.", what: "İki oyuncu basılı tutar. RELEASE çıkınca ilk bırakan round’u alır.", login: "Tech Duel için OFF, admin veya owner rolü gerekiyor."
  } : {
    title: "Tech Duel", subtitle: "In What The Hold, RELEASE will not start until both players hold down.", createTitle: "Create Lobby", create: "Create lobby", active: "Active duels", mine: "My duels", mode: "Game mode", round: "Round", reward: "Reward", fixed: "50 Tech Coin fixed reward · loser coins are not deducted", join: "Join", enter: "Enter match", refresh: "Refresh", ready: "Ready", readyWaiting: "Ready · waiting for opponent", waitingBoth: "Round starts after both players enter the match", wait: "WAIT...", draw: "DRAW!", release: "RELEASE!", hold: "HOLD...", pressHold: "PRESS & HOLD", tooEarly: "TOO EARLY", holdStart: "Hold down to start", holdWaiting: "Keep holding · waiting for opponent", holdBoth: "RELEASE starts after both players hold down", keepHolding: "Keep holding", releaseNow: "Release now", waitingOpponent: "Waiting for opponent result", roundWinner: "Round result", nextRound: "Ready for next round", matchOver: "Match completed", cancelled: "Cancelled", score: "Score", player2: "Player 2", waitingPlayer: "Waiting for Player 2", empty: "No open lobbies.", emptyMine: "No duels yet.", classic: "WAIT → DRAW. Clicking before DRAW loses the round.", focus: "Fake signals appear randomly. Only click on the real DRAW! signal.", what: "Both players hold down. Release after RELEASE!; first release wins the round.", login: "OFF, admin or owner role is required for Tech Duel."
  }, [tr]);

  const loadDuels = async (silent = false) => {
    if (!silent) setBusy(true);
    if (!silent) setNotice(null);
    try {
      const r = await fetch("/api/duels", { credentials: "same-origin", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || c.login);
      setUser(d.user || null); setOpenLobbies(d.open || []); setMyLobbies(d.mine || []);
    } catch (e) { if (!silent) setNotice({ type: "error", text: e instanceof Error ? e.message : c.login }); }
    finally { if (!silent) setBusy(false); }
  };

  const loadRound = async (id = activeLobby?.id, silent = true) => {
    if (!id) return;
    try {
      const r = await fetch(`/api/duels/round?lobby_id=${id}`, { credentials: "same-origin", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Round alınamadı.");
      setPayload(d); setSyncedAt(Date.now()); if (d?.lobby) setActiveLobby(d.lobby);
    } catch (e) { if (!silent) setNotice({ type: "error", text: e instanceof Error ? e.message : "Round alınamadı." }); }
  };

  const postRoundAction = async (action: "next_round" | "hold_ready" | "hold_cancel", silent = true) => {
    if (!payload?.lobby) return null;
    try {
      const r = await fetch("/api/duels/round", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: payload.lobby.id, action }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Round işlemi başarısız.");
      setPayload(d); setSyncedAt(Date.now()); if (d?.lobby) setActiveLobby(d.lobby); return d;
    } catch (e) { if (!silent) setNotice({ type: "error", text: e instanceof Error ? e.message : "Round işlemi başarısız." }); return null; }
  };

  useEffect(() => {
    loadDuels();
    const t1 = window.setInterval(() => setNow(Date.now()), 100);
    const t2 = window.setInterval(() => activeLobby ? loadRound(activeLobby.id, true) : loadDuels(true), 1200);
    return () => { window.clearInterval(t1); window.clearInterval(t2); };
  }, [language, activeLobby?.id]);

  const createLobby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/duels", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, round_count: roundCount }) });
      const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || "Lobby oluşturulamadı.");
      setNotice({ type: "success", text: d?.message || "Lobby oluşturuldu." }); await loadDuels(true);
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Lobby oluşturulamadı." }); }
    finally { setBusy(false); }
  };

  const joinLobby = async (id: number) => {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/duels/join", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: id }) });
      const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || "Düelloya katılınamadı.");
      await loadDuels(true); const lobby = [...openLobbies, ...myLobbies].find((item) => item.id === id); if (lobby) setActiveLobby({ ...lobby, status: "in_progress" });
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Düelloya katılınamadı." }); }
    finally { setBusy(false); }
  };

  const enterMatch = async (lobby: Lobby) => { setActiveLobby(lobby); setHolding(false); setPayload(null); await loadRound(lobby.id, false); };

  const submit = async (tooEarly: boolean, ms: number | null) => {
    if (!payload?.lobby || !payload.current_round || payload.my_submission || submitting) return;
    if (payload.current_round.status !== "active") return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/duels/submit", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: payload.lobby.id, round_number: payload.current_round.round_number, ms, tooEarly }) });
      const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || "Sonuç gönderilemedi."); await loadRound(payload.lobby.id, true);
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Sonuç gönderilemedi." }); }
    finally { setSubmitting(false); }
  };

  const readyForNextRound = async () => { if (!payload?.lobby) return; setBusy(true); setHolding(false); const d = await postRoundAction("next_round", false); if (d) await loadDuels(true); setBusy(false); };

  const lobby = payload?.lobby || activeLobby;
  const current = payload?.current_round || null;
  const currentMode = (lobby?.mode || "classic") as Mode;
  const isWaitingHold = currentMode === "what_the_hold" && current?.status === "waiting_hold";
  const isActiveRound = current?.status === "active";
  const serverNow = payload?.server_time ? toMs(payload.server_time) + (now - syncedAt) : 0;
  const signalAt = toMs(current?.signal_at);
  const signalPassed = Boolean(current && isActiveRound && serverNow >= signalAt);
  const ms = signalPassed ? Math.max(0, Math.round(serverNow - signalAt)) : null;
  const roundCompleted = current?.status === "completed";
  const submitted = Boolean(payload?.my_submission) || submitting;
  const creatorWins = Number(payload?.score?.[String(lobby?.creator_user_id || "")] || 0);
  const opponentWins = Number(payload?.score?.[String(lobby?.opponent_user_id || "")] || 0);
  const readyRows = payload?.ready || [];
  const holdReadyRows = payload?.hold_ready || [];
  const pendingRoundNumber = Number(payload?.pending_round_number || 1);
  const selfReady = Boolean(user && readyRows.some((row) => Number(row.user_id) === Number(user.id)));
  const selfHoldReady = Boolean(user && holdReadyRows.some((row) => Number(row.user_id) === Number(user.id)));
  const readyLabel = `${readyRows.length}/2 ${c.ready}`;
  const holdReadyLabel = `${holdReadyRows.length}/2 ${c.ready}`;
  const cancelled = lobby?.status === "cancelled" || lobby?.status === "İptal edildi";

  useEffect(() => {
    setFocusFakeSignal(randomFakeSignal());
  }, [lobby?.id, current?.round_number, currentMode]);

  useEffect(() => {
    if (currentMode !== "best_focus" || !current || !isActiveRound || signalPassed || submitted || roundCompleted || cancelled) return;
    let timeoutId = 0;
    const schedule = () => {
      const delay = 360 + Math.floor(Math.random() * 560);
      timeoutId = window.setTimeout(() => {
        setFocusFakeSignal((previous) => randomFakeSignal(previous));
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timeoutId);
  }, [currentMode, current?.round_number, isActiveRound, signalPassed, submitted, roundCompleted, cancelled]);

  const arenaText = () => {
    if (cancelled) return c.cancelled;
    if (!current) return selfReady ? c.readyWaiting : c.waitingBoth;
    if (roundCompleted) return current.winner_name ? `${c.roundWinner}: ${current.winner_name}` : c.roundWinner;
    if (submitted) return c.waitingOpponent;
    if (currentMode === "what_the_hold") {
      if (isWaitingHold) return holding || selfHoldReady ? c.hold : c.pressHold;
      if (!holding) return c.pressHold;
      return signalPassed ? c.release : c.hold;
    }
    if (signalPassed) return c.draw;
    if (currentMode === "best_focus") return focusFakeSignal;
    return c.wait;
  };

  const arenaHint = () => {
    if (cancelled) return c.cancelled;
    if (!current) return `${c.round} ${pendingRoundNumber} · ${readyLabel}`;
    if (roundCompleted) return c.roundWinner;
    if (submitted) return c.waitingOpponent;
    if (currentMode === "what_the_hold") {
      if (isWaitingHold) return holding || selfHoldReady ? `${c.holdWaiting} · ${holdReadyLabel}` : c.holdBoth;
      if (!holding) return c.holdStart;
      return signalPassed ? c.releaseNow : c.keepHolding;
    }
    return signalPassed ? c.clickNow : currentMode === "best_focus" ? c.focus : c.dontClick;
  };

  const clickArena = () => { if (!current || roundCompleted || submitted || currentMode === "what_the_hold") return; submit(!signalPassed, signalPassed ? ms : null); };
  const holdStart = () => { if (!current || roundCompleted || submitted || currentMode !== "what_the_hold" || cancelled) return; setHolding(true); if (current.status === "waiting_hold" && !selfHoldReady) postRoundAction("hold_ready", true); };
  const holdEnd = () => { if (!current || roundCompleted || submitted || currentMode !== "what_the_hold" || cancelled) return; setHolding(false); if (current.status === "waiting_hold") { if (selfHoldReady) postRoundAction("hold_cancel", true); return; } if (current.status === "active") submit(!signalPassed, signalPassed ? ms : null); };

  return <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 sm:px-6">
    <div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="relative mx-auto max-w-7xl space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm uppercase tracking-[0.28em] text-cyan-100/60">EkaTech OFF Arena</p><h1 className="mt-3 text-4xl font-medium tracking-tight text-white sm:text-6xl">{c.title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-white/55">{c.subtitle}</p></div><button onClick={() => activeLobby ? loadRound(activeLobby.id, false) : loadDuels()} disabled={busy} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50">{busy ? "..." : c.refresh}</button></div>
        {notice && <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}
      </section>

      {activeLobby && lobby ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4"><p className="text-sm uppercase tracking-[0.22em] text-white/35">{current ? `${c.round} ${current.round_number} / ${lobby.round_count}` : `${c.round} ${pendingRoundNumber} · ${readyLabel}`}</p><h2 className="text-3xl font-medium text-white">#{lobby.id} · {modeTitle(currentMode)}</h2><div className="grid grid-cols-3 items-center gap-3 rounded-3xl border border-white/10 bg-black/35 p-4"><Player name={lobby.creator_name} email={lobby.creator_email} avatarUrl={lobby.creator_avatar_url} wins={creatorWins} target={payload?.target_wins || 0} /><div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-2 text-sm text-white/45">{c.score}: {creatorWins}-{opponentWins}</p></div><Player name={lobby.opponent_name || c.player2} email={lobby.opponent_email || ""} avatarUrl={lobby.opponent_avatar_url || ""} wins={opponentWins} target={payload?.target_wins || 0} /></div><RoundHistory rounds={payload?.rounds || []} /></div>
          <button type="button" onClick={clickArena} onPointerDown={currentMode === "what_the_hold" ? holdStart : undefined} onPointerUp={currentMode === "what_the_hold" ? holdEnd : undefined} onPointerCancel={currentMode === "what_the_hold" ? holdEnd : undefined} onPointerLeave={currentMode === "what_the_hold" && isWaitingHold ? holdEnd : undefined} disabled={!current || roundCompleted || submitted || lobby.status === "completed" || cancelled} className={`min-h-[320px] touch-none select-none rounded-[2rem] border p-8 text-center transition-all ${signalPassed && !roundCompleted ? "border-cyan-300/40 bg-cyan-300/10 shadow-2xl shadow-cyan-500/20" : roundCompleted ? "border-emerald-300/30 bg-emerald-300/10" : submitted ? "border-white/10 bg-white/[0.035]" : isWaitingHold && (holding || selfHoldReady) ? "border-purple-300/35 bg-purple-300/10 shadow-2xl shadow-purple-500/15" : cancelled ? "border-red-300/25 bg-red-300/10" : "border-white/10 bg-black/50"}`}><p className={`text-5xl font-semibold tracking-tight sm:text-7xl ${roundCompleted ? "text-emerald-100" : signalPassed ? "text-cyan-100" : isWaitingHold && (holding || selfHoldReady) ? "text-purple-100" : cancelled ? "text-red-100" : "text-white"}`}>{arenaText()}</p><p className="mt-6 text-sm uppercase tracking-[0.28em] text-white/35">{arenaHint()}</p>{payload?.my_submission && <p className="mt-6 text-sm text-white/55">{Number(payload.my_submission.too_early) === 1 ? c.tooEarly : `${payload.my_submission.ms}ms`}</p>}</button>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">{roundCompleted && lobby.status !== "completed" && <button onClick={readyForNextRound} disabled={busy || selfReady} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : selfReady ? c.readyWaiting : c.nextRound}</button>}{!current && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-6 py-3 text-sm font-medium text-cyan-100">{readyLabel}</span>}{isWaitingHold && <span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-6 py-3 text-sm font-medium text-purple-100">{holdReadyLabel}</span>}{lobby.status === "completed" && <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-6 py-3 text-sm font-medium text-emerald-100">{c.matchOver}: {lobby.winner_name}</span>}{cancelled && <span className="rounded-full border border-red-300/20 bg-red-300/10 px-6 py-3 text-sm font-medium text-red-100">{c.cancelled}</span>}<button onClick={() => { setActiveLobby(null); setPayload(null); setHolding(false); loadDuels(true); }} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1]">Lobby</button></div>
      </section> : <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl"><h2 className="text-2xl font-medium text-white">{c.createTitle}</h2><form onSubmit={createLobby} className="mt-5 space-y-4"><div><p className="mb-2 text-sm text-white/45">{c.mode}</p><div className="space-y-2">{[{ v: "classic", t: "Classic Mode", d: c.classic }, { v: "best_focus", t: "Best Focus", d: c.focus }, { v: "what_the_hold", t: "What The Hold", d: c.what }].map((x) => <button key={x.v} type="button" onClick={() => setMode(x.v as Mode)} className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all ${mode === x.v ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"}`}><span className="block font-medium text-white">{x.t}</span><span className="mt-1 block text-xs text-white/45">{x.d}</span></button>)}</div></div><div><p className="mb-2 text-sm text-white/45">{c.round}</p><div className="grid grid-cols-3 gap-2">{[3, 5, 7].map((v) => <button key={v} type="button" onClick={() => setRoundCount(v)} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${roundCount === v ? "border-purple-300/30 bg-purple-300/10 text-purple-100" : "border-white/10 bg-white/[0.04] text-white/60"}`}>Best of {v}</button>)}</div></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{c.fixed}</div><button type="submit" disabled={busy || !user} className="w-full rounded-full bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : c.create}</button></form></section><section className="space-y-6"><LobbyList title={c.active} empty={c.empty} lobbies={openLobbies} user={user} c={c} onJoin={joinLobby} onPlay={enterMatch} /><LobbyList title={c.mine} empty={c.emptyMine} lobbies={myLobbies} user={user} c={c} onJoin={joinLobby} onPlay={enterMatch} /></section></div>}
    </div>
  </main>;
}

function Player({ name, email, avatarUrl, wins, target }: { name?: string | null; email?: string | null; avatarUrl?: string | null; wins: number; target: number }) {
  return <div className="flex flex-col items-center gap-2 text-center"><Avatar name={name} email={email} url={avatarUrl} /><p className="max-w-28 truncate text-sm text-white">{name}</p><div className="flex gap-1">{Array.from({ length: target || 1 }).map((_, i) => <span key={i} className={`h-2 w-5 rounded-full ${i < wins ? "bg-cyan-200" : "bg-white/15"}`} />)}</div></div>;
}

function RoundHistory({ rounds }: { rounds: Round[] }) {
  if (!rounds.length) return null;
  return <div className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="flex flex-wrap gap-2">{rounds.map((r) => <span key={r.round_number} className={`rounded-full px-3 py-1 text-xs ${r.status === "completed" ? "bg-emerald-300/10 text-emerald-100" : r.status === "waiting_hold" ? "bg-purple-300/10 text-purple-100" : "bg-cyan-300/10 text-cyan-100"}`}>R{r.round_number}: {r.status === "completed" ? r.winner_name || "Result" : r.status === "waiting_hold" ? "Hold" : "Live"}</span>)}</div></div>;
}

function LobbyList({ title, empty, lobbies, user, c, onJoin, onPlay }: { title: string; empty: string; lobbies: Lobby[]; user: User | null; c: any; onJoin: (id: number) => void; onPlay: (lobby: Lobby) => void }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"><h2 className="text-2xl font-medium text-white">{title}</h2><div className="mt-5 space-y-3">{lobbies.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{empty}</p>}{lobbies.map((lobby) => { const isCreator = user?.id === lobby.creator_user_id; const isOpponent = user?.id === lobby.opponent_user_id; const canJoin = lobby.status === "open" && !isCreator; const canPlay = lobby.status === "in_progress" && (isCreator || isOpponent); const label = lobby.status === "cancelled" || lobby.status === "İptal edildi" ? c.cancelled : lobby.status === "open" ? "Open" : lobby.status === "in_progress" ? "Live" : lobby.status === "completed" ? "Completed" : lobby.status; return <div key={lobby.id} className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="flex items-center gap-3"><Avatar name={lobby.creator_name} email={lobby.creator_email} url={lobby.creator_avatar_url} /><div className="min-w-0"><p className="truncate font-medium text-white">{lobby.creator_name}</p><p className="text-sm text-white/40">#{lobby.id}</p></div></div><div className="text-center"><p className="text-2xl font-semibold text-white/35">VS</p><p className="mt-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/45">{label}</p></div><div className="flex items-center gap-3 md:justify-end"><div className="min-w-0 text-right"><p className="truncate font-medium text-white">{lobby.opponent_name || c.player2}</p><p className="text-sm text-white/40">{lobby.opponent_name ? lobby.opponent_email : c.waitingPlayer}</p></div><Avatar name={lobby.opponent_name || c.player2} email={lobby.opponent_email || ""} url={lobby.opponent_avatar_url || ""} /></div></div><div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/55"><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-100">{c.mode}: {modeTitle(lobby.mode)}</span><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">{c.reward}: {lobby.reward_amount || FIXED_REWARD}</span><span className="rounded-full bg-purple-300/10 px-3 py-1 text-purple-100">Best of {lobby.round_count}</span>{lobby.winner_name && <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-100">Result: {lobby.winner_name}</span>}</div><div className="mt-4 flex flex-wrap gap-2">{canJoin && <button type="button" onClick={() => onJoin(lobby.id)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200">{c.join}</button>}{canPlay && <button type="button" onClick={() => onPlay(lobby)} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/15">{c.enter}</button>}</div></div>; })}</div></div>;
}
