import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { useLanguage } from "../i18n";

type User = {
  id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "off" | "client" | "blocked" | string;
  created_at?: string;
};

type ProjectRequest = {
  id: number;
  project_name: string;
  project_type: string;
  budget_range?: string;
  deadline?: string;
  target_date?: string;
  priority?: string;
  description: string;
  status: string;
  created_at?: string;
  user_name: string;
  user_email: string;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  assigned_admin_email?: string | null;
  assigned_admin_avatar_url?: string | null;
  feedback_rating?: number | null;
  feedback_comment?: string | null;
};

type Overview = {
  admin: User;
  stats: {
    totalUsers: number;
    ownerUsers?: number;
    adminUsers: number;
    offUsers?: number;
    clientUsers: number;
    blockedUsers?: number;
    activeSessions: number;
    averageCustomerRating?: number;
    ratedCompletedProjects?: number;
    storageUsedBytes?: number;
    storageMaxBytes?: number;
  };
  recentUsers: User[];
};

const requestStatuses = [
  { value: "received", label: "Talep alındı" },
  { value: "reviewing", label: "İnceleniyor" },
  { value: "offer_ready", label: "Teklif hazırlandı" },
  { value: "waiting_approval", label: "Onay bekliyor" },
  { value: "development_started", label: "Geliştirme başladı" },
  { value: "revision", label: "Revize" },
  { value: "delivered", label: "Teslim edildi" },
  { value: "completed", label: "Tamamlandı" },
  { value: "rejected", label: "Reddedildi" },
];

const legacyStatusLabels: Record<string, string> = {
  new: "Talep alındı",
  reviewed: "İnceleniyor",
  contacted: "Teklif hazırlandı",
  accepted: "Onay bekliyor",
};

const priorityLabels: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

