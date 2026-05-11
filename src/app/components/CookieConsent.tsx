import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { useLanguage } from "../i18n";

type ConsentChoice = "accepted" | "rejected" | null;
type LegalModal = "privacy" | "terms" | null;

const STORAGE_KEY = "ekatech-cookie-consent";

export function CookieConsent() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [choice, setChoice] = useState<ConsentChoice>(null);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<LegalModal>(null);

  const copy = tr
    ? {
        bannerTitle: "Çerez tercihleri",
        bannerText:
          "Deneyimi iyileştirmek ve tercihlerini hatırlamak için zorunlu olmayan küçük veriler kullanabiliriz. Bu sitede dil seçimi gibi tercihler localStorage ile saklanır.",
        accept: "Kabul et",
        reject: "Reddet",
        privacy: "Gizlilik",
        terms: "Şartlar",
        close: "Kapat",
        privacyTitle: "Gizlilik Politikası",
        privacyBody: [
          "EkaTech bu statik web sitesinde kullanıcı hesabı, ödeme sistemi veya dahili veritabanı kullanmaz.",
          "Dil tercihi ve çerez tercihi gibi ayarlar tarayıcında localStorage içinde saklanabilir. Bu bilgiler cihazında kalır ve sitenin daha tutarlı çalışmasına yardımcı olur.",
          "İletişim formu şu anda e-posta taslağı oluşturur. Mesajı göndermeden önce mail uygulamanda kontrol edebilirsin.",
          "Tawk.to gibi üçüncü parti servisler kullanıldığında, bu servislerin kendi gizlilik ve çerez politikaları geçerli olabilir.",
        ],
        termsTitle: "Kullanım Şartları",
        termsBody: [
          "Bu site EkaTech markası için hazırlanmış demo, portfolyo ve hizmet tanıtım amaçlı dijital bir vitrindir.",
          "Concept Project olarak işaretlenen çalışmalar gerçek müşteri iddiası taşımaz; tasarım ve yetenek gösterimi amacıyla sunulur.",
          "Sitedeki tahmini fiyat ve simülasyonlar bağlayıcı teklif değildir. Gerçek proje kapsamı ayrıca değerlendirilmelidir.",
          "Site içeriği haber verilmeden güncellenebilir. Herhangi bir iş ilişkisi için yazılı onay ve net kapsam belirlenmesi gerekir.",
        ],
      }
    : {
        bannerTitle: "Cookie preferences",
        bannerText:
          "We may use small non-essential data to improve the experience and remember your preferences. This site stores preferences like language selection in localStorage.",
        accept: "Accept",
        reject: "Reject",
        privacy: "Privacy",
        terms: "Terms",
        close: "Close",
        privacyTitle: "Privacy Policy",
        privacyBody: [
          "EkaTech does not use user accounts, payment systems, or an internal database on this static website.",
          "Settings such as language preference and cookie preference may be stored in your browser using localStorage. These values stay on your device and help the site behave consistently.",
          "The contact form currently creates an email draft. You can review the message in your mail app before sending it.",
          "When third-party services such as Tawk.to are used, their own privacy and cookie policies may apply.",
        ],
        termsTitle: "Terms of Service",
        termsBody: [
          "This website is a digital showcase for the EkaTech brand, created for demo, portfolio, and service presentation purposes.",
          "Work marked as Concept Project does not claim to be real client work; it is shown for design and capability demonstration.",
          "Estimated prices and simulations on the site are not binding quotes. Real project scope must be evaluated separately.",
          "Site content may be updated without notice. Any business relationship requires written confirmation and a clearly defined scope.",
        ],
      };

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "accepted" || saved === "rejected") {
      setChoice(saved);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const handleOpenPrivacy = () => setModal("privacy");
    const handleOpenTerms = () => setModal("terms");
    const handleOpenPreferences = () => {
      setChoice(null);
      window.localStorage.removeItem(STORAGE_KEY);
    };

    window.addEventListener("ekatech-open-privacy", handleOpenPrivacy);
    window.addEventListener("ekatech-open-terms", handleOpenTerms);
    window.addEventListener("ekatech-open-cookie-preferences", handleOpenPreferences);

    return () => {
      window.removeEventListener("ekatech-open-privacy", handleOpenPrivacy);
      window.removeEventListener("ekatech-open-terms", handleOpenTerms);
      window.removeEventListener("ekatech-open-cookie-preferences", handleOpenPreferences);
    };
  }, []);

  const saveChoice = (nextChoice: Exclude<ConsentChoice, null>) => {
    window.localStorage.setItem(STORAGE_KEY, nextChoice);
    setChoice(nextChoice);
  };

  const modalTitle = modal === "privacy" ? copy.privacyTitle : copy.termsTitle;
  const modalBody = modal === "privacy" ? copy.privacyBody : copy.termsBody;

  if (!ready) return null;

  return (
    <>
      <AnimatePresence>
        {!choice && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28 }}
            className="fixed bottom-5 left-1/2 z-[9997] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 rounded-[1.75rem] border border-white/10 bg-black/80 p-4 shadow-[0_0_70px_rgba(0,212,255,0.18)] backdrop-blur-2xl md:p-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 sm:flex">
                  <Cookie className="h-5 w-5 text-[#00D4FF]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{copy.bannerTitle}</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">{copy.bannerText}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setModal("privacy")}
                      className="text-[#00D4FF] hover:text-white"
                    >
                      {copy.privacy}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal("terms")}
                      className="text-[#00D4FF] hover:text-white"
                    >
                      {copy.terms}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => saveChoice("rejected")}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  {copy.reject}
                </button>
                <button
                  type="button"
                  onClick={() => saveChoice("accepted")}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200"
                >
                  {copy.accept}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/72 px-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-black p-6 shadow-[0_0_90px_rgba(0,212,255,0.16)] md:p-8"
            >
              <button
                type="button"
                onClick={() => setModal(null)}
                className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white"
                aria-label={copy.close}
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/10">
                <ShieldCheck className="h-6 w-6 text-[#00D4FF]" />
              </div>

              <h2 className="pr-12 text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                {modalTitle}
              </h2>

              <div className="mt-6 space-y-4">
                {modalBody.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-white/55">
                    {paragraph}
                  </p>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setModal(null)}
                className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200"
              >
                {copy.close}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
