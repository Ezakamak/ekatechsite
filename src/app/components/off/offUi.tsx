import type { ReactNode } from "react";

export function OffPanel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 text-white shadow-2xl shadow-purple-500/5 backdrop-blur-xl sm:p-6">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>{eyebrow && <p className="text-xs uppercase tracking-[0.24em] text-purple-100/55">{eyebrow}</p>}<h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2></div>
      {action}
    </div>
    {children}
  </section>;
}

export function StatTile({ label, value, tone = "white" }: { label: string; value: ReactNode; tone?: "white" | "cyan" | "amber" | "purple" }) {
  const colors = { white: "text-white", cyan: "text-cyan-100", amber: "text-amber-100", purple: "text-purple-100" };
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p><div className={`mt-2 text-2xl font-semibold ${colors[tone]}`}>{value}</div></div>;
}

export function Pill({ children, tone = "purple" }: { children: ReactNode; tone?: "purple" | "cyan" | "amber" | "emerald" | "white" }) {
  const colors = { purple: "border-purple-300/20 bg-purple-300/10 text-purple-100", cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100", amber: "border-amber-300/20 bg-amber-300/10 text-amber-100", emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100", white: "border-white/10 bg-white/[0.06] text-white/70" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/45">{children}</div>;
}
