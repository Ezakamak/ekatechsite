import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Clock, Flame, Info, Map as MapIcon, Shield, SkipForward, Swords, UserPlus, Users, Zap } from "lucide-react";
import { useLanguage } from "../i18n";
import { closeOpenLobby, useAutoCloseOpenLobbies } from "../lib/openLobbyAutoClose";

type CardType = "attack" | "defense" | "utility" | "trap" | "overload";
type Side = "creator" | "opponent";
type User = { id: number; name: string; email: string; avatar_url?: string | null };
type Player = { id?: number | null; name?: string | null; email?: string | null; avatar_url?: string | null };
type Card = { id: string; name: string; type: CardType; cost: number; text: string; anti?: string };
type Lobby = { id: number; creator_user_id: number; opponent_user_id?: number | null; status: string; map_key: string; creator_name: string; creator_email: string; creator_avatar_url?: string | null; opponent_name?: string | null; opponent_email?: string | null; opponent_avatar_url?: string | null };
type ClashMap = { key: string; name: string; boostType: CardType; boostText: string };
type Step = { actor: Side; card?: string; text?: string; target?: Side; damage?: number; heal?: number };
type MatchState = { lobby: Lobby; me: Side; opponent: Side; players: { creator: Player; opponent: Player }; hp: Record<Side, number>; energy: Record<Side, number>; heat: Record<Side, number>; hand: Card[]; selected: Record<Side, string | null>; turn_number: number; deadline_at?: string | null; turn_status?: string; resolution_id?: string | null; resolution_steps?: Step[]; last_resolution?: string | null; map: ClashMap; turn_seconds?: number };
type SequenceItem = { kind: "step"; step: Step } | { kind: "pause"; text: string };

const TURN_SECONDS = 20;
const MAX_HP = 60;

const MAPS: ClashMap[] = [
  { key: "firewall_city", name: "Firewall City", boostType: "defense", boostText: "Defense kartları küçük ekstra koruma kazanır." },
  { key: "glitch_ruins", name: "Glitch Ruins", boostType: "trap", boostText: "Trap tetiklenirse küçük ekstra yansıma hasarı eklenir." },
  { key: "overclock_core", name: "Overclock Core", boostType: "attack", boostText: "Attack kartları +1 hasar verir; ağır saldırılar daha fazla Heat riski taşır." },
  { key: "data_archive", name: "Data Archive", boostType: "utility", boostText: "Utility kartları tempo avantajı verir ama direkt hasar üretmez." },
];

