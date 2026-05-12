import { useEffect, useState } from "react";
import { useLanguage } from "../i18n";

type AdminAvatar = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  avatar_approved?: number;
  created_at?: string;
};

function getInitials(name?: string, email?: string) {
  const source = name || email || "A";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

export function AdminAvatarApprovals() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [admins, setAdmins] = useState<AdminAvatar[]>([]);
  const [loading, setLoading] = useState(false);
  const [ownerOnlyVisible, setOwnerOnlyVisible] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = tr
    ? {
        title: "Admin profil fotoğrafı onayları",
        subtitle: "Adminler sipariş yönetebilmek için profil fotoğrafı yüklemeli ve owner onayı almalıdır. Reddedilen fotoğraf silinir; admin yeniden yükleme yapar.",
        approved: "Onaylı",
        pending: "Onay bekliyor",
        noPhoto: "Fotoğraf yok",
        approve: "Onayla",
        reject: "Reddet",
        refresh: "Yenile",
        empty: "Onaylanacak admin bulunamadı.",
        error: "Profil fotoğrafları alınamadı.",
      }
    : {
        title: "Admin profile photo approvals",
        subtitle: "Admins must upload a profile photo and receive owner approval before managing orders. Rejected photos are removed, forcing a re-upload.",
        approved: "Approved",
        pending: "Pending approval",
        noPhoto: "No photo",
        approve: "Approve",
        reject: "Reject",
        refresh: "Refresh",
        empty: "No admins to review.",
        error: "Could not load profile photos.",
      };

  const loadAdmins = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/avatar-approval", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        setOwnerOnlyVisible(false);
        return;
      }

      if (!response.ok) throw new Error(data?.error || copy.error);
      setOwnerOnlyVisible(true);
      setAdmins(data?.admins || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  };

  const updateApproval = async (userId: number, action: "approve" | "reject") => {
    setMessage(null);

    try {
      const response = await fetch("/api/admin/avatar-approval", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.error || copy.error);
      setMessage({ type: "success", text: data?.message || (action === "approve" ? copy.approved : copy.pending) });
      await loadAdmins();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    }
  };

  useEffect(() => {
    loadAdmins();
  }, [language]);

  if (!ownerOnlyVisible) return null;

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-medium text-white">{copy.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadAdmins}
          disabled={loading}
          className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1] disabled:opacity-60"
        >
          {loading ? "..." : copy.refresh}
        </button>
      </div>

      {message && (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {message.text}
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {admins.length === 0 && <p className="text-white/45">{copy.empty}</p>}
        {admins.map((admin) => {
          const approved = Number(admin.avatar_approved || 0) === 1;
          const hasPhoto = Boolean(admin.avatar_url);

          return (
            <div key={admin.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-white text-black">
                  {hasPhoto ? (
                    <img src={admin.avatar_url} alt="Admin profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                      {getInitials(admin.name, admin.email)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{admin.name}</p>
                  <p className="truncate text-sm text-white/45">{admin.email}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 ${approved ? "bg-emerald-300/10 text-emerald-100" : "bg-amber-300/10 text-amber-100"}`}>
                  {approved ? copy.approved : copy.pending}
                </span>
                {!hasPhoto && <span className="rounded-full bg-red-300/10 px-3 py-1 text-red-100">{copy.noPhoto}</span>}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateApproval(admin.id, "approve")}
                  disabled={!hasPhoto || approved}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.approve}
                </button>
                <button
                  type="button"
                  onClick={() => updateApproval(admin.id, "reject")}
                  disabled={!hasPhoto}
                  className="rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-medium text-red-100 transition-all hover:bg-red-300/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.reject}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
