/**
 * Server-side authorization helpers for Acquisition OS.
 *
 * Pure functions (no DB, no request objects) so routes stay thin and the
 * rules are unit-testable. Roles come from the session (`owner`/`admin`/
 * `member`) which the auth layer populates from the database — never from
 * client input.
 */

const MANAGER_ROLES = ["owner", "admin"] as const;

/** Roles allowed to perform tenant-management actions (e.g. forge system notifications). */
export function canManageTenant(role: unknown): boolean {
  return typeof role === "string" && (MANAGER_ROLES as readonly string[]).includes(role.toLowerCase());
}

/** Alias with domain intent: creating system notifications on behalf of the tenant. */
export function canCreateNotification(role: unknown): boolean {
  return canManageTenant(role);
}