const CARDS: Card[] = [
  { id: "glitch_strike", name: "Glitch Strike", type: "attack", cost: 2, text: "7 hasar ver. Güvenli ama düşük tempo saldırısı.", anti: "Firewall, Mirror Bug" },
  { id: "packet_burst", name: "Packet Burst", type: "attack", cost: 3, text: "10 hasar ver. Rakip Defense oynadıysa 6 hasara düşer.", anti: "Defense" },
  { id: "pierce_injection", name: "Pierce Injection", type: "attack", cost: 4, text: "8 hasar ver. Kalkan etkisinin çoğunu yok sayar.", anti: "Mirror Bug, Data Drain" },
  { id: "double_ping", name: "Double Ping", type: "attack", cost: 3, text: "2 kez 4 hasar ver. Tek blok kartlarını zorlar.", anti: "Static Field" },
  { id: "core_spike", name: "Core Spike", type: "attack", cost: 5, text: "13 hasar ver. +1 Heat al.", anti: "Firewall, Packet Trap" },
  { id: "firewall", name: "Firewall", type: "defense", cost: 3, text: "Bu tur gelen hasarı yarıya indirir.", anti: "Pierce, Utility" },
  { id: "core_shield", name: "Core Shield", type: "defense", cost: 4, text: "Bu tur ilk hasar vuruşunu tamamen engeller.", anti: "Double Ping" },
  { id: "emergency_patch", name: "Emergency Patch", type: "defense", cost: 2, text: "6 HP yenile. Bu tur hasar aldıysan +2 HP daha yenile.", anti: "Heal Block" },
  { id: "static_field", name: "Static Field", type: "defense", cost: 3, text: "Rakip çoklu vuruş yaparsa ona 5 hasar geri ver.", anti: "Tek vuruş" },
  { id: "system_scan", name: "System Scan", type: "utility", cost: 1, text: "Bilgi/tempo kartı. Gelecek tur kart avantajı sağlar.", anti: "Aggro" },
  { id: "data_drain", name: "Data Drain", type: "utility", cost: 3, text: "Rakip gelecek tur -2 enerji başlar.", anti: "Low-cost" },
  { id: "battery_backup", name: "Battery Backup", type: "utility", cost: 2, text: "Gelecek tur +2 enerji kazan. Hasar alırsan +1'e düşer.", anti: "Attack pressure" },
  { id: "hand_jam", name: "Hand Jam", type: "utility", cost: 3, text: "Rakip utility oynadıysa bozar. Aksi halde 3 hasar verir.", anti: "Attack" },
  { id: "mirror_bug", name: "Mirror Bug", type: "trap", cost: 3, text: "Rakip Attack/Overload oynarsa hasarın bir kısmını ona yansıtır.", anti: "Utility, Decoy" },
  { id: "packet_trap", name: "Packet Trap", type: "trap", cost: 2, text: "Rakip 4+ enerji kart oynarsa ona 6 hasar verir.", anti: "Low-cost" },
  { id: "false_firewall", name: "False Firewall", type: "trap", cost: 2, text: "Rakip Pierce oynarsa hasarı 0 yapar. Aksi halde küçük koruma sağlar.", anti: "Normal Attack" },
  { id: "decoy_packet", name: "Decoy Packet", type: "utility", cost: 1, text: "Rakibin Trap kartı tetiklenirse boşa gider.", anti: "Attack pressure" },
  { id: "core_overload", name: "Core Overload", type: "overload", cost: 7, text: "16 hasar ver. +2 Heat al.", anti: "Core Shield, Packet Trap" },
  { id: "blackout", name: "Blackout", type: "overload", cost: 6, text: "Rakip gelecek tur kart çekemez ve -1 enerji başlar. +1 Heat.", anti: "Battery Backup" },
  { id: "full_restore", name: "Full Restore", type: "overload", cost: 7, text: "16 HP yenile. +2 Heat al.", anti: "Heal Block" },
];
const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function initials(name?: string | null, email?: string | null) { return (name || email || "P").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P"; }
function typeStyle(type: CardType) { return type === "attack" ? "border-red-300/25 bg-red-300/10 text-red-100" : type === "defense" ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : type === "utility" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : type === "trap" ? "border-purple-300/25 bg-purple-300/10 text-purple-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"; }
function mapFor(key: string) { return MAPS.find((map) => map.key === key) || MAPS[0]; }
function parseDeadline(value?: string | null) { if (!value) return 0; const text = String(value); return Date.parse(text.includes("T") ? text : text.replace(" ", "T") + "Z"); }
function sideName(side: Side, tr: boolean) { return side === "creator" ? (tr ? "1. Oyuncu" : "Player 1") : (tr ? "2. Oyuncu" : "Player 2"); }
function cardName(cardId?: string) { return cardId ? (CARD_BY_ID[cardId]?.name || cardId) : "Skip"; }
function clampHp(value: number) { return Math.max(0, Math.min(MAX_HP, value)); }

function buildSequence(steps: Step[], fallback?: string | null): SequenceItem[] {
  const clean = steps.filter((step) => step && step.actor);
  const creator = clean.filter((step) => step.actor === "creator");
  const opponent = clean.filter((step) => step.actor === "opponent");
  const items: SequenceItem[] = [];

  creator.forEach((step) => items.push({ kind: "step", step }));
  if (creator.length && opponent.length) items.push({ kind: "pause", text: "Kısa ara · 1. oyuncunun işlemi tamamlandı." });
  opponent.forEach((step) => items.push({ kind: "step", step }));

  if (!items.length) {
    items.push({ kind: "step", step: { actor: "creator", card: "system", text: fallback || "Round çözümlendi." } });
  }
  return items;
}

function Avatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16 text-base" : size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm";
  return <span className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white font-semibold text-black shadow-lg shadow-black/30`}>{player.avatar_url ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(player.name, player.email)}</span>;
}

export function CoreClash() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState<Lobby[]>([]);
  const [mine, setMine] = useState<Lobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<number | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [infoCard, setInfoCard] = useState<Card | null>(null);
  const [now, setNow] = useState(Date.now());
  const [displayHp, setDisplayHp] = useState<Record<Side, number>>({ creator: MAX_HP, opponent: MAX_HP });
  const [damageFlash, setDamageFlash] = useState<Record<Side, number>>({ creator: 0, opponent: 0 });
  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const [phaseText, setPhaseText] = useState("");
  const [sequenceDone, setSequenceDone] = useState(false);
  const [mapReveal, setMapReveal] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const sequenceTimers = useRef<number[]>([]);
  const activeResolution = useRef<string | null>(null);
  const autoAdvanced = useRef<string | null>(null);
  const revealKey = useRef("");

  const c = useMemo(() => tr ? {
    title: "Core Clash", create: "Rastgele harita ile lobi oluştur", join: "Katıl", enter: "Maça gir", open: "Açık lobiler", mine: "Benim maçlarım", empty: "Henüz açık lobi yok.", hand: "Elindeki kartlar", selected: "Kart seçildi · rakip bekleniyor", opponentSelected: "Rakip seçti", both: "İki oyuncu da lobiye girmeden maç başlamaz.", timer: "Tur süresi", hp: "Core HP", energy: "Enerji", heat: "Heat", cost: "Enerji", anti: "Anti", boost: "Harita boostu", refresh: "Yenile", waiting: "Player 2 bekleniyor", live: "Canlı maç", completed: "Tamamlandı", rule: "Başlangıç eli 3 kart. Her tur +1 kart. El limiti 6. Tur süresi 20 saniye. Skip basarsan pas geçersin. Süre bitince eksik seçim skip sayılır; hasarlar sırayla gösterilir.", host: "Host", player2: "Player 2", emptySlot: "Join bekleniyor", backOff: "OFF Hub", mapReveal: "Savaş alanı seçildi", resolving: "Sıralı round akışı", nextRound: "Yeni tur başlatılıyor", skip: "Skip", pause: "Kısa ara · sıradaki oyuncunun hamlesi hazırlanıyor.", done: "İki oyuncunun hamlesi bitti. Yeni round otomatik açılıyor.", damageBar: "Rakibin can barı yavaşça azalıyor.", healBar: "Can barı yavaşça yenileniyor.", close: "Lobiyi kapat", closed: "Lobby kapatıldı." }
  : {
    title: "Core Clash", create: "Create lobby with random map", join: "Join", enter: "Enter match", open: "Open lobbies", mine: "My matches", empty: "No open lobby yet.", hand: "Your hand", selected: "Card selected · waiting for opponent", opponentSelected: "Opponent selected", both: "Match will not start before both players enter the lobby.", timer: "Turn timer", hp: "Core HP", energy: "Energy", heat: "Heat", cost: "Energy", anti: "Countered by", boost: "Map boost", refresh: "Refresh", waiting: "Waiting for Player 2", live: "Live match", completed: "Completed", rule: "Starting hand: 3 cards. Draw 1 each turn. Hand limit: 6. Turn timer: 20 seconds. Skip passes the turn. When time ends, missing choices become skip; damage is shown step by step.", host: "Host", player2: "Player 2", emptySlot: "Waiting for join", backOff: "OFF Hub", mapReveal: "Battlefield selected", resolving: "Sequential round flow", nextRound: "Starting next round", skip: "Skip", pause: "Short pause · preparing the next player action.", done: "Both actions are complete. Next round starts automatically.", damageBar: "The target HP bar drains slowly.", healBar: "The HP bar restores slowly.", close: "Close lobby", closed: "Lobby closed." }, [tr]);

  const clearSequenceTimers = () => {
    sequenceTimers.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimers.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    sequenceTimers.current.push(timer);
  };

  const ownedOpenLobbyIds = useMemo(() => [...open, ...mine].filter((lobby) => lobby.status === "open" && user?.id === lobby.creator_user_id).map((lobby) => lobby.id), [open, mine, user?.id]);
  useAutoCloseOpenLobbies("core_clash", ownedOpenLobbyIds);

  const hydrateHand = (cards: Card[]) => (cards || []).map((card) => CARD_BY_ID[card.id] || card);
  const loadLobbies = async (silent = false) => { if (!silent) { setBusy(true); setNotice(null); } try { const response = await fetch("/api/core-clash-v2", { credentials: "same-origin", cache: "no-store" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Core Clash yüklenemedi."); setUser(data.user || null); setOpen(data.open || []); setMine(data.mine || []); } catch (error) { if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Core Clash yüklenemedi." }); } finally { if (!silent) setBusy(false); } };
  const loadMatch = async (id = activeLobby, silent = true) => { if (!id) return; try { const response = await fetch(`/api/core-clash-v2-action?lobby_id=${id}`, { credentials: "same-origin", cache: "no-store" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Maç yüklenemedi."); data.hand = hydrateHand(data.hand || []); setMatch(data); setActiveLobby(data.lobby?.id || id); if (data.turn_status !== "resolved" && activeResolution.current !== data.resolution_id) setDisplayHp(data.hp); } catch (error) { if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Maç yüklenemedi." }); } };

  const submitAction = async (payload: Record<string, string>, silent = false) => { if (!match && !payload.lobby_id) return; if (!silent) { setBusy(true); setNotice(null); } try { const response = await fetch("/api/core-clash-v2-action", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: match?.lobby.id, ...payload }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "İşlem yapılamadı."); data.hand = hydrateHand(data.hand || []); setMatch(data); if (data.turn_status !== "resolved") { activeResolution.current = null; setActiveStep(null); setPhaseText(""); setSequenceDone(false); setDisplayHp(data.hp); } } catch (error) { if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "İşlem yapılamadı." }); } finally { if (!silent) setBusy(false); } };

  useEffect(() => { loadLobbies(); const ticker = window.setInterval(() => setNow(Date.now()), 250); const poll = window.setInterval(() => activeLobby ? loadMatch(activeLobby, true) : loadLobbies(true), 1500); return () => { window.clearInterval(ticker); window.clearInterval(poll); }; }, [activeLobby, language]);
  useEffect(() => () => clearSequenceTimers(), []);

  useEffect(() => {
    if (!match) return;
    const key = `${match.lobby.id}:${match.map.key}`;
    if (match.turn_number <= 1 && revealKey.current !== key) {
      revealKey.current = key;
      setMapReveal(true);
      window.setTimeout(() => setMapReveal(false), 2400);
    }
  }, [match?.lobby.id, match?.map.key, match?.turn_number]);

  useEffect(() => {
    if (!match?.resolution_id || activeResolution.current === match.resolution_id) return;

    activeResolution.current = match.resolution_id;
    clearSequenceTimers();
    setSequenceDone(false);
    setActiveStep(null);
    setDamageFlash({ creator: 0, opponent: 0 });

    const items = buildSequence(match.resolution_steps || [], match.last_resolution);
    let delay = 250;

    const animateHp = (side: Side, rawAmount: number, mode: "damage" | "heal") => {
      const amount = Math.max(0, Math.round(rawAmount));
      if (!amount) return 550;
      const stepMs = Math.max(28, Math.min(70, Math.floor(760 / amount)));
      for (let i = 1; i <= amount; i += 1) {
        schedule(() => {
          setDisplayHp((prev) => ({ ...prev, [side]: clampHp(Number(prev[side] || 0) + (mode === "heal" ? 1 : -1)) }));
        }, delay + i * stepMs);
      }
      return amount * stepMs + 180;
    };

    items.forEach((item) => {
      if (item.kind === "pause") {
        schedule(() => {
          setActiveStep(null);
          setPhaseText(c.pause);
          setDamageFlash({ creator: 0, opponent: 0 });
        }, delay);
        delay += 1050;
        return;
      }

      const step = item.step;
      schedule(() => {
        setActiveStep(step);
        const actor = sideName(step.actor, tr);
        const base = step.text || `${actor} ${cardName(step.card)} oynadı.`;
        const effectText = step.damage && step.damage > 0 ? c.damageBar : step.heal && step.heal > 0 ? c.healBar : "";
        setPhaseText(`${actor}: ${base}${effectText ? ` ${effectText}` : ""}`);
      }, delay);

      if (step.target && step.damage && step.damage > 0) {
        schedule(() => setDamageFlash((prev) => ({ ...prev, [step.target as Side]: step.damage || 0 })), delay + 260);
        delay += animateHp(step.target, step.damage, "damage") + 650;
        schedule(() => setDamageFlash((prev) => ({ ...prev, [step.target as Side]: 0 })), delay - 260);
      } else if (step.target && step.heal && step.heal > 0) {
        delay += animateHp(step.target, step.heal, "heal") + 650;
      } else {
        delay += 1250;
      }
    });

    schedule(() => {
      setDisplayHp(match.hp);
      setActiveStep(null);
      setDamageFlash({ creator: 0, opponent: 0 });
      setSequenceDone(true);
      setPhaseText(match.lobby.status === "completed" ? c.completed : c.done);
    }, delay);

    schedule(() => {
      if (match.lobby.status !== "completed" && autoAdvanced.current !== match.resolution_id) {
        autoAdvanced.current = match.resolution_id || null;
        submitAction({ action: "next" }, true);
      }
    }, delay + 1200);
  }, [match?.resolution_id]);

  const createLobby = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setNotice(null); try { const response = await fetch("/api/core-clash-v2", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Lobi oluşturulamadı."); await loadLobbies(true); setNotice({ type: "success", text: data?.message || "Core Clash lobisi oluşturuldu." }); } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Lobi oluşturulamadı." }); } finally { setBusy(false); } };
  const joinLobby = async (id: number) => { setBusy(true); setNotice(null); try { const response = await fetch("/api/core-clash-join", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: id }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Lobiye katılınamadı."); setActiveLobby(id); await loadMatch(id, false); } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Lobiye katılınamadı." }); } finally { setBusy(false); } };
  const closeLobby = async (id: number) => { setBusy(true); setNotice(null); try { await closeOpenLobby("core_clash", id); setNotice({ type: "success", text: c.closed }); await loadLobbies(true); } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Lobi kapatılamadı." }); } finally { setBusy(false); } };
  const chooseCard = async (card: Card) => submitAction({ action: "play", card_id: card.id });
  const skipTurn = async () => submitAction({ action: "skip" });
  const startHold = (card: Card) => { if (holdTimer.current) window.clearTimeout(holdTimer.current); holdTimer.current = window.setTimeout(() => setInfoCard(card), 420); };
  const endHold = () => { if (holdTimer.current) window.clearTimeout(holdTimer.current); holdTimer.current = null; };

  const turnSeconds = match?.turn_seconds || TURN_SECONDS;
  const secondsLeft = match?.deadline_at && match.turn_status !== "resolved" ? Math.max(0, Math.ceil((parseDeadline(match.deadline_at) - now) / 1000)) : 0;
  const resolving = match?.turn_status === "resolved";
  const canAct = Boolean(match && !resolving && !match.selected?.[match.me] && match.lobby.status === "in_progress");

  return <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6"><div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" /><div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />{match && mapReveal && <MapReveal map={match.map} label={c.mapReveal} />}{match && resolving && <ResolutionBanner match={match} activeStep={activeStep} phaseText={phaseText} sequenceDone={sequenceDone} c={c} tr={tr} />}<div className="relative mx-auto max-w-7xl space-y-8"><section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm uppercase tracking-[0.28em] text-purple-100/60">EkaTech OFF Cards</p><h1 className="mt-3 text-5xl font-medium tracking-tight sm:text-7xl">{c.title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-white/55">{c.rule}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => navigateTo("/off")} className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.08]">← {c.backOff}</button><button onClick={() => activeLobby ? loadMatch(activeLobby, false) : loadLobbies()} disabled={busy} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50">{busy ? "..." : c.refresh}</button></div></div>{notice && <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}</section>{match ? <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-5"><div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"><div className="flex items-center justify-between gap-3"><button onClick={() => { setMatch(null); setActiveLobby(null); activeResolution.current = null; loadLobbies(true); }} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/75">← Lobbies</button><span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-sm text-purple-100">Round {match.turn_number}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><PlayerPanel title="You" player={match.players[match.me]} hp={displayHp[match.me]} energy={match.energy[match.me]} heat={match.heat[match.me]} damage={damageFlash[match.me]} c={c} /><PlayerPanel title="Opponent" player={match.players[match.opponent]} hp={displayHp[match.opponent]} energy={match.energy[match.opponent]} heat={match.heat[match.opponent]} damage={damageFlash[match.opponent]} c={c} /></div></div><MapPanel map={match.map} c={c} /><div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-100" /><h2 className="text-xl font-medium">{c.timer}</h2></div><span className="font-mono text-3xl text-cyan-100">{secondsLeft}s</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-200 transition-all" style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / turnSeconds) * 100))}%` }} /></div><p className="mt-4 text-sm text-white/45">{resolving ? c.resolving : match.selected?.[match.me] ? c.selected : match.selected?.[match.opponent] ? c.opponentSelected : c.both}</p>{canAct && <button onClick={skipTurn} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.1]"><SkipForward className="h-4 w-4" /> {c.skip}</button>}</div></div><div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"><div className="flex items-center gap-2"><Swords className="h-5 w-5 text-red-100" /><h2 className="text-2xl font-medium">{c.hand}</h2><span className="ml-auto rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/45">{match.hand.length}/6</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{match.hand.map((card) => <CardButton key={card.id} card={card} disabled={!canAct || card.cost > match.energy[match.me]} c={c} onClick={() => chooseCard(card)} onInfo={() => setInfoCard(card)} onHoldStart={() => startHold(card)} onHoldEnd={endHold} boosted={card.type === match.map.boostType} />)}</div></div></section> : <LobbyHome c={c} user={user} busy={busy} open={open} mine={mine} createLobby={createLobby} joinLobby={joinLobby} closeLobby={closeLobby} enterLobby={(id) => { setActiveLobby(id); loadMatch(id, false); }} />}</div>{infoCard && <InfoModal card={infoCard} c={c} close={() => setInfoCard(null)} />}</main>;
}

