import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Code2,
  FileText,
  Mail,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";

type Phase = "idle" | "running" | "done";

type FloatingItem = {
  title: string;
  detail: string;
  result: string;
  icon: ElementType;
  idleX: number;
  idleY: number;
  idleRotate: number;
};

const items: FloatingItem[] = [
  {
    title: "Lead Emails",
    detail: "34 unread leads",
    result: "Scored and enriched",
    icon: Mail,
    idleX: -170,
    idleY: -120,
    idleRotate: -10,
  },
  {
    title: "Support Messages",
    detail: "12 unanswered chats",
    result: "Prioritized and routed",
    icon: MessageSquare,
    idleX: 130,
    idleY: -90,
    idleRotate: 8,
  },
  {
    title: "Invoice Files",
    detail: "8 documents waiting",
    result: "Extracted and organized",
    icon: FileText,
    idleX: -120,
    idleY: 60,
    idleRotate: 7,
  },
  {
    title: "Code Requests",
    detail: "Pending implementation",
    result: "Structured into tasks",
    icon: Code2,
    idleX: 160,
    idleY: 75,
    idleRotate: -9,
  },
  {
    title: "Weekly Reports",
    detail: "Manual reporting flow",
    result: "Dashboard updated",
    icon: BarChart3,
    idleX: 5,
    idleY: -165,
    idleRotate: 5,
  },
];

const steps = [
  "Collect scattered work",
  "Understand context",
  "Automate the workflow",
  "Deliver clean results",
];

