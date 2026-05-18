import { Bot, Coins, ShieldCheck } from "lucide-react";
import type { BetPanelState, GameStatus } from "./types";
import { useLanguage } from "../../i18n";

interface BetControlsProps {
  panels: BetPanelState[];
  status: GameStatus;
  visualMultiplier: number;
  onPanelChange: (panelId: string, patch: Partial<BetPanelState>) => void;
  onPlaceBet: (panel: BetPanelState) => void;
  onCashOut: (panel: BetPanelState) => void;
}

const quickBets = [50, 100, 500];

function normalizeDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  return decimalParts.length ? `${normalizedInteger || "0"}.${decimalParts.join("")}` : normalizedInteger;
}

function panelNumber(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function BetControls({ panels, status, visualMultiplier, onPanelChange, onPlaceBet, onCashOut }: BetControlsProps) {
  const { language } = useLanguage();
  const tr = language === "tr";
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {panels.map((panel, index) => {
        const panelAmount = panelNumber(panel.amount);
        const possibleVisualScore = (panel.activeBetAmount ?? panelAmount) * visualMultiplier;
        const canPlaceBet = status === "STATUS_BETTING" && !panel.isBetAccepted && panelAmount > 0;
        const canCashOut = status === "STATUS_FLYING" && panel.isBetAccepted && !panel.hasCashedOut;

        return (
          <div key={panel.id} className="rounded-[1.75rem] border border-emerald-300/20 bg-zinc-950/85 p-5 shadow-[0_0_42px_rgba(16,185,129,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">{tr ? "Tech Coin Uçuş Paneli" : "Tech Coin Flight Panel"} {index + 1}</h3>
              <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">{panel.id}</span>
            </div>

            <label className="mt-5 block text-sm text-zinc-300">{tr ? "Katılım puanı" : "Entry score"}</label>
            <div className="mt-2 flex items-center rounded-2xl border border-emerald-300/20 bg-black/70 px-4 py-3 focus-within:border-emerald-300/70">
              <Coins className="mr-3 h-5 w-5 text-emerald-300" />
              <input
                type="text"
                inputMode="decimal"
                min="1"
                step="1"
                value={panel.amount}
                onChange={(event) => onPanelChange(panel.id, { amount: normalizeDecimalInput(event.target.value) })}
                className="w-full bg-transparent font-mono text-2xl font-bold text-white outline-none"
                disabled={panel.isBetAccepted}
              />
              <span className="font-mono text-emerald-300">TC</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {quickBets.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onPanelChange(panel.id, { amount: String(panelAmount + amount) })}
                  disabled={panel.isBetAccepted}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +{amount} TC
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-zinc-700 bg-black/40 p-3 text-sm text-zinc-200">
                <span className="flex items-center gap-2"><Bot className="h-4 w-4 text-cyan-300" /> {tr ? "Otomatik katılım" : "Auto join"}</span>
                <input type="checkbox" checked={panel.autoBet} onChange={(event) => onPanelChange(panel.id, { autoBet: event.target.checked })} />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-zinc-700 bg-black/40 p-3 text-sm text-zinc-200">
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> {tr ? "Otomatik durdur" : "Auto stop"}</span>
                <input type="checkbox" checked={panel.autoCashout} onChange={(event) => onPanelChange(panel.id, { autoCashout: event.target.checked })} />
              </label>
            </div>

            <label className="mt-4 block text-sm text-zinc-300">{tr ? "Otomatik puan kilitleme çarpanı" : "Auto stop multiplier"}</label>
            <div className="mt-2 flex items-center rounded-2xl border border-zinc-700 bg-black/50 px-4 py-3">
              <input
                type="text"
                inputMode="decimal"
                min="1.01"
                step="0.05"
                value={panel.autoCashoutMultiplier}
                onChange={(event) => onPanelChange(panel.id, { autoCashoutMultiplier: normalizeDecimalInput(event.target.value) })}
                className="w-full bg-transparent font-mono text-xl text-white outline-none"
              />
              <span className="font-mono text-cyan-300">x</span>
            </div>

            <button
              type="button"
              onClick={() => (canCashOut ? onCashOut(panel) : onPlaceBet(panel))}
              disabled={!canPlaceBet && !canCashOut}
              className={`mt-5 w-full rounded-2xl px-5 py-4 text-lg font-black uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50 ${canCashOut ? "bg-emerald-300 text-black shadow-[0_0_26px_rgba(110,231,183,0.7)] hover:bg-emerald-200" : "bg-red-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.45)] hover:bg-red-400"}`}
            >
              {canCashOut ? (tr ? "PUANI KİLİTLE" : "LOCK SCORE") : panel.isBetAccepted ? (tr ? "KATILIM KİLİTLENDİ" : "ENTRY LOCKED") : (tr ? "UÇUŞA KATIL" : "JOIN FLIGHT")}
            </button>

            {panel.isBetAccepted && !panel.hasCashedOut ? (
              <p className="mt-3 text-center font-mono text-lg font-black text-emerald-300 drop-shadow-[0_0_14px_rgba(16,185,129,0.85)]">
                {tr ? "Tahmini round puanı" : "Estimated round score"}: {possibleVisualScore.toFixed(2)} TC
              </p>
            ) : null}
            {panel.hasCashedOut ? <p className="mt-3 text-center text-sm font-bold text-cyan-200">{tr ? "Round puanı kilitlendi." : "Round score locked."}</p> : null}
          </div>
        );
      })}
    </section>
  );
}
