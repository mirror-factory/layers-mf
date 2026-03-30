-- Add Granger-related columns to existing tables

-- context_items: priority weighting, confidence scoring, source quotes
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS priority_weight INT NOT NULL DEFAULT 0;
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 1.0;
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS source_quote TEXT;

-- chat_messages: multi-channel support (web, discord, slack)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'web';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS discord_channel_id TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS discord_message_id TEXT;

-- conversations: compacted summary for long conversation context
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS compacted_summary TEXT;
