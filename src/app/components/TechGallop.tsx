import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ChevronDown,
  CircleDollarSign,
  Flag,
  Gauge,
  Medal,
  Play,
  Radar,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { playOffSound } from "./OffSoundEngine";

type TrackId =
  | "neon-valley"
  | "firewall-speedway"
  | "quantum-desert"
  | "glitch-circuit"
  | "data-storm-arena";

type StatKey =
  | "speed"
  | "acceleration"
  | "stamina"
  | "sprint"
  | "consistency";

type Horse = {
  id: string;
  name: string;
  style: string;
  color: string;
  risk: "Low" | "Medium" | "High";
  preference: TrackId;
  form: string[];
  stats: Record<StatKey, number>;
};

type Track = {
  id: TrackId;
  name: string;
  description: string;
  favors: StatKey;
  accent: string;
  weather: string;
};

type RaceHorseState = {
  horse: Horse;
  chance: number;
  finishRank: number;
  finishProgress: number;
  lane: number;
  earlyBias: number;
  midBias: number;
  staminaDrop: number;
  lateKick: number;
};

type RaceSnapshot = {
  tick: number;
  states: Array<RaceHorseState & { progress: number; yOffset: number }>;
};

type RaceResult = {
  id: number;
  track: Track;
  winner: Horse;
  selectedPick: Horse | null;
  reward: number;
  photoFinish: boolean;
  order: RaceHorseState[];
  snapshots: RaceSnapshot[];
  explanation: string;
};

const TRACKS: Track[] = [
  {
    id: "neon-valley",
    name: "Neon Valley",
    description: "A glossy straightaway that rewards pure top speed.",
    favors: "speed",
    accent: "from-cyan-300 to-fuchsia-400",
    weather: "holographic tailwind",
  },
  {
    id: "firewall-speedway",
    name: "Firewall Speedway",
    description: "Hard launches out of burning gates decide early control.",
    favors: "acceleration",
    accent: "from-orange-300 to-red-500",
    weather: "plasma heat shimmer",
  },
  {
    id: "quantum-desert",
    name: "Quantum Desert",
    description: "Long data dunes punish horses with poor stamina.",
    favors: "stamina",
    accent: "from-amber-200 to-cyan-300",
    weather: "ion sandstorm",
  },
  {
    id: "glitch-circuit",
    name: "Glitch Circuit",
    description: "Unstable bends favor disciplined, consistent racers.",
    favors: "consistency",
    accent: "from-violet-300 to-emerald-300",
    weather: "pixel distortion",
  },
  {
    id: "data-storm-arena",
    name: "Data Storm Arena",
    description: "A loud indoor oval built for last-second sprint bursts.",
    favors: "sprint",
    accent: "from-sky-300 to-indigo-500",
    weather: "thunder cache surge",
  },
];

const HORSES: Horse[] = [
  {
    id: "neon-comet",
    name: "Neon Comet",
    style: "Fast starter, weak finisher",
    color: "#22d3ee",
    risk: "Medium",
    preference: "neon-valley",
    form: ["W", "2", "4", "W", "3"],
    stats: { speed: 93, acceleration: 91, stamina: 68, sprint: 70, consistency: 78 },
  },
  {
    id: "quantum-hoof",
    name: "Quantum Hoof",
    style: "Slow starter, huge final sprint",
    color: "#a78bfa",
    risk: "Medium",
    preference: "data-storm-arena",
    form: ["3", "W", "2", "5", "W"],
    stats: { speed: 80, acceleration: 64, stamina: 88, sprint: 96, consistency: 82 },
  },
  {
    id: "firewall-fury",
    name: "Firewall Fury",
    style: "Acceleration specialist",
    color: "#fb923c",
    risk: "High",
    preference: "firewall-speedway",
    form: ["5", "W", "6", "2", "W"],
    stats: { speed: 86, acceleration: 97, stamina: 71, sprint: 76, consistency: 62 },
  },
  {
    id: "glitch-ghost",
    name: "Glitch Ghost",
    style: "Risky high-variance horse",
    color: "#f472b6",
    risk: "High",
    preference: "glitch-circuit",
    form: ["W", "7", "W", "6", "2"],
    stats: { speed: 90, acceleration: 79, stamina: 74, sprint: 92, consistency: 52 },
  },
  {
    id: "data-dynasty",
    name: "Data Dynasty",
    style: "Balanced elite contender",
    color: "#34d399",
    risk: "Low",
    preference: "glitch-circuit",
    form: ["2", "2", "W", "3", "2"],
    stats: { speed: 85, acceleration: 84, stamina: 86, sprint: 85, consistency: 93 },
  },
  {
    id: "storm-saddle",
    name: "Storm Saddle",
    style: "Track specialist with endurance",
    color: "#60a5fa",
    risk: "Medium",
    preference: "quantum-desert",
    form: ["4", "3", "2", "W", "4"],
    stats: { speed: 78, acceleration: 76, stamina: 98, sprint: 81, consistency: 84 },
  },
];

