"use client";

import { motion } from "framer-motion";

const systems = [
  { name: "Intake", code: "OS.IN.01" },
  { name: "Ownership", code: "OS.OW.02" },
  { name: "Decision Rights", code: "OS.DR.03" },
  { name: "Execution Rhythm", code: "OS.ER.04" },
  { name: "Quality Control", code: "OS.QC.05" },
  { name: "Reporting", code: "OS.RP.06" },
];

export function ArchitectureDiagram() {
  return (
    <div className="architectural-grid rounded-sm border border-line bg-white p-6 shadow-precise relative overflow-hidden">
      {/* Blueprint Grid Lines & Corner Accents */}
      <div className="absolute left-2 top-2 font-mono text-[8px] tracking-widest text-muted/50 select-none">
        GRID_REF // 47.9-N
      </div>
      <div className="absolute right-2 top-2 font-mono text-[8px] tracking-widest text-muted/50 select-none">
        SYS_BP_V4.2
      </div>
      <div className="absolute left-2 bottom-2 font-mono text-[8px] tracking-widest text-muted/50 select-none">
        SCALE // 1.00
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.8fr_1fr] lg:items-stretch relative z-10">
        {/* Founder Load */}
        <motion.div
          whileHover={{ borderColor: "rgba(10, 31, 68, 0.4)", backgroundColor: "var(--paper)" }}
          transition={{ duration: 0.15 }}
          className="flex min-h-36 flex-col justify-between rounded-sm border border-line bg-white p-6 relative group cursor-default"
        >
          <div className="flex justify-between items-start">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Founder Load
            </span>
            <span className="font-mono text-[8px] text-muted/60 select-none">FL.BP.01</span>
          </div>
          <div>
            <p className="font-heading text-xl font-semibold leading-tight text-navy">
              Decisions, approvals, memory, escalation
            </p>
            <div className="mt-4 h-1 w-8 bg-error/70 rounded-full" />
          </div>
        </motion.div>

        {/* Operating System */}
        <div className="rounded-sm border border-navy/20 bg-white p-6 relative">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-navy font-semibold">
              Operating System
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-muted/60 select-none">OS.BP.02</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {systems.map((system) => (
              <motion.div
                key={system.name}
                whileHover={{
                  borderColor: "var(--accent)",
                  backgroundColor: "rgba(0, 194, 209, 0.04)",
                  y: -2,
                }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col justify-between min-h-20 rounded-sm border border-line bg-paper p-3 font-mono text-xs uppercase tracking-[0.08em] text-navy cursor-default"
              >
                <div className="flex justify-between items-start text-[8px] text-muted/60 select-none">
                  <span>SYSTEM // BLOCK</span>
                  <span>{system.code}</span>
                </div>
                <span className="font-heading text-[11px] font-semibold tracking-normal text-navy-dark mt-2 xl:text-xs">
                  {system.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Company Output */}
        <motion.div
          whileHover={{ borderColor: "rgba(10, 31, 68, 0.8)", backgroundColor: "var(--navy-dark)" }}
          transition={{ duration: 0.15 }}
          className="flex min-h-36 flex-col justify-between rounded-sm border border-line bg-navy p-6 text-white relative group cursor-default"
        >
          <div className="flex justify-between items-start">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
              Company Output
            </span>
            <span className="font-mono text-[8px] text-accent/60 select-none">CO.BP.03</span>
          </div>
          <div>
            <p className="font-heading text-xl font-semibold leading-tight text-white">
              Predictable work without constant founder intervention
            </p>
            <div className="mt-4 h-1 w-8 bg-accent/70 rounded-full" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
