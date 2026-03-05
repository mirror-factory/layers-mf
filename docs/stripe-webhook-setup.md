# Stripe Webhook Setup

## Local Development

Use the Stripe CLI to forward events to your local server. This generates a temporary webhook signing secret.

```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` secret it prints and add to `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Run this every time you start local dev (or add it to your dev script).

## Production (Stripe Dashboard)

1. Go to **Developers → Webhooks → Add destination**
2. Select **Webhook endpoint**
3. Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_...`) → add to Vercel env vars

## Events Layers Needs

| Event | Why |
|-------|-----|
| `checkout.session.completed` | Credit purchase confirmed → add credits to org |
| `invoice.payment_succeeded` | Subscription renewal → extend access |
| `invoice.payment_failed` | Failed payment → notify owner, suspend if needed |
| `customer.subscription.updated` | Plan change → update credit limits |
