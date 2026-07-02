"use client";

import { motion } from "framer-motion";
import { ArrowRight, Cpu, Eye, Layers, Settings, ShieldCheck } from "lucide-react";

const flowSteps = [
  {
    title: "Dependency",
    type: "INPUT_STATE",
    code: "SYS.NODE.01",
    metrics: "Load: 95% | Stability: Low",
    body: "Operations rely on approvals, memory, and constant fire-fighting.",
    icon: Cpu,
    color: "border-error/30 text-error bg-error/[0.01]",
  },
  {
    title: "Diagnosis",
    type: "TRANSFORM_01",
    code: "SYS.NODE.02",
    metrics: "Audit Coverage: 100%",
    body: "Map decision paths, bottlenecks, and owner dependencies.",
    icon: Eye,
    color: "border-line text-navy bg-white",
  },
  {
    title: "Architecture",
    type: "TRANSFORM_02",
    code: "SYS.NODE.03",
    metrics: "Redundancy: Active",
    body: "Design roles, decision rights, review loops, and handoffs.",
    icon: Layers,
    color: "border-line text-navy bg-white",
  },
  {
    title: "Installation",
    type: "TRANSFORM_03",
    code: "SYS.NODE.04",
    metrics: "Integration Status: 100%",
    body: "Install operational rhythms, train team leads, and verify handoffs.",
    icon: Settings,
    color: "border-line text-navy bg-white",
  },
  {
    title: "Independence",
    type: "OUTPUT_STATE",
    code: "SYS.NODE.05",
    metrics: "Load: <5% | Autonomy: 100%",
    body: "The company runs predictably under team control, freeing you.",
    icon: ShieldCheck,
    color: "border-accent/40 text-accent bg-accent/[0.01]",
  },
];

export function ProcessFlow() {
  return (
    <div className="relative w-full rounded-sm border border-line bg-paper/50 p-6 md:p-8 overflow-hidden">
      {/* Blueprint Grid Lines */}
      <div className="absolute inset-0 architectural-grid opacity-30 pointer-events-none" />

      {/* Connection SVG Line for Desktop */}
      <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 hidden xl:block h-1 pointer-events-none z-0">
        <svg className="w-full h-4 overflow-visible" fill="none">
          <motion.path
            d="M 0 8 L 1000 8"
            className="stroke-line/50 stroke-1"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      <div className="grid gap-6 xl:grid-cols-5 relative z-10">
        {flowSteps.map((step, idx) => {
          const Icon = step.icon;
          const isInput = idx === 0;
          const isOutput = idx === flowSteps.length - 1;

          return (
            <motion.div
              key={step.title}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={`flex flex-col justify-between rounded-sm border p-6 xl:p-4 bg-white shadow-[0_2px_8px_rgba(6,20,46,0.02)] min-h-[260px] relative transition-colors duration-200 ${
                isInput
                  ? "border-error/30 hover:border-error"
                  : isOutput
                  ? "border-accent/30 hover:border-accent"
                  : "border-line hover:border-navy/30"
              }`}
            >
              {/* Node metadata */}
              <div className="flex justify-between items-start font-mono text-[9px] text-muted">
                <span>{step.type}</span>
                <span>{step.code}</span>
              </div>

              {/* Node Icon and Title */}
              <div className="mt-4 flex-1">
                <div className="flex items-center gap-3 xl:gap-2">
                  <div className="p-2 rounded-sm border border-line/40 bg-paper shrink-0">
                    <Icon size={18} strokeWidth={1.8} className={isInput ? "text-error" : isOutput ? "text-accent" : "text-navy"} />
                  </div>
                  <h3 className="font-heading text-[17px] font-bold leading-tight text-navy xl:text-base">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-4 text-xs leading-5 text-body">
                  {step.body}
                </p>
              </div>

              {/* Node Metric Footer */}
              <div className="mt-6 border-t border-line/50 pt-4 flex items-center justify-between font-mono text-[9px]">
                <span className="text-muted">{step.metrics}</span>
                {!isOutput && (
                  <ArrowRight size={12} className="text-muted/60 xl:hidden" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
