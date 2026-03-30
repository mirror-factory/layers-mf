import { NextRequest, NextResponse } from 'next/server';
import { verifyDiscordRequest } from '@/lib/discord/verify';
import {
  InteractionType,
  InteractionResponseType,
  type DiscordInteraction,
} from '@/lib/discord/types';
import { handleSlashCommand } from '@/lib/discord/commands';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-signature-ed25519') ?? '';
  const timestamp = request.headers.get('x-signature-timestamp') ?? '';

  // Discord requires Ed25519 signature verification on all interactions
  if (!(await verifyDiscordRequest(rawBody, signature, timestamp))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const interaction: DiscordInteraction = JSON.parse(rawBody);

  // Handle PING — Discord sends this to verify the endpoint URL
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // Handle slash commands (/ask, /status, /tasks, /digest)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const applicationId = process.env.DISCORD_APPLICATION_ID!;

    // Discord requires a response within 3 seconds, so defer immediately
    // then process the command in the background via fire-and-forget
    handleSlashCommand(interaction, applicationId).catch((err) => {
      console.error('[discord] command handler error:', err);
    });

    return NextResponse.json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });
  }

  return NextResponse.json(
    { error: 'Unknown interaction type' },
    { status: 400 }
  );
}
