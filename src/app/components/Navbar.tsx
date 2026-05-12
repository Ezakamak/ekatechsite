import { useState } from "react";
import logo from "../../imports/View_recent_photos.png";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import { useLanguage } from "../i18n";

export function Navbar() {
  const { language, setLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav =
    language === "tr"
      ? {
          about: "Hakkında",
          services: "Servisler",
          projects: "Projeler",
          auth: "Giriş",
          estimator: "Hesaplayıcı",
          faq: "SSS",
          contact: "İletişim",
          cta: "Başlayalım",
          menu: "Menü",
        }
      : {
          about: "About",
          services: "Services",
          projects: "Projects",
          auth: "Sign In",
          estimator: "Estimator",
          faq: "FAQ",
          contact: "Contact",
          cta: "Get Started",
          menu: "Menu",
        };

  const links = [
    { href: "#about", label: nav.about },
    { href: "#services", label: nav.services },
    { href: "#projects", label: nav.projects },
    { href: "#auth", label: nav.auth },
    { href: "#estimator", label: nav.estimator },
    { href: "#faq", label: nav.faq },
    { href: "#contact", label: nav.contact },
  ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/45 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="#" onClick={closeMobile} className="flex items-center gap-3">
          <img src={logo} alt="EkaTech Logo" className="h-10 w-10 object-contain" />
          <span className="font-medium tracking-tight text-white">EkaTech</span>
        </a>

        <div className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-gray-400 transition-colors hover:text-white">
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

          <a href="#auth" className="hidden sm:block">
            <button className="rounded-full bg-white px-5 py-2 font-medium text-black transition-all duration-300 hover:bg-gray-200">
              {nav.auth}
            </button>
          </a>

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
                  onClick={closeMobile}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-white/75 transition-all hover:bg-white/[0.07] hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={closeMobile}
                className="mt-2 rounded-2xl bg-white px-4 py-3 text-center font-medium text-black"
              >
                {nav.cta}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
