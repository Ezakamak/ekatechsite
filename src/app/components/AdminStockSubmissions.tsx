import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, RefreshCcw, XCircle } from "lucide-react";
import { useLanguage } from "../i18n";

type StockSubmission = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  description_tr: string;
  description_en?: string;
  initial_price: number;
  risk: "low" | "medium" | "high" | string;
  status: "pending" | "approved" | "rejected" | string;
  reviewer_note?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  user_name?: string;
  user_email?: string;
  reviewer_name?: string | null;
};

export function AdminStockSubmissions() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () =>
      tr
        ? {
            title: "Hisse Başvuru Onayı",
            subtitle: "Kullanıcıların oluşturduğu kurgu hisseler burada onaylanmadan Eka InvestSim piyasasına eklenmez.",
            pending: "Bekleyen",
            approved: "Onaylı",
            rejected: "Reddedilen",
            all: "Tümü",
            refresh: "Yenile",
            approve: "Yayımla",
            reject: "Reddet",
            empty: "Bu filtrede hisse başvurusu yok.",
            error: "Hisse başvuruları alınamadı.",
            notePlaceholder: "Admin notu / red sebebi (isteğe bağlı)",
            submittedBy: "Gönderen",
            reviewedBy: "İnceleyen",
            price: "Başlangıç fiyatı",
            risk: "Risk",
            low: "Düşük",
            medium: "Orta",
            high: "Yüksek",
            approvedMessage: "Hisse yayımlandı.",
            rejectedMessage: "Başvuru reddedildi.",
          }
        : {
            title: "Stock Submission Approval",
            subtitle: "User-created fictional stocks are not added to Eka InvestSim until approved here.",
            pending: "Pending",
            approved: "Approved",
            rejected: "Rejected",
            all: "All",
            refresh: "Refresh",
            approve: "Publish",
            reject: "Reject",
            empty: "No stock submissions match this filter.",
            error: "Could not load stock submissions.",
            notePlaceholder: "Admin note / rejection reason (optional)",
            submittedBy: "Submitted by",
            reviewedBy: "Reviewed by",
            price: "Initial price",
            risk: "Risk",
            low: "Low",
            medium: "Medium",
            high: "High",
            approvedMessage: "Stock published.",
            rejectedMessage: "Submission rejected.",
          },
    [tr]
  );

  const [filter, setFilter] = useState("pending");
  const [submissions, setSubmissions] = useState<StockSubmission[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [filter, language]);

  async function loadSubmissions() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/market-stock-submissions?status=${encodeURIComponent(filter)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (error) {
      setSubmissions([]);
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  }

  async function moderate(submissionId: number, action: "approve" | "reject") {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/market-stock-submissions", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, action, reviewerNote: notes[submissionId] || "" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.error);
      setStatus({ type: "success", message: data?.message || (action === "approve" ? copy.approvedMessage : copy.rejectedMessage) });
      setNotes((current) => ({ ...current, [submissionId]: "" }));
      await loadSubmissions();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.error });
    } finally {
      setLoading(false);
    }
  }

  function riskLabel(risk: string) {
    if (risk === "low") return copy.low;
    if (risk === "high") return copy.high;
    return copy.medium;
  }

  function statusLabel(statusValue: string) {
    if (statusValue === "approved") return copy.approved;
    if (statusValue === "rejected") return copy.rejected;
    return copy.pending;
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
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-sm text-purple-100">
            <BarChart3 className="h-4 w-4" /> {copy.title}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadSubmissions}
          disabled={loading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
        >
          <RefreshCcw className="h-4 w-4" /> {loading ? "..." : copy.refresh}
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
        {submissions.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-white/45">{copy.empty}</p>
        ) : (
          submissions.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold text-white">{item.symbol}</p>
                  <p className="mt-1 text-sm text-white/45">{item.name} · {item.sector}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${item.status === "approved" ? "bg-emerald-300/10 text-emerald-100" : item.status === "rejected" ? "bg-red-300/10 text-red-100" : "bg-amber-300/10 text-amber-100"}`}>
                  {statusLabel(item.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label={copy.price} value={String(item.initial_price)} />
                <Info label={copy.risk} value={riskLabel(item.risk)} />
              </div>

              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/70">{tr ? item.description_tr : item.description_en || item.description_tr}</p>

              <p className="mt-3 text-xs text-white/35">{copy.submittedBy}: {item.user_name || "-"} · {item.user_email || "-"}</p>
              {item.reviewer_name ? <p className="mt-1 text-xs text-white/35">{copy.reviewedBy}: {item.reviewer_name}</p> : null}
              {item.reviewer_note ? <p className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/45">{item.reviewer_note}</p> : null}

              {item.status === "pending" && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={notes[item.id] || ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value.slice(0, 240) }))}
                    placeholder={copy.notePlaceholder}
                    className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/45 p-3 text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => moderate(item.id, "approve")}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-4 w-4" /> {copy.approve}
                    </button>
                    <button
                      type="button"
                      onClick={() => moderate(item.id, "reject")}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-medium text-red-100 transition-all hover:bg-red-300/15 disabled:opacity-40"
                    >
                      <XCircle className="h-4 w-4" /> {copy.reject}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}
