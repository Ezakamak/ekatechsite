import { Coins, Wallet, Zap } from "lucide-react";
import type { TechCoinWallet } from "./types";

interface TechWalletPanelProps {
  wallet?: TechCoinWallet;
  connected: boolean;
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function TechWalletPanel({ wallet, connected }: TechWalletPanelProps) {
  const balance = wallet ? currencyFormatter.format(wallet.techCoinBalance) : "...";

  return (
    <aside className="rounded-3xl border border-emerald-400/30 bg-black/80 p-4 shadow-[0_0_38px_rgba(16,185,129,0.25)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/50 bg-emerald-400/10 text-emerald-300">
          <Wallet className="h-6 w-6" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">OFF canlı Tech Coin</p>
          <h2 className="text-lg font-semibold text-white">{wallet?.userName ?? "Tech Pilot"}</h2>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-400/10 via-cyan-400/10 to-transparent p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-zinc-300">
            <Coins className="h-4 w-4 text-emerald-300" /> Bakiye
          </span>
          <span className="font-mono text-xl font-black text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.85)]">
            {balance} TC
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-cyan-300" /> OFF Hub canlı senkronizasyonu
        </span>
        <span className={connected ? "text-emerald-300" : "text-red-300"}>{connected ? "ONLINE" : "OFFLINE"}</span>
      </div>
    </aside>
  );
}