const STAT_LABELS: Record<StatKey, string> = {
  speed: "Speed",
  acceleration: "Acceleration",
  stamina: "Stamina",
  sprint: "Final Sprint",
  consistency: "Consistency",
};

const TRACK_WEIGHT: Record<StatKey, number> = {
  speed: 0.24,
  acceleration: 0.18,
  stamina: 0.2,
  sprint: 0.2,
  consistency: 0.18,
};

function statAverage(horse: Horse) {
  return Object.values(horse.stats).reduce((sum, stat) => sum + stat, 0) / 5;
}

function horseWeight(horse: Horse, track: Track) {
  const base = statAverage(horse) * 0.62;
  const profile = Object.entries(horse.stats).reduce(
    (sum, [key, value]) => sum + value * TRACK_WEIGHT[key as StatKey],
    0,
  );
  const trackBoost = horse.stats[track.favors] * 0.22;
  const specialist = horse.preference === track.id ? 8 : 0;
  const consistencySafety = horse.stats.consistency * 0.08;
  const variance = horse.risk === "High" ? Math.random() * 12 - 3 : Math.random() * 4;
  return Math.max(12, base + profile * 0.36 + trackBoost + specialist + consistencySafety + variance);
}

function weightedPick<T>(items: T[], weightFor: (item: T) => number) {
  const weights = items.map((item) => Math.max(0.1, weightFor(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return items[index];
  }
  return items[items.length - 1];
}

function rankByWeightedPerformance(horses: Horse[], track: Track, winner: Horse) {
  return horses
    .filter((horse) => horse.id !== winner.id)
    .map((horse) => {
      const weight = horseWeight(horse, track);
      const luck = Math.random() * (horse.risk === "High" ? 32 : 22);
      return { horse, score: weight + luck };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.horse);
}

function buildSnapshots(order: RaceHorseState[]) {
  const snapshots: RaceSnapshot[] = [];
  const progressAt = (state: RaceHorseState, tick: number) => {
    const t = tick / 100;
    const earlySurge = Math.sin(Math.min(1, t / 0.28) * Math.PI) * state.earlyBias;
    const midMove = Math.sin(Math.max(0, Math.min(1, (t - 0.24) / 0.42)) * Math.PI) * state.midBias;
    const fatigue = Math.max(0, (t - 0.48) / 0.32) * state.staminaDrop;
    const lateSprint = Math.max(0, (t - 0.72) / 0.28) ** 1.7 * state.lateKick;
    const curve = state.horse.stats.acceleration > 88 ? 0.88 : 1.03;
    let progress = 94 * t ** curve + earlySurge + midMove - fatigue + lateSprint;

    if (tick >= 88) {
      const start = 94 * 0.88 ** curve + Math.sin(Math.PI) * state.earlyBias + state.midBias * 0.28 - state.staminaDrop * 0.8 + state.lateKick * 0.28;
      const finalBlend = (tick - 88) / 12;
      progress = start * (1 - finalBlend) + state.finishProgress * finalBlend;
    }

    return Math.max(0, Math.min(state.finishProgress, progress));
  };

  for (let tick = 0; tick <= 100; tick += 2) {
    const states = order.map((state) => ({
      ...state,
      progress: progressAt(state, tick),
      yOffset: Math.sin(tick / 8 + state.lane) * 2.5,
    }));
    snapshots.push({ tick, states });
  }
  return snapshots;
}

function createRace(track: Track, selectedPick: Horse | null): RaceResult {
  const chances = HORSES.map((horse) => ({ horse, weight: horseWeight(horse, track) }));
  const total = chances.reduce((sum, entry) => sum + entry.weight, 0);
  const winner = weightedPick(chances, (entry) => entry.weight).horse;
  const rest = rankByWeightedPerformance(HORSES, track, winner);
  const finishOrder = [winner, ...rest];
  const photoFinish = Math.random() > 0.72;
  const order: RaceHorseState[] = finishOrder.map((horse, index) => {
    const chance = chances.find((entry) => entry.horse.id === horse.id)!.weight / total;
    const isWinner = index === 0;
    return {
      horse,
      chance,
      finishRank: index + 1,
      finishProgress: isWinner ? 100 : Math.max(88, 99.2 - index * (photoFinish && index === 1 ? 0.38 : 1.7)),
      lane: HORSES.findIndex((runner) => runner.id === horse.id),
      earlyBias: (horse.stats.acceleration - 72) / 7 + (index > 1 ? Math.random() * 5 : Math.random() * 2),
      midBias: (horse.stats.speed - 75) / 8 + (index === 2 ? 4.8 : Math.random() * 3.2),
      staminaDrop: Math.max(0, 86 - horse.stats.stamina) / 4 + (horse.style.includes("weak") ? 5 : 0),
      lateKick: (horse.stats.sprint - 72) / 4 + (isWinner ? 9 : index === 1 ? 5 : 1),
    };
  });

  const winningTrait = track.favors === "sprint" ? "final sprint" : STAT_LABELS[track.favors].toLowerCase();
  const explanation = `${winner.name} converted ${track.name}'s ${winningTrait} bias into a controlled late move${
    photoFinish ? " and survived a photo finish." : "."
  }`;

  return {
    id: Date.now(),
    track,
    winner,
    selectedPick,
    reward: selectedPick?.id === winner.id ? 75 : 0,
    photoFinish,
    order,
    snapshots: buildSnapshots(order),
    explanation,
  };
}

function chanceLabel(chance: number) {
  if (chance >= 0.19) return "Prime chance";
  if (chance >= 0.16) return "Strong chance";
  if (chance >= 0.13) return "Live outsider";
  return "Long shot";
}

function trackName(id: TrackId) {
  return TRACKS.find((track) => track.id === id)?.name || id;
}

export function TechGallop() {
  const [trackId, setTrackId] = useState<TrackId>("neon-valley");
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [race, setRace] = useState<RaceResult | null>(null);
  const [phase, setPhase] = useState<"ready" | "running" | "finished">("ready");
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [localBalance, setLocalBalance] = useState(250);

  const track = TRACKS.find((item) => item.id === trackId)!;
  const chanceMap = useMemo(() => {
    const weights = HORSES.map((horse) => ({ horse, weight: horseWeight(horse, track) }));
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
    return new Map(weights.map((entry) => [entry.horse.id, entry.weight / total]));
  }, [track]);

  const snapshot = race?.snapshots[snapshotIndex] || null;
  const sortedLive = snapshot
    ? [...snapshot.states].sort((a, b) => b.progress - a.progress)
    : [];

  const startRace = () => {
    const pick = HORSES.find((horse) => horse.id === selectedHorseId) || null;
    const nextRace = createRace(track, pick);
    setRace(nextRace);
    setPhase("running");
    setSnapshotIndex(0);
    playOffSound("ready");

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setSnapshotIndex(index);
      if (index >= nextRace.snapshots.length - 1) {
        window.clearInterval(timer);
        setPhase("finished");
        setLocalBalance((balance) => balance + nextRace.reward);
        playOffSound(nextRace.reward > 0 ? "coin" : "win");
      }
    }, 115);
  };

  const resetRace = () => {
    setRace(null);
    setPhase("ready");
    setSnapshotIndex(0);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-16 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-[-8rem] top-72 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-sm text-cyan-100">
                <Sparkles className="h-4 w-4" /> OFF Hub cyber racing module
              </div>
              <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">
                Tech <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-amber-100 bg-clip-text text-transparent">Gallop</span>
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/58">
                Futuristic virtual horse racing powered only by fictional Tech Coin. The winner is secretly selected before the cinematic starts, then the race animation is generated to match the locked result.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/50">Practice Tech Coin purse</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-cyan-100">
                  <img src={coinIcon} alt="Tech Coin" className="h-5 w-5 rounded-full" /> {localBalance} TC
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/50">
                Pick a horse for a 75 TC fictional reward. No real-money currency is used or shown.
              </p>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.45fr]">
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                <Flag className="h-4 w-4" /> Track system
              </div>
              <div className="relative mt-4">
                <select
                  value={trackId}
                  disabled={phase === "running"}
                  onChange={(event) => setTrackId(event.target.value as TrackId)}
                  className="w-full appearance-none rounded-2xl border border-cyan-200/20 bg-black/55 px-4 py-4 text-white outline-none transition focus:border-cyan-100/60 disabled:opacity-60"
                >
                  {TRACKS.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/60" />
              </div>
              <div className={`mt-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${track.accent} p-[1px]`}>
                <div className="rounded-[1.45rem] bg-black/80 p-4">
                  <h2 className="text-2xl font-semibold">{track.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/55">{track.description}</p>
                  <div className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                    <span className="rounded-full bg-white/10 px-3 py-2">Favors: {STAT_LABELS[track.favors]}</span>
                    <span className="rounded-full bg-white/10 px-3 py-2">Effect: {track.weather}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-amber-200/20 bg-amber-200/[0.06] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-100/75">
                <Radar className="h-4 w-4" /> Fair result engine
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/58">
                <li>• Winner is secretly selected before the race animation starts.</li>
                <li>• Stats, form, track preference, and track type affect weighted chance.</li>
                <li>• Weaker horses stay live through bounded randomness and risk variance.</li>
                <li>• Animation uses the locked winner, so final board and visuals always match.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Race card</p>
                <h2 className="mt-1 text-3xl font-semibold">Choose your Tech Coin runner</h2>
              </div>
              <button
                type="button"
                disabled={phase === "running"}
                onClick={phase === "finished" ? resetRace : startRace}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {phase === "finished" ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {phase === "finished" ? "New race" : phase === "running" ? "Race running" : "Start race"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {HORSES.map((horse) => {
                const chance = chanceMap.get(horse.id) || 0;
                const selected = selectedHorseId === horse.id;
                return (
                  <button
                    key={horse.id}
                    type="button"
                    disabled={phase === "running"}
                    onClick={() => setSelectedHorseId(selected ? null : horse.id)}
                    className={`rounded-[1.5rem] border p-4 text-left transition ${
                      selected
                        ? "border-cyan-200/60 bg-cyan-200/10 shadow-xl shadow-cyan-500/10"
                        : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-white/[0.06]"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold" style={{ color: horse.color }}>{horse.name}</h3>
                        <p className="mt-1 text-xs text-white/45">{horse.style}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70">{chanceLabel(chance)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      {horse.form.map((form, index) => (
                        <span key={`${horse.id}-${index}`} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-white/65">{form}</span>
                      ))}
                      <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2 py-1 text-amber-100">{horse.risk} risk</span>
                      <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-cyan-100">Prefers {trackName(horse.preference)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {(Object.keys(horse.stats) as StatKey[]).map((key) => (
                        <div key={key} className="rounded-xl bg-white/[0.055] p-2">
                          <p className="truncate text-[10px] text-white/40">{STAT_LABELS[key]}</p>
                          <p className="mt-1 font-mono text-sm text-white">{horse.stats[key]}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300" style={{ width: `${Math.round(chance * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-white/42">Estimated chance: {Math.round(chance * 100)}% · hidden result not revealed</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {race && snapshot && (
          <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <div className="overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-slate-950/80 p-5 shadow-2xl shadow-cyan-500/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/65">Cinematic race view</p>
                  <h2 className="mt-1 text-2xl font-semibold">{race.track.name}</h2>
                </div>
                <div className="text-right text-sm text-white/55">
                  <p>Distance progress</p>
                  <p className="font-mono text-cyan-100">{snapshot.tick}%</p>
                </div>
              </div>
              <div className="relative mt-5 h-[29rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
                <div className="absolute inset-x-0 top-8 h-24 bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent blur-xl" style={{ transform: `translateX(${snapshot.tick * 1.8 - 120}px)` }} />
                <div className="absolute left-6 right-6 top-10 space-y-3">
                  {snapshot.states.map((state) => (
                    <div key={state.horse.id} className="relative h-14 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                      <div className="absolute inset-y-0 left-0 border-r border-dashed border-white/15" style={{ width: "92%" }} />
                      <div className="absolute inset-y-0 right-[7%] w-px bg-amber-100/70 shadow-[0_0_20px_rgba(254,243,199,0.8)]" />
                      <div className="absolute left-0 top-1/2 h-px w-full bg-gradient-to-r from-cyan-200/30 via-transparent to-fuchsia-200/30" />
                      <div className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2 transition-all duration-100 ease-linear" style={{ left: `${Math.min(92, state.progress * 0.92)}%`, transform: `translate(-50%, calc(-50% + ${state.yOffset}px))` }}>
                        <span className="text-2xl drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]">♞</span>
                        <span className="hidden rounded-full bg-black/60 px-2 py-1 text-xs text-white/70 sm:inline" style={{ color: state.horse.color }}>{state.horse.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-5 left-5 right-5 grid gap-3 rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur-md sm:grid-cols-3">
                  <div className="flex items-center gap-2 text-sm text-white/65"><Gauge className="h-4 w-4 text-cyan-100" /> Smooth lane movement</div>
                  <div className="flex items-center gap-2 text-sm text-white/65"><Zap className="h-4 w-4 text-amber-100" /> Late sprint surge</div>
                  <div className="flex items-center gap-2 text-sm text-white/65"><Activity className="h-4 w-4 text-fuchsia-100" /> Dynamic camera drift</div>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/65">Live position board</p>
                <div className="mt-4 space-y-2">
                  {sortedLive.map((state, index) => (
                    <div key={state.horse.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-mono text-sm">{index + 1}</span>
                        <span style={{ color: state.horse.color }}>{state.horse.name}</span>
                      </div>
                      <span className="font-mono text-sm text-white/50">{state.progress.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {phase === "finished" && (
                <div className="rounded-[2rem] border border-amber-200/20 bg-amber-200/[0.07] p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-2 text-amber-100"><Trophy className="h-5 w-5" /> Race result</div>
                  <h2 className="mt-3 text-3xl font-black">{race.winner.name} wins!</h2>
                  {race.photoFinish && <p className="mt-2 text-sm text-cyan-100">Photo finish confirmed by the holo-line.</p>}
                  <div className="mt-4 space-y-2">
                    {race.order.map((state) => (
                      <div key={state.horse.id} className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-100" /> #{state.finishRank} {state.horse.name}</span>
                        <span className="text-white/45">{state.finishProgress.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="flex items-center gap-2 text-sm text-white/65"><CircleDollarSign className="h-4 w-4 text-cyan-100" /> Reward result: {race.reward > 0 ? `+${race.reward} Tech Coin` : "0 Tech Coin"}</p>
                    <p className="mt-3 text-sm leading-6 text-white/55">{race.explanation}</p>
                  </div>
                </div>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
