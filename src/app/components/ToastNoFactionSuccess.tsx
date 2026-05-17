import { useCallback, useEffect } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

export type ToastNoFactionSuccessPayload = {
  id: string;
  amount: number;
  multiplier: number;
  currency?: string;
  title?: string;
  sourceId?: string;
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

export function ToastNoFactionSuccess({ id, amount, multiplier, currency = "TechCoin", locale = "tr-TR", title = "CASHOUT BAŞARILI", onClose }: ToastNoFactionSuccessProps) {
  const removeFromDomAndState = useCallback(() => {
    document.getElementById(id)?.remove();
    onClose(id);
  }, [id, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(removeFromDomAndState, 3800);
    return () => window.clearTimeout(timer);
  }, [removeFromDomAndState]);

  return (
    <button type="button" id={id} className="toast-nofaction-success" onClick={removeFromDomAndState} aria-live="polite" aria-label={`${title}: +${formatWinAmount(amount, locale)} ${currency}, ${multiplier.toFixed(2)}x`}>
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