export function AutomationSimulator() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase !== "running") return;

    setProgress(0);

    const interval = window.setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 100));
    }, 100);

    const doneTimer = window.setTimeout(() => {
      setProgress(100);
      setPhase("done");
    }, 2400);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(doneTimer);
    };
  }, [phase]);

  const startAutomation = () => {
    setProgress(0);
    setPhase("running");
  };

  const resetAutomation = () => {
    setProgress(0);
    setPhase("idle");
  };

  return (
    <section className="relative overflow-hidden bg-black px-6 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.20),transparent_35%),radial-gradient(circle_at_80%_55%,rgba(0,212,255,0.18),transparent_36%)]" />
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
            From scattered work to a clean system.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">
            Before automation, everything feels messy. Press the button and watch the workflow organize itself into something fast, clean and useful.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative min-h-[700px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_0_80px_rgba(139,92,246,0.12)] backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-white/35">Workflow state</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                  {phase === "idle" ? "Scattered inputs" : phase === "running" ? "Organizing the system" : "Structured output"}
                </h3>
              </div>

              <div className="shrink-0 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm text-white/50">
                {phase === "idle" ? "Unstructured" : phase === "running" ? "Processing" : "Optimized"}
              </div>
            </div>

            <div className="relative mt-6 h-[570px] rounded-[2rem] border border-white/10 bg-black/35">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.08),transparent_55%)]" />

              {phase !== "idle" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute left-1/2 top-10 h-[490px] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(0,212,255,0.35),transparent)]"
                />
              )}

              {items.map((item, index) => {
                const Icon = item.icon;
                const orderedY = -220 + index * 110;

                return (
                  <motion.div
                    key={item.title}
                    className="absolute left-1/2 top-1/2 z-10 w-[320px] max-w-[calc(100%-2rem)] -translate-x-1/2"
                    initial={false}
                    animate={
                      phase === "idle"
                        ? {
                            x: [item.idleX, item.idleX + 12, item.idleX - 8, item.idleX],
                            y: [item.idleY, item.idleY - 10, item.idleY + 8, item.idleY],
                            rotate: [item.idleRotate, item.idleRotate + 2, item.idleRotate - 2, item.idleRotate],
                            scale: [1, 1.02, 0.99, 1],
                          }
                        : {
                            x: 0,
                            y: orderedY,
                            rotate: 0,
                            scale: 1,
                          }
                    }
                    transition={
                      phase === "idle"
                        ? {
                            duration: 5.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: index * 0.12,
                          }
                        : {
                            duration: 0.75,
                            delay: index * 0.12,
                            ease: "easeInOut",
                          }
                    }
                  >
                    <div
                      className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-all duration-500 ${
                        phase === "idle"
                          ? "border-white/10 bg-white/[0.045]"
                          : phase === "running"
                            ? "border-[#00D4FF]/25 bg-[#00D4FF]/[0.055]"
                            : "border-emerald-400/20 bg-emerald-400/[0.06]"
                      }`}
                    >
                      {phase === "running" && (
                        <motion.div
                          className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(0,212,255,0.18),transparent)]"
                          animate={{ x: ["-120%", "350%"] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.1 }}
                        />
                      )}

                      <div className="relative flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                            phase === "done"
                              ? "border-emerald-300/30 bg-emerald-300/10"
                              : phase === "running"
                                ? "border-[#00D4FF]/30 bg-[#00D4FF]/10"
                                : "border-white/10 bg-white/5"
                          }`}
                        >
                          {phase === "done" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                          ) : (
                            <Icon className="h-5 w-5 text-white/70" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium leading-tight text-white">{item.title}</p>
                            <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/45">
                              {phase === "done" ? "Done" : "Input"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-white/45">
                            {phase === "done" ? item.result : item.detail}
                          </p>
                        </div>
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
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.10),transparent_60%)]" />

            <div className="relative">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-white/35">EkaTech AI Core</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Automation engine</h3>
                </div>

                <div
                  className={`h-3 w-3 rounded-full ${
                    phase === "idle"
                      ? "bg-white/20"
                      : phase === "running"
                        ? "bg-[#00D4FF] shadow-[0_0_24px_rgba(0,212,255,0.85)]"
                        : "bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.8)]"
                  }`}
                />
              </div>

              <div className="mb-6 rounded-3xl border border-white/10 bg-black/35 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-white/55">Workflow progress</p>
                  <p className="text-sm text-white/55">{progress}%</p>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#00D4FF,#8B5CF6)]"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>

              <div className="mb-8 space-y-3">
                {steps.map((step, index) => (
                  <motion.div
                    key={step}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${
                      phase === "idle"
                        ? "border-white/10 bg-black/25"
                        : phase === "running"
                          ? "border-[#00D4FF]/20 bg-[#00D4FF]/[0.045]"
                          : "border-emerald-400/20 bg-emerald-400/[0.05]"
                    }`}
                    animate={{ opacity: phase === "idle" ? 0.55 : 1 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                        phase === "done"
                          ? "border-emerald-300/30 bg-emerald-300/10"
                          : phase === "running"
                            ? "border-[#00D4FF]/30 bg-[#00D4FF]/10"
                            : "border-white/10 bg-white/5"
                      }`}
                    >
                      {phase === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      ) : (
                        <Sparkles className="h-5 w-5 text-[#00D4FF]" />
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-white">{step}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {index === 0 && "Gather every loose task into one flow"}
                        {index === 1 && "Read intent, urgency and context"}
                        {index === 2 && "Sort, score and structure automatically"}
                        {index === 3 && "Return a clean system to the team"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {phase === "done" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 grid gap-3 sm:grid-cols-2"
                >
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center gap-2 text-[#00D4FF]">
                      <Clock3 className="h-4 w-4" />
                      <span className="text-sm">Time saved</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">8.4 hours / week</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center gap-2 text-[#00D4FF]">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm">Workflow boost</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">5 tasks automated</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center gap-2 text-[#00D4FF]">
                      <Bot className="h-4 w-4" />
                      <span className="text-sm">System result</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">Clean output</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center gap-2 text-[#00D4FF]">
                      <ArrowRight className="h-4 w-4" />
                      <span className="text-sm">Business impact</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">Faster response</p>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={startAutomation}
                  disabled={phase === "running"}
                  className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#00D4FF,#8B5CF6)] px-6 py-4 font-medium text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Zap className="h-4 w-4" />
                  {phase === "idle" ? "Organize with AI" : phase === "running" ? "Running automation..." : "Run again"}
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
