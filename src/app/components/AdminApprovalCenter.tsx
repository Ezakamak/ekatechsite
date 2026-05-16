import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Image,
  RefreshCcw,
  UserRound,
  XCircle,
} from "lucide-react";
import { useLanguage } from "../i18n";

type ApprovalTab = "adminPhotos" | "userPhotos";

type AvatarApproval = {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
  avatar_approved?: number;
  created_at?: string;
};

function getInitials(name?: string, email?: string) {
  const source = name || email || "U";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export function AdminApprovalCenter() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Onay Merkezi",
            subtitle:
              "Admin profil fotoğrafları ve kullanıcı profil fotoğrafları tek yerden yönetilir. Hisse yorumları artık onaysız yayımlanır.",
            adminPhotos: "Admin fotoğrafları",
            userPhotos: "Kullanıcı fotoğrafları",
            pending: "Bekleyen",
            approved: "Onaylı",
            rejected: "Reddedilen",
            all: "Tümü",
            refresh: "Yenile",
            approve: "Onayla",
            reject: "Reddet",
            emptyComments: "Bu filtrede yorum yok.",
            emptyPhotos: "Bu filtrede onay bekleyen fotoğraf yok.",
            commentError: "Yorum listesi alınamadı.",
            photoError: "Fotoğraf onay listesi alınamadı.",
            saved: "Güncellendi.",
            user: "Kullanıcı",
            reviewedBy: "İnceleyen",
            ownerOnly: "Fotoğraf onayları sadece owner hesabına görünür.",
            adminPhotoNote:
              "Admin fotoğrafı onaylanmazsa admin sipariş yönetemez.",
            userPhotoNote:
              "Kullanıcı fotoğrafı onaylanmadan genel alanlarda gösterilmez.",
          }
        : {
            title: "Approval Center",
            subtitle:
              "Manage admin and user profile photos from one place. Stock comments now publish without approval.",
            adminPhotos: "Admin photos",
            userPhotos: "User photos",
            pending: "Pending",
            approved: "Approved",
            rejected: "Rejected",
            all: "All",
            refresh: "Refresh",
            approve: "Approve",
            reject: "Reject",
            emptyComments: "No comments match this filter.",
            emptyPhotos: "No pending photos match this filter.",
            commentError: "Could not load comments.",
            photoError: "Could not load photo approvals.",
            saved: "Updated.",
            user: "User",
            reviewedBy: "Reviewed by",
            ownerOnly: "Photo approvals are visible only to the owner account.",
            adminPhotoNote:
              "Admins cannot manage orders until their photo is approved.",
            userPhotoNote: "User photos are not shown publicly until approved.",
          },
    [tr],
  );

  const [activeTab, setActiveTab] = useState<ApprovalTab>("adminPhotos");
  const [avatars, setAvatars] = useState<AvatarApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoAccess, setPhotoAccess] = useState(true);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const tabs = [
    {
      value: "adminPhotos" as const,
      label: copy.adminPhotos,
      icon: <Image className="h-4 w-4" />,
    },
    {
      value: "userPhotos" as const,
      label: copy.userPhotos,
      icon: <UserRound className="h-4 w-4" />,
    },
  ];

  useEffect(() => {
    loadAvatars(activeTab === "adminPhotos" ? "admin" : "user");
  }, [activeTab, language]);

  async function loadCurrent() {
    await loadAvatars(activeTab === "adminPhotos" ? "admin" : "user");
  }

  async function loadAvatars(type: "admin" | "user") {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/avatar-approval?type=${type}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        setPhotoAccess(false);
        setAvatars([]);
        return;
      }
      if (!response.ok) throw new Error(data?.error || copy.photoError);
      setPhotoAccess(true);
      setAvatars(
        Array.isArray(data?.avatars)
          ? data.avatars
          : Array.isArray(data?.admins)
            ? data.admins
            : [],
      );
    } catch (error) {
      setAvatars([]);
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : copy.photoError,
      });
    } finally {
      setLoading(false);
    }
  }

  async function moderateAvatar(userId: number, action: "approve" | "reject") {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/avatar-approval", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.photoError);
      setStatus({ type: "success", message: data?.message || copy.saved });
      await loadAvatars(activeTab === "adminPhotos" ? "admin" : "user");
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : copy.photoError,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 text-white backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <CheckCircle2 className="h-4 w-4" /> {copy.title}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">
            {copy.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={loadCurrent}
          disabled={loading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
        >
          <RefreshCcw className="h-4 w-4" /> {loading ? "..." : copy.refresh}
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${activeTab === tab.value ? "border-white/25 bg-white text-black" : "border-white/10 bg-black/25 text-white/55 hover:bg-white/[0.08] hover:text-white"}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {!photoAccess ? (
        <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
          {copy.ownerOnly}
        </div>
      ) : (
        <AvatarModerationGrid
          avatars={avatars}
          copy={copy}
          loading={loading}
          isAdminTab={activeTab === "adminPhotos"}
          onModerate={moderateAvatar}
        />
      )}
    </section>
  );
}

function AvatarModerationGrid({
  avatars,
  copy,
  loading,
  isAdminTab,
  onModerate,
}: {
  avatars: AvatarApproval[];
  copy: any;
  loading: boolean;
  isAdminTab: boolean;
  onModerate: (userId: number, action: "approve" | "reject") => void;
}) {
  return (
    <div className="mt-5">
      <p className="mb-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/45">
        {isAdminTab ? copy.adminPhotoNote : copy.userPhotoNote}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {avatars.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-white/45">
            {copy.emptyPhotos}
          </p>
        ) : (
          avatars.map((avatar) => {
            const hasPhoto = Boolean(avatar.avatar_url);
            return (
              <article
                key={avatar.id}
                className="rounded-3xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white text-black">
                    {hasPhoto ? (
                      <img
                        src={avatar.avatar_url}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                        {getInitials(avatar.name, avatar.email)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {avatar.name}
                    </p>
                    <p className="truncate text-sm text-white/45">
                      {avatar.email}
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/60">
                      {avatar.role || "client"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onModerate(avatar.id, "approve")}
                    disabled={loading || !hasPhoto}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {copy.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => onModerate(avatar.id, "reject")}
                    disabled={loading || !hasPhoto}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-medium text-red-100 transition-all hover:bg-red-300/15 disabled:opacity-40"
                  >
                    <XCircle className="h-4 w-4" /> {copy.reject}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
