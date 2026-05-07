/**
 * Discord integration for Granger.
 *
 * Slash commands, DMs, mentions, and reactions are handled by the Chat SDK
 * bot instance (bot.ts). The interactions API route delegates to
 * `chat.webhooks.discord(request)` which routes events to registered handlers.
 *
 * The Chat SDK's DiscordAdapter handles:
 * - Ed25519 signature verification
 * - Slash command routing (via onSlashCommand handlers)
 * - DM handling (via onDirectMessage handler)
 * - Mention handling (via onNewMention / onSubscribedMessage)
 * - Reaction handling (via onReaction)
 * - Message splitting for Discord's 2000 char limit
 *
 * Remaining custom modules:
 * - api.ts — low-level Discord REST helpers (used by approval-handler)
 * - approval-handler.ts — approval posting with reaction buttons
 * - register-commands.ts — slash command registration with Discord API
 */

export { registerCommands } from './register-commands';
export { sendFollowup, sendMessage, addReaction, createThread } from './api';
export { postApprovalToDiscord, handleApprovalReaction } from './approval-handler';
export { createGrangerBot, getBot } from './bot';
export type { GrangerBot } from './bot';
