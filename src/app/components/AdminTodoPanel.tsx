import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { useLanguage } from "../i18n";

type Todo = {
  id: number;
  title: string;
  is_done?: number;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  created_at?: string;
};

export function AdminTodoPanel() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const copy = tr
    ? {
        title: "Admin görev listesi",
        subtitle: "Kısa ekip görevleri. Owner tümünü, adminler kendine açık/atanmış görevleri görür.",
        placeholder: "Yeni görev yaz...",
        add: "Ekle",
        empty: "Görev yok.",
        refresh: "Yenile",
      }
    : {
        title: "Admin todo list",
        subtitle: "Short team tasks. Owner sees all; admins see open or assigned tasks.",
        placeholder: "Write a new task...",
        add: "Add",
        empty: "No tasks.",
        refresh: "Refresh",
      };

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/todos", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Todo alınamadı.");
      setTodos(data?.todos || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Todo alınamadı." });
    } finally {
      setLoading(false);
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const response = await fetch("/api/admin/todos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Görev eklenemedi.");
      setTitle("");
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Görev eklenemedi." });
    }
  };

  const toggle = async (todo: Todo) => {
    try {
      const response = await fetch("/api/admin/todos", {
        method: "PATCH",
        credentials: "same-origin",
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

      {message && <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">{message.text}</div>}

      <form onSubmit={add} className="mt-5 flex gap-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.placeholder} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
        <button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-200">
          <Plus className="h-4 w-4" /> {copy.add}
        </button>
      </form>

      <div className="mt-5 space-y-2">
        {todos.length === 0 && <p className="text-white/45">{copy.empty}</p>}
        {todos.map((todo) => {
          const done = Number(todo.is_done || 0) === 1;
          return (
            <button key={todo.id} type="button" onClick={() => toggle(todo)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-all hover:bg-white/[0.04]">
              {done ? <CheckCircle2 className="h-5 w-5 text-emerald-200" /> : <Circle className="h-5 w-5 text-white/35" />}
              <span className={`flex-1 text-sm ${done ? "text-white/35 line-through" : "text-white/80"}`}>{todo.title}</span>
              {todo.assigned_admin_name && <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-white/35">{todo.assigned_admin_name}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
