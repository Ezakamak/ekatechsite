import { useEffect, useMemo, useState } from "react";
import { Coins, History, Search } from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";

type CreditUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  balance: number;
  lifetime_earned: number;
  wallet_updated_at?: string | null;
};

type CreditLog = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  amount: number;
  reason: string;
  created_at?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)));
}

export function AdminOffCredits() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const copy = tr ? trCopy : enCopy;
  const [users, setUsers] = useState<CreditUser[]>([]);
  const [recent, setRecent] = useState<CreditLog[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [amount, setAmount] = useState(200);
  const [note, setNote] = useState("ABC Okulları üyelik bonusu");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    if (!query) return users;
    return users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLocaleLowerCase("tr-TR").includes(query));
  }, [users, search]);

  const selectedUser = users.find((user) => user.id === selectedUserId) || null;

  async function loadCredits() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/off-credits", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.loadError);
      setUsers(data?.users || []);
      setRecent(data?.recent || []);
      if (!selectedUserId && data?.users?.[0]?.id) setSelectedUserId(Number(data.users[0].id));
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.loadError });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCredits();
  }, []);

  async function applyCredit(nextAmount = amount) {
    if (!selectedUserId) {
      setStatus({ type: "error", message: copy.selectUser });
      return;
    }

    const normalizedAmount = Math.trunc(Number(nextAmount || 0));
    if (!normalizedAmount) {
      setStatus({ type: "error", message: copy.invalidAmount });
      return;
    }

    if (note.trim().length < 3) {
      setStatus({ type: "error", message: copy.invalidNote });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/off-credits", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, amount: normalizedAmount, note }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || copy.actionError);
      setStatus({ type: "success", message: data?.message || copy.actionOk });
      await loadCredits();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : copy.actionError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.055] p-5 text-white shadow-2xl shadow-amber-500/5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
            <Coins className="h-4 w-4" /> {copy.eyebrow}
          </div>
          <h2 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{copy.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">{copy.subtitle}</p>
        </div>
        <button type="button" onClick={loadCredits} disabled={loading || busy} className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1] disabled:opacity-50">
          {copy.refresh}
        </button>
      </div>

      {status ? (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
          {status.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <label className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <Search className="h-4 w-4 text-white/30" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
          </label>
          <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
            {loading ? <p className="text-sm text-white/45">{copy.loading}</p> : null}
            {!loading && filteredUsers.length === 0 ? <p className="text-sm text-white/45">{copy.noUsers}</p> : null}
            {filteredUsers.map((user) => (
              <button key={user.id} type="button" onClick={() => setSelectedUserId(user.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selectedUserId === user.id ? "border-amber-300/35 bg-amber-300/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"}`}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">{user.name?.slice(0, 1)?.toUpperCase() || "U"}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{user.name}</p>
                  <p className="truncate text-xs text-white/40">{user.email}</p>
                  <p className="mt-1 text-xs text-amber-100/70">{user.role}</p>
                </div>
                <CoinAmount amount={Number(user.balance || 0)} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">{copy.selectedUser}</p>
            {selectedUser ? (
              <>
                <h3 className="mt-3 text-2xl font-medium">{selectedUser.name}</h3>
                <p className="mt-1 text-sm text-white/45">{selectedUser.email}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoBox label={copy.currentBalance} value={<CoinAmount amount={Number(selectedUser.balance || 0)} />} />
                  <InfoBox label={copy.lifetime} value={<CoinAmount amount={Number(selectedUser.lifetime_earned || 0)} />} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-white/45">{copy.selectUser}</p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">{copy.operation}</p>
            <label className="mt-4 block">
              <span className="text-sm text-white/45">{copy.amount}</span>
              <input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
            </label>
            <label className="mt-4 block">
              <span className="text-sm text-white/45">{copy.note}</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button type="button" disabled={busy || !selectedUserId} onClick={() => applyCredit(Math.abs(amount || 0))} className="rounded-full bg-emerald-300 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-200 disabled:opacity-45">
                {copy.add}
              </button>
              <button type="button" disabled={busy || !selectedUserId} onClick={() => applyCredit(-Math.abs(amount || 0))} className="rounded-full border border-red-300/30 bg-red-300/10 px-4 py-3 text-sm font-semibold text-red-100 transition-all hover:bg-red-300/15 disabled:opacity-45">
                {copy.remove}
              </button>
              <button type="button" disabled={busy || !selectedUserId} onClick={() => { setAmount(200); setNote("ABC Okulları üyelik bonusu"); applyCredit(200); }} className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition-all hover:bg-cyan-300/15 disabled:opacity-45">
                +200 ABC
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-white/35">
              <History className="h-4 w-4" /> {copy.recent}
            </div>
            <div className="space-y-3">
              {recent.length === 0 ? <p className="text-sm text-white/45">{copy.noRecent}</p> : null}
              {recent.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.user_name || item.user_email || `#${item.user_id}`}</p>
                      <p className="mt-1 text-xs text-white/40">{item.reason}</p>
                    </div>
                    <span className={Number(item.amount) >= 0 ? "text-emerald-300" : "text-red-300"}>{Number(item.amount) >= 0 ? "+" : ""}{formatNumber(Number(item.amount || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoinAmount({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-white">
      <span>{formatNumber(amount)}</span>
      <span className="inline-flex h-5 w-5 overflow-hidden rounded-full border border-amber-300/30 bg-amber-100/5 p-[1px]">
        <img src={coinIcon} alt="Tech Coin" className="h-full w-full rounded-full object-cover" style={{ clipPath: "circle(50% at 50% 50%)" }} />
      </span>
    </span>
  );
}

function InfoBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-white/35">{label}</p>
      <div className="mt-2 text-xl">{value}</div>
    </div>
  );
}

const trCopy = {
  eyebrow: "OFF ekonomi yönetimi",
  title: "Kullanıcı OFF kredileri",
  subtitle: "Kullanıcıların Tech Coin bakiyelerini gör, ABC Okulları bonusu gibi kampanya kredileri ekle veya gerektiğinde düzeltme yap.",
  refresh: "Yenile",
  search: "Kullanıcı, e-posta veya rol ara...",
  loading: "Kredi verisi yükleniyor...",
  noUsers: "Filtreye uyan kullanıcı yok.",
  selectedUser: "Seçili kullanıcı",
  selectUser: "Önce bir kullanıcı seç.",
  currentBalance: "Mevcut bakiye",
  lifetime: "Toplam kazanılan",
  operation: "Kredi işlemi",
  amount: "Miktar",
  note: "İşlem nedeni",
  add: "Kredi ekle",
  remove: "Kredi çıkar",
  recent: "Son admin işlemleri",
  noRecent: "Henüz admin kredi işlemi yok.",
  loadError: "OFF kredi listesi alınamadı.",
  actionError: "Kredi işlemi yapılamadı.",
  actionOk: "Kredi güncellendi.",
  invalidAmount: "Miktar 0 dışında olmalı.",
  invalidNote: "İşlem nedeni en az 3 karakter olmalı.",
};

const enCopy = {
  ...trCopy,
  eyebrow: "OFF economy management",
  title: "User OFF credits",
  subtitle: "View Tech Coin balances, add campaign credits like ABC Schools bonuses, or make corrections when needed.",
  refresh: "Refresh",
  search: "Search user, email or role...",
  loading: "Loading credit data...",
  noUsers: "No users match the filter.",
  selectedUser: "Selected user",
  selectUser: "Select a user first.",
  currentBalance: "Current balance",
  lifetime: "Lifetime earned",
  operation: "Credit operation",
  amount: "Amount",
  note: "Operation note",
  add: "Add credit",
  remove: "Remove credit",
  recent: "Recent admin actions",
  noRecent: "No admin credit actions yet.",
  loadError: "OFF credit list could not be loaded.",
  actionError: "Credit action failed.",
  actionOk: "Credit updated.",
  invalidAmount: "Amount must not be 0.",
  invalidNote: "Operation note must be at least 3 characters.",
};
