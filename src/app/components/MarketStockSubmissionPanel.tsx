import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, RefreshCcw, Send } from "lucide-react";
import { useLanguage } from "../i18n";

type Submission = {
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
};

const MIN_INITIAL_PRICE = 25;
const MAX_INITIAL_PRICE = 250;
const sectorOptions = [
  { tr: "Teknoloji", en: "Technology" },
  { tr: "Finans", en: "Finance" },
  { tr: "Enerji", en: "Energy" },
  { tr: "Sağlık", en: "Healthcare" },
  { tr: "Perakende", en: "Retail" },
  { tr: "Ulaşım", en: "Transportation" },
  { tr: "Gıda", en: "Food" },
  { tr: "Oyun", en: "Gaming" },
  { tr: "Yapay Zeka", en: "Artificial Intelligence" },
  { tr: "Savunma", en: "Defense" },
  { tr: "Eğlence", en: "Entertainment" },
  { tr: "Diğer", en: "Other" },
];

export function MarketStockSubmissionPanel() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = useMemo(
    () =>
      tr
        ? {
            eyebrow: "Topluluk piyasası",
            title: "Kendi Hissenizi Yayımlayın",
            subtitle: "Kurgu şirketini oluştur, önemli alanları doldur ve admin onayına gönder. Onaylanmadan Eka InvestSim piyasasında görünmez.",
            symbol: "Sembol",
            symbolHelp: "2-8 karakter. Örn: EKA, AI7, PGAME",
            name: "Hisse / Şirket adı",
            sector: "Sektör",
            descriptionTr: "Açıklama",
            descriptionEn: "İngilizce açıklama (isteğe bağlı)",
            initialPrice: "Başlangıç fiyatı",
            priceHelp: `Zorunlu aralık: ${MIN_INITIAL_PRICE}-${MAX_INITIAL_PRICE} Tech Coin. Çok ucuz veya abartı pahalı fiyat kabul edilmez.`,
            risk: "Risk seviyesi",
            low: "Düşük",
            medium: "Orta",
            high: "Yüksek",
            submit: "Admin onayına gönder",
            refresh: "Başvurularımı yenile",
            required: `Zorunlu alanları doldur: sembol, ad, sektör, açıklama, ${MIN_INITIAL_PRICE}-${MAX_INITIAL_PRICE} Tech Coin arası fiyat ve risk.`,
            sent: "Başvuru gönderildi. Admin onaylamadan yayımlanmaz.",
            empty: "Henüz hisse başvurun yok.",
            mySubmissions: "Başvurularım",
            pending: "Bekliyor",
            approved: "Onaylandı",
            rejected: "Reddedildi",
            reviewerNote: "Admin notu",
            disclaimer: "Bu alan gerçek hisse, yatırım veya para değildir; sadece OFF Tech Coin simülasyonudur.",
            descriptionPlaceholder: "Şirketin ne yaptığını, neden farklı olduğunu ve simülasyondaki temasını yaz...",
            englishDescriptionPlaceholder: "İsteğe bağlı İngilizce açıklama...",
          }
        : {
            eyebrow: "Community market",
            title: "Publish Your Own Stock",
            subtitle: "Create a fictional company, fill the required fields and send it for admin approval. It will not appear in Eka InvestSim before approval.",
            symbol: "Symbol",
            symbolHelp: "2-8 characters. Example: EKA, AI7, PGAME",
            name: "Stock / Company name",
            sector: "Sector",
            descriptionTr: "Description",
            descriptionEn: "English description (optional)",
            initialPrice: "Initial price",
            priceHelp: `Required range: ${MIN_INITIAL_PRICE}-${MAX_INITIAL_PRICE} Tech Coin. Too cheap or extremely expensive prices are not accepted.`,
            risk: "Risk level",
            low: "Low",
            medium: "Medium",
            high: "High",
            submit: "Send for admin approval",
            refresh: "Refresh my submissions",
            required: `Fill required fields: symbol, name, sector, description, ${MIN_INITIAL_PRICE}-${MAX_INITIAL_PRICE} Tech Coin price and risk.`,
            sent: "Submission sent. It will not be published before admin approval.",
            empty: "You have no stock submissions yet.",
            mySubmissions: "My submissions",
            pending: "Pending",
            approved: "Approved",
            rejected: "Rejected",
            reviewerNote: "Admin note",
            disclaimer: "This is not a real stock, investment or money system; it is only an OFF Tech Coin simulation.",
            descriptionPlaceholder: "Explain what the company does, why it is different, and its simulation theme...",
            englishDescriptionPlaceholder: "Optional English description...",
          },
    [tr]
  );

  const [form, setForm] = useState({
    symbol: "",
    name: "",
    sector: "Teknoloji",
    descriptionTr: "",
    descriptionEn: "",
    initialPrice: "100",
    risk: "medium",
  });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: field === "symbol" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) : value }));
  }

  function isValid() {
    return (
      form.symbol.length >= 2 &&
      form.name.trim().length >= 3 &&
      form.sector.trim().length >= 3 &&
      form.descriptionTr.trim().length >= 20 &&
      Number(form.initialPrice) >= MIN_INITIAL_PRICE &&
      Number(form.initialPrice) <= MAX_INITIAL_PRICE &&
      ["low", "medium", "high"].includes(form.risk)
    );
  }

  async function loadSubmissions() {
    setLoading(true);
    try {
      const response = await fetch("/api/market-stock-submissions", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.required);
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.required });
    } finally {
      setLoading(false);
    }
  }

  async function submitStock() {
    setStatus(null);
    if (!isValid()) {
      setStatus({ type: "error", message: copy.required });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/market-stock-submissions", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol,
          name: form.name,
          sector: form.sector,
          descriptionTr: form.descriptionTr,
          descriptionEn: form.descriptionEn,
          initialPrice: Number(form.initialPrice),
          risk: form.risk,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.required);
      setStatus({ type: "success", message: data?.message || copy.sent });
      setForm({ symbol: "", name: "", sector: "Teknoloji", descriptionTr: "", descriptionEn: "", initialPrice: "100", risk: "medium" });
      await loadSubmissions();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.required });
    } finally {
      setLoading(false);
    }
  }

  function statusLabel(statusValue: string) {
    if (statusValue === "approved") return copy.approved;
    if (statusValue === "rejected") return copy.rejected;
    return copy.pending;
  }

  return (
    <section className="bg-black px-3 pb-28 text-white sm:px-6">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <BarChart3 className="h-4 w-4" /> {copy.eyebrow}
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">{copy.title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55 sm:text-base">{copy.subtitle}</p>
            <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{copy.disclaimer}</p>
          </div>
          <button
            type="button"
            onClick={loadSubmissions}
            disabled={loading}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.1] disabled:opacity-40"
          >
            <RefreshCcw className="h-4 w-4" /> {copy.refresh}
          </button>
        </div>

        {status && (
          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
            {status.message}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.symbol} help={copy.symbolHelp}>
                <input value={form.symbol} onChange={(event) => updateField("symbol", event.target.value)} placeholder="EKA" className="field-input" />
              </Field>
              <Field label={copy.name}>
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Eka Quantum" className="field-input" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={copy.sector}>
                <select value={form.sector} onChange={(event) => updateField("sector", event.target.value)} className="field-input">
                  {sectorOptions.map((sector) => <option key={sector.tr} value={sector.tr}>{tr ? sector.tr : sector.en}</option>)}
                </select>
              </Field>
              <Field label={copy.initialPrice} help={copy.priceHelp}>
                <input type="number" min={MIN_INITIAL_PRICE} max={MAX_INITIAL_PRICE} step="1" value={form.initialPrice} onChange={(event) => updateField("initialPrice", event.target.value)} className="field-input" />
              </Field>
              <Field label={copy.risk}>
                <select value={form.risk} onChange={(event) => updateField("risk", event.target.value)} className="field-input">
                  <option value="low">{copy.low}</option>
                  <option value="medium">{copy.medium}</option>
                  <option value="high">{copy.high}</option>
                </select>
              </Field>
            </div>

            <Field label={copy.descriptionTr}>
              <textarea value={form.descriptionTr} onChange={(event) => updateField("descriptionTr", event.target.value.slice(0, 420))} placeholder={copy.descriptionPlaceholder} className="field-input min-h-28 resize-none" />
            </Field>
            <Field label={copy.descriptionEn} required={false}>
              <textarea value={form.descriptionEn} onChange={(event) => updateField("descriptionEn", event.target.value.slice(0, 420))} placeholder={copy.englishDescriptionPlaceholder} className="field-input min-h-24 resize-none" />
            </Field>

            <button
              type="button"
              onClick={submitStock}
              disabled={loading || !isValid()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200 disabled:opacity-40"
            >
              <Send className="h-4 w-4" /> {copy.submit}
            </button>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4 sm:p-5">
            <h3 className="text-xl font-semibold">{copy.mySubmissions}</h3>
            <div className="mt-4 space-y-3">
              {submissions.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">{copy.empty}</p>
              ) : (
                submissions.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{item.symbol}</p>
                        <p className="text-sm text-white/45">{item.name} · {item.sector}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${item.status === "approved" ? "bg-emerald-300/10 text-emerald-100" : item.status === "rejected" ? "bg-red-300/10 text-red-100" : "bg-amber-300/10 text-amber-100"}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/55">{tr ? item.description_tr : item.description_en || item.description_tr}</p>
                    {item.reviewer_note ? <p className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/45"><span className="text-white/70">{copy.reviewerNote}:</span> {item.reviewer_note}</p> : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(0,0,0,.42);
          padding: .85rem 1rem;
          color: white;
          outline: none;
        }
        .field-input::placeholder { color: rgba(255,255,255,.25); }
      `}</style>
    </section>
  );
}

function Field({ label, help, children, required = true }: { label: string; help?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm text-white/50">
      <span>{label} {required ? <span className="text-red-300">*</span> : null}</span>
      {children}
      {help ? <span className="text-xs text-white/30">{help}</span> : null}
    </label>
  );
}