function getStatusLabel(status: string) {
  return requestStatuses.find((item) => item.value === status)?.label || legacyStatusLabels[status] || status;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "A";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

export function AdminPanel() {
  const { language } = useLanguage();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [gateMessage, setGateMessage] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [requestPriorityFilter, setRequestPriorityFilter] = useState("all");

  const isOwner = overview?.admin?.role === "owner";

  const t = useMemo(
    () =>
      language === "tr"
        ? {
            eyebrow: "Yönetici paneli",
            title: "EkaTech kontrol merkezi",
            subtitle: "Kullanıcıları, oturumları ve proje taleplerini tek yerden yönet.",
            totalUsers: "Toplam kullanıcı",
            averageRating: "Ortalama müşteri puanı",
            ratedProjects: "tamamlanan proje puanlandı",
            admins: "Admin",
            offUsers: "OFF",
            clients: "Client",
            activeSessions: "Aktif oturum",
            allUsers: "Kullanıcı yönetimi",
            requests: "Proje talepleri",
            noRequests: "Filtreye uyan proje talebi yok.",
            noUsers: "Filtreye uyan kullanıcı yok.",
            budget: "Bütçe",
            deadline: "Hedef",
            priority: "Öncelik",
            rating: "Puan",
            saved: "Güncellendi.",
            error: "İşlem başarısız.",
            gateTitle: "Admin erişimi gerekli",
            gateSubtitle: "Bu sayfa sadece admin veya owner hesaplarda açılır.",
            signIn: "Giriş yap",
            home: "Ana sayfa",
            unassigned: "Tüm adminlere açık",
            assignedToYou: "Sana atanmış",
            assignedAdmin: "Sorumlu admin",
            protectedOwner: "Korunan owner hesabı",
            userSearch: "İsim veya e-posta ara...",
            projectSearch: "Proje, müşteri veya e-posta ara...",
            roleFilter: "Rol filtresi",
            statusFilter: "Durum filtresi",
            priorityFilter: "Öncelik filtresi",
            all: "Tümü",
          }
        : {
            eyebrow: "Admin panel",
            title: "EkaTech control center",
            subtitle: "Manage users, sessions and project requests from one place.",
            totalUsers: "Total users",
            averageRating: "Average customer rating",
            ratedProjects: "completed projects rated",
            admins: "Admins",
            offUsers: "OFF",
            clients: "Clients",
            activeSessions: "Active sessions",
            allUsers: "User management",
            requests: "Project requests",
            noRequests: "No project requests match the filters.",
            noUsers: "No users match the filters.",
            budget: "Budget",
            deadline: "Target",
            priority: "Priority",
            rating: "Rating",
            saved: "Updated.",
            error: "Action failed.",
            gateTitle: "Admin access required",
            gateSubtitle: "This page opens only for admin or owner accounts.",
            signIn: "Sign in",
            home: "Home",
            unassigned: "Open to all admins",
            assignedToYou: "Assigned to you",
            assignedAdmin: "Assigned admin",
            protectedOwner: "Protected owner account",
            userSearch: "Search name or email...",
            projectSearch: "Search project, client or email...",
            roleFilter: "Role filter",
            statusFilter: "Status filter",
            priorityFilter: "Priority filter",
            all: "All",
          },
    [language]
  );

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !query || `${user.name} ${user.email}`.toLowerCase().includes(query);
      const matchesRole = userRoleFilter === "all" || user.role === userRoleFilter;
      return matchesQuery && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  const filteredRequests = useMemo(() => {
    const query = requestSearch.trim().toLowerCase();
    return requests.filter((request) => {
      const haystack = `${request.project_name} ${request.project_type} ${request.user_name} ${request.user_email}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = requestStatusFilter === "all" || request.status === requestStatusFilter;
      const matchesPriority = requestPriorityFilter === "all" || (request.priority || "normal") === requestPriorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [requests, requestSearch, requestStatusFilter, requestPriorityFilter]);

  const loadAdminData = async () => {
    setLoading(true);
    setStatus(null);
    setGateMessage("");

    try {
      const overviewResponse = await fetch("/api/admin/overview", { credentials: "same-origin" });

      if (overviewResponse.status === 401 || overviewResponse.status === 403) {
        const data = await overviewResponse.json().catch(() => null);
        setVisible(false);
        setGateMessage(data?.error || t.gateSubtitle);
        return;
      }

      if (!overviewResponse.ok) {
        const data = await overviewResponse.json().catch(() => null);
        throw new Error(data?.error || t.error);
      }

      const overviewData = await overviewResponse.json();
      setOverview(overviewData);
      setVisible(true);

      const [usersResponse, requestsResponse] = await Promise.all([
        fetch("/api/admin/users", { credentials: "same-origin" }),
        fetch("/api/admin/project-requests", { credentials: "same-origin" }),
      ]);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setRequests(requestsData.requests || []);
      }
    } catch (error) {
      setVisible(false);
      setGateMessage(error instanceof Error ? error.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const updateRole = async (userId: number, role: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || t.error);

      setStatus({ type: "success", message: data?.message || t.saved });
      await loadAdminData();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : t.error });
    }
  };

  const updateRequestStatus = async (requestId: number, nextStatus: string) => {
    try {
      const response = await fetch("/api/admin/project-requests", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status: nextStatus }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || t.error);

      setStatus({ type: "success", message: data?.message || t.saved });
      await loadAdminData();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : t.error });
    }
  };

  if (!visible && !loading) {
    return (
      <section id="admin" className="relative flex min-h-screen items-center overflow-hidden bg-black px-4 py-24 sm:px-6">
        <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center backdrop-blur-xl sm:p-8">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
            {t.eyebrow}
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">{t.gateTitle}</h1>
          <p className="mt-4 text-white/55">{gateMessage || t.gateSubtitle}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a href="/signin" className="rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200">
              {t.signIn}
            </a>
            <a href="/" className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-medium text-white/80 transition-all hover:bg-white/[0.1]">
              {t.home}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const averageRating = Number(overview?.stats.averageCustomerRating || 0);
  const ratedCompletedProjects = Number(overview?.stats.ratedCompletedProjects || 0);
  const storageUsedGb = (Number(overview?.stats.storageUsedBytes || 0) / 1_000_000_000).toFixed(2);
  const storageMaxGb = (Number(overview?.stats.storageMaxBytes || 8_000_000_000) / 1_000_000_000).toFixed(0);

  return (
    <section id="admin" className="relative overflow-hidden bg-black px-4 py-24 sm:px-6">
      <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-purple-200/20 to-transparent" />
      <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55 }}
          className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
              {t.eyebrow}
            </div>
            <h2 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">{t.title}</h2>
            <p className="text-lg leading-8 text-white/55">{t.subtitle}</p>
            <p className="text-sm text-cyan-100/80">Depolama: {storageUsedGb} GB / {storageMaxGb} GB</p>
          </div>

          <button
            type="button"
            onClick={loadAdminData}
            className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1]"
          >
            Refresh
          </button>
        </motion.div>

        {status && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status.type === "success"
                ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                : "border-red-300/20 bg-red-300/10 text-red-100"
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label={t.totalUsers} value={overview?.stats.totalUsers ?? 0} />
          <StatCard label={t.admins} value={overview?.stats.adminUsers ?? 0} />
          <StatCard label={t.offUsers} value={overview?.stats.offUsers ?? 0} />
          <StatCard label={t.activeSessions} value={overview?.stats.activeSessions ?? 0} />
          <StatCard label={t.averageRating} value={averageRating ? averageRating.toFixed(1) : "-"} suffix={averageRating ? "/5" : ""} note={`${ratedCompletedProjects} ${t.ratedProjects}`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title={t.allUsers}>
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_0.45fr]">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={t.userSearch} className="w-full rounded-2xl border border-white/10 bg-black/35 py-3 pl-11 pr-4 text-white outline-none placeholder:text-white/25" />
              </label>
              <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
                <option value="all">{t.roleFilter}: {t.all}</option>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="off">OFF</option>
                <option value="client">client</option>
                <option value="blocked">blocked</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredUsers.length === 0 && <p className="text-white/45">{t.noUsers}</p>}
              {filteredUsers.map((user) => {
                const targetIsOwner = user.role === "owner";
                const targetIsAdmin = user.role === "admin";
                const canEditTarget = !targetIsOwner && (isOwner || !targetIsAdmin);

                return (
                  <div key={user.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-sm text-white/45">{user.email}</p>
                        {targetIsOwner && <p className="mt-1 text-xs text-purple-100/70">{t.protectedOwner}</p>}
                      </div>
                      <select
                        value={user.role || "client"}
                        onChange={(event) => updateRole(user.id, event.target.value)}
                        disabled={!canEditTarget}
                        className="rounded-full border border-white/10 bg-black px-4 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {targetIsOwner && <option value="owner">owner</option>}
                        <option value="client">client</option>
                        <option value="off">OFF</option>
                        <option value="admin" disabled={!isOwner}>admin</option>
                        <option value="blocked">blocked</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title={t.requests}>
            <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_0.45fr_0.45fr]">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder={t.projectSearch} className="w-full rounded-2xl border border-white/10 bg-black/35 py-3 pl-11 pr-4 text-white outline-none placeholder:text-white/25" />
              </label>
              <select value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
                <option value="all">{t.statusFilter}: {t.all}</option>
                {requestStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={requestPriorityFilter} onChange={(event) => setRequestPriorityFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
                <option value="all">{t.priorityFilter}: {t.all}</option>
                <option value="low">{priorityLabels.low}</option>
                <option value="normal">{priorityLabels.normal}</option>
                <option value="high">{priorityLabels.high}</option>
                <option value="urgent">{priorityLabels.urgent}</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredRequests.length === 0 && <p className="text-white/45">{t.noRequests}</p>}
              {filteredRequests.map((request) => {
                const isAssigned = Boolean(request.assigned_admin_id);

                return (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-white/35">{request.project_type}</p>
                          <h3 className="mt-1 text-xl font-medium text-white">{request.project_name}</h3>
                        </div>
                        <p className="text-sm text-white/45">
                          {request.user_name} · {request.user_email}
                        </p>
                        <p className="text-sm leading-6 text-white/60">{request.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-white/45">
                          {request.budget_range && <span className="rounded-full bg-white/[0.06] px-3 py-1">{t.budget}: {request.budget_range}</span>}
                          {(request.target_date || request.deadline) && <span className="rounded-full bg-white/[0.06] px-3 py-1">{t.deadline}: {request.target_date || request.deadline}</span>}
                          <span className="rounded-full bg-white/[0.06] px-3 py-1">{t.priority}: {priorityLabels[request.priority || "normal"] || request.priority}</span>
                          {request.feedback_rating && <span className="rounded-full bg-amber-200/10 px-3 py-1 text-amber-100">{t.rating}: {request.feedback_rating}/5</span>}
                          <span className="rounded-full bg-white/[0.06] px-3 py-1">Durum: {getStatusLabel(request.status)}</span>
                          <span className={`rounded-full px-3 py-1 ${isAssigned ? "bg-purple-300/15 text-purple-100" : "bg-cyan-300/10 text-cyan-100"}`}>
                            {isAssigned ? t.assignedToYou : t.unassigned}
                          </span>
                        </div>

                        {isAssigned && (
                          <div className="inline-flex items-center gap-3 rounded-2xl border border-purple-300/20 bg-purple-300/[0.08] p-3">
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-white/15 bg-white text-black">
                              {request.assigned_admin_avatar_url ? (
                                <img src={request.assigned_admin_avatar_url} alt="Admin" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                                  {getInitials(request.assigned_admin_name, request.assigned_admin_email)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-white/35">{t.assignedAdmin}</p>
                              <p className="text-sm font-medium text-white">{request.assigned_admin_name || "Admin"}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <select
                        value={request.status}
                        onChange={(event) => updateRequestStatus(request.id, event.target.value)}
                        className="rounded-full border border-white/10 bg-black px-4 py-2 text-sm text-white outline-none"
                      >
                        {requestStatuses.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, suffix = "", note = "" }: { label: string; value: number | string; suffix?: string; note?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-3 text-4xl font-medium text-white">{value}<span className="text-xl text-white/45">{suffix}</span></p>
      {note && <p className="mt-2 text-xs text-white/35">{note}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <h3 className="mb-5 text-2xl font-medium text-white">{title}</h3>
      {children}
    </div>
  );
}
