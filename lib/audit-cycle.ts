export type AuditStage = {
  n: string;
  code: string;
  title: string;
  detail: string;
  output: string;
};

export const auditCycle: ReadonlyArray<AuditStage> = [
  {
    n: "01",
    code: "DISCOVER",
    title: "Discover",
    detail:
      "Map reality read-only. PII scan, Ghost AWS/billing, Latency hotspots, Legacy manifests, Sync drift — bounded, masked, evidence-based. No mutation, no assumptions.",
    output: "Masked report — terminal / JSON / HTML",
  },
  {
    n: "02",
    code: "ARCHITECT",
    title: "Architect",
    detail:
      "Translate evidence into OS design: roles, decision rights, handoffs, review loops, escalation rules. Tooling: SOLID DataSource / Detector interfaces reserved for scale.",
    output: "Design + stable interfaces",
  },
  {
    n: "03",
    code: "BUILD",
    title: "Build",
    detail:
      "Implement in isolation. pip install -e ./waves-*, src layout, pyproject.toml, non-root Docker python:3.11-slim, Python 3.11, no exec of target code.",
    output: "Independently installable package",
  },
  {
    n: "04",
    code: "CONNECT",
    title: "Connect",
    detail:
      "Wire adapters — DB/file sources, AWS pricing, endpoint YAML, safe_path, redaction. Connect client stack: WhatsApp, sheets, CRM, payments via n8n + Supabase + Neon.",
    output: "Integrated system",
  },
  {
    n: "05",
    code: "TEST",
    title: "Test",
    detail:
      "Automated pytest per tool — 43 / 48 / 96 / 83 / 30 (300). ruff / black, mocks (moto, http.server), synthetic demo data. No real PII/billing needed.",
    output: "Test evidence",
  },
  {
    n: "06",
    code: "VALIDATE",
    title: "Validate",
    detail:
      "Beyond tests: Docker build, Quick Start demo, encoding, repo tree, security (redaction / SSRF / safe_path), docs. Checked before any deploy.",
    output: "Validated artifact",
  },
  {
    n: "07",
    code: "DEPLOY",
    title: "Deploy",
    detail:
      "Ship via established workflow — Docker image, CI wheel, Vercel (Next 15). Reports at your chosen path; sites via vercel deploy. No secrets in transit.",
    output: "Delivered system",
  },
  {
    n: "08",
    code: "MONITOR",
    title: "Monitor",
    detail:
      "Watch and re-run. Deterministic re-scans, report re-render without re-scan. Roadmap: hosted continuous monitoring, drift detection, dashboards.",
    output: "Ongoing assurance",
  },
] as const;