function ResolutionBanner({ match, activeStep, phaseText, sequenceDone, c, tr }: { match: MatchState; activeStep: Step | null; phaseText: string; sequenceDone: boolean; c: any; tr: boolean }) {
  return <div className="fixed inset-x-0 top-28 z-50 mx-auto w-[min(92vw,760px)] overflow-hidden rounded-[1.5rem] border border-red-300/25 bg-black/85 p-5 text-sm text-red-100 shadow-2xl shadow-red-500/20 backdrop-blur-xl"><div className="absolute inset-0 bg-gradient-to-r from-red-500/15 via-purple-500/10 to-cyan-500/10" /><div className="relative"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-red-100/60">{c.resolving}</p><h3 className="mt-1 text-xl font-semibold text-white">{sequenceDone ? c.nextRound : activeStep ? `${sideName(activeStep.actor, tr)} · ${cardName(activeStep.card)}` : c.pause}</h3></div><Activity className={`h-6 w-6 ${sequenceDone ? "text-emerald-100" : "text-red-100"}`} /></div><p className="mt-3 leading-6 text-white/75">{phaseText || match.last_resolution || c.resolving}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${sequenceDone ? "w-full bg-emerald-200" : "w-2/3 animate-pulse bg-red-200"}`} /></div></div></div>;
}

