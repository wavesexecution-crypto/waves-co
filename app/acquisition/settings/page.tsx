import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let hasAccess = false;
  if (tenantId) {
    try {
      const entitlement = await getEntitlement(tenantId);
      hasAccess = hasCommercialAccess(entitlement);
    } catch {
      hasAccess = false;
    }
  }

  return <SettingsClient user={user} tenantId={tenantId} hasAccess={hasAccess} />;
}