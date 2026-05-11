import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  FileText,
  Mail,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";

type Task = {
  title: string;
  source: string;
  before: string;
  after: string;
  icon: React.ElementType;
};

const tasks: Task[] = [
  {
    title: "Customer Requests",
    source: "Inbox",
    before: "12 unanswered messages",
    after: "Prioritized and routed",
    icon: MessageSquare,
  },
  {
    title: "Lead Emails",
    source: "Sales",
    before: "34 unread leads",
    after: "Scored and enriched",
    icon: Mail,
  },
  {
    title: "Invoice Data",
    source: "Finance",
    before: "8 documents waiting",
    after: "Extracted and organized",
    icon: FileText,
  },
  {
    title: "Business Reports",
    source: "Analytics",
    before: "Manual weekly report",
    after: "Dashboard updated",
    icon: BarChart3,
  },
  {
    title: "CRM Records",
    source: "Database",
    before: "Duplicate entries found",
    after: "Cleaned and synced",
    icon: Database,
  },
];

const pipeline = ["Detect", "Analyze", "Automate", "Deliver"];

export function AutomationSimulator() {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const runAutomation = () => {
    setRunning(true);
    setCompleted(false);

    window.setTimeout(() => {
      setRunning(false);
      setCompleted(true);
    }, 2200);
  };

  const resetAutomation = () => {
    setRunning(false);
    setCompleted(false);
  };

  const active = running || completed;

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.20),transparent_34%),radial-gradient(circle_at_80%_55%,rgba(0,212,255,0.18),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55 backdrop-blur-md">
            <Bot className="h-4 w-4 text-[#00D4FF]" />
            AI automation simulator
          </div>

          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            Turn messy work into automated systems.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">
            Watch repetitive business tasks move through an AI-powered workflow and come out clean, sorted and ready to use.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_0_80px_rgba(139,92,246,0.12)] backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-white/35">Incoming work</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                  Before automation
                </h3>
              </div>
              <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm text-white/50">
                {completed ? "Processed" : running ? "Processing" : "Manual queue"}
              </div>
            </div>

            <div className="space-y-3">
              {tasks.map((task, index) => {
                const Icon = task.icon;

                return (
                  <motion.div
                    key={task.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: index * 0.06 }}
                    className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 ${
                      active
                        ? "border-[#00D4FF]/20 bg-[#00D4FF]/[0.055]"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    {running && (
                      <motion.div
                        className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(0,212,255,0.18),transparent)]"
                        animate={{ x: ["-120%", "340%"] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.08 }}
                      />
                    )}

                    <div className="relative flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-500 ${active ? "border-[#00D4FF]/30 bg-[#00D4FF]/10" : "border-white/10 bg-white/5"}`}>
                        {completed ? <CheckCircle2 className="h-5 w-5 text-[#00D4FF]" /> : <Icon className="h-5 w-5 text-white/70" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-white">{task.title}</p>
                          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/45">
                            {task.source}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-white/45">
                          {completed ? task.after : task.before}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_0_80px_rgba(0,212,255,0.12)] backdrop-blur-xl"
          >
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.12),transparent_60%)]" />

            <div className="relative">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-white/35">Workflow engine</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                    EkaTech AI Core
                  </h3>
                </div>
                <div className={`h-3 w-3 rounded-full ${running ? "bg-[#00D4FF] shadow-[0_0_24px_rgba(0,212,255,0.9)]" : completed ? "bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.8)]" : "bg-white/20"}`} />
              </div>

              <div className="relative mb-8 rounded-3xl border border-white/10 bg-black/35 p-6">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(0,212,255,0.4),transparent)]" />

                <div className="relative space-y-5">
                  {pipeline.map((item, index) => {
                    const isOn = running || completed;

                    return (
                      <motion.div
                        key={item}
                        className="flex items-center gap-4"
                        animate={{ opacity: isOn ? 1 : 0.55 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <motion.div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isOn ? "border-[#00D4FF]/35 bg-[#00D4FF]/10" : "border-white/10 bg-white/5"}`}
                          animate={running ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                          transition={{ duration: 0.7, repeat: running ? Infinity : 0, delay: index * 0.16 }}
                        >
                          {completed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Sparkles className="h-5 w-5 text-[#00D4FF]" />}
                        </motion.div>
                        <div>
                          <p className="font-medium text-white">{item}</p>
                          <p className="text-sm text-white/45">
                            {index === 0 && "Collect signals from every channel"}
                            {index === 1 && "Classify, score and understand context"}
                            {index === 2 && "Trigger the right workflow instantly"}
                            {index === 3 && "Send clean results to your team"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-2xl font-semibold text-white">5</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">Tasks</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-2xl font-semibold text-white">4</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">Steps</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-2xl font-semibold text-white">AI</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">Driven</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={runAutomation}
                  disabled={running}
                  className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] px-6 py-4 font-medium text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Zap className="h-4 w-4" />
                  {running ? "Running automation..." : completed ? "Run again" : "Automate workflow"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  onClick={resetAutomation}
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-4 font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  Reset
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
