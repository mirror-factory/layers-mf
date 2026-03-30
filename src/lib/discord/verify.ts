import { verifyKey } from 'discord-interactions';

export async function verifyDiscordRequest(
  rawBody: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  const publicKey = process.env.DISCORD_PUBLIC_KEY!;
  return verifyKey(rawBody, signature, timestamp, publicKey);
}
