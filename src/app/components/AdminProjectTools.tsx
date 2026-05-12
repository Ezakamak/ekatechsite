import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, LinkIcon, MessageSquare, Search, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "../i18n";

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
  user_name: string;
  user_email: string;
  feedback_rating?: number | null;
  feedback_comment?: string | null;
};

type ProjectMessage = {
  id: number;
  message: string;
  sender_name: string;
  sender_role: string;
  created_at?: string;
};

type ProjectLink = {
  id: number;
  label: string;
  url: string;
};

const priorityOptions = ["low", "normal", "high", "urgent"];
const statusOptions = ["all", "received", "reviewing", "offer_ready", "waiting_approval", "development_started", "revision", "delivered", "completed", "rejected"];

function priorityLabel(value: string, tr: boolean) {
  const labels: Record<string, string> = tr
    ? { low: "Düşük", normal: "Normal", high: "Yüksek", urgent: "Acil" }
    : { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
  return labels[value] || value;
}

export function AdminProjectTools() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [projects, setProjects] = useState<ProjectRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [priority, setPriority] = useState("normal");
  const [targetDate, setTargetDate] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = tr
    ? {
        title: "Gelişmiş proje yönetimi",
        subtitle: "Proje ara/filtrele, müşteriye proje mesajı gönder, link ekle, öncelik ve hedef tarihi ayarla.",
        search: "Proje, müşteri veya e-posta ara...",
        status: "Durum",
        priority: "Öncelik",
        all: "Tümü",
        targetDate: "Hedef tarih",
        savePlan: "Planı kaydet",
        message: "Müşteriye mesaj",
        send: "Gönder",
        linkLabel: "Link başlığı",
        linkUrl: "https://...",
        addLink: "Link ekle",
        messages: "Mesajlar",
        links: "Linkler",
        feedback: "Müşteri puanı",
        selectProject: "Bir proje seç",
        refresh: "Yenile",
      }
    : {
        title: "Advanced project management",
        subtitle: "Search/filter projects, send client messages, add links, set priority and target dates.",
        search: "Search project, client or email...",
        status: "Status",
        priority: "Priority",
        all: "All",
        targetDate: "Target date",
        savePlan: "Save plan",
        message: "Message to client",
        send: "Send",
        linkLabel: "Link label",
        linkUrl: "https://...",
        addLink: "Add link",
        messages: "Messages",
        links: "Links",
        feedback: "Customer rating",
        selectProject: "Select a project",
        refresh: "Refresh",
      };

  const selectedProject = projects.find((item) => item.id === selectedId) || null;

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch = !query || [project.project_name, project.project_type, project.user_name, project.user_email].join(" ").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || (project.priority || "normal") === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [projects, search, statusFilter, priorityFilter]);

  const loadProjects = async () => {
    setNotice(null);
    try {
      const response = await fetch("/api/admin/project-requests", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Projects failed");
      setProjects(data?.requests || []);
      if (!selectedId && data?.requests?.[0]?.id) setSelectedId(data.requests[0].id);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Projects failed" });
    }
  };

  const loadTools = async (projectId: number) => {
    try {
      const response = await fetch(`/api/admin/project-tools?projectId=${projectId}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Tools failed");
      setMessages(data?.messages || []);
      setLinks(data?.links || []);
    } catch {
      setMessages([]);
      setLinks([]);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setPriority(selectedProject.priority || "normal");
    setTargetDate(selectedProject.target_date || selectedProject.deadline || "");
    loadTools(selectedProject.id);
  }, [selectedId, projects.length]);

  const saveMeta = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject) return;
    await sendAction({ action: "meta", projectId: selectedProject.id, priority, targetDate });
  };

  const sendCustomerMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !customerMessage.trim()) return;
    const ok = await sendAction({ action: "message", projectId: selectedProject.id, message: customerMessage.trim() });
    if (ok) setCustomerMessage("");
  };

  const addLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !linkLabel.trim() || !linkUrl.trim()) return;
    const ok = await sendAction({ action: "link", projectId: selectedProject.id, label: linkLabel.trim(), url: linkUrl.trim() });
    if (ok) {
      setLinkLabel("");
      setLinkUrl("");
    }
  };

  const sendAction = async (payload: Record<string, unknown>) => {
    setNotice(null);
    try {
      const response = await fetch("/api/admin/project-tools", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Action failed");
      setNotice({ type: "success", text: data?.message || "OK" });
      await loadProjects();
      if (selectedProject) await loadTools(selectedProject.id);
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Action failed" });
      return false;
    }
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-medium text-white"><SlidersHorizontal className="h-5 w-5" /> {copy.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button type="button" onClick={loadProjects} className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1]">{copy.refresh}</button>
      </div>

      {notice && <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.5fr_0.5fr]">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} className="w-full rounded-2xl border border-white/10 bg-black/35 py-3 pl-11 pr-4 text-white outline-none placeholder:text-white/25" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
          <option value="all">{copy.status}: {copy.all}</option>
          {statusOptions.filter((value) => value !== "all").map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
          <option value="all">{copy.priority}: {copy.all}</option>
          {priorityOptions.map((value) => <option key={value} value={value}>{priorityLabel(value, tr)}</option>)}
        </select>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="max-h-[560px] space-y-2 overflow-y-auto rounded-3xl border border-white/10 bg-black/25 p-3">
          {filteredProjects.map((project) => (
            <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${selectedId === project.id ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{project.project_name}</p>
                  <p className="mt-1 truncate text-xs text-white/45">{project.user_name} · {project.user_email}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-white/45">{priorityLabel(project.priority || "normal", tr)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
          {!selectedProject ? (
            <p className="text-white/45">{copy.selectProject}</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">{selectedProject.project_type}</p>
                <h4 className="mt-1 text-2xl font-medium text-white">{selectedProject.project_name}</h4>
                <p className="mt-2 text-sm text-white/45">{selectedProject.description}</p>
                {selectedProject.feedback_rating && <p className="mt-2 text-sm text-amber-100">{copy.feedback}: {selectedProject.feedback_rating}/5 {selectedProject.feedback_comment ? `· ${selectedProject.feedback_comment}` : ""}</p>}
              </div>

              <form onSubmit={saveMeta} className="grid gap-3 sm:grid-cols-[0.6fr_1fr_auto]">
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
                  {priorityOptions.map((value) => <option key={value} value={value}>{priorityLabel(value, tr)}</option>)}
                </select>
                <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none" />
                <button type="submit" className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.savePlan}</button>
              </form>

              <form onSubmit={sendCustomerMessage} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <h5 className="mb-3 flex items-center gap-2 font-medium text-white"><MessageSquare className="h-4 w-4" /> {copy.message}</h5>
                <textarea value={customerMessage} onChange={(event) => setCustomerMessage(event.target.value.slice(0, 1200))} rows={3} className="w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
                <button type="submit" className="mt-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.send}</button>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-white/65">{copy.messages}</p>
                  {messages.map((item) => <div key={item.id} className="rounded-xl bg-black/30 p-3 text-sm text-white/65"><span className="text-white/35">{item.sender_name}: </span>{item.message}</div>)}
                </div>
              </form>

              <form onSubmit={addLink} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <h5 className="mb-3 flex items-center gap-2 font-medium text-white"><LinkIcon className="h-4 w-4" /> {copy.links}</h5>
                <div className="grid gap-3 sm:grid-cols-[0.7fr_1fr_auto]">
                  <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder={copy.linkLabel} className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
                  <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder={copy.linkUrl} className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
                  <button type="submit" className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.addLink}</button>
                </div>
                <div className="mt-4 space-y-2">
                  {links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-sm text-white/65 hover:bg-white/[0.05]"><span>{link.label}</span><ExternalLink className="h-4 w-4" /></a>)}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
