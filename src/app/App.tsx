import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { LanguageProvider } from "./i18n";
import { Navbar } from "./components/Navbar";
import { Loader } from "./components/Loader";
import { ScrollProgress } from "./components/ScrollProgress";
import { CommandMenu } from "./components/CommandMenu";
import { BackToTop } from "./components/BackToTop";
import { CookieConsent } from "./components/CookieConsent";
import { AnnouncementPopup } from "./components/AnnouncementPopup";
import { MaintenanceGate } from "./components/MaintenanceGate";

const Hero = lazy(() =>
  import("./components/Hero").then((module) => ({ default: module.Hero })),
);
const About = lazy(() =>
  import("./components/About").then((module) => ({ default: module.About })),
);
const ServiceDetails = lazy(() =>
  import("./components/ServiceDetails").then((module) => ({
    default: module.ServiceDetails,
  })),
);
const Projects = lazy(() =>
  import("./components/Projects").then((module) => ({
    default: module.Projects,
  })),
);
const BeforeAfter = lazy(() =>
  import("./components/BeforeAfter").then((module) => ({
    default: module.BeforeAfter,
  })),
);
const AutomationSimulator = lazy(() =>
  import("./components/AutomationSimulator").then((module) => ({
    default: module.AutomationSimulator,
  })),
);
const SystemStatus = lazy(() =>
  import("./components/SystemStatus").then((module) => ({
    default: module.SystemStatus,
  })),
);
const ProjectEstimator = lazy(() =>
  import("./components/ProjectEstimator").then((module) => ({
    default: module.ProjectEstimator,
  })),
);
const HowWeWork = lazy(() =>
  import("./components/HowWeWork").then((module) => ({
    default: module.HowWeWork,
  })),
);
const TechStack = lazy(() =>
  import("./components/TechStack").then((module) => ({
    default: module.TechStack,
  })),
);
const CTA = lazy(() =>
  import("./components/CTA").then((module) => ({ default: module.CTA })),
);
const ReactionTime = lazy(() =>
  import("./components/ReactionTime").then((module) => ({
    default: module.ReactionTime,
  })),
);
const FAQAccordion = lazy(() =>
  import("./components/FAQAccordion").then((module) => ({
    default: module.FAQAccordion,
  })),
);
const Contact = lazy(() =>
  import("./components/Contact").then((module) => ({
    default: module.Contact,
  })),
);
const Footer = lazy(() =>
  import("./components/Footer").then((module) => ({ default: module.Footer })),
);
const AdminPanel = lazy(() =>
  import("./components/AdminPanel").then((module) => ({
    default: module.AdminPanel,
  })),
);
const AdminOffCredits = lazy(() =>
  import("./components/AdminOffCredits").then((module) => ({
    default: module.AdminOffCredits,
  })),
);
const AdminUserActivity = lazy(() =>
  import("./components/AdminUserActivity").then((module) => ({
    default: module.AdminUserActivity,
  })),
);
const AdminBotProfiles = lazy(() =>
  import("./components/AdminBotProfiles").then((module) => ({
    default: module.AdminBotProfiles,
  })),
);
const AdminApprovalCenter = lazy(() =>
  import("./components/AdminApprovalCenter").then((module) => ({
    default: module.AdminApprovalCenter,
  })),
);
const AdminStockSubmissions = lazy(() =>
  import("./components/AdminStockSubmissions").then((module) => ({
    default: module.AdminStockSubmissions,
  })),
);
const ProjectRequestPanel = lazy(() =>
  import("./components/ProjectRequestPanel").then((module) => ({
    default: module.ProjectRequestPanel,
  })),
);
const AuthPage = lazy(() =>
  import("./components/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
const AccountPage = lazy(() =>
  import("./components/AccountPage").then((module) => ({
    default: module.AccountPage,
  })),
);
const AnnouncementAdmin = lazy(() =>
  import("./components/AnnouncementAdmin").then((module) => ({
    default: module.AnnouncementAdmin,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("./components/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const AdminAuditLogs = lazy(() =>
  import("./components/AdminAuditLogs").then((module) => ({
    default: module.AdminAuditLogs,
  })),
);
const AdminChat = lazy(() =>
  import("./components/AdminChat").then((module) => ({
    default: module.AdminChat,
  })),
);
const AdminTodoPanel = lazy(() =>
  import("./components/AdminTodoPanel").then((module) => ({
    default: module.AdminTodoPanel,
  })),
);
const AdminProjectTools = lazy(() =>
  import("./components/AdminProjectTools").then((module) => ({
    default: module.AdminProjectTools,
  })),
);
const MaintenancePanel = lazy(() =>
  import("./components/MaintenancePanel").then((module) => ({
    default: module.MaintenancePanel,
  })),
);
const OffPage = lazy(() =>
  import("./components/OffPage").then((module) => ({
    default: module.OffPage,
  })),
);
const CoreClash = lazy(() =>
  import("./components/CoreClashVisualEffects").then((module) => ({
    default: module.CoreClash,
  })),
);
const AutoEnterLobbies = lazy(() =>
  import("./components/AutoEnterLobbies").then((module) => ({
    default: module.AutoEnterLobbies,
  })),
);
const GamePresenceManager = lazy(() =>
  import("./components/GamePresenceManager").then((module) => ({
    default: module.GamePresenceManager,
  })),
);
const OffSoundEngine = lazy(() =>
  import("./components/OffSoundEngine").then((module) => ({
    default: module.OffSoundEngine,
  })),
);
const TechCoinWalletBadge = lazy(() =>
  import("./components/TechCoinWalletBadge").then((module) => ({
    default: module.TechCoinWalletBadge,
  })),
);
const TechAviator = lazy(() =>
  import("./components/tech-aviator/TechAviator").then((module) => ({
    default: module.TechAviator,
  })),
);
const SecurePaymentGateway = lazy(() =>
  import("./components/SecurePaymentGateway").then((module) => ({
    default: module.SecurePaymentGateway,
  })),
);

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("EkaTech arayüzü güvenli moda alındı", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4 py-16 text-white sm:px-6">
        <div className="max-w-xl rounded-[2rem] border border-red-300/20 bg-red-500/10 p-6 text-center shadow-2xl shadow-red-500/10 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-100/70">
            Güvenli mod
          </p>
          <h1 className="mt-4 text-3xl font-semibold">
            Site yüklenirken bir modül hata verdi.
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Siyah ekranda kalmaman için arayüzü güvenli moda aldım. Sayfayı
            yenileyerek tekrar deneyebilirsin.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Sayfayı yenile
          </button>
        </div>
      </main>
    );
  }
}

function getCurrentPath() {
  if (typeof window === "undefined") return "/";

  const searchParams = new URLSearchParams(window.location.search);
  const forgotMode =
    searchParams.get("forgot") === "1" ||
    searchParams.get("reset") === "1" ||
    searchParams.get("mode") === "forgot";

  if (forgotMode) return "/forgot-password";

  const pathname = window.location.pathname.replace(/\/+$/, "");
  return pathname || "/";
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [languageLoading, setLanguageLoading] = useState(false);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [checkoutRedirecting, setCheckoutRedirecting] = useState(false);
  const [paymentToast, setPaymentToast] = useState("");
  const [path, setPath] = useState(getCurrentPath);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 3600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setPath(getCurrentPath());

    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("ekatech-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("ekatech-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    let languageTimer: number | undefined;

    const handleLanguageSwitch = () => {
      setLanguageLoading(true);
      if (languageTimer) window.clearTimeout(languageTimer);

      languageTimer = window.setTimeout(() => {
        setLanguageLoading(false);
      }, 750);
    };

    window.addEventListener("ekatech-language-switch", handleLanguageSwitch);

    return () => {
      if (languageTimer) window.clearTimeout(languageTimer);
      window.removeEventListener(
        "ekatech-language-switch",
        handleLanguageSwitch,
      );
    };
  }, []);

  useEffect(() => {
    let redirectTimer: number | undefined;
    let toastTimer: number | undefined;

    const clearRedirect = () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
      redirectTimer = undefined;
    };

    const startCheckoutRedirect = (event?: Event) => {
      const pack = (event as CustomEvent | undefined)?.detail;
      if (pack) window.sessionStorage.setItem("ekatech:checkout-package", JSON.stringify(pack));
      clearRedirect();
      setCheckoutRedirecting(true);
      redirectTimer = window.setTimeout(() => {
        window.history.pushState({}, "", "/gateway/secure-pay");
        window.dispatchEvent(new Event("ekatech-route-change"));
        window.scrollTo({ top: 0, behavior: "smooth" });
        setCheckoutRedirecting(false);
      }, 1700);
    };

    const showPaymentToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setPaymentToast(
        customEvent.detail?.message ||
          "Ödeme işlemi gerçekleştirilemediği için iptal edildi",
      );

      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => setPaymentToast(""), 5200);
    };

    window.addEventListener(
      "ekatech-start-techcoin-checkout",
      startCheckoutRedirect,
    );
    window.addEventListener("ekatech-payment-cancelled", showPaymentToast);

    return () => {
      clearRedirect();
      if (toastTimer) window.clearTimeout(toastTimer);
      window.removeEventListener(
        "ekatech-start-techcoin-checkout",
        startCheckoutRedirect,
      );
      window.removeEventListener("ekatech-payment-cancelled", showPaymentToast);
    };
  }, []);

  useEffect(() => {
    let fallbackTimer: number | undefined;
    let settleTimer: number | undefined;

    const clearTimers = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (settleTimer) window.clearTimeout(settleTimer);
      fallbackTimer = undefined;
      settleTimer = undefined;
    };

    const startTransition = () => {
      clearTimers();
      setTransitionLoading(true);
      fallbackTimer = window.setTimeout(
        () => setTransitionLoading(false),
        2200,
      );
    };

    const endTransition = () => {
      clearTimers();
      settleTimer = window.setTimeout(() => setTransitionLoading(false), 450);
    };

    window.addEventListener("ekatech-transition-start", startTransition);
    window.addEventListener("ekatech-transition-end", endTransition);

    return () => {
      clearTimers();
      window.removeEventListener("ekatech-transition-start", startTransition);
      window.removeEventListener("ekatech-transition-end", endTransition);
    };
  }, []);

  const isSignIn = path === "/signin";
  const isSignUp = path === "/signup";
  const isForgotPassword = path === "/forgot-password";
  const isAdmin = path === "/admin";
  const isAccount = path === "/account";
  const isOff = path === "/off";
  const isCoreClash = path === "/core-clash";
  const isTechAviator = path === "/tech-aviator";
  const isGateway =
    path === "/gateway/secure-pay" || path === "/checkout/simulated-gate";

  return (
    <LanguageProvider>
      <AppErrorBoundary>
        <Loader
          show={!isGateway && (loading || languageLoading || transitionLoading)}
        />
        <CheckoutRedirectOverlay show={checkoutRedirecting} />
        <PaymentCancelledToast message={paymentToast} />
        {!isGateway ? (
          <>
            <ScrollProgress />
            <CommandMenu />
            <BackToTop />
            <CookieConsent />
            <AnnouncementPopup />
            <MaintenanceGate />
            <Suspense fallback={null}>
              <AutoEnterLobbies />
              <GamePresenceManager />
              <OffSoundEngine />
            </Suspense>
          </>
        ) : null}
        {isCoreClash ? (
          <div className="fixed right-5 top-24 z-[80] px-2 sm:right-6">
            <Suspense fallback={null}>
              <TechCoinWalletBadge />
            </Suspense>
          </div>
        ) : null}
        {isGateway ? (
          <Suspense
            fallback={
              <div className="min-h-screen bg-[#eef2f7]" aria-live="polite" />
            }
          >
            <SecurePaymentGateway />
          </Suspense>
        ) : (
          <div className="min-h-screen bg-black dark">
            <Navbar />

            <Suspense
              fallback={
                <div className="min-h-screen bg-black" aria-live="polite" />
              }
            >
              {isSignIn ? (
                <AuthPage mode="login" />
              ) : isSignUp ? (
                <AuthPage mode="signup" />
              ) : isForgotPassword ? (
                <ForgotPasswordPage />
              ) : isAdmin ? (
                <>
                  <AdminPanel />
                  <div className="bg-black px-4 pb-24 sm:px-6">
                    <div className="mx-auto max-w-7xl space-y-6">
                      <AdminOffCredits />
                      <AdminUserActivity />
                      <AdminBotProfiles />
                      <AdminApprovalCenter />
                      <AdminStockSubmissions />
                      <MaintenancePanel />
                      <AdminTodoPanel />
                      <AdminProjectTools />
                      <AdminChat />
                      <AnnouncementAdmin />
                      <AdminAuditLogs />
                    </div>
                  </div>
                </>
              ) : isAccount ? (
                <AccountPage />
              ) : isOff ? (
                <OffPage />
              ) : isCoreClash ? (
                <CoreClash />
              ) : isTechAviator ? (
                <TechAviator />
              ) : (
                <>
                  <Hero />
                  <ProjectRequestPanel />
                  <About />
                  <ServiceDetails />
                  <Projects />
                  <BeforeAfter />
                  <div id="automation">
                    <AutomationSimulator />
                  </div>
                  <SystemStatus />
                  <ProjectEstimator />
                  <HowWeWork />
                  <TechStack />
                  <CTA />
                  <ReactionTime />
                  <FAQAccordion />
                  <Contact />
                  <Footer />
                </>
              )}
            </Suspense>
          </div>
        )}
      </AppErrorBoundary>
    </LanguageProvider>
  );
}

function CheckoutRedirectOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 px-4 text-white backdrop-blur-xl"
      role="status"
      aria-live="assertive"
    >
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl shadow-cyan-500/10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-300/10">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-100/25 border-t-cyan-100" />
        </div>
        <h2 className="mt-6 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Güvenli Ödeme Sayfasına Yönlendiriliyorsunuz...
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-300">
          Lütfen tarayıcınızı kapatmayın. EkaPay Secure ödeme geçidi ile şifreli
          oturum hazırlanıyor.
        </p>
        <div className="mt-6 rounded-2xl border border-emerald-200/15 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          256-Bit SSL bağlantı kontrolü tamamlandı. Yönlendirme birkaç saniye
          içinde yapılacaktır.
        </div>
      </div>
    </div>
  );
}

function PaymentCancelledToast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[210] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-red-200/25 bg-slate-950 px-5 py-4 text-sm font-semibold text-red-50 shadow-2xl shadow-red-950/40"
      role="alert"
    >
      {message}
    </div>
  );
}
