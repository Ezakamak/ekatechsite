import logo from "../../imports/View_recent_photos.png";
import { motion } from "motion/react";

export function Navbar() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/30 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src= {logo}
            alt="EkaTech Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-white font-medium tracking-tight">EkaTech</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-gray-400 hover:text-white transition-colors">About</a>
          <a href="#projects" className="text-gray-400 hover:text-white transition-colors">Projects</a>
          <a href="#tech" className="text-gray-400 hover:text-white transition-colors">Tech</a>
          <a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contact</a>
        </div>

        <a href="#contact">
          <button className="px-5 py-2 rounded-full bg-white text-black hover:bg-gray-200 transition-all duration-300 font-medium">
            Get Started
          </button>
        </a>
      </div>
    </motion.nav>
  );
}
