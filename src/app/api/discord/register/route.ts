import { NextRequest, NextResponse } from 'next/server';
import { registerCommands } from '@/lib/discord/register-commands';

// Protected endpoint — only callable with a secret
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await registerCommands();
    return NextResponse.json({ success: true, commands: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
