import { useEffect, useState } from "react";
import { LanguageProvider } from "./i18n";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { ServiceDetails } from "./components/ServiceDetails";
import { Projects } from "./components/Projects";
import { BeforeAfter } from "./components/BeforeAfter";
import { AutomationSimulator } from "./components/AutomationSimulator";
import { SystemStatus } from "./components/SystemStatus";
import { ProjectEstimator } from "./components/ProjectEstimator";
import { HowWeWork } from "./components/HowWeWork";
import { TechStack } from "./components/TechStack";
import { CTA } from "./components/CTA";
import { ReactionTime } from "./components/ReactionTime";
import { FAQAccordion } from "./components/FAQAccordion";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { Loader } from "./components/Loader";
import { ScrollProgress } from "./components/ScrollProgress";
import { CommandMenu } from "./components/CommandMenu";
import { BackToTop } from "./components/BackToTop";
import { CookieConsent } from "./components/CookieConsent";
import { AdminPanel } from "./components/AdminPanel";
import { AdminOffCredits } from "./components/AdminOffCredits";
import { AdminApprovalCenter } from "./components/AdminApprovalCenter";
import { ProjectRequestPanel } from "./components/ProjectRequestPanel";
import { AuthPage } from "./components/AuthPage";
import { AccountPage } from "./components/AccountPage";
import { AnnouncementAdmin } from "./components/AnnouncementAdmin";
import { AnnouncementPopup } from "./components/AnnouncementPopup";
import { ForgotPasswordPage } from "./components/ForgotPasswordPage";
import { AdminAuditLogs } from "./components/AdminAuditLogs";
import { AdminChat } from "./components/AdminChat";
import { AdminTodoPanel } from "./components/AdminTodoPanel";
import { AdminProjectTools } from "./components/AdminProjectTools";
import { MaintenancePanel } from "./components/MaintenancePanel";
import { MaintenanceGate } from "./components/MaintenanceGate";
import { OffPage } from "./components/OffPage";
import { CoreClash } from "./components/CoreClashVisualEffects";
import { AutoEnterLobbies } from "./components/AutoEnterLobbies";
import { GamePresenceManager } from "./components/GamePresenceManager";

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
    const handleLanguageSwitch = () => {
      setLanguageLoading(true);

      window.setTimeout(() => {
        setLanguageLoading(false);
      }, 750);
    };

    window.addEventListener("ekatech-language-switch", handleLanguageSwitch);

    return () => {
      window.removeEventListener("ekatech-language-switch", handleLanguageSwitch);
    };
  }, []);

  useEffect(() => {
    let fallbackTimer: number | undefined;

    const startTransition = () => {
      setTransitionLoading(true);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => setTransitionLoading(false), 2200);
    };

    const endTransition = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      window.setTimeout(() => setTransitionLoading(false), 450);
    };

    window.addEventListener("ekatech-transition-start", startTransition);
    window.addEventListener("ekatech-transition-end", endTransition);

    return () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
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

  return (
    <LanguageProvider>
      <Loader show={loading || languageLoading || transitionLoading} />
      <ScrollProgress />
      <CommandMenu />
      <BackToTop />
      <CookieConsent />
      <AnnouncementPopup />
      <MaintenanceGate />
      <AutoEnterLobbies />
      <GamePresenceManager />
      <div className="min-h-screen bg-black dark">
        <Navbar />

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
                <AdminApprovalCenter />
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
      </div>
    </LanguageProvider>
  );
}
