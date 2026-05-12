import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n";

type AuditLog = {
  id: number;
  actor_user_id?: number | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: number | null;
  target_label?: string | null;
  details?: string | null;
  created_at?: string | null;
};

const actionLabelsTr: Record<string, string> = {
  profile_photo_updated: "Profil fotoğrafı güncellendi",
  profile_photo_removed: "Profil fotoğrafı kaldırıldı",
  admin_avatar_uploaded_pending: "Admin fotoğrafı onay bekliyor",
  admin_avatar_approved: "Admin fotoğrafı onaylandı",
  admin_avatar_rejected: "Admin fotoğrafı reddedildi",
  project_request_created: "Proje talebi oluşturuldu",
  project_status_updated: "Proje durumu güncellendi",
  user_role_changed: "Kullanıcı rolü değiştirildi",
  announcement_created: "Duyuru oluşturuldu",
  announcement_enabled: "Duyuru aktif edildi",
  announcement_disabled: "Duyuru pasif edildi",
};

const actionLabelsEn: Record<string, string> = {
  profile_photo_updated: "Profile photo updated",
  profile_photo_removed: "Profile photo removed",
  admin_avatar_uploaded_pending: "Admin photo pending approval",
  admin_avatar_approved: "Admin photo approved",
  admin_avatar_rejected: "Admin photo rejected",
  project_request_created: "Project request created",
  project_status_updated: "Project status updated",
  user_role_changed: "User role changed",
  announcement_created: "Announcement created",
  announcement_enabled: "Announcement enabled",
  announcement_disabled: "Announcement disabled",
};

function formatDate(value?: string | null, tr = true) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(tr ? "tr-TR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionTone(action: string) {
  if (action.includes("rejected") || action.includes("disabled") || action.includes("removed")) {
    return "border-red-300/20 bg-red-300/10 text-red-100";
  }

  if (action.includes("approved") || action.includes("created") || action.includes("enabled")) {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  }

  if (action.includes("updated") || action.includes("changed")) {
    return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
  }

  return "border-white/10 bg-white/[0.06] text-white/70";
}

export function AdminAuditLogs() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Önemli işlem kayıtları",
            subtitle: "Giriş-çıkış gibi küçük hareketler değil; profil fotoğrafı, proje, rol ve duyuru gibi önemli yönetim olayları burada görünür.",
            refresh: "Yenile",
            empty: "Henüz önemli işlem kaydı yok.",
            error: "Log kayıtları alınamadı.",
            actor: "İşlemi yapan",
            target: "Hedef",
            date: "Tarih",
            system: "Sistem",
          }
        : {
            title: "Important activity logs",
            subtitle: "Only important management events are listed here: profile photos, projects, roles and announcements. Routine sign-in/out is not logged.",
            refresh: "Refresh",
            empty: "No important activity logs yet.",
            error: "Could not load logs.",
            actor: "Actor",
            target: "Target",
            date: "Date",
            system: "System",
          },
    [tr]
  );

  const actionLabels = tr ? actionLabelsTr : actionLabelsEn;

  const loadLogs = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/audit-logs?limit=80", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.error || copy.error);
      setLogs(data?.logs || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [language]);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-medium text-white">{copy.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1] disabled:opacity-60"
        >
          {loading ? "..." : copy.refresh}
        </button>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          {message.text}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {logs.length === 0 && !message && <p className="text-white/45">{copy.empty}</p>}
        {logs.map((log) => (
          <div key={log.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getActionTone(log.action)}`}>
                    {actionLabels[log.action] || log.action}
                  </span>
                  {log.actor_role && <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/45">{log.actor_role}</span>}
                </div>
                <p className="text-sm leading-6 text-white/65">{log.details || actionLabels[log.action] || log.action}</p>
                <div className="flex flex-wrap gap-2 text-xs text-white/40">
                  <span>{copy.actor}: {log.actor_name || log.actor_email || copy.system}</span>
                  {log.target_label && <span>{copy.target}: {log.target_label}</span>}
                  {log.target_type && <span>{log.target_type}{log.target_id ? ` #${log.target_id}` : ""}</span>}
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45">
                {copy.date}: {formatDate(log.created_at, tr)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
