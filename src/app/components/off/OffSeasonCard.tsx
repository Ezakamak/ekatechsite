import { useEffect, useMemo, useState } from "react";
import { OffPanel, StatTile } from "./offUi";

export function OffSeasonCard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { let on = true; fetch("/api/off-seasons", { credentials: "same-origin", cache: "no-store" }).then(r => r.json()).then(d => { if (on) setData(d); }).catch(() => {}); return () => { on = false; }; }, []);
  const season = data?.activeSeason;
  const percent = useMemo(() => {
    if (!season) return 0;
    const start = new Date(season.starts_at).getTime(), end = new Date(season.ends_at).getTime(), now = Date.now();
    return Math.max(0, Math.min(100, ((now - start) / Math.max(1, end - start)) * 100));
  }, [season]);
  const left = season ? Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000)) : 0;
  return <OffPanel title={season?.name_tr || "OFF Sezonu"} eyebrow="Active Season">
    <div className="grid gap-3 sm:grid-cols-3"><StatTile label="Sezon XP" value={data?.userSeasonXp || 0} tone="cyan" /><StatTile label="Sıra" value={data?.userRank ? `#${data.userRank}` : "-"} tone="purple" /><StatTile label="Kalan" value={`${left} gün`} tone="amber" /></div>
    <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10"><div className="h-full rounded-full bg-gradient-to-r from-purple-400 via-cyan-300 to-amber-300" style={{ width: `${percent}%` }} /></div>
  </OffPanel>;
}
