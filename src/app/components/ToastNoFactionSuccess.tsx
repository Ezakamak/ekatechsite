import { useCallback, useEffect } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useLanguage } from "../i18n";

export type ToastNoFactionSuccessPayload = {
  id: string;
  amount: number;
  multiplier: number;
  currency?: string;
  title?: string;
  sourceId?: string;
  displayAmount?: string;
  displayMultiplier?: string;
  variant?: "success" | "danger" | "neutral";
  hideHint?: boolean;
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

export function ToastNoFactionSuccess({ id, amount, multiplier, currency = "TechCoin", locale = "tr-TR", title, displayAmount, displayMultiplier, variant = "success", hideHint = false, onClose }: ToastNoFactionSuccessProps) {
  const { language } = useLanguage();
  const tr = language === "tr";
  const resolvedTitle = title || (tr ? "CASHOUT BAŞARILI" : "CASHOUT SUCCESSFUL");
  const safeMultiplier = Number.isFinite(Number(multiplier)) ? Number(multiplier) : 1;
  const multiplierLabel = displayMultiplier || `${safeMultiplier.toFixed(2)}x`;
  const removeFromState = useCallback(() => {
    onClose(id);
  }, [id, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(removeFromState, 3800);
    return () => window.clearTimeout(timer);
  }, [removeFromState]);

  return (
    <button type="button" id={id} className={`toast-nofaction-success toast-nofaction-success--${variant}`} onClick={removeFromState} aria-live="polite" aria-label={`${resolvedTitle}: ${displayAmount || `+${formatWinAmount(amount, locale)} ${currency}`}, ${multiplierLabel}`}>
      <span className="toast-nofaction-success__shine" aria-hidden="true" />
      <span className="toast-nofaction-success__burst toast-nofaction-success__burst--left" aria-hidden="true"><Sparkles /></span>
      <span className="toast-nofaction-success__burst toast-nofaction-success__burst--right" aria-hidden="true"><Sparkles /></span>
      <span className="toast-nofaction-success__icon" aria-hidden="true"><CheckCircle2 /></span>
      <span className="toast-nofaction-success__title">{resolvedTitle}</span>
      <span className="toast-nofaction-success__amount">{displayAmount || `+${formatWinAmount(amount, locale)} ${currency}`}</span>
      <span className="toast-nofaction-success__multiplier">{multiplierLabel}</span>
      {!hideHint ? <span className="toast-nofaction-success__hint">{tr ? "Kapatmak için tıkla" : "Click to dismiss"}</span> : null}
    </button>
  );
}
