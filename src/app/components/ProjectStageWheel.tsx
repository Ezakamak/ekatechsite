import { useLanguage } from "../i18n";

type ProjectRequest = {
  id: number;
  project_name: string;
  project_type: string;
  budget_range?: string;
  deadline?: string;
  description: string;
  status: string;
  created_at?: string;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  assigned_admin_email?: string | null;
  assigned_admin_avatar_url?: string | null;
};

type Stage = {
  key: string;
  label: { tr: string; en: string };
  description: { tr: string; en: string };
};

const stages: Stage[] = [
  { key: "received", label: { tr: "Talep alındı", en: "Request received" }, description: { tr: "Talebiniz başarıyla alındı.", en: "Your request was received successfully." } },
  { key: "reviewing", label: { tr: "İnceleniyor", en: "Under review" }, description: { tr: "Ekibimiz talebinizi inceliyor.", en: "Our team is reviewing your request." } },
  { key: "offer_ready", label: { tr: "Teklif hazırlandı", en: "Offer prepared" }, description: { tr: "Size özel teklif hazırlandı.", en: "A custom offer has been prepared for you." } },
  { key: "waiting_approval", label: { tr: "Onay bekliyor", en: "Awaiting approval" }, description: { tr: "Teklif onayınız bekleniyor.", en: "The offer is waiting for your approval." } },
  { key: "development_started", label: { tr: "Geliştirme başladı", en: "Development started" }, description: { tr: "Proje geliştirme süreci aktif olarak devam ediyor.", en: "Project development is actively in progress." } },
  { key: "revision", label: { tr: "Revize", en: "Revision" }, description: { tr: "Geri bildirimler doğrultusunda revize ediliyor.", en: "Revisions are being made based on feedback." } },
  { key: "delivered", label: { tr: "Teslim edildi", en: "Delivered" }, description: { tr: "Proje teslim edildi ve onay bekliyor.", en: "The project has been delivered and is awaiting approval." } },
  { key: "completed", label: { tr: "Tamamlandı", en: "Completed" }, description: { tr: "Proje başarıyla tamamlandı.", en: "The project was completed successfully." } },
];

const legacyStatusMap: Record<string, string> = {
  new: "received",
  reviewed: "reviewing",
  contacted: "offer_ready",
  accepted: "waiting_approval",
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "EA";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EA";
}

