"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";

const todaySteps = [
  "Owner approves invoices",
  "Owner approves hiring",
  "Owner approves pricing",
  "Owner answers questions",
  "Owner solves problems",
  "Owner goes on vacation",
  "Everything stops.",
];

const systemSteps = [
  "SYSTEM (Invoices)",
  "SYSTEM (Hiring)",
  "SYSTEM (Pricing)",
  "SYSTEM (Questions)",
  "SYSTEM (Problems)",
  "Founder (Strategy Only)",
  "Operational Independence.",
];

export function DependencyVisual() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % todaySteps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-sm border border-line bg-white p-6 shadow-precise md:p-10 relative overflow-hidden">
      {/* Technical blueprint details */}
      <div className="absolute left-4 top-4 font-mono text-[9px] tracking-widest text-muted/50 select-none">
        MODEL // DEPENDENCY
      </div>
      <div className="absolute right-4 top-4 font-mono text-[9px] tracking-widest text-muted/50 select-none">
        STATUS // ACTIVE_SIM
      </div>

      <div className="mt-6 grid gap-10 md:grid-cols-2 md:divide-x md:divide-line/50">
        {/* Left Column: TODAY */}
        <div className="flex flex-col">
          <div className="mb-8 flex items-center gap-4">
            <span className="h-2 w-2 rounded-full bg-error" />
            <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-navy">
              TODAY // Owner Dependent
            </h4>
          </div>

          <div className="relative flex-1 pl-6">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-4 bottom-8 w-[2px] bg-line/45" />

            <div className="space-y-4">
              {todaySteps.map((step, idx) => {
                const isActive = activeIndex === idx;
                const isPast = activeIndex > idx;
                const isLast = idx === todaySteps.length - 1;
                const isVacation = idx === 5;

                let stateColor = "text-muted border-line/40 bg-white";
                let dotColor = "bg-line/40";
                
                if (isActive) {
                  if (isLast) {
                    stateColor = "text-error border-error/50 bg-error/5 font-semibold";
                    dotColor = "bg-error";
                  } else if (isVacation) {
                    stateColor = "text-error border-error/40 bg-error/5";
                    dotColor = "bg-error";
                  } else {
                    stateColor = "text-navy border-navy bg-paper font-semibold";
                    dotColor = "bg-navy";
                  }
                } else if (isPast) {
                  if (idx === 5) {
                    stateColor = "text-error/80 border-error/30 bg-error/[0.02]";
                    dotColor = "bg-error/80";
                  } else if (isLast) {
                    stateColor = "text-error border-error bg-error/5";
                    dotColor = "bg-error";
                  } else {
                    stateColor = "text-body/60 border-line/60 bg-white";
                    dotColor = "bg-navy/40";
                  }
                }

                return (
                  <motion.div
                    key={step}
                    animate={isActive ? { x: 3 } : { x: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative flex items-center gap-4 rounded-sm border p-4 text-sm transition-all duration-300 ${stateColor}`}
                  >
                    {/* Animated Step Dot */}
                    <div className="absolute -left-[20px] z-10 flex h-[10px] w-[10px] items-center justify-center">
                      <span className={`h-2.5 w-2.5 rounded-full border border-white transition-colors duration-300 ${dotColor}`} />
                    </div>

                    <div className="flex flex-1 items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider">{step}</span>
                      {isLast && isActive && (
                        <ShieldAlert size={16} className="text-error" />
                      )}
                      {isVacation && isActive && (
                        <AlertCircle size={16} className="text-error" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: SYSTEM */}
        <div className="flex flex-col pt-10 md:pt-0 md:pl-10">
          <div className="mb-8 flex items-center gap-4">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-navy">
              SYSTEM // Engineered Autonomy
            </h4>
          </div>

          <div className="relative flex-1 pl-6">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-4 bottom-8 w-[2px] bg-line/45" />

            <div className="space-y-4">
              {systemSteps.map((step, idx) => {
                const isActive = activeIndex === idx;
                const isPast = activeIndex > idx;
                const isLast = idx === systemSteps.length - 1;
                const isFounderStrategy = idx === 5;

                let stateColor = "text-muted border-line/40 bg-white";
                let dotColor = "bg-line/40";

                if (isActive) {
                  if (isLast) {
                    stateColor = "text-accent border-accent/50 bg-accent/5 font-semibold";
                    dotColor = "bg-accent animate-pulse";
                  } else {
                    stateColor = "text-navy border-accent bg-paper font-semibold";
                    dotColor = "bg-accent";
                  }
                } else if (isPast) {
                  stateColor = "text-body/70 border-line/70 bg-white";
                  dotColor = "bg-accent/60";
                }

                return (
                  <motion.div
                    key={step}
                    animate={isActive ? { x: 3 } : { x: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative flex items-center gap-4 rounded-sm border p-4 text-sm transition-all duration-300 ${stateColor}`}
                  >
                    {/* Step Dot */}
                    <div className="absolute -left-[20px] z-10 flex h-[10px] w-[10px] items-center justify-center">
                      <span className={`h-2.5 w-2.5 rounded-full border border-white transition-colors duration-300 ${dotColor}`} />
                    </div>

                    <div className="flex flex-1 items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider">{step}</span>
                      {isLast && isActive && (
                        <CheckCircle size={16} className="text-accent" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
