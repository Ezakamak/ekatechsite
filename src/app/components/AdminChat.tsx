import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n";

type ChatMessage = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_avatar_url?: string;
  user_role?: string;
  message: string;
  created_at?: string;
};

type CurrentUser = {
  id: number;
  role?: string;
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

function formatTime(value?: string, tr = true) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" });
}

export function AdminChat() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Admin ortak chat",
            subtitle: "Owner ve adminlerin hızlı notlaşması için. Sadece yazı mesajı desteklenir; son 50 mesaj gösterilir.",
            refresh: "Yenile",
            placeholder: "Adminlere mesaj yaz...",
            send: "Gönder",
            empty: "Henüz mesaj yok.",
            error: "Mesajlar alınamadı.",
            delete: "Sil",
            chars: "karakter",
          }
        : {
            title: "Shared admin chat",
            subtitle: "Quick internal notes for owner and admins. Text-only; latest 50 messages are shown.",
            refresh: "Refresh",
            placeholder: "Write a message to admins...",
            send: "Send",
            empty: "No messages yet.",
            error: "Could not load messages.",
            delete: "Delete",
            chars: "characters",
          },
    [tr]
  );

  const loadMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setMessage(null);

    try {
      const [chatResponse, meResponse] = await Promise.all([
        fetch("/api/admin/chat?limit=50", { credentials: "same-origin" }),
        fetch("/api/me", { credentials: "same-origin" }),
      ]);

      const chatData = await chatResponse.json().catch(() => null);
      const meData = await meResponse.json().catch(() => null);

      if (!chatResponse.ok) throw new Error(chatData?.error || copy.error);

      setMessages(chatData?.messages || []);
      if (meResponse.ok && meData?.user) setCurrentUser(meData.user);
    } catch (error) {
      if (!silent) setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = draft.trim();
    if (!nextMessage) return;

    setSending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextMessage }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.error || copy.error);
      setDraft("");
      await loadMessages(true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id: number) => {
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/chat?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.error || copy.error);
      await loadMessages(true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(() => loadMessages(true), 10000);
    return () => window.clearInterval(timer);
  }, [language]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const isOwner = currentUser?.role === "owner";

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-medium text-white">{copy.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => loadMessages()}
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

      <div ref={listRef} className="mt-5 max-h-[420px] space-y-3 overflow-y-auto rounded-3xl border border-white/10 bg-black/35 p-4">
        {messages.length === 0 && <p className="py-8 text-center text-white/45">{copy.empty}</p>}
        {messages.map((item) => {
          const mine = currentUser?.id === item.user_id;
          return (
            <div key={item.id} className={`flex gap-3 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white text-black">
                  {item.user_avatar_url ? (
                    <img src={item.user_avatar_url} alt="Admin" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
                      {getInitials(item.user_name, item.user_email)}
                    </div>
                  )}
                </div>
              )}

              <div className={`max-w-[86%] rounded-3xl border px-4 py-3 ${mine ? "border-cyan-300/20 bg-cyan-300/10" : "border-white/10 bg-white/[0.055]"}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
                  <span>{mine ? "Sen" : item.user_name}</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{item.user_role || "admin"}</span>
                  <span>{formatTime(item.created_at, tr)}</span>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => deleteMessage(item.id)}
                      className="text-red-200/70 underline underline-offset-4 transition-colors hover:text-red-100"
                    >
                      {copy.delete}
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/80">{item.message}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="mt-4 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
          placeholder={copy.placeholder}
          rows={3}
          className="w-full resize-none rounded-3xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/35">{draft.length}/1000 {copy.chars}</p>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "..." : copy.send}
          </button>
        </div>
      </form>
    </div>
  );
}
