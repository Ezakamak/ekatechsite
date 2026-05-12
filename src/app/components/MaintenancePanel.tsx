import { FormEvent, useEffect, useState } from "react";
import { Power } from "lucide-react";
import { useLanguage } from "../i18n";

export function MaintenancePanel() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = tr
    ? {
        title: "Site bakım modu",
        subtitle: "Sadece owner aktif/pasif yapabilir. Aktifken client ve ziyaretçiler bakım ekranı görür; admin/owner paneli kullanabilir.",
        placeholder: "Bakım mesajı",
        active: "Aktif",
        passive: "Kapalı",
        save: "Kaydet",
      }
    : {
        title: "Site maintenance mode",
        subtitle: "Only owner can change this. Clients and visitors see a maintenance screen; admins and owner can still use the panel.",
        placeholder: "Maintenance message",
        active: "Active",
        passive: "Off",
        save: "Save",
      };

  const load = async () => {
    try {
      const response = await fetch("/api/admin/maintenance", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        setActive(Boolean(data?.active));
        setMessage(data?.message || "");
      }
    } catch {
      undefined;
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);

    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, message }),
      });
      const data = await response.json().catch(() => null);

      if (response.status === 403) {
        setVisible(false);
        return;
      }

      if (!response.ok) throw new Error(data?.error || "Maintenance failed");
      setStatus({ type: "success", text: data?.message || copy.save });
      window.dispatchEvent(new Event("ekatech-maintenance-change"));
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Maintenance failed" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!visible) return null;

  return (
    <form onSubmit={save} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-medium text-white"><Power className="h-5 w-5" /> {copy.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-black/35 px-4 py-3 text-sm text-white">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4" />
          {active ? copy.active : copy.passive}
        </label>
      </div>

      <textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 300))} placeholder={copy.placeholder} rows={3} className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
      {status && <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{status.text}</div>}
      <button type="submit" className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200">{copy.save}</button>
    </form>
  );
}
