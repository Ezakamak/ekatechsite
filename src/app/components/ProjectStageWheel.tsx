type ProjectRequest = {
  id: number;
  project_name: string;
  project_type: string;
  budget_range?: string;
  deadline?: string;
  description: string;
  status: string;
  created_at?: string;
};

type Stage = {
  key: string;
  label: string;
  description: string;
};

const stages: Stage[] = [
  { key: "received", label: "Talep alındı", description: "Talebiniz başarıyla alındı." },
  { key: "reviewing", label: "İnceleniyor", description: "Ekibimiz talebinizi inceliyor." },
  { key: "offer_ready", label: "Teklif hazırlandı", description: "Size özel teklif hazırlandı." },
  { key: "waiting_approval", label: "Onay bekliyor", description: "Teklif onayınız bekleniyor." },
  { key: "development_started", label: "Geliştirme başladı", description: "Proje geliştirme süreci aktif olarak devam ediyor." },
  { key: "revision", label: "Revize", description: "Geri bildirimler doğrultusunda revize ediliyor." },
  { key: "delivered", label: "Teslim edildi", description: "Proje teslim edildi ve onay bekliyor." },
  { key: "completed", label: "Tamamlandı", description: "Proje başarıyla tamamlandı." },
];

const legacyStatusMap: Record<string, string> = {
  new: "received",
  reviewed: "reviewing",
  contacted: "offer_ready",
  accepted: "waiting_approval",
};

export function ProjectStageWheel({ request }: { request: ProjectRequest }) {
  const normalizedStatus = legacyStatusMap[request.status] || request.status || "received";
  const isRejected = normalizedStatus === "rejected";
  const foundStageIndex = stages.findIndex((stage) => stage.key === normalizedStatus);
  const activeIndex = isRejected ? 0 : foundStageIndex >= 0 ? foundStageIndex : 0;
  const activeStage = isRejected
    ? { label: "Reddedildi", description: "Proje talebi şu anda onaylanmadı." }
    : stages[activeIndex];
  const progress = isRejected ? 0 : Math.round(((activeIndex + 1) / stages.length) * 100);
  const visualProgress = isRejected ? 0 : (activeIndex / (stages.length - 1)) * 100;
  const radius = 41.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - visualProgress / 100);
  const gradientId = `stage-gradient-${request.id}`;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/35 p-5 shadow-2xl shadow-cyan-500/5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-white/35">{request.project_type}</p>
          <h3 className="text-2xl font-medium text-white">{request.project_name}</h3>
          <p className="max-w-2xl text-sm leading-6 text-white/55">{request.description}</p>
          <div className="flex flex-wrap gap-2 text-xs text-white/45">
            {request.budget_range && <span className="rounded-full bg-white/[0.06] px-3 py-1">Bütçe: {request.budget_range}</span>}
            {request.deadline && <span className="rounded-full bg-white/[0.06] px-3 py-1">Hedef: {request.deadline}</span>}
            {request.created_at && <span className="rounded-full bg-white/[0.06] px-3 py-1">{request.created_at}</span>}
          </div>
        </div>

        <div className={`rounded-full border px-4 py-2 text-sm font-medium ${isRejected ? "border-red-300/20 bg-red-300/10 text-red-100" : "border-white/10 bg-white text-black"}`}>
          {activeStage.label}
        </div>
      </div>

      {isRejected && (
        <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          Bu proje talebi onaylanmadı. Yeni bir proje talebi gönderebilir veya destekle iletişime geçebilirsin.
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
              <p className="text-xs uppercase tracking-[0.35em] text-white/35">İlerleme</p>
              <p className="mt-2 text-6xl font-medium tracking-tight text-white">%{progress}</p>
              <p className="mt-2 text-sm text-white/45">Proje genel ilerleme</p>
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
                title={stage.label}
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
                      <h4 className="font-medium text-white">{stage.label}</h4>
                      {completed && <span className="text-cyan-200">✓</span>}
                      {current && <span className="rounded-full bg-purple-300/20 px-2 py-0.5 text-xs text-purple-100">Aktif</span>}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-white/45">{stage.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Proje ilerlemesi" value={`%${progress}`} detail="Genel tamamlanma oranı" />
        <SummaryCard label="Mevcut aşama" value={activeStage.label} detail={isRejected ? "Talep onaylanmadı" : `${activeIndex + 1}. aşamadasınız`} />
        <SummaryCard label="Tahmini teslim" value={request.deadline || "Belirlenecek"} detail="Hedef teslim tarihi" />
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
