import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "client" | "blocked" | string;
  created_at?: string;
};

type ProjectRequest = {
  id: number;
  project_name: string;
  project_type: string;
  budget_range?: string;
  deadline?: string;
  description: string;
  status: string;
  created_at?: string;
  user_name: string;
  user_email: string;
};

type Overview = {
  admin: User;
  stats: {
    totalUsers: number;
    adminUsers: number;
    clientUsers: number;
    activeSessions: number;
  };
  recentUsers: User[];
};

const requestStatuses = ["new", "reviewed", "contacted", "accepted", "rejected"];

export function AdminPanel() {
  const { language } = useLanguage();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [gateMessage, setGateMessage] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const t = useMemo(
    () =>
      language === "tr"
        ? {
            eyebrow: "Yönetici paneli",
            title: "EkaTech kontrol merkezi",
            subtitle: "Kullanıcıları, oturumları ve proje taleplerini tek yerden yönet.",
            totalUsers: "Toplam kullanıcı",
            admins: "Admin",
            clients: "Client",
            activeSessions: "Aktif oturum",
            recentUsers: "Son kullanıcılar",
            allUsers: "Kullanıcı yönetimi",
            requests: "Proje talepleri",
            noRequests: "Henüz proje talebi yok.",
            role: "Rol",
            email: "E-posta",
            user: "Kullanıcı",
            created: "Tarih",
            project: "Proje",
            type: "Tür",
            budget: "Bütçe",
            deadline: "Deadline",
            requestStatus: "Durum",
            saved: "Güncellendi.",
            error: "İşlem başarısız.",
            gateTitle: "Admin erişimi gerekli",
            gateSubtitle: "Bu sayfa sadece role değeri admin olan hesaplarda açılır.",
            signIn: "Giriş yap",
            home: "Ana sayfa",
          }
        : {
            eyebrow: "Admin panel",
            title: "EkaTech control center",
            subtitle: "Manage users, sessions and project requests from one place.",
            totalUsers: "Total users",
            admins: "Admins",
            clients: "Clients",
            activeSessions: "Active sessions",
            recentUsers: "Recent users",
            allUsers: "User management",
            requests: "Project requests",
            noRequests: "No project requests yet.",
            role: "Role",
            email: "Email",
            user: "User",
            created: "Date",
            project: "Project",
            type: "Type",
            budget: "Budget",
            deadline: "Deadline",
            requestStatus: "Status",
            saved: "Updated.",
            error: "Action failed.",
            gateTitle: "Admin access required",
            gateSubtitle: "This page opens only for accounts whose role value is admin.",
            signIn: "Sign in",
            home: "Home",
          },
    [language]
  );

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

      setStatus({ type: "success", message: t.saved });
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

      if (!response.ok) throw new Error(t.error);

      setStatus({ type: "success", message: t.saved });
      await loadAdminData();
    } catch {
      setStatus({ type: "error", message: t.error });
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t.totalUsers} value={overview?.stats.totalUsers ?? 0} />
          <StatCard label={t.admins} value={overview?.stats.adminUsers ?? 0} />
          <StatCard label={t.clients} value={overview?.stats.clientUsers ?? 0} />
          <StatCard label={t.activeSessions} value={overview?.stats.activeSessions ?? 0} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title={t.allUsers}>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-sm text-white/45">{user.email}</p>
                    </div>
                    <select
                      value={user.role || "client"}
                      onChange={(event) => updateRole(user.id, event.target.value)}
                      className="rounded-full border border-white/10 bg-black px-4 py-2 text-sm text-white outline-none"
                    >
                      <option value="client">client</option>
                      <option value="admin">admin</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t.requests}>
            <div className="space-y-3">
              {requests.length === 0 && <p className="text-white/45">{t.noRequests}</p>}
              {requests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
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
                        {request.deadline && <span className="rounded-full bg-white/[0.06] px-3 py-1">{t.deadline}: {request.deadline}</span>}
                      </div>
                    </div>

                    <select
                      value={request.status}
                      onChange={(event) => updateRequestStatus(request.id, event.target.value)}
                      className="rounded-full border border-white/10 bg-black px-4 py-2 text-sm text-white outline-none"
                    >
                      {requestStatuses.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-3 text-4xl font-medium text-white">{value}</p>
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
