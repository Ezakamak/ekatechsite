import { useEffect, useMemo, useState } from "react";
import { Activity, Coins, Gamepad2, Search, Shield, TrendingUp, UserRound } from "lucide-react";
import { useLanguage } from "../i18n";

type UserRow = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
  created_at?: string | null;
  last_login_at?: string | null;
  last_activity_at?: string | null;
  wallet?: { balance: number; lifetime_earned: number };
  game_stats?: Record<string, GameStats>;
  market_stats?: MarketStats;
};

type GameStats = {
  label: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  last_played_at?: string | null;
};

type MarketStats = {
  trades: number;
  buys: number;
  sells: number;
  buy_total: number;
  sell_total: number;
  net_flow: number;
  last_trade_at?: string | null;
};

type TimelineItem = {
  type: string;
  title: string;
  detail: string;
  created_at?: string | null;
  amount?: number | null;
  status?: string | null;
};

type UserDetail = {
  user: UserRow;
  last_login_at?: string | null;
  wallet?: { balance: number; lifetime_earned: number; updated_at?: string | null };
  game_stats?: Record<string, GameStats>;
  market_stats?: MarketStats;
  holdings?: Array<{ symbol: string; shares: number; name?: string | null; price?: number; value?: number; updated_at?: string | null }>;
  login_history?: Array<{ created_at?: string | null; expires_at?: string | null }>;
  timeline?: TimelineItem[];
};

function formatDate(value?: string | null, locale = "tr-TR") {
  if (!value) return "-";
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatNumber(value?: number | string | null, locale = "tr-TR") {
  const number = Number(value || 0);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
}

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "U";
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function avatar(user?: UserRow | null) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white text-sm font-semibold text-black">
      {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(user?.name, user?.email)}
    </div>
  );
}

