import { redirect } from "next/navigation";

/**
 * The cycle hub moved to /acquisition (the primary OS home). This path
 * redirects so no duplicate hub exists; step pages live on unchanged.
 */
export default function CycleHubRedirect() {
  redirect("/acquisition");
}
