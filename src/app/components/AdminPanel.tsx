import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n";
import { AdminOffCredits } from "./AdminOffCredits";
import { AdminUserActivity } from "./AdminUserActivity";
import { AdminBotProfiles } from "./AdminBotProfiles";
import { AdminApprovalCenter } from "./AdminApprovalCenter";
import { AdminStockSubmissions } from "./AdminStockSubmissions";
import { MaintenancePanel } from "./MaintenancePanel";
import { AdminTodoPanel } from "./AdminTodoPanel";
import { AdminProjectTools } from "./AdminProjectTools";
import { AdminChat } from "./AdminChat";
import { AnnouncementAdmin } from "./AnnouncementAdmin";
import { AdminAuditLogs } from "./AdminAuditLogs";
import { AdminSeasonEngine } from "./AdminSeasonEngine";

export function AdminPanel() {
  const { language } = useLanguage();
  const [overview, setOverview] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const tr = language === "tr";
  const tabs = useMemo(() => [
    ["overview", tr ? "Genel Bakış" : "Overview"],
    ["users", tr ? "Kullanıcılar" : "Users"],
    ["projects", tr ? "Projeler & Müşteri" : "Projects & Client"],
    ["off", tr ? "OFF Yönetimi" : "OFF Management"],
    ["site", tr ? "Site Yönetimi" : "Site Management"],
    ["maintenance", tr ? "Sistem & Bakım" : "System & Maintenance"],
  ], [tr]);

  useEffect(() => { (async () => {
    const r = await fetch('/api/admin/overview', { credentials: 'same-origin' });
    if (!r.ok) { setVisible(false); setLoading(false); return; }
    setOverview(await r.json()); setVisible(true); setLoading(false);
  })(); }, []);

  if (!visible && !loading) return <section className="min-h-screen bg-black px-4 py-24 text-white">Admin access required.</section>;

  return <section className="bg-black px-4 py-24 sm:px-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-4xl text-white">EkaTech Admin Control Center</h1>
      <div className="flex flex-wrap gap-2">{tabs.map(([k,l]) => <button key={k} onClick={() => setTab(String(k))} className={`rounded-full px-4 py-2 text-sm border ${tab===k? 'border-cyan-200/50 bg-cyan-300/20 text-white':'border-white/10 bg-white/5 text-white/70'}`}>{l}</button>)}</div>

      {tab === 'overview' && <div className="grid gap-4 md:grid-cols-4">{[['Total',overview?.stats?.totalUsers||0],['Admin',overview?.stats?.adminUsers||0],['OFF',overview?.stats?.offUsers||0],['Sessions',overview?.stats?.activeSessions||0]].map((s:any)=><div key={s[0]} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white"><p className="text-sm text-white/60">{s[0]}</p><p className="text-3xl">{s[1]}</p></div>)}</div>}
      {tab === 'users' && <div className="space-y-6"><AdminUserActivity /><AdminApprovalCenter /><AdminBotProfiles /></div>}
      {tab === 'projects' && <div className="space-y-6"><AdminProjectTools /><AdminChat /><AdminStockSubmissions /></div>}
      {tab === 'off' && <div className="space-y-6"><AdminSeasonEngine /><AdminOffCredits /></div>}
      {tab === 'site' && <AnnouncementAdmin />}
      {tab === 'maintenance' && <div className="space-y-6"><MaintenancePanel /><AdminTodoPanel /><AdminAuditLogs /></div>}
    </div>
  </section>;
}
