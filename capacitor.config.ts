const config = {
  appId: "com.mirrorfactory.granger",
  appName: "Granger",
  webDir: "out",
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL || "https://granger.app",
    cleartext: true,
  },
};

export default config;
