import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Brain, Clock, Flame, Info, Map, Shield, Sparkles, Swords, Zap } from "lucide-react";
import { useLanguage } from "../i18n";

type User = { id: number; name: string; email: string; avatar_url?: string | null };
type Player = { id?: number | null; name?: string | null; email?: string | null; avatar_url?: string | null };
type CardType = "attack" | "defense" | "utility" | "trap" | "overload";
type Card = { id: string; name: string; type: CardType; cost: number; text: string; anti?: string; tags?: string[]; boost?: string };
type Lobby = { id: number; creator_user_id: number; opponent_user_id?: number | null; status: string; map_key: string; winner_user_id?: number | null; creator_name: string; creator_email: string; creator_avatar_url?: string | null; opponent_name?: string | null; opponent_email?: string | null; opponent_avatar_url?: string | null; winner_name?: string | null; turn_number?: number; deadline_at?: string | null };
type MatchState = { user: User; lobby: Lobby; me: "creator" | "opponent"; opponent: "creator" | "opponent"; players: { creator: Player; opponent: Player }; hp: Record<string, number>; energy: Record<string, number>; heat: Record<string, number>; hand: Card[]; selected: Record<string, string | null>; turn_number: number; deadline_at?: string | null; last_resolution?: string | null; map: ClashMap; };
type ClashMap = { key: string; name: string; boostType: CardType; boostText: string; color: string };

const MAPS: ClashMap[] = [
  { key: "firewall_city", name: "Firewall City", boostType: "defense", boostText: "Defense kartları +2 shield etkisi kazanır.", color: "cyan" },
  { key: "glitch_ruins", name: "Glitch Ruins", boostType: "trap", boostText: "Trap kartları tetiklenirse +2 hasar ekler.", color: "purple" },
  { key: "overclock_core", name: "Overclock Core", boostType: "attack", boostText: "Attack kartları +2 hasar verir ama +1 Heat riski taşır.", color: "red" },
  { key: "data_archive", name: "Data Archive", boostType: "utility", boostText: "Utility kartları oynanınca gelecek tur +1 kart avantajı sağlar.", color: "emerald" },
];

