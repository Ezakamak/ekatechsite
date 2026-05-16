import { lazy, Suspense, useEffect, useState } from "react";
import { LanguageProvider } from "./i18n";
import { Navbar } from "./components/Navbar";
import { Loader } from "./components/Loader";
import { ScrollProgress } from "./components/ScrollProgress";
import { CommandMenu } from "./components/CommandMenu";
import { BackToTop } from "./components/BackToTop";
import { CookieConsent } from "./components/CookieConsent";
import { AnnouncementPopup } from "./components/AnnouncementPopup";
import { MaintenanceGate } from "./components/MaintenanceGate";

const Hero = lazy(() => import("./components/Hero").then((module) => ({ default: module.Hero })));
const About = lazy(() => import("./components/About").then((module) => ({ default: module.About })));
const ServiceDetails = lazy(() => import("./components/ServiceDetails").then((module) => ({ default: module.ServiceDetails })));
const Projects = lazy(() => import("./components/Projects").then((module) => ({ default: module.Projects })));
const BeforeAfter = lazy(() => import("./components/BeforeAfter").then((module) => ({ default: module.BeforeAfter })));
const AutomationSimulator = lazy(() => import("./components/AutomationSimulator").then((module) => ({ default: module.AutomationSimulator })));
const SystemStatus = lazy(() => import("./components/SystemStatus").then((module) => ({ default: module.SystemStatus })));
const ProjectEstimator = lazy(() => import("./components/ProjectEstimator").then((module) => ({ default: module.ProjectEstimator })));
const HowWeWork = lazy(() => import("./components/HowWeWork").then((module) => ({ default: module.HowWeWork })));
const TechStack = lazy(() => import("./components/TechStack").then((module) => ({ default: module.TechStack })));
const CTA = lazy(() => import("./components/CTA").then((module) => ({ default: module.CTA })));
const ReactionTime = lazy(() => import("./components/ReactionTime").then((module) => ({ default: module.ReactionTime })));
const FAQAccordion = lazy(() => import("./components/FAQAccordion").then((module) => ({ default: module.FAQAccordion })));
const Contact = lazy(() => import("./components/Contact").then((module) => ({ default: module.Contact })));
const Footer = lazy(() => import("./components/Footer").then((module) => ({ default: module.Footer })));
const AdminPanel = lazy(() => import("./components/AdminPanel").then((module) => ({ default: module.AdminPanel })));
const AdminOffCredits = lazy(() => import("./components/AdminOffCredits").then((module) => ({ default: module.AdminOffCredits })));
const AdminUserActivity = lazy(() => import("./components/AdminUserActivity").then((module) => ({ default: module.AdminUserActivity })));
const AdminBotProfiles = lazy(() => import("./components/AdminBotProfiles").then((module) => ({ default: module.AdminBotProfiles })));
const AdminApprovalCenter = lazy(() => import("./components/AdminApprovalCenter").then((module) => ({ default: module.AdminApprovalCenter })));
const AdminStockSubmissions = lazy(() => import("./components/AdminStockSubmissions").then((module) => ({ default: module.AdminStockSubmissions })));
const ProjectRequestPanel = lazy(() => import("./components/ProjectRequestPanel").then((module) => ({ default: module.ProjectRequestPanel })));
const AuthPage = lazy(() => import("./components/AuthPage").then((module) => ({ default: module.AuthPage })));
const AccountPage = lazy(() => import("./components/AccountPage").then((module) => ({ default: module.AccountPage })));
const AnnouncementAdmin = lazy(() => import("./components/AnnouncementAdmin").then((module) => ({ default: module.AnnouncementAdmin })));
const ForgotPasswordPage = lazy(() => import("./components/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const AdminAuditLogs = lazy(() => import("./components/AdminAuditLogs").then((module) => ({ default: module.AdminAuditLogs })));
const AdminChat = lazy(() => import("./components/AdminChat").then((module) => ({ default: module.AdminChat })));
const AdminTodoPanel = lazy(() => import("./components/AdminTodoPanel").then((module) => ({ default: module.AdminTodoPanel })));
const AdminProjectTools = lazy(() => import("./components/AdminProjectTools").then((module) => ({ default: module.AdminProjectTools })));
const MaintenancePanel = lazy(() => import("./components/MaintenancePanel").then((module) => ({ default: module.MaintenancePanel })));
const OffPage = lazy(() => import("./components/OffPage").then((module) => ({ default: module.OffPage })));
const CoreClash = lazy(() => import("./components/CoreClashVisualEffects").then((module) => ({ default: module.CoreClash })));
const AutoEnterLobbies = lazy(() => import("./components/AutoEnterLobbies").then((module) => ({ default: module.AutoEnterLobbies })));
const GamePresenceManager = lazy(() => import("./components/GamePresenceManager").then((module) => ({ default: module.GamePresenceManager })));
const OffSoundEngine = lazy(() => import("./components/OffSoundEngine").then((module) => ({ default: module.OffSoundEngine })));
const TechCoinWalletBadge = lazy(() => import("./components/TechCoinWalletBadge").then((module) => ({ default: module.TechCoinWalletBadge })));
const TechAviator = lazy(() => import("./components/tech-aviator/TechAviator").then((module) => ({ default: module.TechAviator })));

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
      window.removeEventListener("ekatech-language-switch", handleLanguageSwitch);
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
      fallbackTimer = window.setTimeout(() => setTransitionLoading(false), 2200);
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

  return (
    <LanguageProvider>
      <Loader show={loading || languageLoading || transitionLoading} />
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
      {isCoreClash ? (
        <div className="fixed right-5 top-24 z-[80] px-2 sm:right-6">
          <Suspense fallback={null}>
            <TechCoinWalletBadge />
          </Suspense>
        </div>
      ) : null}
      <div className="min-h-screen bg-black dark">
        <Navbar />

        <Suspense fallback={<div className="min-h-screen bg-black" aria-live="polite" />}>
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
    </LanguageProvider>
  );
}
