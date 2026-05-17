import { useEffect } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

export type ToastNoFactionSuccessPayload = {
  amount: number;
  multiplier: number;
  currency?: string;
};

type ToastNoFactionSuccessProps = ToastNoFactionSuccessPayload & {
  locale?: string;
  title?: string;
  onClose: () => void;
};

function formatWinAmount(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(Number(amount) || 0)));
}

export function ToastNoFactionSuccess({ amount, multiplier, currency = "TechCoin", locale = "tr-TR", title = "CASHOUT BAŞARILI", onClose }: ToastNoFactionSuccessProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3800);
    return () => window.clearTimeout(timer);
  }, [onClose, amount, multiplier]);

  return (
    <button type="button" className="toast-nofaction-success" onClick={onClose} aria-live="polite" aria-label={`${title}: +${formatWinAmount(amount, locale)} ${currency}, ${multiplier.toFixed(2)}x`}>
      <span className="toast-nofaction-success__shine" aria-hidden="true" />
      <span className="toast-nofaction-success__burst toast-nofaction-success__burst--left" aria-hidden="true"><Sparkles /></span>
      <span className="toast-nofaction-success__burst toast-nofaction-success__burst--right" aria-hidden="true"><Sparkles /></span>
      <span className="toast-nofaction-success__icon" aria-hidden="true"><CheckCircle2 /></span>
      <span className="toast-nofaction-success__title">{title}</span>
      <span className="toast-nofaction-success__amount">+{formatWinAmount(amount, locale)} {currency}</span>
      <span className="toast-nofaction-success__multiplier">{multiplier.toFixed(2)}x</span>
      <span className="toast-nofaction-success__hint">Kapatmak için tıkla</span>
    </button>
  );
}
