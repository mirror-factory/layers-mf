# Launch Checklist

## Infrastructure
- [ ] Production Supabase project created + all migrations applied
- [ ] Vercel project linked to GitHub repo
- [ ] Custom domain configured (layers.mirrorfactory.com)
- [ ] Cloudflare DNS pointing to Vercel
- [ ] All environment variables set in Vercel dashboard
- [ ] Stripe live keys configured
- [ ] Inngest Vercel integration installed
- [ ] Nango OAuth apps configured per provider

## Security
- [ ] RLS policies verified on all tables
- [ ] Webhook signature verification active (Stripe, Linear, Discord, Nango)
- [ ] Webhook idempotency active
- [ ] Rate limiting active (per-org tiers)
- [ ] API key hashing verified
- [ ] robots.txt set to noindex (pre-launch)
- [ ] CORS headers configured
- [ ] NEXT_PUBLIC_SITE_URL set to production domain

## Testing
- [ ] Full E2E suite passes against production
- [ ] Auth flow works (signup, login, OAuth, password reset)
- [ ] File upload → pipeline → ready (end-to-end)
- [ ] Chat sends message → gets response with citations
- [ ] Integration connect → sync → items appear
- [ ] Credit purchase → webhook → balance updated
- [ ] Daily digest cron fires and generates correctly
- [ ] All 32 pages load without errors

## Monitoring
- [ ] Sentry integration (future — not yet built)
- [ ] Inngest Cloud dashboard accessible
- [ ] Webhook health dashboard shows all providers green
- [ ] Content health score > 75

## Documentation
- [ ] In-app user guide complete
- [ ] API docs cover all 63 endpoints
- [ ] Production setup guide complete
- [ ] Environment variables documented
