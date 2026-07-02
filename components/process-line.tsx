"use client";

import { motion } from "framer-motion";

type ProcessLineProps = {
  steps: string[];
  compact?: boolean;
};

export function ProcessLine({ steps, compact = false }: ProcessLineProps) {
  return (
    <ol className={`grid gap-4 ${compact ? "grid-cols-2 md:grid-cols-5" : "grid-cols-1 md:grid-cols-5"}`}>
      {steps.map((step, index) => (
        <motion.li
          key={step}
          whileHover={{ y: -2, borderColor: "var(--accent)" }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="premium-card relative flex min-h-36 flex-col justify-between rounded-sm p-6"
        >
          <div className="flex justify-between items-start">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              PHASE // {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent/40" />
          </div>
          
          <p className="mt-6 font-heading text-lg font-bold leading-tight text-navy">
            {step}
          </p>

          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute -right-3 top-1/2 hidden h-px w-6 bg-line/65 md:block z-20"
            />
          )}
        </motion.li>
      ))}
    </ol>
  );
}
