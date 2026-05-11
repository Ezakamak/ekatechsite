import logo from "../../imports/View_recent_photos.png";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

export function Navbar() {
  const { language, setLanguage } = useLanguage();

  const nav =
    language === "tr"
      ? { about: "Hakkında", projects: "Projeler", tech: "Teknoloji", contact: "İletişim", cta: "Başlayalım" }
      : { about: "About", projects: "Projects", tech: "Tech", contact: "Contact", cta: "Get Started" };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/30 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="EkaTech Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-white font-medium tracking-tight">EkaTech</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-gray-400 hover:text-white transition-colors">{nav.about}</a>
          <a href="#projects" className="text-gray-400 hover:text-white transition-colors">{nav.projects}</a>
          <a href="#tech" className="text-gray-400 hover:text-white transition-colors">{nav.tech}</a>
          <a href="#contact" className="text-gray-400 hover:text-white transition-colors">{nav.contact}</a>
        </div>

        <div className="flex items-center gap-3">
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

          <a href="#contact" className="hidden sm:block">
            <button className="px-5 py-2 rounded-full bg-white text-black hover:bg-gray-200 transition-all duration-300 font-medium">
              {nav.cta}
            </button>
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
