-- Runtime grants for the Acquisition Cycle OS tables.
--
-- Tables are owned by the migration role while the application connects as
-- the restricted wavesco_app role (which is exactly why RLS is enforced).
-- Without these grants every cycle-OS query fails with 42501 "permission
-- denied" even though the tables and RLS policies exist. Follows the repo's
-- existing grant convention (see the initial schema history). Idempotent:
-- GRANT is naturally re-runnable.
GRANT USAGE ON SCHEMA public TO wavesco_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "CompanyBrain", "CompanyBrainRevision",
  "AcquisitionCycle", "CycleGoal", "MessageTemplate",
  "AiJob", "N8nJob", "N8nEvent",
  "ReplyReport", "ReplyDirection",
  "CycleReport", "EmailCredential"
  TO wavesco_app;
