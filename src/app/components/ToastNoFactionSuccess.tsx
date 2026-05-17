import { useCallback, useEffect } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

export type ToastNoFactionSuccessPayload = {
  id: string;
  amount: number;
  multiplier: number;
  currency?: string;
  title?: string;
  sourceId?: string;
  displayAmount?: string;
  variant?: "success" | "danger" | "neutral";
};

export function createToastNoFactionSuccessId(prefix = "toast-nofaction-success") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ToastNoFactionSuccessProps = ToastNoFactionSuccessPayload & {
  locale?: string;
  onClose: (id: string) => void;
};

function formatWinAmount(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(Number(amount) || 0)));
}

export function ToastNoFactionSuccess({ id, amount, multiplier, currency = "TechCoin", locale = "tr-TR", title = "CASHOUT BAŞARILI", displayAmount, variant = "success", onClose }: ToastNoFactionSuccessProps) {
  const safeMultiplier = Number.isFinite(Number(multiplier)) ? Number(multiplier) : 1;
  const removeFromState = useCallback(() => {
    onClose(id);
  }, [id, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(removeFromState, 3800);
    return () => window.clearTimeout(timer);
  }, [removeFromState]);

  return (
    <button type="button" id={id} className={`toast-nofaction-success toast-nofaction-success--${variant}`} onClick={removeFromState} aria-live="polite" aria-label={`${title}: ${displayAmount || `+${formatWinAmount(amount, locale)} ${currency}`}, ${safeMultiplier.toFixed(2)}x`}>
      <span className="toast-nofaction-success__shine" aria-hidden="true" />
      <span className="toast-nofaction-success__burst toast-nofaction-success__burst--left" aria-hidden="true"><Sparkles /></span>
      <span className="toast-nofaction-success__burst toast-nofaction-success__burst--right" aria-hidden="true"><Sparkles /></span>
      <span className="toast-nofaction-success__icon" aria-hidden="true"><CheckCircle2 /></span>
      <span className="toast-nofaction-success__title">{title}</span>
      <span className="toast-nofaction-success__amount">{displayAmount || `+${formatWinAmount(amount, locale)} ${currency}`}</span>
      <span className="toast-nofaction-success__multiplier">{safeMultiplier.toFixed(2)}x</span>
      <span className="toast-nofaction-success__hint">Kapatmak için tıkla</span>
    </button>
  );
}
