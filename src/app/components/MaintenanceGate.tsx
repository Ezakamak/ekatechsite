import { useEffect, useState } from "react";
import { useLanguage } from "../i18n";

type MaintenanceState = {
  active: boolean;
  message?: string;
};

type UserState = {
  role?: string;
};

export function MaintenanceGate() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [maintenance, setMaintenance] = useState<MaintenanceState>({ active: false });
  const [user, setUser] = useState<UserState | null>(null);

  const load = async () => {
    try {
      const [maintenanceResponse, meResponse] = await Promise.all([
        fetch("/api/admin/maintenance", { credentials: "same-origin" }),
        fetch("/api/me", { credentials: "same-origin" }),
      ]);
      const maintenanceData = await maintenanceResponse.json().catch(() => null);
      const meData = await meResponse.json().catch(() => null);
      setMaintenance({ active: Boolean(maintenanceData?.active), message: maintenanceData?.message || "" });
      setUser(meResponse.ok ? meData?.user || null : null);
    } catch {
      setMaintenance({ active: false });
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener("ekatech-auth-change", load);
    window.addEventListener("ekatech-maintenance-change", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekatech-auth-change", load);
      window.removeEventListener("ekatech-maintenance-change", load);
    };
  }, []);

  const canBypass = user?.role === "owner" || user?.role === "admin";
  if (!maintenance.active || canBypass) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 px-4 backdrop-blur-xl">
      <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-2xl">⚙️</div>
        <h1 className="text-4xl font-medium tracking-tight text-white">{tr ? "Site bakımda" : "Site under maintenance"}</h1>
        <p className="mt-4 leading-7 text-white/55">
          {maintenance.message || (tr ? "Kısa süreli bakım yapıyoruz. Lütfen biraz sonra tekrar dene." : "We are performing short maintenance. Please check again soon.")}
        </p>
      </div>
    </div>
  );
}
