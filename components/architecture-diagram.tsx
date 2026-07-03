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

const hover = {
  whileHover: {
    y: -2,
    borderColor: "var(--accent)",
    backgroundColor: "rgba(0,194,209,.04)",
  },
  transition: {
    duration: 0.18,
  },
};

export function ArchitectureDiagram() {
  return (
    <div className="architectural-grid relative overflow-hidden rounded-sm border border-line bg-white p-6 shadow-precise">
      <div className="absolute left-2 top-2 font-mono text-[8px] tracking-widest text-muted/50">
        GRID_REF // 47.9-N
      </div>

      <div className="absolute right-2 top-2 font-mono text-[8px] tracking-widest text-muted/50">
        SYS_BP_V4.2
      </div>

      <div className="absolute left-2 bottom-2 font-mono text-[8px] tracking-widest text-muted/50">
        SCALE // 1.00
      </div>

      <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_1.8fr_1fr]">

        <motion.div
          whileHover={{
            borderColor: "rgba(10,31,68,.4)",
            backgroundColor: "var(--paper)",
          }}
          transition={{ duration: .15 }}
          className="flex min-h-36 flex-col justify-between rounded-sm border border-line bg-white p-6"
        >
          <div className="flex justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted">
              Founder Load
            </span>

            <span className="font-mono text-[8px] text-muted/60">
              FL.BP.01
            </span>
          </div>

          <div>
            <p className="font-heading text-xl font-semibold leading-tight text-navy">
              Decisions,
              <br />
              approvals,
              <br />
              memory,
              <br />
              escalation
            </p>

            <div className="mt-4 h-1 w-8 rounded-full bg-error/70" />
          </div>
        </motion.div>

        <div className="rounded-sm border border-navy/20 bg-white p-6">

          <div className="mb-5 flex items-center justify-between">

            <span className="font-mono text-[10px] uppercase tracking-[.14em] font-semibold text-navy">
              Operating System
            </span>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-muted/60">
                OS.BP.02
              </span>

              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </div>

          </div>

          <div className="grid gap-2 sm:grid-cols-2">

            {systems.map((system) => (

              <motion.div
                key={system.code}
                {...hover}
                className="flex min-h-20 flex-col justify-between rounded-sm border border-line bg-paper p-3"
              >
                <div className="flex justify-between font-mono text-[8px] text-muted/60">
                  <span>SYSTEM // BLOCK</span>
                  <span>{system.code}</span>
                </div>

                <span className="mt-2 font-heading text-[11px] font-semibold text-navy">
                  {system.name}
                </span>

              </motion.div>

            ))}

          </div>

        </div>

        <motion.div
          whileHover={{
            borderColor: "rgba(10,31,68,.8)",
            backgroundColor: "#061734",
          }}
          transition={{ duration: .15 }}
          className="flex min-h-36 flex-col justify-between rounded-sm border border-line bg-navy p-6 text-white"
        >
          <div className="flex justify-between">

            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-accent">
              Company Output
            </span>

            <span className="font-mono text-[8px] text-accent/60">
              CO.BP.03
            </span>

          </div>

          <div>

            <p className="font-heading text-xl font-semibold leading-tight">
              Predictable work
              <br />
              without constant
              <br />
              founder
              <br />
              intervention
            </p>

            <div className="mt-4 h-1 w-8 rounded-full bg-accent/70" />

          </div>

        </motion.div>

      </div>
    </div>
  );
}