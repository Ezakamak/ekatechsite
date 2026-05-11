import logo from "../../imports/View_recent_photos.png";
import { Github, Linkedin, Twitter } from "lucide-react";
import { useLanguage } from "../i18n";

export function Footer() {
  const { language } = useLanguage();
  const tr = language === "tr";

  const copy = tr
    ? {
        rights: "© 2026 EkaTech Tüm hakları saklıdır.",
        questions: "Sorular için contact@ekatech.net",
        privacy: "Gizlilik",
        terms: "Şartlar",
        contact: "İletişim",
      }
    : {
        rights: "© 2026 EkaTech All rights reserved.",
        questions: "For questions contact@ekatech.net",
        privacy: "Privacy",
        terms: "Terms",
        contact: "Contact",
      };

  return (
    <footer className="bg-black py-12 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="EkaTech Logo" className="w-10 h-10 object-contain" />
              <span className="text-white font-medium">EkaTech</span>
            </div>

            <p className="text-gray-500 text-sm text-center">
              {copy.rights} {copy.questions}
            </p>

            <div className="flex items-center gap-4">
              <a href="#" aria-label="Twitter" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" aria-label="GitHub" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-white/5 pt-6 text-sm text-white/35">
            <a href="#privacy" className="hover:text-white transition-colors">{copy.privacy}</a>
            <span>•</span>
            <a href="#terms" className="hover:text-white transition-colors">{copy.terms}</a>
            <span>•</span>
            <a href="#contact" className="hover:text-white transition-colors">{copy.contact}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
