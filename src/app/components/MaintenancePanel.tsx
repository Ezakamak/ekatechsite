import { useEffect, useRef, useState } from "react";
import { Power } from "lucide-react";
import { useLanguage } from "../i18n";

export function MaintenancePanel() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "saving"; text: string } | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const copy = tr
    ? {
        title: "Site bakım modu",
        subtitle: "Sadece owner aktif/pasif yapabilir. Aktifken client ve ziyaretçiler bakım ekranı görür; admin/owner paneli kullanabilir.",
        placeholder: "Bakım mesajı",
        active: "Aktif",
        passive: "Kapalı",
        saving: "Kaydediliyor...",
        saved: "Otomatik kaydedildi.",
        error: "Bakım modu güncellenemedi.",
      }
    : {
        title: "Site maintenance mode",
        subtitle: "Only owner can change this. Clients and visitors see a maintenance screen; admins and owner can still use the panel.",
        placeholder: "Maintenance message",
        active: "Active",
        passive: "Off",
        saving: "Saving...",
        saved: "Auto-saved.",
        error: "Could not update maintenance mode.",
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
    } finally {
      setLoaded(true);
    }
  };

  const saveMaintenance = async (nextActive: boolean, nextMessage: string, silent = false) => {
    if (!silent) setStatus(null);
    setSaving(true);
    if (silent) setStatus({ type: "saving", text: copy.saving });

    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive, message: nextMessage }),
      });
      const data = await response.json().catch(() => null);

      if (response.status === 403) {
        setVisible(false);
        return;
      }

      if (!response.ok) throw new Error(data?.error || copy.error);

      setStatus({ type: "success", text: data?.message || copy.saved });
      window.dispatchEvent(new Event("ekatech-maintenance-change"));
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenance = () => {
    const nextActive = !active;
    setActive(nextActive);
    saveMaintenance(nextActive, message);
  };

  const updateMessage = (value: string) => {
    const nextMessage = value.slice(0, 300);
    setMessage(nextMessage);

    if (!loaded) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      saveMaintenance(active, nextMessage, true);
    }, 800);
  };

  useEffect(() => {
    load();

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-medium text-white"><Power className="h-5 w-5" /> {copy.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/50">{copy.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={toggleMaintenance}
          disabled={saving}
          className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/35 px-4 py-3 text-sm text-white transition-all hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
          aria-pressed={active}
        >
          <span className={`relative h-7 w-12 rounded-full transition-all ${active ? "bg-emerald-300/80" : "bg-white/15"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-all ${active ? "left-6" : "left-1"}`} />
          </span>
          <span className={active ? "text-emerald-100" : "text-white/65"}>{active ? copy.active : copy.passive}</span>
        </button>
      </div>

      <textarea
        value={message}
        onChange={(event) => updateMessage(event.target.value)}
        onBlur={() => saveMaintenance(active, message, true)}
        placeholder={copy.placeholder}
        rows={3}
        className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25"
      />

      {status && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
          status.type === "success"
            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
            : status.type === "saving"
              ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
              : "border-red-300/20 bg-red-300/10 text-red-100"
        }`}>
          {status.text}
        </div>
      )}
    </div>
  );
}