export function ProjectStageWheel({ request }: { request: ProjectRequest }) {
  const { language } = useLanguage();
  const tr = language === "tr";
  const localizedStage = (stage: Stage) => ({ label: stage.label[language], description: stage.description[language] });
  const normalizedStatus = legacyStatusMap[request.status] || request.status || "received";
  const isRejected = normalizedStatus === "rejected";
  const foundStageIndex = stages.findIndex((stage) => stage.key === normalizedStatus);
  const activeIndex = isRejected ? 0 : foundStageIndex >= 0 ? foundStageIndex : 0;
  const activeStage = isRejected
    ? { label: tr ? "Reddedildi" : "Rejected", description: tr ? "Proje talebi şu anda onaylanmadı." : "The project request is not approved right now." }
    : localizedStage(stages[activeIndex]);
  const progress = isRejected ? 0 : Math.round(((activeIndex + 1) / stages.length) * 100);
  const visualProgress = isRejected ? 0 : (activeIndex / (stages.length - 1)) * 100;
  const radius = 41.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - visualProgress / 100);
  const gradientId = `stage-gradient-${request.id}`;
  const hasAssignedAdmin = Boolean(request.assigned_admin_id && request.assigned_admin_name);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/35 p-5 shadow-2xl shadow-cyan-500/5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-white/35">{request.project_type}</p>
          <h3 className="text-2xl font-medium text-white">{request.project_name}</h3>
          <p className="max-w-2xl text-sm leading-6 text-white/55">{request.description}</p>
          <div className="flex flex-wrap gap-2 text-xs text-white/45">
            {request.budget_range && <span className="rounded-full bg-white/[0.06] px-3 py-1">{tr ? "Bütçe" : "Budget"}: {request.budget_range}</span>}
            {request.deadline && <span className="rounded-full bg-white/[0.06] px-3 py-1">{tr ? "Hedef" : "Target"}: {request.deadline}</span>}
            {request.created_at && <span className="rounded-full bg-white/[0.06] px-3 py-1">{request.created_at}</span>}
          </div>
        </div>

        <div className={`rounded-full border px-4 py-2 text-sm font-medium ${isRejected ? "border-red-300/20 bg-red-300/10 text-red-100" : "border-white/10 bg-white text-black"}`}>
          {activeStage.label}
        </div>
      </div>

      {hasAssignedAdmin && (
        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white text-black">
              {request.assigned_admin_avatar_url ? (
                <img src={request.assigned_admin_avatar_url} alt={tr ? "Admin" : "Administrator"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                  {getInitials(request.assigned_admin_name, request.assigned_admin_email)}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/55">{tr ? "Sorumlu admin" : "Assigned admin"}</p>
              <p className="font-medium text-white">{request.assigned_admin_name}</p>
              {request.assigned_admin_email && <p className="text-sm text-white/40">{request.assigned_admin_email}</p>}
            </div>
          </div>
        </div>
      )}

      {!hasAssignedAdmin && !isRejected && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/45">
          {tr ? "Proje henüz bir admin tarafından alınmadı. İnceleme başladığında sorumlu admin burada görünecek." : "No admin has taken this project yet. The assigned admin will appear here when review starts."}
        </div>
      )}

      {isRejected && (
        <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          {tr ? "Bu proje talebi onaylanmadı. Yeni bir proje talebi gönderebilir veya destekle iletişime geçebilirsin." : "This project request was not approved. You can send a new request or contact support."}
        </div>
      )}

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[380px]">
          <div className="absolute inset-4 rounded-full shadow-[0_0_45px_rgba(34,211,238,0.16)]">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id={gradientId} x1="18" y1="12" x2="82" y2="88" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.98)" />
                  <stop offset="100%" stopColor="rgba(139,92,246,0.98)" />
                </linearGradient>
                <filter id={`${gradientId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="rgba(0,0,0,0.45)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2.2"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 50 50)"
                filter={`url(#${gradientId}-glow)`}
                style={{ transition: "stroke-dashoffset 700ms ease" }}
              />
            </svg>
          </div>

          <div className="absolute inset-[25%] rounded-full border border-dashed border-white/15 bg-white/[0.025]" />

          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/35">{tr ? "İlerleme" : "Progress"}</p>
              <p className="mt-2 text-6xl font-medium tracking-tight text-white">%{progress}</p>
              <p className="mt-2 text-sm text-white/45">{tr ? "Proje genel ilerleme" : "Overall project progress"}</p>
              <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
            </div>
          </div>

          {stages.map((stage, index) => {
            const angle = -90 + index * 45;
            const x = 50 + 41 * Math.cos((angle * Math.PI) / 180);
            const y = 50 + 41 * Math.sin((angle * Math.PI) / 180);
            const completed = !isRejected && index < activeIndex;
            const current = !isRejected && index === activeIndex;

            return (
              <div
                key={stage.key}
                className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-semibold transition-all ${
                  current
                    ? "border-purple-300/70 bg-purple-500/25 text-white shadow-[0_0_28px_rgba(139,92,246,0.75)]"
                    : completed
                      ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.45)]"
                      : "border-white/15 bg-white/[0.04] text-white/45"
                }`}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={stage.label[language]}
              >
                {index + 1}
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          {stages.map((stage, index) => {
            const completed = !isRejected && index < activeIndex;
            const current = !isRejected && index === activeIndex;

            return (
              <div
                key={stage.key}
                className={`rounded-2xl border p-4 transition-all ${
                  current
                    ? "border-purple-300/45 bg-purple-500/15 shadow-[0_0_28px_rgba(139,92,246,0.18)]"
                    : completed
                      ? "border-cyan-300/20 bg-cyan-300/[0.06]"
                      : "border-white/10 bg-white/[0.025]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                      current
                        ? "border-purple-300/70 text-purple-100"
                        : completed
                          ? "border-cyan-300/60 text-cyan-100"
                          : "border-white/15 text-white/40"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{stage.label[language]}</h4>
                      {completed && <span className="text-cyan-200">✓</span>}
                      {current && <span className="rounded-full bg-purple-300/20 px-2 py-0.5 text-xs text-purple-100">{tr ? "Aktif" : "Active"}</span>}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-white/45">{stage.description[language]}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <SummaryCard label={tr ? "Proje ilerlemesi" : "Project progress"} value={`%${progress}`} detail={tr ? "Genel tamamlanma oranı" : "Overall completion rate"} />
        <SummaryCard label={tr ? "Mevcut aşama" : "Current stage"} value={activeStage.label} detail={isRejected ? (tr ? "Talep onaylanmadı" : "Request was not approved") : (tr ? `${activeIndex + 1}. aşamadasınız` : `You are at stage ${activeIndex + 1}`)} />
        <SummaryCard label={tr ? "Tahmini teslim" : "Estimated delivery"} value={request.deadline || (tr ? "Belirlenecek" : "To be determined")} detail={tr ? "Hedef teslim tarihi" : "Target delivery date"} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-sm text-white/40">{label}</p>
      <p className="mt-2 truncate text-xl font-medium text-white">{value}</p>
      <p className="mt-1 text-sm text-white/35">{detail}</p>
    </div>
  );
}
