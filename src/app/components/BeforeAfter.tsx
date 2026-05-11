import { useState } from "react";
import { motion } from "motion/react";

function BeforeMockup() {
  return (
    <div className="absolute inset-0 bg-[#f4f4f4] p-5 text-[#0b3b78]">
      <div className="mx-auto h-full max-w-5xl border border-gray-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-3">
          <div>
            <div className="text-3xl font-bold">BizCo</div>
            <div className="text-xs text-gray-500">Solutions for a Better Tomorrow</div>
          </div>
          <div className="text-xs font-semibold text-gray-700">Call Us Today! 1-800-555-0199</div>
        </div>

        <div className="flex bg-[#0755ad] text-xs font-semibold text-white">
          {['Home', 'Services', 'Solutions', 'Industries', 'About Us', 'Contact'].map((item) => (
            <div key={item} className="border-r border-white/25 px-5 py-2">{item}</div>
          ))}
        </div>

        <div className="grid grid-cols-[1.4fr_0.8fr] border-b border-gray-300">
          <div className="m-3 h-44 bg-[linear-gradient(135deg,#9fb7cb,#e0e0e0)]" />
          <div className="m-3 border border-gray-300 bg-gray-50 p-5">
            <div className="mb-3 text-2xl font-bold">Helping Businesses Succeed</div>
            <p className="text-sm leading-6 text-black">Practical technology solutions for organizations of all sizes.</p>
            <button className="mt-5 rounded bg-[#0755ad] px-5 py-2 text-sm text-white">Learn More</button>
          </div>
        </div>

        <div className="grid grid-cols-[0.7fr_1.5fr_0.7fr] gap-3 p-3 text-black">
          <div className="border border-gray-300 bg-gray-50 p-3">
            <div className="mb-3 font-bold text-[#0b3b78]">Our Services</div>
            {['IT Consulting', 'Software Development', 'Cloud Solutions', 'Support'].map((item) => (
              <div key={item} className="mb-2 text-sm text-[#0755ad]">› {item}</div>
            ))}
          </div>

          <div className="border border-gray-300 bg-white p-3">
            <div className="mb-3 text-xl font-bold text-[#0b3b78]">Welcome to BizCo</div>
            <p className="mb-4 text-sm leading-6">We provide reliable and cost-effective business technology solutions.</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="border border-gray-300 bg-gray-50 p-3 text-center">
                  <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-[#0755ad]" />
                  <div className="text-xs font-bold text-[#0b3b78]">Feature</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-300 bg-gray-50 p-3">
            <div className="mb-3 font-bold text-[#0b3b78]">Get In Touch</div>
            <p className="text-sm leading-6">info@bizco.com<br />123 Business Ave.</p>
            <button className="mt-4 rounded bg-[#0755ad] px-4 py-2 text-sm text-white">Contact Us</button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 rounded-md bg-black/60 px-4 py-2 text-xl font-bold tracking-wider text-white">BEFORE</div>
    </div>
  );
}

function AfterMockup() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(0,212,255,0.20),transparent_35%),radial-gradient(circle_at_25%_75%,rgba(139,92,246,0.25),transparent_35%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-25" />

      <div className="relative mx-auto h-full max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-[0_0_90px_rgba(0,212,255,0.12)] backdrop-blur-xl">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)]" />
            <div className="text-2xl font-semibold">BizCo</div>
          </div>
          <div className="hidden gap-8 text-sm text-white/65 md:flex">
            <span>Services</span><span>Solutions</span><span>Work</span><span>About</span>
          </div>
          <button className="rounded-full bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] px-5 py-3 text-sm font-medium">Get in Touch</button>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">AI-powered. Human-centered.</div>
            <h3 className="text-5xl font-semibold tracking-[-0.06em] md:text-7xl">We build digital experiences that <span className="bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] bg-clip-text text-transparent">make an impact.</span></h3>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/55">Modern websites, smart systems and automation built for ambitious teams.</p>
            <div className="mt-8 flex gap-4">
              <button className="rounded-full bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] px-6 py-3">Build Your Vision</button>
              <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3">Explore Work</button>
            </div>
          </div>

          <div className="relative h-80">
            <div className="absolute left-4 top-6 h-48 w-72 rotate-[-5deg] rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 text-sm text-white/55">Performance Overview</div>
              <div className="text-3xl font-semibold">$98,420</div>
              <div className="mt-8 h-24 rounded-2xl bg-[linear-gradient(135deg,rgba(0,212,255,0.25),rgba(139,92,246,0.25))]" />
            </div>
            <div className="absolute right-0 top-0 h-44 w-64 rotate-[4deg] rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
              <div className="mb-4 text-sm text-white/55">AI Automation</div>
              <div className="space-y-3 text-sm text-white/70"><div>Lead Enrichment</div><div>Invoice Processing</div><div>Support Analysis</div></div>
            </div>
            <div className="absolute bottom-4 right-8 h-36 w-64 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
              <div className="text-sm text-white/55">System Status</div>
              <div className="mt-5 h-12 rounded-xl bg-[linear-gradient(90deg,rgba(0,212,255,0.25),rgba(34,197,94,0.25))]" />
              <div className="mt-4 text-sm text-white/70">99.9% Uptime</div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {['Modern Design', 'AI Automation', 'Cloud & DevOps', 'Product Strategy'].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/70">{item}</div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 rounded-md bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] px-4 py-2 text-xl font-bold tracking-wider text-white">AFTER</div>
    </div>
  );
}

export function BeforeAfter() {
  const [value, setValue] = useState(50);

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.14),transparent_48%)]" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-white/40">Before / After</p>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">From outdated to future-ready.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">Drag the slider to see how a basic website can become a premium digital experience.</p>
        </motion.div>

        <div className="relative aspect-[16/9] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_0_90px_rgba(0,212,255,0.12)]">
          <BeforeMockup />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
            <AfterMockup />
          </div>

          <div className="absolute inset-y-0 z-20 w-[2px] bg-white shadow-[0_0_24px_rgba(255,255,255,0.8)]" style={{ left: `${value}%` }}>
            <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white backdrop-blur-xl">
              ↔
            </div>
          </div>

          <input
            aria-label="Before after slider"
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      </div>
    </section>
  );
}