const CARD_LIBRARY: Card[] = [
  { id: "glitch_strike", name: "Glitch Strike", type: "attack", cost: 2, text: "8 hasar ver.", anti: "Firewall, Mirror Bug", tags: ["direct"] },
  { id: "packet_burst", name: "Packet Burst", type: "attack", cost: 3, text: "11 hasar ver. Rakip Defense oynadıysa 6 hasara düşer.", anti: "Defense", tags: ["direct"] },
  { id: "pierce_injection", name: "Pierce Injection", type: "attack", cost: 4, text: "9 hasar ver. Bunun 5'i shield yok sayar.", anti: "Mirror Bug, Data Drain", tags: ["pierce"] },
  { id: "double_ping", name: "Double Ping", type: "attack", cost: 3, text: "2 kez 5 hasar ver. Tek kalkanı zorlar.", anti: "Static Field", tags: ["multi"] },
  { id: "core_spike", name: "Core Spike", type: "attack", cost: 5, text: "15 hasar ver. +1 Heat al.", anti: "Firewall, Packet Trap", tags: ["heavy", "heat"] },
  { id: "firewall", name: "Firewall", type: "defense", cost: 3, text: "Bu tur gelen hasarı %50 azalt.", anti: "Pierce Injection, Utility", tags: ["reduce"] },
  { id: "core_shield", name: "Core Shield", type: "defense", cost: 4, text: "Bu tur ilk hasar vuruşunu tamamen engelle.", anti: "Double Ping, Bait", tags: ["block"] },
  { id: "emergency_patch", name: "Emergency Patch", type: "defense", cost: 2, text: "7 HP yenile. Bu tur hasar aldıysan +3 HP daha yenile.", anti: "Heal Block", tags: ["heal"] },
  { id: "static_field", name: "Static Field", type: "defense", cost: 3, text: "Rakip çoklu vuruş yaparsa ona 6 hasar geri ver.", anti: "Tek vuruş, Utility", tags: ["multi-counter"] },
  { id: "system_scan", name: "System Scan", type: "utility", cost: 1, text: "Rakibin seçtiği kart tipini görürsün. Gelecek tur 1 kart avantajı.", anti: "Aggro", tags: ["info"] },
  { id: "data_drain", name: "Data Drain", type: "utility", cost: 3, text: "Rakip gelecek tur -2 enerji başlar.", anti: "Low-cost cards", tags: ["energy"] },
  { id: "battery_backup", name: "Battery Backup", type: "utility", cost: 2, text: "Gelecek tur +2 enerji kazan. Hasar alırsan +1'e düşer.", anti: "Attack pressure", tags: ["ramp"] },
  { id: "hand_jam", name: "Hand Jam", type: "utility", cost: 3, text: "Rakip kart çekme etkisi kullandıysa iptal et. Aksi halde 4 hasar ver.", anti: "Attack", tags: ["interrupt"] },
  { id: "mirror_bug", name: "Mirror Bug", type: "trap", cost: 3, text: "Rakip Attack oynarsa gelen hasarın %50'sini ona yansıt.", anti: "Utility, Decoy", tags: ["reflect"] },
  { id: "packet_trap", name: "Packet Trap", type: "trap", cost: 2, text: "Rakip 4+ enerji kart oynarsa ona 8 hasar ver.", anti: "Low-cost", tags: ["cost-counter"] },
  { id: "false_firewall", name: "False Firewall", type: "trap", cost: 2, text: "Rakip Pierce oynarsa hasarı 0 yap. Aksi halde 3 shield değeri kazan.", anti: "Normal Attack", tags: ["pierce-counter"] },
  { id: "decoy_packet", name: "Decoy Packet", type: "utility", cost: 1, text: "Rakibin Trap kartı tetiklenirse boşa gider.", anti: "Attack pressure", tags: ["anti-trap"] },
  { id: "core_overload", name: "Core Overload", type: "overload", cost: 7, text: "18 hasar ver. +2 Heat al.", anti: "Core Shield, Packet Trap, Drain", tags: ["heavy", "heat"] },
  { id: "blackout", name: "Blackout", type: "overload", cost: 6, text: "Rakip gelecek tur kart çekemez ve -1 enerji başlar. +1 Heat.", anti: "Battery Backup", tags: ["control", "heat"] },
  { id: "full_restore", name: "Full Restore", type: "overload", cost: 7, text: "20 HP yenile. +2 Heat al.", anti: "Heal Block", tags: ["heal", "heat"] },
];

function typeStyle(type: CardType) {
  if (type === "attack") return "border-red-300/25 bg-red-300/10 text-red-100";
  if (type === "defense") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  if (type === "utility") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (type === "trap") return "border-purple-300/25 bg-purple-300/10 text-purple-100";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "P";
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P";
}

function Avatar({ user }: { user: Player }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-semibold text-black">{user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(user.name, user.email)}</span>;
}

