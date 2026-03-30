import { after } from 'next/server';
import { getBot } from '@/lib/discord/bot';

export const maxDuration = 60;

/**
 * POST /api/discord/interactions
 *
 * Discord Interactions endpoint — receives slash commands, button clicks,
 * and PING verification challenges.
 *
 * Delegates entirely to the Chat SDK's Discord adapter, which handles:
 * - Ed25519 signature verification
 * - PING/PONG responses
 * - Slash command routing (via chat.onSlashCommand handlers in bot.ts)
 * - Button/component interaction routing
 */
export async function POST(request: Request) {
  const bot = getBot();
  return bot.webhooks.discord(request, {
    waitUntil: (p) => after(() => p),
  });
}

/**
 * GET /api/discord/interactions
 *
 * Health check endpoint — useful for monitoring and uptime checks.
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'discord-interactions',
    timestamp: new Date().toISOString(),
  });
}
