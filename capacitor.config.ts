import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app is a native shell around the hosted FairGrade site, so web deploys reach the app
 * instantly. Native features (the ML Kit document scanner) are called from the site through the
 * Capacitor bridge.
 *
 *   FAIRGRADE_APP_URL=http://10.0.2.2:3000 npx cap sync android   # point an emulator at local `npm run dev`
 */
const url = process.env.FAIRGRADE_APP_URL || "https://fairgrade-zeta.vercel.app";

const config: CapacitorConfig = {
  appId: "app.fairgrade.mobile",
  appName: "FairGrade",
  webDir: "mobile/www",
  // Lets the server recognise the app and render the app layout instead of the website.
  appendUserAgent: "FairGradeApp/1.0",
  server: {
    url,
    cleartext: url.startsWith("http://"),
  },
  android: {
    backgroundColor: "#f7f7fb",
  },
};

export default config;
