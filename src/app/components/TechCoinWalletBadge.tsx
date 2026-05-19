import { useCallback, useEffect, useState } from "react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";

type Wallet = {
  balance: number;
  lifetime_earned?: number;
  updated_at?: string | null;
};

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

export function TechCoinWalletBadge({ className = "" }: { className?: string }) {
  const { language } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const label = language === "tr" ? "Tech Coin bakiyesi" : "Tech Coin balance";
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/coins", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Wallet unavailable");
      setWallet({ balance: Number(data.balance || 0), lifetime_earned: Number(data.lifetime_earned || 0), updated_at: data.updated_at || null });
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
    window.addEventListener("ekatech-techcoin-refresh", loadWallet);
    return () => {
      window.removeEventListener("ekatech-techcoin-refresh", loadWallet);
    };
  }, [loadWallet]);

  if (!wallet && !loading) return null;

  return (
    <div className={`rounded-full border border-amber-300/25 bg-black/85 px-4 py-2.5 text-amber-100 shadow-2xl shadow-black/40 backdrop-blur-xl ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/55">{label}</p>
      <div className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-white">
        <span>{formatNumber(Number(wallet?.balance || 0), locale)}</span>
        <span className="inline-flex h-6 w-6 overflow-hidden rounded-full border border-amber-300/30 bg-amber-100/5 p-[1px]">
          <img src={coinIcon} alt="Tech Coin" className="h-full w-full rounded-full object-cover" style={{ clipPath: "circle(50% at 50% 50%)" }} />
        </span>
      </div>
    </div>
  );
}
