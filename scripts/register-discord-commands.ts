#!/usr/bin/env tsx
import { registerCommands } from '../src/lib/discord/register-commands';
import 'dotenv/config';

async function main() {
  console.log('Registering Discord slash commands...');
  const result = await registerCommands();
  console.log('Done:', JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
