import { SignJWT, importPKCS8 } from "jose";

interface APNsPayload {
  token: string;
  title: string;
  body: string;
  link?: string;
  badge?: number;
  sound?: string;
}

interface APNsResult {
  success: boolean;
  /** True if the token is invalid/expired and should be removed from DB */
  tokenInvalid?: boolean;
}

// Cache the signing key so we don't re-import on every call
let cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const rawKey = process.env.APNS_KEY;
  if (!rawKey) throw new Error("APNS_KEY not set");

  // The .p8 key is a PEM-encoded PKCS#8 EC private key
  cachedKey = await importPKCS8(rawKey, "ES256");
  return cachedKey;
}

/**
 * Create a JWT for APNs authentication.
 * Uses ES256 algorithm per Apple's requirements.
 */
async function createAPNsJWT(): Promise<string> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;

  if (!keyId || !teamId) {
    throw new Error("APNS_KEY_ID or APNS_TEAM_ID not set");
  }

  const key = await getSigningKey();

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

/**
 * Send a push notification via Apple Push Notification service.
 * Uses JWT-based (token) authentication with a .p8 key.
 *
 * Required environment variables:
 * - APNS_KEY_ID: Key ID from Apple Developer portal
 * - APNS_TEAM_ID: Team ID from Apple Developer portal
 * - APNS_KEY: Contents of the .p8 private key file (with newlines)
 * - APNS_BUNDLE_ID: App bundle identifier (defaults to com.mirrorfactory.granger)
 */
export async function sendAPNs(payload: APNsPayload): Promise<APNsResult> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = process.env.APNS_KEY;
  const bundleId = process.env.APNS_BUNDLE_ID ?? "com.mirrorfactory.granger";

  if (!keyId || !teamId || !key) {
    console.log("[apns] Missing APNs credentials -- push disabled");
    return { success: false };
  }

  const jwt = await createAPNsJWT();

  // Use sandbox for development, production for release
  const host =
    process.env.NODE_ENV === "production"
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";

  const apnsPayload = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      badge: payload.badge ?? 1,
      sound: payload.sound ?? "default",
      "mutable-content": 1,
    },
    link: payload.link,
  };

  try {
    const res = await fetch(`https://${host}/3/device/${payload.token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apnsPayload),
    });

    if (res.ok) {
      return { success: true };
    }

    const errorText = await res.text();
    console.error(`[apns] Push failed (${res.status}):`, errorText);

    // 410 = token unregistered, 400 = bad token
    const tokenInvalid = res.status === 410 || res.status === 400;
    return { success: false, tokenInvalid };
  } catch (err) {
    console.error("[apns] Push error:", err);
    return { success: false };
  }
}
