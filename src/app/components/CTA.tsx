import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../i18n";

export function CTA() {
  const { language } = useLanguage();

  const copy =
    language === "tr"
      ? {
          line1: "Olağanüstü Bir Şey",
          line2: "İnşa Etmeye Hazır mısın?",
          subtitle: "Geleceği birlikte oluşturalım. Bir sonraki projenizi EkaTech ile başlatın.",
          button: "İletişime Geç",
        }
      : {
          line1: "Ready to Build",
          line2: "Something Exceptional?",
          subtitle: "Let's create the future together. Start your next project with EkaTech.",
          button: "Get in Touch",
        };

  return (
    <section className="py-32 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5" />

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-7xl font-light text-white mb-8">
            {copy.line1}
            <br />
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {copy.line2}
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-12 font-light max-w-2xl mx-auto">
            {copy.subtitle}
          </p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <a href="#contact">
              <button className="group px-10 py-5 rounded-full bg-white text-black hover:bg-gray-200 transition-all duration-300 font-medium flex items-center gap-3 mx-auto">
                {copy.button}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
