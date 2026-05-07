const DISCORD_API = 'https://discord.com/api/v10';

export async function sendFollowup(
  interactionToken: string,
  content: string,
  applicationId: string
) {
  const res = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    }
  );
  return res.json();
}

export async function sendMessage(
  channelId: string,
  content: string,
  threadId?: string
) {
  const body: Record<string, unknown> = { content: content.slice(0, 2000) };
  if (threadId) body.message_reference = { message_id: threadId };

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function addReaction(
  channelId: string,
  messageId: string,
  emoji: string
) {
  await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    {
      method: 'PUT',
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    }
  );
}

export async function createThread(
  channelId: string,
  messageId: string,
  name: string
) {
  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}/threads`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.slice(0, 100),
        auto_archive_duration: 1440,
      }),
    }
  );
  return res.json();
}
