import { motion } from "motion/react";
import { Sparkles, Zap, Shield } from "lucide-react";

export function About() {

  const features = [
    {
      icon: Sparkles,
      title: "Intelligent Solutions",
      description: "AI-powered systems that learn and adapt to your needs"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Built for speed and performance at scale"
    },
    {
      icon: Shield,
      title: "Enterprise Ready",
      description: "Secure, reliable, and production-tested"
    }
  ];

  return (
    <section id="about" className="py-32 bg-black relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-light text-white mb-6">
            Minimal Software.
            <br />
            <span className="text-gray-400">Maximum Impact.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto font-light">
            EkaTech creates modern, scalable, intelligent digital products with a relentless focus on simplicity, speed, and innovation. We build what matters.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className="p-8 rounded-3xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                <feature.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 font-light">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
