/**
 * /notifications — Full notification history page.
 *
 * Shows all notifications with filtering, mark-as-read, and mark-all-read.
 * Uses the existing WavesCo design system.
 */

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationHistory } from "./notification-history";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your Acquisition OS notification history.",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-8 lg:px-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-muted">
            Updates from your Acquisition OS cycles and campaigns.
          </p>
        </div>

        <NotificationHistory />
      </div>
    </main>
  );
}
