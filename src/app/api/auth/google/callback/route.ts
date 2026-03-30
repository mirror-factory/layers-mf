import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCode } from '@/lib/api/google-auth';

interface CredentialRow {
  org_id: string;
  user_id: string;
  provider: string;
  token_encrypted: string;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
}

/** Upsert a credential row (credentials table added via migration) */
async function upsertCredential(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: CredentialRow,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- credentials table pending DB types regeneration
  const client = supabase as any;
  await client
    .from('credentials')
    .upsert(row, { onConflict: 'org_id,user_id,provider' });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/api-keys?error=no_code', request.url),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();
  if (!member) {
    return NextResponse.redirect(
      new URL('/settings/api-keys?error=no_org', request.url),
    );
  }

  try {
    const tokens = await exchangeCode(code);

    const baseCredential = {
      org_id: member.org_id,
      user_id: user.id,
      token_encrypted: tokens.access_token!,
      refresh_token_encrypted: tokens.refresh_token ?? null,
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    };

    // Store Gmail + Drive credentials (same OAuth tokens, separate rows)
    await upsertCredential(supabase, {
      ...baseCredential,
      provider: 'gmail',
    });
    await upsertCredential(supabase, {
      ...baseCredential,
      provider: 'drive',
    });

    return NextResponse.redirect(
      new URL('/settings/api-keys?success=google', request.url),
    );
  } catch (err) {
    console.error('Google OAuth error:', err);
    return NextResponse.redirect(
      new URL('/settings/api-keys?error=oauth_failed', request.url),
    );
  }
}
