import { motion } from "motion/react";
import { useState } from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../i18n";

export function Contact() {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const copy =
    language === "tr"
      ? {
          badge: "Bağlantı Kuralım",
          title: "Projeni Başlat",
          subtitle:
            "Vizyonunu anlat, onu hayata geçirelim. Form gönderildiğinde e-posta uygulaman açılır ve mesaj contact@ekatech.net adresine hazırlanır.",
          name: "Adınız",
          email: "E-posta adresiniz",
          message: "Projenizi anlatın...",
          button: "E-posta Oluştur",
          success: "E-posta taslağı hazırlandı. Göndermek için mail uygulamanı kontrol et.",
        }
      : {
          badge: "Let's Connect",
          title: "Start Your Project",
          subtitle:
            "Tell us about your vision and we'll bring it to life. Submitting opens your email app with a prepared message to contact@ekatech.net.",
          name: "Your Name",
          email: "Your Email",
          message: "Tell us about your project...",
          button: "Create Email",
          success: "Email draft created. Check your mail app to send it.",
        };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const subject = encodeURIComponent(`New EkaTech project request from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nProject details:\n${formData.message}`
    );

    window.location.href = `mailto:contact@ekatech.net?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <section id="contact" className="py-32 bg-gradient-to-b from-gray-950 to-black">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <Mail className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300 text-sm">{copy.badge}</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-light text-white mb-6">{copy.title}</h2>
          <p className="text-xl text-gray-400 font-light">{copy.subtitle}</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <input
            type="text"
            placeholder={copy.name}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            required
          />

          <input
            type="email"
            placeholder={copy.email}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            required
          />

          <textarea
            placeholder={copy.message}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            rows={6}
            className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
            required
          />

          {sent && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              {copy.success}
            </div>
          )}

          <button
            type="submit"
            className="group w-full px-8 py-5 rounded-2xl bg-white text-black hover:bg-gray-200 transition-all duration-300 font-medium flex items-center justify-center gap-2"
          >
            {copy.button}
            <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </motion.form>
      </div>
    </section>
  );
}
