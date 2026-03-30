export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
} as const;

export interface DiscordInteraction {
  id: string;
  type: number;
  data?: {
    name: string;
    options?: { name: string; value: string; type: number }[];
  };
  member?: { user: { id: string; username: string } };
  user?: { id: string; username: string }; // For DM interactions
  channel_id: string;
  guild_id?: string;
  token: string; // Used for follow-up responses
}
