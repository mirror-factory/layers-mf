import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mirrorfactory.granger",
  appName: "Granger",
  webDir: "out",
  server: {
    // For dev: point to your local Next.js server (use your machine's local IP)
    // For prod: point to the deployed URL
    url: process.env.CAPACITOR_SERVER_URL || "https://layers.hustletogether.com",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Granger",
  },
  plugins: {},
  // Custom native plugins registered via CAPBridgedPlugin:
  // - PushNotificationsPlugin (jsName: "PushNotifications")
  // - LiveActivityPlugin (jsName: "LiveActivity")
};

export default config;
