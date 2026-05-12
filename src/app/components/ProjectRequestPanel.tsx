import { FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type User = { id: number; name: string; email: string };

export function ProjectRequestPanel() {
  const { language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("Website");
  const [budgetRange, setBudgetRange] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const tr = language === "tr";

  useEffect(() => {
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/project-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, projectType, budgetRange, deadline, description }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Request failed");

      setProjectName("");
      setBudgetRange("");
      setDeadline("");
      setDescription("");
      setStatus({ type: "success", message: tr ? "Proje talebi admin paneline gönderildi." : "Project request sent to the admin panel." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : tr ? "Talep gönderilemedi." : "Could not submit request." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="request" className="relative overflow-hidden bg-black px-4 py-24 sm:px-6">
      <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-cyan-200/20 to-transparent" />
      <div className="relative mx-auto grid max-w-7xl items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55 }}
          className="space-y-5"
        >
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-cyan-100/80">
            {tr ? "Proje talebi" : "Project request"}
          </div>
          <h2 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">
            {tr ? "Yeni proje brief'i oluştur" : "Create a new project brief"}
          </h2>
          <p className="text-lg leading-8 text-white/55">
            {tr
              ? "Giriş yapan kullanıcılar buradan proje talebi bırakır. Admin panelinde görünür."
              : "Signed-in users can submit project requests here. They appear in the admin panel."}
          </p>
          {!user && (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              {tr ? "Proje talebi bırakmak için önce giriş yap." : "Sign in first to submit a project request."}
            </div>
          )}
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr ? "Proje adı" : "Project name"} value={projectName} onChange={setProjectName} disabled={!user} />
            <label className="block space-y-2">
              <span className="text-sm text-white/55">{tr ? "Proje türü" : "Project type"}</span>
              <select
                value={projectType}
                onChange={(event) => setProjectType(event.target.value)}
                disabled={!user}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none disabled:opacity-50"
              >
                <option>Website</option>
                <option>AI Automation</option>
                <option>Dashboard</option>
                <option>Landing Page</option>
                <option>Custom Software</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr ? "Bütçe aralığı" : "Budget range"} value={budgetRange} onChange={setBudgetRange} disabled={!user} />
            <Field label={tr ? "Teslim hedefi" : "Target date"} value={deadline} onChange={setDeadline} disabled={!user} />
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-white/55">{tr ? "Proje açıklaması" : "Project description"}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!user}
              rows={5}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none disabled:opacity-50"
            />
          </label>

          {status && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!user || loading}
            className="w-full rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "..." : tr ? "Talebi gönder" : "Submit request"}
          </button>
        </motion.form>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-white/55">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none disabled:opacity-50"
      />
    </label>
  );
}
