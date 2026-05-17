import background from "../../imports/photo.png";
import { motion } from "motion/react";
import { ArrowRight, Radio } from "lucide-react";
import { useLanguage } from "../i18n";

export function Hero() {
  const { language } = useLanguage();

  const copy =
    language === "tr"
      ? {
          status: "Seçili dijital projeler için müsait",
          line1: "Minimal Yazılım",
          line2: "Maksimum Etki",
          subtitle:
            "Özen, hız ve akıllı sistemlerle tasarlanmış yeni nesil yapay zeka çözümleri ve modern web deneyimleri",
          primary: "Proje Başlat",
          secondary: "İşleri Gör",
          buyTechCoin: "TechCoin Satın Al",
        }
      : {
          status: "Available for selected digital projects",
          line1: "Minimum Software",
          line2: "Maximum Impact",
          subtitle:
            "Next-generation AI solutions and modern web experiences crafted with precision and intelligence",
          primary: "Start a Project",
          secondary: "View Work",
          buyTechCoin: "Buy TechCoin",
        };

  const startTechCoinCheckout = () => {
    window.dispatchEvent(new Event("ekatech-start-techcoin-checkout"));
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black px-4 pt-24">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      <img
        src={background}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-70 blur-sm pointer-events-none"
        decoding="async"
        fetchPriority="high"
      />

      <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-2 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 backdrop-blur-xl"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </span>
          <Radio className="h-4 w-4 text-[#00D4FF]" />
          {copy.status}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="mb-6 text-5xl font-light tracking-tight text-white sm:text-6xl md:text-8xl">
            {copy.line1}
            <br />
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {copy.line2}
            </span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mb-12 max-w-2xl text-lg font-light text-gray-400 sm:text-xl"
        >
          {copy.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col justify-center gap-4 sm:flex-row"
        >
          <a href="#contact">
            <button className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-medium text-black transition-all duration-300 hover:bg-gray-200 sm:w-auto">
              {copy.primary}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </a>

          <button
            type="button"
            onClick={startTechCoinCheckout}
            className="w-full rounded-full bg-cyan-300 px-8 py-4 font-semibold text-black shadow-2xl shadow-cyan-500/20 transition-all duration-300 hover:bg-cyan-100 sm:w-auto"
          >
            {copy.buyTechCoin}
          </button>

          <a href="#projects">
            <button className="w-full rounded-full border border-white/10 px-8 py-4 font-medium text-white transition-all duration-300 hover:bg-white/5 sm:w-auto">
              {copy.secondary}
            </button>
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-white/40"
          />
        </div>
      </motion.div>
    </section>
  );
}
