import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Projects } from "./components/Projects";
import { TechStack } from "./components/TechStack";
import { CTA } from "./components/CTA";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-black dark">
      <Navbar />
      <Hero />
      <About />
      <Projects />
      <TechStack />
      <CTA />
      <Contact />
      <Footer />
    </div>
  );
}