export function CoreClash() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState<Lobby[]>([]);
  const [mine, setMine] = useState<Lobby[]>([]);
  const [mapKey, setMapKey] = useState(MAPS[0].key);
  const [activeLobby, setActiveLobby] = useState<number | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [infoCard, setInfoCard] = useState<Card | null>(null);
  const holdTimer = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const c = useMemo(() => tr ? {
    title: "Core Clash",
    subtitle: "2 kişilik aynı anda kart seçme düellosu. 3 kartla başla, her tur 1 kart çek, elde max 6 kart tut.",
    create: "Lobi oluştur",
    join: "Katıl",
    enter: "Maça gir",
    open: "Açık lobiler",
    mine: "Benim maçlarım",
    empty: "Henüz açık lobi yok.",
    map: "Harita",
    hand: "Elindeki kartlar",
    selected: "Kart seçildi · rakip bekleniyor",
    opponentSelected: "Rakip seçti",
    both: "İki oyuncu da lobiye girmeden maç başlamaz.",
    timer: "Tur süresi",
    hp: "Core HP",
    energy: "Enerji",
    heat: "Heat",
    rules: "Kurallar",
    ruleText: "Başlangıç eli 3 kart. Her tur +1 kart. El limiti 6. Tur süresi 15 saniye. Kartı basılı tutunca detay açılır.",
    cost: "Enerji",
    anti: "Anti",
    boost: "Harita boostu",
    refresh: "Yenile",
    back: "Lobilere dön",
    waiting: "Player 2 bekleniyor",
    live: "Canlı maç",
    completed: "Tamamlandı",
  } : {
    title: "Core Clash",
    subtitle: "A 2-player simultaneous card duel. Start with 3 cards, draw 1 each turn, keep max 6 cards.",
    create: "Create lobby",
    join: "Join",
    enter: "Enter match",
    open: "Open lobbies",
    mine: "My matches",
    empty: "No open lobby yet.",
    map: "Map",
    hand: "Your hand",
    selected: "Card selected · waiting for opponent",
    opponentSelected: "Opponent selected",
    both: "Match will not start before both players enter the lobby.",
    timer: "Turn timer",
    hp: "Core HP",
    energy: "Energy",
    heat: "Heat",
    rules: "Rules",
    ruleText: "Starting hand: 3 cards. Draw 1 each turn. Hand limit: 6. Turn timer: 15 seconds. Hold a card to inspect details.",
    cost: "Energy",
    anti: "Countered by",
    boost: "Map boost",
    refresh: "Refresh",
    back: "Back to lobbies",
    waiting: "Waiting for Player 2",
    live: "Live match",
    completed: "Completed",
  }, [tr]);

  const selectedMap = MAPS.find((m) => m.key === mapKey) || MAPS[0];

  const loadLobbies = async (silent = false) => {
    if (!silent) setBusy(true);
    if (!silent) setNotice(null);
    try {
      const response = await fetch("/api/core-clash", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Core Clash API hazır değil. Migration gerekebilir.");
      setUser(data.user || null);
      setOpen(data.open || []);
      setMine(data.mine || []);
    } catch (error) {
      if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Core Clash yüklenemedi." });
    } finally {
      if (!silent) setBusy(false);
    }
  };

  const loadMatch = async (id = activeLobby, silent = true) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/core-clash/action?lobby_id=${id}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Maç yüklenemedi.");
      setMatch(data);
      setActiveLobby(data.lobby?.id || id);
    } catch (error) {
      if (!silent) setNotice({ type: "error", text: error instanceof Error ? error.message : "Maç yüklenemedi." });
    }
  };

  useEffect(() => {
    loadLobbies();
    const ticker = window.setInterval(() => setNow(Date.now()), 250);
    const poll = window.setInterval(() => activeLobby ? loadMatch(activeLobby, true) : loadLobbies(true), 1500);
    return () => { window.clearInterval(ticker); window.clearInterval(poll); };
  }, [activeLobby, language]);

  const createLobby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/core-clash", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ map_key: mapKey }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Lobi oluşturulamadı.");
      await loadLobbies(true);
      setNotice({ type: "success", text: data?.message || "Core Clash lobisi oluşturuldu." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Lobi oluşturulamadı." });
    } finally {
      setBusy(false);
    }
  };

  const joinLobby = async (id: number) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/core-clash/join", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Lobiye katılınamadı.");
      setActiveLobby(id);
      await loadMatch(id, false);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Lobiye katılınamadı." });
    } finally {
      setBusy(false);
    }
  };

  const chooseCard = async (card: Card) => {
    if (!match || match.selected?.[match.me] || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/core-clash/action", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobby_id: match.lobby.id, card_id: card.id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Kart seçilemedi.");
      setMatch(data);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Kart seçilemedi." });
    } finally {
      setBusy(false);
    }
  };

  const startHold = (card: Card) => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setInfoCard(card), 420);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const secondsLeft = match?.deadline_at ? Math.max(0, Math.ceil((Date.parse(match.deadline_at.replace(" ", "T") + "Z") - now) / 1000)) : 15;

  return <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
    <div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
    <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="relative mx-auto max-w-7xl space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-purple-100/60">EkaTech OFF Cards</p>
            <h1 className="mt-3 text-5xl font-medium tracking-tight sm:text-7xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/55">{c.subtitle}</p>
          </div>
          <button onClick={() => activeLobby ? loadMatch(activeLobby, false) : loadLobbies()} disabled={busy} className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50">{busy ? "..." : c.refresh}</button>
        </div>
        <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">{c.ruleText}</div>
        {notice && <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}
      </section>

      {match ? <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3"><button onClick={() => { setMatch(null); setActiveLobby(null); loadLobbies(true); }} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/75">← {c.back}</button><span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-sm text-purple-100">Turn {match.turn_number}</span></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><PlayerPanel title="You" player={match.players[match.me]} hp={match.hp[match.me]} energy={match.energy[match.me]} heat={match.heat[match.me]} c={c} /><PlayerPanel title="Opponent" player={match.players[match.opponent]} hp={match.hp[match.opponent]} energy={match.energy[match.opponent]} heat={match.heat[match.opponent]} c={c} /></div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"><div className="flex items-center gap-2 text-white"><Map className="h-5 w-5" /><h2 className="text-xl font-medium">{match.map.name}</h2></div><p className="mt-3 text-sm leading-6 text-white/50">{match.map.boostText}</p><span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs ${typeStyle(match.map.boostType)}`}>{c.boost}: {match.map.boostType}</span></div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-100" /><h2 className="text-xl font-medium">{c.timer}</h2></div><span className="font-mono text-3xl text-cyan-100">{secondsLeft}s</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-200 transition-all" style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / 15) * 100))}%` }} /></div><p className="mt-4 text-sm text-white/45">{match.selected?.[match.me] ? c.selected : match.selected?.[match.opponent] ? c.opponentSelected : c.both}</p></div>
          {match.last_resolution && <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-5 text-sm leading-6 text-emerald-100">{match.last_resolution}</div>}
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"><div className="flex items-center gap-2"><Swords className="h-5 w-5 text-red-100" /><h2 className="text-2xl font-medium">{c.hand}</h2><span className="ml-auto rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/45">{match.hand.length}/6</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{match.hand.map((card) => <CardButton key={card.id} card={card} disabled={Boolean(match.selected?.[match.me]) || card.cost > match.energy[match.me] || match.lobby.status === "completed"} c={c} onClick={() => chooseCard(card)} onInfo={() => setInfoCard(card)} onHoldStart={() => startHold(card)} onHoldEnd={endHold} boosted={card.type === match.map.boostType} />)}</div></div>
      </section> : <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <form onSubmit={createLobby} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl"><h2 className="text-2xl font-medium text-white">{c.create}</h2><p className="mt-3 text-sm leading-6 text-white/45">{c.both}</p><div className="mt-5 space-y-3"><p className="text-sm text-white/45">{c.map}</p>{MAPS.map((map) => <button key={map.key} type="button" onClick={() => setMapKey(map.key)} className={`w-full rounded-2xl border p-4 text-left transition-all ${mapKey === map.key ? "border-purple-300/30 bg-purple-300/10" : "border-white/10 bg-black/25 hover:bg-white/[0.06]"}`}><div className="flex items-center justify-between gap-3"><span className="font-medium text-white">{map.name}</span><span className={`rounded-full border px-3 py-1 text-xs ${typeStyle(map.boostType)}`}>{map.boostType}</span></div><p className="mt-2 text-sm text-white/45">{map.boostText}</p></button>)}</div><button disabled={busy || !user} className="mt-6 w-full rounded-full bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 disabled:opacity-50">{busy ? "..." : c.create}</button></form>
        <div className="space-y-6"><LobbyList title={c.open} empty={c.empty} lobbies={open} user={user} c={c} onJoin={joinLobby} onEnter={(id) => { setActiveLobby(id); loadMatch(id, false); }} /><LobbyList title={c.mine} empty={c.empty} lobbies={mine} user={user} c={c} onJoin={joinLobby} onEnter={(id) => { setActiveLobby(id); loadMatch(id, false); }} /></div>
      </section>}
    </div>

    {infoCard && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={() => setInfoCard(null)}><div className="max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><span className={`rounded-full border px-3 py-1 text-xs ${typeStyle(infoCard.type)}`}>{infoCard.type}</span><h3 className="mt-4 text-3xl font-medium text-white">{infoCard.name}</h3></div><button onClick={() => setInfoCard(null)} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-white/60">×</button></div><p className="mt-4 text-sm leading-6 text-white/60">{infoCard.text}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Rule label={c.cost} value={String(infoCard.cost)} /><Rule label={c.anti} value={infoCard.anti || "-"} /></div></div></div>}
  </main>;
}

