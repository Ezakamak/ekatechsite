import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Send, Trash2, RefreshCw, SmilePlus, Circle } from "lucide-react";
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

type TypingUser = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  role?: string;
};

const quickRepliesTr = ["Bakıyorum", "Tamamdır", "Bunu ben alıyorum", "Birazdan dönüş yapacağım"];
const quickRepliesEn = ["Checking", "Got it", "I’ll take this", "I’ll reply shortly"];
const reactions = ["👍", "✅", "👀", "⚡"];

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

function formatDateDivider(value?: string, tr = true) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(tr ? "tr-TR" : "en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function isSameDay(a?: string, b?: string) {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;
  return first.toDateString() === second.toDateString();
}

export function AdminChat() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Admin ortak chat",
            subtitle: "Owner ve adminler için hızlı iç iletişim. Yazıyor durumu, hızlı cevaplar ve canlı yenileme açık.",
            refresh: "Yenile",
            placeholder: "Adminlere mesaj yaz...",
            send: "Gönder",
            empty: "Henüz mesaj yok.",
            error: "Mesajlar alınamadı.",
            delete: "Sil",
            chars: "karakter",
            quickReplies: "Hızlı cevaplar",
            online: "Canlı",
            lastUpdate: "Son güncelleme",
            typingSingle: "yazıyor",
            typingMultiple: "yazıyor",
            you: "Sen",
            enterHint: "Enter gönderir, Shift+Enter yeni satır",
          }
        : {
            title: "Shared admin chat",
            subtitle: "Fast internal communication for owner and admins. Typing status, quick replies and live refresh are enabled.",
            refresh: "Refresh",
            placeholder: "Write a message to admins...",
            send: "Send",
            empty: "No messages yet.",
            error: "Could not load messages.",
            delete: "Delete",
            chars: "characters",
            quickReplies: "Quick replies",
            online: "Live",
            lastUpdate: "Last update",
            typingSingle: "is typing",
            typingMultiple: "are typing",
            you: "You",
            enterHint: "Enter sends, Shift+Enter adds a line",
          },
    [tr]
  );

  const loadTyping = async () => {
    try {
      const response = await fetch("/api/admin/chat-typing", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (response.ok) setTypingUsers(data?.typing || []);
    } catch {
      setTypingUsers([]);
    }
  };

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
      setLastUpdated(new Date().toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      if (meResponse.ok && meData?.user) setCurrentUser(meData.user);
      await loadTyping();
    } catch (error) {
      if (!silent) setMessage({ type: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markTyping = async () => {
    try {
      await fetch("/api/admin/chat-typing", { method: "POST", credentials: "same-origin" });
    } catch {
      undefined;
    }
  };

  const clearTyping = async () => {
    try {
      await fetch("/api/admin/chat-typing", { method: "DELETE", credentials: "same-origin" });
    } catch {
      undefined;
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value.slice(0, 1000));

    if (value.trim()) {
      if (!typingTimerRef.current) markTyping();
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => {
        clearTyping();
        typingTimerRef.current = null;
      }, 2600);
    } else {
      clearTyping();
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
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
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
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

  const addQuickText = (text: string) => {
    setDraft((current) => (current.trim() ? `${current.trim()} ${text}` : text).slice(0, 1000));
    markTyping();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(() => loadMessages(true), 7000);
    const typingTimer = window.setInterval(loadTyping, 2500);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(typingTimer);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      clearTyping();
    };
  }, [language]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, typingUsers.length]);

  const isOwner = currentUser?.role === "owner";
  const quickReplies = tr ? quickRepliesTr : quickRepliesEn;
  const typingText = typingUsers.length === 1
    ? `${typingUsers[0].name} ${copy.typingSingle}...`
    : typingUsers.length > 1
      ? `${typingUsers.map((user) => user.name).join(", ")} ${copy.typingMultiple}...`
      : "";

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] backdrop-blur-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-white/[0.07] to-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-medium text-white">{copy.title}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                <Circle className="h-2 w-2 fill-current" />
                {copy.online}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
            {lastUpdated && <p className="mt-2 text-xs text-white/35">{copy.lastUpdate}: {lastUpdated}</p>}
          </div>
          <button
            type="button"
            onClick={() => loadMessages()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {copy.refresh}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm sm:mx-6 ${message.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {message.text}
        </div>
      )}

      <div ref={listRef} className="max-h-[460px] space-y-3 overflow-y-auto bg-black/25 p-4 sm:p-5">
        {messages.length === 0 && <p className="py-8 text-center text-white/45">{copy.empty}</p>}
        {messages.map((item, index) => {
          const mine = currentUser?.id === item.user_id;
          const showDivider = index === 0 || !isSameDay(messages[index - 1]?.created_at, item.created_at);
          return (
            <div key={item.id}>
              {showDivider && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/35">{formatDateDivider(item.created_at, tr)}</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              )}

              <div className={`flex gap-3 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white text-black">
                    {item.user_avatar_url ? (
                      <img src={item.user_avatar_url} alt="Admin" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
                        {getInitials(item.user_name, item.user_email)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-black bg-emerald-300" />
                  </div>
                )}

                <div className={`group max-w-[86%] rounded-3xl border px-4 py-3 shadow-lg ${mine ? "border-cyan-300/20 bg-cyan-300/10 shadow-cyan-500/5" : "border-white/10 bg-white/[0.055] shadow-black/10"}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
                    <span>{mine ? copy.you : item.user_name}</span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{item.user_role || "admin"}</span>
                    <span>{formatTime(item.created_at, tr)}</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(item.id)}
                        className="inline-flex items-center gap-1 text-red-200/55 opacity-0 transition-all hover:text-red-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                        {copy.delete}
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/84">{item.message}</p>
                </div>
              </div>
            </div>
          );
        })}

        {typingText && (
          <div className="flex items-center gap-3 pl-1 text-sm text-white/45">
            <div className="flex -space-x-2">
              {typingUsers.slice(0, 3).map((user) => (
                <div key={user.id} className="h-8 w-8 overflow-hidden rounded-full border border-black bg-white text-black">
                  {user.avatar_url ? <img src={user.avatar_url} alt="Typing" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold">{getInitials(user.name, user.email)}</div>}
                </div>
              ))}
            </div>
            <span>{typingText}</span>
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45" />
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/35 p-4 sm:p-5">
        <div className="mb-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/35">{copy.quickReplies}</p>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button key={reply} type="button" onClick={() => addQuickText(reply)} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-white/65 transition-all hover:bg-white/[0.08] hover:text-white">
                {reply}
              </button>
            ))}
            {reactions.map((reaction) => (
              <button key={reaction} type="button" onClick={() => addQuickText(reaction)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-sm transition-all hover:bg-white/[0.08]">
                {reaction}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={sendMessage} className="space-y-3">
          <div className="relative">
            <textarea
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => window.setTimeout(clearTyping, 400)}
              placeholder={copy.placeholder}
              rows={3}
              className="w-full resize-none rounded-3xl border border-white/10 bg-black/40 px-4 py-3 pr-14 text-white outline-none placeholder:text-white/25 focus:border-cyan-200/40"
            />
            <SmilePlus className="pointer-events-none absolute right-4 top-4 h-5 w-5 text-white/25" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs text-white/35">{draft.length}/1000 {copy.chars}</p>
              <p className="text-xs text-white/25">{copy.enterHint}</p>
            </div>
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "..." : copy.send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
