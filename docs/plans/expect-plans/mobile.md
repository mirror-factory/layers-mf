# Expect Plan — Mobile Cross-Cutting

> Mobile-specific flows that span every feature. Device: iPhone 14 Pro 393×852.

### S1 — Auth on mobile
1. `/signup` → full-width form.
2. Inputs have inputMode=email/tel/etc for correct keyboards.
3. Google OAuth button tap-friendly (≥44pt).

### S2 — Sidebar → bottom nav
1. Logged in, default landing.
2. **Expect**: bottom nav replaces sidebar.
3. Active tab highlighted.
4. More menu (⋯) opens sheet with secondary nav.

### S3 — Chat input
1. Focus input.
2. **Expect**: keyboard doesn't push content up weirdly; last message stays visible.
3. Enter sends; no line break on soft keyboard Enter.
4. @ picker opens as bottom sheet (not floating dropdown).

### S4 — Swipe gestures
1. In conversation list, swipe left on item → Delete / Archive.
2. In artifact panel, swipe down → close.
3. In image viewer, swipe to dismiss.

### S5 — Camera upload
1. Library → Upload.
2. **Expect**: native sheet with "Take Photo" / "Photo Library" / "Files".
3. Take photo → uploads as photo source type.

### S6 — PWA install
1. Browser prompt → Add to Home Screen.
2. Launch from home screen.
3. **Expect**: standalone mode, splash screen with Granger branding.

### S7 — Push notifications (APNS)
1. Grant notification permission.
2. Trigger any AI activity (schedule run, approval).
3. **Expect**: native push notification.
4. Tap → opens exact chat / page.

### S8 — Orientation
1. Rotate to landscape.
2. **Expect**: layout adapts, no content cut off.
3. Rotate back — state preserved.

### S9 — Tablet split view
1. On iPad 820×1180.
2. Chat on left, artifact on right.
3. Divider draggable.

### S10 — Offline
1. Airplane mode.
2. **Expect**: "You're offline" banner.
3. Cached chat history still browsable.
4. Sending queues until online.