function PlayerPanel({ title, player, hp, energy, heat, damage, c }: { title: string; player: Player; hp: number; energy: number; heat: number; damage: number; c: any }) {
  const hpPercent = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));
  return <div className={`relative overflow-hidden rounded-3xl border p-4 transition-all duration-300 ${damage > 0 ? "border-red-300/40 bg-red-500/10 shadow-xl shadow-red-500/20" : "border-white/10 bg-black/35"}`}><div className="flex items-center gap-3"><Avatar player={player} /><div className="min-w-0"><p className="text-xs uppercase tracking-[0.16em] text-white/30">{title}</p><p className="truncate font-medium text-white">{player.name || player.email || "Player"}</p></div>{damage > 0 && <span className="ml-auto rounded-full bg-red-500/20 px-3 py-1 text-sm font-bold text-red-100">-{damage}</span>}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-400 to-cyan-200 transition-[width] duration-200" style={{ width: `${hpPercent}%` }} /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><MiniStat icon={<Shield className="h-4 w-4" />} label={c.hp} value={hp} /><MiniStat icon={<Zap className="h-4 w-4" />} label={c.energy} value={energy} /><MiniStat icon={<Flame className="h-4 w-4" />} label={c.heat} value={heat} /></div></div>;
}
function MiniStat({ icon, label, value }: { icon: any; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><div className="mx-auto flex justify-center text-white/50">{icon}</div><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p><p className="font-mono text-lg text-white">{value}</p></div>; }
function cardDecor(card: Card) { const symbol = card.type === "attack" ? "⚔" : card.type === "defense" ? "⬡" : card.type === "utility" ? "✦" : card.type === "trap" ? "◇" : "⚡"; const glow = card.type === "attack" ? "from-red-400/25" : card.type === "defense" ? "from-cyan-300/25" : card.type === "utility" ? "from-emerald-300/25" : card.type === "trap" ? "from-purple-300/25" : "from-amber-300/25"; return { symbol, glow }; }
function CardButton({ card, disabled, c, boosted, onClick, onInfo, onHoldStart, onHoldEnd }: { card: Card; disabled: boolean; c: any; boosted: boolean; onClick: () => void; onInfo: () => void; onHoldStart: () => void; onHoldEnd: () => void }) { const decor = cardDecor(card); return <button type="button" disabled={disabled} onClick={onClick} onPointerDown={onHoldStart} onPointerUp={onHoldEnd} onPointerCancel={onHoldEnd} onPointerLeave={onHoldEnd} className={`group relative min-h-64 overflow-hidden rounded-3xl border p-4 text-left transition-all hover:-translate-y-1 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-45 ${typeStyle(card.type)} ${boosted ? "ring-2 ring-white/25 shadow-[0_0_32px_rgba(255,255,255,0.16)]" : ""}`}><span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${decor.glow} via-transparent to-black/25 opacity-80`} /><span className="pointer-events-none absolute -right-8 -top-8 grid h-28 w-28 place-items-center rounded-full border border-white/10 bg-white/[0.055] text-6xl font-black text-white/10 transition group-hover:scale-110 group-hover:text-white/16">{decor.symbol}</span><span className="pointer-events-none absolute bottom-3 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" /><div className="relative flex items-start justify-between gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.12em]"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/12 text-[11px]">{decor.symbol}</span>{card.type}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black shadow-[0_0_18px_rgba(255,255,255,0.35)]">{c.cost} {card.cost}</span></div><div className="relative mt-5 rounded-2xl border border-white/10 bg-black/20 p-3"><h3 className="text-xl font-black text-white">{card.name}</h3><p className="mt-3 line-clamp-4 text-sm leading-6 text-white/65">{card.text}</p></div>{boosted && <p className="relative mt-3 rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-bold text-white/85">✦ {c.boost}</p>}<div className="relative mt-4 flex items-center justify-between gap-3 text-xs text-white/50"><span className="truncate">{c.anti}: {card.anti || "-"}</span><span onClick={(event) => { event.stopPropagation(); onInfo(); }} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1 transition hover:bg-white/10"><Info className="h-3 w-3" /> info</span></div></button>; }
function MapPanel({ map, c }: { map: ClashMap; c: any }) { return <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"><div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-cyan-500/10" /><div className="relative flex items-center gap-2 text-white"><MapIcon className="h-5 w-5" /><h2 className="text-xl font-medium">{map.name}</h2></div><p className="relative mt-3 text-sm leading-6 text-white/60">{map.boostText}</p><span className={`relative mt-4 inline-flex rounded-full border px-3 py-1 text-xs ${typeStyle(map.boostType)}`}>{c.boost}: {map.boostType}</span></div>; }
function MapReveal({ map, label }: { map: ClashMap; label: string }) { return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-md"><div className="relative w-[min(90vw,680px)] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl"><div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20" /><div className="relative"><p className="text-xs uppercase tracking-[0.32em] text-white/45">{label}</p><h2 className="mt-4 text-5xl font-semibold tracking-tight text-white">{map.name}</h2><p className="mt-4 text-white/60">{map.boostText}</p></div></div></div>; }

function LobbyHome({ c, user, busy, open, mine, createLobby, joinLobby, closeLobby, enterLobby }: { c: any; user: User | null; busy: boolean; open: Lobby[]; mine: Lobby[]; createLobby: (event: FormEvent<HTMLFormElement>) => void; joinLobby: (id: number) => void; closeLobby: (id: number) => void; enterLobby: (id: number) => void }) {
  return <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]"><div className="space-y-6"><form onSubmit={createLobby} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl"><div className="flex items-center gap-3"><div className="rounded-2xl border border-purple-300/20 bg-purple-300/10 p-3 text-purple-100"><UserPlus className="h-5 w-5" /></div><div><h2 className="text-2xl font-medium">{c.create}</h2><p className="mt-1 text-sm text-white/45">{c.both}</p></div></div><button disabled={busy || !user} className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? "..." : c.create}</button>{!user && <p className="mt-3 text-sm text-red-100/70">Sign in gerekli.</p>}</form><LobbyList title={c.mine} items={mine} c={c} user={user} empty={c.empty} action={(lobby) => enterLobby(lobby.id)} actionText={c.enter} closeLobby={closeLobby} /></div><LobbyList title={c.open} items={open} c={c} user={user} empty={c.empty} action={(lobby) => joinLobby(lobby.id)} actionText={c.join} closeLobby={closeLobby} /></section>;
}
function LobbyList({ title, items, c, user, empty, action, actionText, closeLobby }: { title: string; items: Lobby[]; c: any; user: User | null; empty: string; action: (lobby: Lobby) => void; actionText: string; closeLobby: (id: number) => void }) { return <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-cyan-100" /><h2 className="text-2xl font-medium">{title}</h2></div><div className="mt-5 space-y-3">{items.length ? items.map((lobby) => { const map = mapFor(lobby.map_key); const canClose = lobby.status === "open" && user?.id === lobby.creator_user_id; return <div key={lobby.id} className="rounded-3xl border border-white/10 bg-black/30 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar player={{ name: lobby.creator_name, email: lobby.creator_email, avatar_url: lobby.creator_avatar_url }} /><div><p className="text-xs uppercase tracking-[0.14em] text-white/30">{c.host}</p><p className="font-medium text-white">{lobby.creator_name || lobby.creator_email}</p></div></div><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">{map.name}</span></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-white/45">{lobby.opponent_user_id ? c.live : c.waiting}</p><div className="flex flex-wrap justify-end gap-2">{canClose && <button onClick={() => closeLobby(lobby.id)} className="rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-semibold text-red-100">{c.close}</button>}<button onClick={() => action(lobby)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">{actionText}</button></div></div></div>; }) : <p className="rounded-3xl border border-white/10 bg-black/30 p-5 text-sm text-white/45">{empty}</p>}</div></div>; }
function InfoModal({ card, c, close }: { card: Card; c: any; close: () => void }) { return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md" onClick={close}><div className={`w-full max-w-md rounded-[2rem] border p-6 shadow-2xl ${typeStyle(card.type)}`} onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] opacity-70">{card.type} · {c.cost} {card.cost}</p><h2 className="mt-3 text-3xl font-semibold text-white">{card.name}</h2></div><button onClick={close} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-white/70">✕</button></div><p className="mt-5 leading-7 text-white/70">{card.text}</p><p className="mt-4 text-sm text-white/50">{c.anti}: {card.anti || "-"}</p></div></div>; }
