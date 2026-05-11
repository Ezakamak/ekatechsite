import { useEffect, useState } from "react";
import { LanguageProvider } from "./i18n";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Projects } from "./components/Projects";
import { BeforeAfter } from "./components/BeforeAfter";
import { AutomationSimulator } from "./components/AutomationSimulator";
import { TechStack } from "./components/TechStack";
import { CTA } from "./components/CTA";
import { ReactionTime } from "./components/ReactionTime";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { Loader } from "./components/Loader";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [languageLoading, setLanguageLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 3600);
    return () => window.clearTimeout(timer);
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

  return (
    <LanguageProvider>
      <Loader show={loading || languageLoading} />
      <div className="min-h-screen bg-black dark">
        <Navbar />
        <Hero />
        <About />
        <Projects />
        <BeforeAfter />
        <AutomationSimulator />
        <TechStack />
        <CTA />
        <ReactionTime />
        <Contact />
        <Footer />
      </div>
    </LanguageProvider>
  );
}
