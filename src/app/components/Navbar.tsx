import { MouseEvent, useEffect, useMemo, useState } from "react";
import logo from "../../imports/View_recent_photos.png";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, ChevronDown } from "lucide-react";
import { useLanguage } from "../i18n";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
};

type SwitchAccount = User & {
  active?: boolean;
};

export function Navbar() {
  const { language, setLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<SwitchAccount[]>([]);

  const nav =
    language === "tr"
      ? {
          about: "Hakkında",
          services: "Servisler",
          projects: "Projeler",
          admin: "Admin",
          signin: "Sign In",
          signup: "Sign Up",
          account: "Hesabım",
          estimator: "Hesaplayıcı",
          faq: "SSS",
          contact: "İletişim",
          cta: "Başlayalım",
          menu: "Menü",
          switchAccount: "Hesap değiştir",
          addAccount: "Hesap ekle",
          current: "Aktif",
        }
      : {
          about: "About",
          services: "Services",
          projects: "Projects",
          admin: "Admin",
          signin: "Sign In",
          signup: "Sign Up",
          account: "Account",
          estimator: "Estimator",
          faq: "FAQ",
          contact: "Contact",
          cta: "Get Started",
          menu: "Menu",
          switchAccount: "Switch account",
          addAccount: "Add account",
          current: "Active",
        };

  const initials = useMemo(() => {
    const source = user?.name || user?.email || "E";
    return getInitials(source);
  }, [user]);

  const canUseAdmin = user?.role === "admin" || user?.role === "owner";

  const links = [
    { href: "/#about", label: nav.about },
    { href: "/#services", label: nav.services },
    { href: "/#projects", label: nav.projects },
    ...(canUseAdmin ? [{ href: "/admin", label: nav.admin }] : []),
    { href: "/#estimator", label: nav.estimator },
    { href: "/#faq", label: nav.faq },
    { href: "/#contact", label: nav.contact },
  ];

  const closeMobile = () => setMobileOpen(false);

  const refreshAccounts = () => {
    fetch("/api/account-switch", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => setAccounts(data?.accounts || []))
      .catch(() => setAccounts([]));
  };

  const refreshUser = () => {
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        setUser(data?.user || null);
        if (data?.user) refreshAccounts();
        else setAccounts([]);
      })
      .catch(() => {
        setUser(null);
        setAccounts([]);
      });
  };

  useEffect(() => {
    refreshUser();

    window.addEventListener("ekatech-auth-change", refreshUser);
    window.addEventListener("focus", refreshUser);

    return () => {
      window.removeEventListener("ekatech-auth-change", refreshUser);
      window.removeEventListener("focus", refreshUser);
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const close = (event: MouseEvent | Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.("[data-account-menu]")) setAccountMenuOpen(false);
    };

    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [accountMenuOpen]);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    closeMobile();
    setAccountMenuOpen(false);

    if (typeof window === "undefined") return;

    event.preventDefault();
    window.history.pushState({}, "", href);
    window.dispatchEvent(new Event("ekatech-route-change"));

    if (href.includes("#")) {
      const hash = href.split("#")[1];
      window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 50);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const switchAccount = async (userId: number) => {
    try {
      const response = await fetch("/api/account-switch", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) return;

      const data = await response.json().catch(() => null);
      if (data?.user) {
        setUser(data.user);
        setAccountMenuOpen(false);
        window.dispatchEvent(new Event("ekatech-auth-change"));
        window.history.pushState({}, "", "/account");
        window.dispatchEvent(new Event("ekatech-route-change"));
      }
    } catch {
      undefined;
    }
  };

  const Avatar = ({ size = "small", account }: { size?: "small" | "medium"; account?: User | null }) => {
    const target = account || user;
    const source = target?.name || target?.email || "E";

    return (
      <span className={`${size === "medium" ? "h-10 w-10" : "h-9 w-9"} flex overflow-hidden items-center justify-center rounded-full bg-white text-sm font-semibold text-black`}>
        {target?.avatar_url ? (
          <img src={target.avatar_url} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          getInitials(source)
        )}
      </span>
    );
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/45 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="/" onClick={(event) => navigate(event, "/")} className="flex items-center gap-3">
          <img src={logo} alt="EkaTech Logo" className="h-10 w-10 object-contain" />
          <span className="font-medium tracking-tight text-white">EkaTech</span>
        </a>

        <div className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={(event) => navigate(event, link.href)} className="text-sm text-gray-400 transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                language === "en" ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("tr")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                language === "tr" ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              TR
            </button>
          </div>

          {user ? (
            <div className="relative" data-account-menu>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAccountMenuOpen((value) => !value);
                  refreshAccounts();
                }}
                className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] py-1 pl-1 pr-3 text-white transition-all duration-300 hover:bg-white/[0.1]"
                aria-label={nav.account}
              >
                <Avatar />
                <span className="hidden max-w-28 truncate text-sm font-medium sm:block">{user.name}</span>
                <ChevronDown className="hidden h-4 w-4 text-white/45 sm:block" />
              </button>

              <AnimatePresence>
                {accountMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-black/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
                  >
                    <a
                      href="/account"
                      onClick={(event) => navigate(event, "/account")}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-white transition-colors hover:bg-white/[0.06]"
                    >
                      <Avatar size="medium" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-white/45">{user.email}</p>
                      </div>
                    </a>

                    <div className="my-2 h-px bg-white/10" />
                    <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.18em] text-white/35">{nav.switchAccount}</p>

                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => account.active ? undefined : switchAccount(account.id)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-white transition-colors hover:bg-white/[0.06] disabled:opacity-70"
                          disabled={account.active}
                        >
                          <Avatar account={account} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{account.name}</p>
                            <p className="truncate text-xs text-white/40">{account.email}</p>
                          </div>
                          {account.active && <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100">{nav.current}</span>}
                        </button>
                      ))}
                    </div>

                    <a
                      href="/api/start-account-add"
                      className="mt-2 block rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-white/[0.1]"
                    >
                      + {nav.addAccount}
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <a
                href="/signin"
                onClick={(event) => navigate(event, "/signin")}
                className="hidden rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 font-medium text-white transition-all duration-300 hover:bg-white/[0.1] sm:block"
              >
                {nav.signin}
              </a>

              <a
                href="/signup"
                onClick={(event) => navigate(event, "/signup")}
                className="hidden rounded-full bg-white px-5 py-2 font-medium text-black transition-all duration-300 hover:bg-gray-200 sm:block"
              >
                {nav.signup}
              </a>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white lg:hidden"
            aria-label={nav.menu}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="border-t border-white/5 bg-black/90 px-4 pb-5 pt-2 backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto grid max-w-7xl gap-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(event) => navigate(event, link.href)}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-white/75 transition-all hover:bg-white/[0.07] hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              {user ? (
                <>
                  <a
                    href="/account"
                    onClick={(event) => navigate(event, "/account")}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white"
                  >
                    <Avatar size="medium" />
                    <span className="font-medium">{nav.account}</span>
                  </a>
                  <a href="/api/start-account-add" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center font-medium text-white">
                    + {nav.addAccount}
                  </a>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <a href="/signin" onClick={(event) => navigate(event, "/signin")} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center font-medium text-white">
                    {nav.signin}
                  </a>
                  <a href="/signup" onClick={(event) => navigate(event, "/signup")} className="rounded-2xl bg-white px-4 py-3 text-center font-medium text-black">
                    {nav.signup}
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function getInitials(source: string) {
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "E";
}
