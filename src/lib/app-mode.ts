import "server-only";
import { cookies, headers } from "next/headers";

/**
 * True when the page is being rendered for the FairGrade Android app (its WebView appends
 * "FairGradeApp" to the user agent). The app gets a native-style shell: top bar, bottom tabs,
 * no marketing pages. Setting the `fg_app=1` cookie previews app mode in a desktop browser.
 */
export async function isAppMode() {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/FairGradeApp/.test(ua)) return true;
  return (await cookies()).get("fg_app")?.value === "1";
}
