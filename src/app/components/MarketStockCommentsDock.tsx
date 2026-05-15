import { useEffect, useMemo, useState } from "react";
import { MessageCircle, RefreshCcw, Send } from "lucide-react";
import { useLanguage } from "../i18n";

type MarketComment = {
  id: number;
  symbol: string;
  comment: string;
  created_at?: string;
  user_name?: string;
  user_avatar_url?: string | null;
};

function detectDetailSymbol() {
  if (typeof document === "undefined") return null;

  const hasDetailBackButton = Array.from(document.querySelectorAll("button, a")).some((node) => {
    const text = node.textContent?.trim().toLowerCase() || "";
    return text.includes("piyasaya dön") || text.includes("back to market");
  });

  if (!hasDetailBackButton) return null;

  const heading = Array.from(document.querySelectorAll("h1")).find((node) => {
    const text = node.textContent?.trim() || "";
    return /^[A-Z0-9]{2,12}$/.test(text) && !text.includes("EKA INVESTSIM");
  });

  return heading?.textContent?.trim().toUpperCase() || null;
}

export function MarketStockCommentsDock() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Hisse yorumları",
            subtitle: "Yorumlar admin onayından sonra yayımlanır.",
            placeholder: "Bu hisse hakkında kısa yorum yaz...",
            send: "Onaya gönder",
            refresh: "Yenile",
            empty: "Bu hisse için onaylanmış yorum yok.",
            pending: "Yorum admin onayına gönderildi.",
            error: "Yorum işlemi başarısız.",
            close: "Kapat",
            open: "Yorumlar",
            user: "Kullanıcı",
          }
        : {
            title: "Stock comments",
            subtitle: "Comments are published only after admin approval.",
            placeholder: "Write a short comment about this stock...",
            send: "Send for review",
            refresh: "Refresh",
            empty: "No approved comments for this stock yet.",
            pending: "Comment sent for admin approval.",
            error: "Comment action failed.",
            close: "Close",
            open: "Comments",
            user: "User",
          },
    [tr]
  );

  const [symbol, setSymbol] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tick = () => setSymbol(detectDetailSymbol());
    tick();
    const timer = window.setInterval(tick, 550);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setOpen(true);
    setStatus(null);
    setText("");
    if (symbol) loadComments(symbol);
    else setComments([]);
  }, [symbol]);

  async function loadComments(nextSymbol = symbol) {
    if (!nextSymbol) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/market-comments?symbol=${encodeURIComponent(nextSymbol)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  }

  async function submitComment() {
    if (!symbol || text.trim().length < 3) return;
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/market-comments", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, comment: text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setText("");
      setStatus({ type: "success", message: data?.message || copy.pending });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  }

  if (!symbol) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-40 left-5 z-[130] inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-black/80 px-4 py-3 text-sm font-medium text-cyan-100 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all hover:bg-cyan-300/10 md:bottom-24 md:left-8"
      >
        <MessageCircle className="h-4 w-4" /> {symbol} {copy.open}
      </button>
    );
  }

  return (
    <aside className="fixed bottom-40 left-5 z-[130] w-[calc(100vw-2.5rem)] max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-black/85 text-white shadow-2xl shadow-black/50 backdrop-blur-xl md:bottom-24 md:left-8 md:w-[26rem]">
      <div className="border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/60">{symbol}</p>
            <h3 className="mt-1 text-xl font-semibold">{copy.title}</h3>
            <p className="mt-1 text-xs leading-5 text-white/45">{copy.subtitle}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/[0.08]">
            {copy.close}
          </button>
        </div>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto p-4">
        {comments.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">{copy.empty}</p>
        ) : (
          comments.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2">
                {item.user_avatar_url ? <img src={item.user_avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">{(item.user_name || "U").slice(0, 1).toUpperCase()}</span>}
                <p className="text-sm font-medium text-white">{item.user_name || copy.user}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/65">{item.comment}</p>
            </div>
          ))
        )}
      </div>

      {status && (
        <div className={`mx-4 rounded-2xl border px-4 py-3 text-xs ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {status.message}
        </div>
      )}

      <div className="space-y-3 p-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 420))}
          placeholder={copy.placeholder}
          className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/45 p-3 text-sm text-white outline-none placeholder:text-white/25"
        />
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => loadComments()} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/65 hover:bg-white/[0.09] disabled:opacity-40">
            <RefreshCcw className="h-4 w-4" /> {copy.refresh}
          </button>
          <button type="button" onClick={submitComment} disabled={loading || text.trim().length < 3} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40">
            <Send className="h-4 w-4" /> {copy.send}
          </button>
        </div>
      </div>
    </aside>
  );
}
