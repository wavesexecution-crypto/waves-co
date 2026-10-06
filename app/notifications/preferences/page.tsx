/**
 * /notifications/preferences — Notification settings page.
 *
 * Client-facing notification preferences per category and channel.
 */

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationPreferencesPanel } from "./preferences-panel";

export const metadata: Metadata = {
  title: "Notification Settings",
  description: "Configure your Acquisition OS notification preferences.",
};

export default async function NotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-8 lg:px-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Notification Settings
          </h1>
          <p className="mt-2 text-sm text-muted">
            Choose how you receive updates from your Acquisition OS.
          </p>
        </div>

        <NotificationPreferencesPanel />
      </div>
    </main>
  );
}
