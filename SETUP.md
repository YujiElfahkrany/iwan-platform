# Iwan Academy — Setup Guide

## Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Stripe account (for payments)
- Resend account (for emails)
- Vercel account (for hosting)

## Local Development

### 1. Clone & install
```bash
git clone <your-repo>
cd iwan-platform
npm install
```

### 2. Environment variables
Copy `.env.local` and fill in your values:

```bash
cp .env.local .env.local.example  # keep the example for reference
```

Required variables:
| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `AUTH_SECRET` | Run: `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → (add endpoint) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API keys |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | A verified sender in Resend |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (dev) or your Vercel URL |

### 3. Stripe webhook (local)
```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:3000/api/payments/webhook
# Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET
```

### 4. Run dev server
```bash
npm run dev
```
Visit: http://localhost:3000

---

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel → set all env vars
3. Add Stripe webhook endpoint: `https://your-domain.vercel.app/api/payments/webhook`
4. Vercel Cron is configured in `vercel.json` (runs daily at 08:00 UTC)
5. Set `CRON_SECRET` env var — Vercel auto-injects it for Cron routes

---

## Architecture

| Feature | Implementation |
|---|---|
| Auth | NextAuth.js v5 (credentials + JWT) |
| Database | MongoDB via Mongoose |
| i18n | next-intl (EN + AR RTL) |
| Payments | Stripe Checkout + webhooks |
| Video | Jitsi Meet (iframe, meet.jit.si) |
| Email | Resend |
| Styling | Tailwind CSS + shadcn/ui |
| Font | Cairo (Arabic + Latin) |
| Reminders | Vercel Cron → `/api/cron` |

## User Flows

### Student
1. Register at `/auth/register/student` (3-step form)
2. Browse teachers at `/dashboard/student/teachers`
3. View teacher profile → pick a slot → Stripe checkout
4. After payment: booking confirmed, email sent
5. Join session at `/session/[bookingId]` (within 10 min of start)

### Teacher
1. Register at `/auth/register/teacher` (3-step form)
2. Add availability slots at `/dashboard/teacher/availability`
3. Create group classes at `/dashboard/teacher/classes`
4. View bookings at `/dashboard/teacher/bookings`
5. Join session at `/session/[bookingId]`

## Key Files
- `models/` — Mongoose schemas
- `lib/auth.ts` — NextAuth config
- `lib/stripe.ts` — Stripe client
- `app/api/payments/webhook/route.ts` — Stripe webhook handler
- `messages/en.json` / `messages/ar.json` — All UI strings
- `i18n/routing.ts` — Locale config
- `middleware.ts` — Auth guards + locale routing
