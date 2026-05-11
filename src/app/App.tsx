import { useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Projects } from "./components/Projects";
import { TechStack } from "./components/TechStack";
import { CTA } from "./components/CTA";
import { ReactionTime } from "./components/ReactionTime";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { Loader } from "./components/Loader";

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(false);
    }, 3600);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <Loader show={loading} />

      <div className="min-h-screen bg-black dark">
        <Navbar />
        <Hero />
        <About />
        <Projects />
        <TechStack />
        <CTA />
        <ReactionTime />
        <Contact />
        <Footer />
      </div>
    </>
  );
}