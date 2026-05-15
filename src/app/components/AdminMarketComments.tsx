import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, RefreshCcw, XCircle } from "lucide-react";
import { useLanguage } from "../i18n";

type ModerationComment = {
  id: number;
  symbol: string;
  comment: string;
  status: "pending" | "approved" | "rejected" | string;
  created_at?: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
  user_name?: string;
  user_email?: string;
  user_avatar_url?: string | null;
  reviewer_name?: string | null;
};

export function AdminMarketComments() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Hisse yorum onayı",
            subtitle: "Eka InvestSim yorumları burada onaylanmadan yayımlanmaz.",
            pending: "Bekleyen",
            approved: "Onaylı",
            rejected: "Reddedilen",
            all: "Tümü",
            refresh: "Yenile",
            approve: "Onayla",
            reject: "Reddet",
            empty: "Bu filtrede yorum yok.",
            saved: "Yorum durumu güncellendi.",
            error: "Yorum listesi alınamadı.",
            user: "Kullanıcı",
            reviewedBy: "İnceleyen",
          }
        : {
            title: "Stock comment approvals",
            subtitle: "Eka InvestSim comments are not published until approved here.",
            pending: "Pending",
            approved: "Approved",
            rejected: "Rejected",
            all: "All",
            refresh: "Refresh",
            approve: "Approve",
            reject: "Reject",
            empty: "No comments match this filter.",
            saved: "Comment status updated.",
            error: "Could not load comments.",
            user: "User",
            reviewedBy: "Reviewed by",
          },
    [tr]
  );

  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadComments();
  }, [filter]);

  async function loadComments() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/market-comments?status=${encodeURIComponent(filter)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      setComments([]);
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  }

  async function moderate(commentId: number, action: "approve" | "reject") {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/market-comments", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setStatus({ type: "success", message: data?.message || copy.saved });
      await loadComments();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  }

  const filters = [
    { value: "pending", label: copy.pending },
    { value: "approved", label: copy.approved },
    { value: "rejected", label: copy.rejected },
    { value: "all", label: copy.all },
  ];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 text-white backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <MessageCircle className="h-4 w-4" /> {copy.title}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadComments}
          disabled={loading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
        >
          <RefreshCcw className="h-4 w-4" /> {copy.refresh}
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-all ${filter === item.value ? "border-white/25 bg-white text-black" : "border-white/10 bg-black/25 text-white/55 hover:bg-white/[0.08] hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {status && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {status.message}
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {comments.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-white/45">{copy.empty}</p>
        ) : (
          comments.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {item.user_avatar_url ? (
                    <img src={item.user_avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                      {(item.user_name || "U").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.user_name || copy.user}</p>
                    <p className="truncate text-xs text-white/35">{item.user_email}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${item.status === "approved" ? "bg-emerald-300/10 text-emerald-100" : item.status === "rejected" ? "bg-red-300/10 text-red-100" : "bg-amber-300/10 text-amber-100"}`}>
                  {item.status}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/50">{item.symbol}</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{item.comment}</p>
              </div>

              {item.reviewer_name && (
                <p className="mt-3 text-xs text-white/35">{copy.reviewedBy}: {item.reviewer_name}</p>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => moderate(item.id, "approve")}
                  disabled={loading || item.status === "approved"}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" /> {copy.approve}
                </button>
                <button
                  type="button"
                  onClick={() => moderate(item.id, "reject")}
                  disabled={loading || item.status === "rejected"}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
                >
                  <XCircle className="h-4 w-4" /> {copy.reject}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
