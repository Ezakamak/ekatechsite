import image1 from "../../imports/03A0DC2B-F970-48BA-98C6-637A5E3D2042.png";
import image2 from "../../imports/6FD69605-01B6-4FAA-ADAA-3F41FD35BD4E.png";
import image3 from "../../imports/A0F32DA8-6BBE-4248-B021-EC5C53119F75.png";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "../i18n";

export function Projects() {
  const { language } = useLanguage();

  const copy =
    language === "tr"
      ? {
          heading: "Öne Çıkan İşler",
          subtitle: "Fikirleri etkileyici dijital deneyimlere dönüştürüyoruz",
          view: "Projeyi Gör",
          projects: [
            {
              title: "Neural Analytics Platformu",
              description: "Gerçek zamanlı içgörüler ve tahmine dayalı analizlerle yapay zeka destekli veri zekası sistemi",
              image: image1,
              tags: ["AI", "Python", "Analitik"],
            },
            {
              title: "Cloud Automation Suite",
              description: "Cloudflare Workers üzerinde geliştirilen sunucusuz altyapı otomasyon platformu",
              image: image2,
              tags: ["Cloudflare", "Otomasyon", "API"],
            },
            {
              title: "Kurumsal Web Portalı",
              description: "Akıcı kullanıcı deneyimi ve yüksek performans sunan modern web uygulaması",
              image: image3,
              tags: ["Web", "React", "Performans"],
            },
          ],
        }
      : {
          heading: "Featured Work",
          subtitle: "Transforming ideas into exceptional digital experiences",
          view: "View Project",
          projects: [
            {
              title: "Neural Analytics Platform",
              description: "AI-powered data intelligence system with real-time insights and predictive analytics",
              image: image1,
              tags: ["AI", "Python", "Analytics"],
            },
            {
              title: "Cloud Automation Suite",
              description: "Serverless infrastructure automation platform built on Cloudflare Workers",
              image: image2,
              tags: ["Cloudflare", "Automation", "APIs"],
            },
            {
              title: "Enterprise Web Portal",
              description: "Modern web application with seamless UX and lightning-fast performance",
              image: image3,
              tags: ["Web", "React", "Performance"],
            },
          ],
        };

  return (
    <section id="projects" className="py-32 bg-gradient-to-b from-black to-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-light text-white mb-6">
            {copy.heading}
          </h2>
          <p className="text-xl text-gray-400 font-light">{copy.subtitle}</p>
        </motion.div>

        <div className="space-y-8">
          {copy.projects.map((project, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-all duration-500"
            >
              <div className="grid md:grid-cols-2 gap-8 p-8">
                <div className="flex flex-col justify-center">
                  <h3 className="text-3xl text-white mb-4">{project.title}</h3>
                  <p className="text-gray-400 mb-6 font-light leading-relaxed">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors w-fit group/link">
                    {copy.view}
                    <ExternalLink className="w-4 h-4 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                  </button>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