function PlayerPanel({ title, player, hp, energy, heat, c }: { title: string; player: Player; hp: number; energy: number; heat: number; c: any }) {
  return <div className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="flex items-center gap-3"><Avatar user={player} /><div className="min-w-0"><p className="text-xs uppercase tracking-[0.16em] text-white/30">{title}</p><p className="truncate font-medium text-white">{player.name || player.email || "Player"}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><MiniStat icon={<Shield className="h-4 w-4" />} label={c.hp} value={hp} /><MiniStat icon={<Zap className="h-4 w-4" />} label={c.energy} value={energy} /><MiniStat icon={<Flame className="h-4 w-4" />} label={c.heat} value={heat} /></div></div>;
}
function MiniStat({ icon, label, value }: { icon: any; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><div className="mx-auto flex justify-center text-white/50">{icon}</div><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p><p className="font-mono text-lg text-white">{value}</p></div>; }
function Rule({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.14em] text-white/35">{label}</p><p className="mt-2 text-sm text-white/70">{value}</p></div>; }
function CardButton({ card, disabled, c, boosted, onClick, onInfo, onHoldStart, onHoldEnd }: { card: Card; disabled: boolean; c: any; boosted: boolean; onClick: () => void; onInfo: () => void; onHoldStart: () => void; onHoldEnd: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} onPointerDown={onHoldStart} onPointerUp={onHoldEnd} onPointerCancel={onHoldEnd} onPointerLeave={onHoldEnd} className={`group min-h-56 rounded-3xl border p-4 text-left transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-45 ${typeStyle(card.type)} ${boosted ? "ring-2 ring-white/20" : ""}`}><div className="flex items-start justify-between gap-2"><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs">{card.type}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">{card.cost}</span></div><h3 className="mt-5 text-xl font-semibold text-white">{card.name}</h3><p className="mt-3 line-clamp-4 text-sm leading-6 text-white/60">{card.text}</p>{boosted && <p className="mt-3 text-xs text-white/80">+ {c.boost}</p>}<div className="mt-4 flex items-center justify-between text-xs text-white/45"><span>{c.anti}: {card.anti || "-"}</span><span onClick={(event) => { event.stopPropagation(); onInfo(); }} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1"><Info className="h-3 w-3" /> info</span></div></button>; }
function LobbyList({ title, empty, lobbies, user, c, onJoin, onEnter }: { title: string; empty: string; lobbies: Lobby[]; user: User | null; c: any; onJoin: (id: number) => void; onEnter: (id: number) => void }) { return <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"><h2 className="text-2xl font-medium text-white">{title}</h2><div className="mt-5 space-y-3">{lobbies.length === 0 && <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-white/45">{empty}</div>}{lobbies.map((lobby) => { const isMine = user?.id === lobby.creator_user_id || user?.id === lobby.opponent_user_id; const canJoin = lobby.status === "open" && user?.id !== lobby.creator_user_id; const canEnter = isMine && lobby.status !== "open"; return <div key={lobby.id} className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-white">#{lobby.id} · {MAPS.find((m) => m.key === lobby.map_key)?.name || lobby.map_key}</p><p className="mt-1 text-sm text-white/45">{lobby.creator_name} vs {lobby.opponent_name || c.waiting}</p></div><span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/50">{lobby.status === "open" ? c.waiting : lobby.status === "completed" ? c.completed : c.live}</span></div><div className="mt-4 flex gap-2">{canJoin && <button onClick={() => onJoin(lobby.id)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black">{c.join}</button>}{canEnter && <button onClick={() => onEnter(lobby.id)} className="rounded-full border border-purple-300/20 bg-purple-300/10 px-5 py-2 text-sm font-medium text-purple-100">{c.enter}</button>}</div></div>; })}</div></div>; }
