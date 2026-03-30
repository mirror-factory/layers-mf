const DISCORD_API = 'https://discord.com/api/v10';

interface SlashCommand {
  name: string;
  description: string;
  options?: {
    name: string;
    description: string;
    type: number; // 3 = STRING, 4 = INTEGER, 5 = BOOLEAN
    required?: boolean;
  }[];
}

const COMMANDS: SlashCommand[] = [
  {
    name: 'ask',
    description: 'Ask Granger a question about your team context, meetings, or tasks',
    options: [
      {
        name: 'question',
        description: 'Your question for Granger',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'status',
    description: 'Get a summary of pending approvals, overdue items, and active tasks',
  },
  {
    name: 'tasks',
    description: 'List your current tasks and in-progress Linear issues',
  },
  {
    name: 'digest',
    description: 'Generate your personalized daily digest right now',
  },
];

export async function registerCommands() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID; // For guild-specific commands (faster updates)

  if (!applicationId || !botToken) {
    throw new Error('Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN');
  }

  // Use guild commands for development (instant update), global for production
  const url = guildId
    ? `${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands`
    : `${DISCORD_API}/applications/${applicationId}/commands`;

  const res = await fetch(url, {
    method: 'PUT', // PUT replaces all commands atomically
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(COMMANDS),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to register commands: ${res.status} ${error}`);
  }

  const registered = await res.json();
  console.log(`Registered ${registered.length} commands`);
  return registered;
}