export function AdminUserActivity() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const locale = tr ? "tr-TR" : "en-US";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const c = useMemo(() => tr ? {
    title: "Kullanıcı aktivite detayı",
    subtitle: "Kullanıcı seç; son girişini, OFF oyunlarını, InvestSim al/satlarını, kazanç/kayıp ve Tech Coin hareketlerini gör.",
    search: "Kullanıcı ara...",
    lastLogin: "Son giriş",
    lastActivity: "Son aktivite",
    wallet: "Tech Coin cüzdanı",
    lifetime: "Toplam kazanım",
    market: "InvestSim özeti",
    games: "OFF oyun geçmişi",
    holdings: "Aktif hisseleri",
    timeline: "Detaylı hareket dökümü",
    logins: "Son oturumlar",
    buys: "Alış",
    sells: "Satış",
    trades: "İşlem",
    net: "Net akış",
    played: "Oynadı",
    wins: "Kazandı",
    losses: "Kaybetti",
    draws: "Berabere",
    empty: "Bu kullanıcı için kayıt bulunamadı.",
    select: "Detayı aç",
    refresh: "Yenile",
    noSelection: "Soldan bir kullanıcı seç.",
  } : {
    title: "User activity detail",
    subtitle: "Select a user and inspect last login, OFF games, InvestSim trades, wins/losses and Tech Coin movements.",
    search: "Search user...",
    lastLogin: "Last login",
    lastActivity: "Last activity",
    wallet: "Tech Coin wallet",
    lifetime: "Lifetime earned",
    market: "InvestSim summary",
    games: "OFF game history",
    holdings: "Active holdings",
    timeline: "Detailed activity log",
    logins: "Recent sessions",
    buys: "Buys",
    sells: "Sells",
    trades: "Trades",
    net: "Net flow",
    played: "Played",
    wins: "Wins",
    losses: "Losses",
    draws: "Draws",
    empty: "No records for this user.",
    select: "Open detail",
    refresh: "Refresh",
    noSelection: "Select a user from the left.",
  }, [tr]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => !q || `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(q));
  }, [users, query]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/user-activity", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Aktivite listesi alınamadı.");
      const rows = data?.users || [];
      setUsers(rows);
      if (!selectedId && rows[0]?.id) {
        setSelectedId(Number(rows[0].id));
        await loadDetail(Number(rows[0].id));
      } else if (selectedId) {
        await loadDetail(selectedId);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktivite listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: number) {
    setSelectedId(id);
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/user-activity?user_id=${id}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) throw new Error(data?.error || "Kullanıcı detayı alınamadı.");
      setDetail(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kullanıcı detayı alınamadı.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const selectedUser = detail?.user || users.find((user) => Number(user.id) === Number(selectedId)) || null;
  const gameStats = detail?.game_stats || selectedUser?.game_stats || {};
  const marketStats = detail?.market_stats || selectedUser?.market_stats || { trades: 0, buys: 0, sells: 0, buy_total: 0, sell_total: 0, net_flow: 0 };
  const wallet = detail?.wallet || selectedUser?.wallet || { balance: 0, lifetime_earned: 0 };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 text-white backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-medium text-cyan-100">
            Admin Intelligence
          </div>
          <h2 className="mt-3 text-3xl font-medium tracking-tight">{c.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{c.subtitle}</p>
        </div>
        <button onClick={loadUsers} disabled={loading || detailLoading} className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.1] disabled:opacity-50">
          {loading ? "..." : c.refresh}
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} className="w-full rounded-2xl border border-white/10 bg-black/45 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/25" />
          </label>
          <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filteredUsers.map((user) => {
              const active = Number(user.id) === Number(selectedId);
              return (
                <button key={user.id} onClick={() => loadDetail(Number(user.id))} className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"}`}>
                  <div className="flex items-center gap-3">
                    {avatar(user)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{user.name}</p>
                        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45">{user.role}</span>
                      </div>
                      <p className="truncate text-xs text-white/40">{user.email}</p>
                      <p className="mt-1 text-[11px] text-white/30">{c.lastActivity}: {formatDate(user.last_activity_at || user.last_login_at, locale)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {!filteredUsers.length && <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/45">{c.empty}</p>}
          </div>
        </div>

        <div className="min-h-[520px] rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
          {!selectedUser ? <div className="flex h-full items-center justify-center text-white/45">{c.noSelection}</div> : (
            <div className="space-y-5 opacity-100 transition-opacity">
              <div className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  {avatar(selectedUser)}
                  <div>
                    <h3 className="text-2xl font-semibold">{selectedUser.name}</h3>
                    <p className="text-sm text-white/45">{selectedUser.email}</p>
                    <p className="mt-1 text-xs text-white/35">#{selectedUser.id} · {selectedUser.role}</p>
                  </div>
                </div>
                {detailLoading && <span className="rounded-full bg-white/[0.08] px-4 py-2 text-sm text-white/50">Yükleniyor...</span>}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MiniStat icon={<UserRound className="h-4 w-4" />} label={c.lastLogin} value={formatDate(detail?.last_login_at || selectedUser.last_login_at, locale)} />
                <MiniStat icon={<Activity className="h-4 w-4" />} label={c.lastActivity} value={formatDate(selectedUser.last_activity_at || detail?.last_login_at, locale)} />
                <MiniStat icon={<Coins className="h-4 w-4" />} label={c.wallet} value={formatNumber(wallet.balance, locale)} />
                <MiniStat icon={<Shield className="h-4 w-4" />} label={c.lifetime} value={formatNumber(wallet.lifetime_earned, locale)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <InfoPanel title={c.market} icon={<TrendingUp className="h-5 w-5 text-emerald-100" />}>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label={c.trades} value={formatNumber(marketStats.trades, locale)} />
                    <Metric label={c.buys} value={`${formatNumber(marketStats.buys, locale)} · ${formatNumber(marketStats.buy_total, locale)}`} />
                    <Metric label={c.sells} value={`${formatNumber(marketStats.sells, locale)} · ${formatNumber(marketStats.sell_total, locale)}`} />
                    <Metric label={c.net} value={formatNumber(marketStats.net_flow, locale)} />
                  </div>
                </InfoPanel>

                <InfoPanel title={c.games} icon={<Gamepad2 className="h-5 w-5 text-purple-100" />}>
                  <div className="space-y-2">
                    {Object.entries(gameStats).map(([key, game]) => (
                      <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{game.label}</p>
                          <p className="text-xs text-white/35">{formatDate(game.last_played_at, locale)}</p>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-white/50">
                          <span>{c.played}: {game.played}</span>
                          <span className="text-emerald-100">{c.wins}: {game.wins}</span>
                          <span className="text-red-100">{c.losses}: {game.losses}</span>
                          <span>{c.draws}: {game.draws}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </InfoPanel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <InfoPanel title={c.holdings} icon={<TrendingUp className="h-5 w-5 text-cyan-100" />}>
                  <div className="space-y-2">
                    {(detail?.holdings || []).length === 0 && <p className="text-sm text-white/45">{c.empty}</p>}
                    {(detail?.holdings || []).map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                        <div>
                          <p className="font-medium">{item.symbol} · {item.name || ""}</p>
                          <p className="text-xs text-white/40">{formatNumber(item.shares, locale)} adet</p>
                        </div>
                        <p className="text-cyan-100">{formatNumber(item.value, locale)}</p>
                      </div>
                    ))}
                  </div>
                </InfoPanel>

                <InfoPanel title={c.logins} icon={<UserRound className="h-5 w-5 text-white/70" />}>
                  <div className="space-y-2">
                    {(detail?.login_history || []).length === 0 && <p className="text-sm text-white/45">{c.empty}</p>}
                    {(detail?.login_history || []).map((item, index) => (
                      <div key={`${item.created_at}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                        <p>{formatDate(item.created_at, locale)}</p>
                        <p className="text-xs text-white/35">expires: {formatDate(item.expires_at, locale)}</p>
                      </div>
                    ))}
                  </div>
                </InfoPanel>
              </div>

              <InfoPanel title={c.timeline} icon={<Activity className="h-5 w-5 text-cyan-100" />}>
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {(detail?.timeline || []).length === 0 && <p className="text-sm text-white/45">{c.empty}</p>}
                  {(detail?.timeline || []).map((item, index) => (
                    <div key={`${item.type}-${item.created_at}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-white/45">{item.detail}</p>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs ${item.type === "market" ? "bg-emerald-300/10 text-emerald-100" : item.type === "game" ? "bg-purple-300/10 text-purple-100" : "bg-cyan-300/10 text-cyan-100"}`}>{item.type}</span>
                      </div>
                      <p className="mt-2 text-xs text-white/30">{formatDate(item.created_at, locale)}</p>
                    </div>
                  ))}
                </div>
              </InfoPanel>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center gap-2 text-white/45">{icon}<span className="text-xs">{label}</span></div><p className="mt-2 break-words text-lg font-medium text-white">{value}</p></div>;
}

function InfoPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4"><div className="mb-3 flex items-center gap-2"><span>{icon}</span><h3 className="text-lg font-medium">{title}</h3></div>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-xs text-white/35">{label}</p><p className="mt-1 font-medium text-white">{value}</p></div>;
}
