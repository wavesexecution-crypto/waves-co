"use client";

import { Button } from "@/components/button";

/** Browser print (save as PDF) of the on-screen report. */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      Download PDF
    </Button>
  );
}
