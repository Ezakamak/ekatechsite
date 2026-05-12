import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../i18n";

type Todo = {
  id: number;
  title: string;
  is_done?: number;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  created_by_name?: string | null;
  created_at?: string;
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

export function AdminTodoPanel() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("shared");
  const [filter, setFilter] = useState("open");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const copy = tr
    ? {
        title: "Admin görev listesi",
        subtitle: "Ortak veya kendine atanmış ekip görevleri. Owner tüm görevleri görür.",
        placeholder: "Yeni görev yaz...",
        add: "Ekle",
        empty: "Görev yok.",
        refresh: "Yenile",
        shared: "Ortak görev",
        me: "Bana ata",
        open: "Açık",
        done: "Tamamlanan",
        all: "Tümü",
        createdBy: "Ekleyen",
        assignedTo: "Atanan",
        deleted: "Görev silindi.",
      }
    : {
        title: "Admin todo list",
        subtitle: "Shared or assigned team tasks. Owner sees all tasks.",
        placeholder: "Write a new task...",
        add: "Add",
        empty: "No tasks.",
        refresh: "Refresh",
        shared: "Shared task",
        me: "Assign to me",
        open: "Open",
        done: "Done",
        all: "All",
        createdBy: "Created by",
        assignedTo: "Assigned to",
        deleted: "Task deleted.",
      };

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const done = Number(todo.is_done || 0) === 1;
      if (filter === "open") return !done;
      if (filter === "done") return done;
      return true;
    });
  }, [todos, filter]);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/todos", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Todo alınamadı.");
      setTodos(data?.todos || []);
      setCurrentUser(data?.currentUser || null);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Todo alınamadı." });
    } finally {
      setLoading(false);
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;

    setMessage(null);
    try {
      const response = await fetch("/api/admin/todos", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle, assignedAdminId: assignee }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Görev eklenemedi.");
      setTitle("");
      setMessage({ type: "success", text: data?.message || copy.add });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Görev eklenemedi." });
    }
  };

  const toggle = async (todo: Todo) => {
    setMessage(null);
    try {
      const response = await fetch("/api/admin/todos", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: todo.id, is_done: Number(todo.is_done || 0) ? 0 : 1 }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Görev güncellenemedi.");
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Görev güncellenemedi." });
    }
  };

  const remove = async (todo: Todo) => {
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/todos?id=${todo.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Görev silinemedi.");
      setMessage({ type: "success", text: data?.message || copy.deleted });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Görev silinemedi." });
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-medium text-white">{copy.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button type="button" onClick={load} className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1]">
          {loading ? "..." : copy.refresh}
        </button>
      </div>

      {message && <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{message.text}</div>}

      <form onSubmit={add} className="mt-5 grid gap-2 sm:grid-cols-[1fr_0.35fr_auto]">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.placeholder} className="min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
          <option value="shared">{copy.shared}</option>
          <option value="me">{copy.me}</option>
        </select>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-200">
          <Plus className="h-4 w-4" /> {copy.add}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          ["open", copy.open],
          ["done", copy.done],
          ["all", copy.all],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs transition-all ${filter === value ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {filteredTodos.length === 0 && <p className="text-white/45">{copy.empty}</p>}
        {filteredTodos.map((todo) => {
          const done = Number(todo.is_done || 0) === 1;
          const assignedLabel = todo.assigned_admin_name || (todo.assigned_admin_id ? `#${todo.assigned_admin_id}` : copy.shared);
          return (
            <div key={todo.id} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-all hover:bg-white/[0.04]">
              <button type="button" onClick={() => toggle(todo)} className="shrink-0 text-left">
                {done ? <CheckCircle2 className="h-5 w-5 text-emerald-200" /> : <Circle className="h-5 w-5 text-white/35" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${done ? "text-white/35 line-through" : "text-white/80"}`}>{todo.title}</p>
                <p className="mt-1 text-xs text-white/30">
                  {copy.assignedTo}: {assignedLabel}{todo.created_by_name ? ` · ${copy.createdBy}: ${todo.created_by_name}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => remove(todo)} className="rounded-full border border-red-300/20 bg-red-300/10 p-2 text-red-100/70 transition-all hover:text-red-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
