import { motion } from "motion/react";
import { Code2, Brain, Cloud, Workflow, Globe, Cpu } from "lucide-react";

export function TechStack() {

  const technologies = [
    { icon: Code2, name: "Python", description: "Backend & AI" },
    { icon: Brain, name: "AI & ML", description: "Intelligence" },
    { icon: Cloud, name: "Cloudflare", description: "Edge Computing" },
    { icon: Workflow, name: "Automation", description: "Workflows" },
    { icon: Globe, name: "Web Dev", description: "Modern Stack" },
    { icon: Cpu, name: "APIs", description: "Integration" }
  ];

  return (
    <section id="tech" className="py-32 bg-gray-950 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[150px]" />

      <div className="max-w-6xl mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-light text-white mb-6">
            Technology Stack
          </h2>
          <p className="text-xl text-gray-400 font-light">
            Powered by cutting-edge tools and frameworks
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {technologies.map((tech, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
              className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <tech.icon className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl text-white mb-2">{tech.name}</h3>
              <p className="text-gray-400 text-sm font-light">{tech.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
