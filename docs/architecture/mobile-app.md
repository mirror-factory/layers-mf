# Mobile App Architecture

> Strategy: **Capacitor** for native iOS + Android apps wrapping the Next.js web app.
> All three platforms (web, Android, iOS) share a single codebase with zero UI rewrite.
> Produces real .ipa and .apk files for App Store / Play Store distribution.

## PWA Setup

### Manifest

`public/manifest.json` defines the PWA metadata — name, theme color, icons, and start URL. The manifest is linked from the root layout via Next.js metadata.

### Meta Tags

The root layout (`src/app/layout.tsx`) includes:

- `<meta name="apple-mobile-web-app-capable" content="yes" />`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`
- `<meta name="apple-mobile-web-app-title" content="Granger" />`
- `themeColor: "#34d399"` in the metadata export

### Service Worker

Not yet implemented. When added, register in the root layout or via `next-pwa`. The service worker should cache the app shell and API responses for offline support.

## Capacitor Setup

Capacitor wraps the web app in a native WebView for iOS and Android.

### Config

`capacitor.config.ts` at the project root defines:

- `appId`: `com.mirrorfactory.granger`
- `appName`: `Granger`
- `webDir`: `out` (Next.js static export output)
- `server.url`: Points to the deployed app URL for live mode

### Installation (when ready)

```bash
pnpm add @capacitor/core @capacitor/cli
pnpm dlx cap init
pnpm dlx cap add android
pnpm dlx cap add ios
```

## Build Instructions

### Web (PWA)

```bash
pnpm build
# Deploy to Vercel — PWA is served automatically via manifest.json
```

### Android

```bash
pnpm build          # Build the Next.js app
pnpm dlx cap sync   # Copy web assets to native project
pnpm dlx cap open android  # Open in Android Studio
# Build APK/AAB from Android Studio
```

### iOS

```bash
pnpm build          # Build the Next.js app
pnpm dlx cap sync   # Copy web assets to native project
pnpm dlx cap open ios      # Open in Xcode
# Build IPA from Xcode
```

## Notes

- All three platforms share the same codebase — no platform-specific code needed for basic functionality.
- For native features (push notifications, biometrics), add Capacitor plugins as needed.
- The `server.url` in Capacitor config points to the live deployment. For development, change it to your local dev URL.
- Icons at `public/icon-192.png` and `public/icon-512.png` are referenced by the PWA manifest. Generate these from the brand assets.
