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
| `NEXT_PUBLIC_AGORA_APP_ID` | Agora Console → Project → App ID |
| `AGORA_APP_CERTIFICATE` | Agora Console → Project → Primary Certificate |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 → Account ID (session recording) |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage API Tokens → Object Read & Write |
| `R2_SECRET_ACCESS_KEY` | Shown once when the R2 API token is created |
| `R2_BUCKET_NAME` | The R2 bucket you created for recordings |
| `GEMINI_API_KEY` | Google AI Studio → Get API key (AI session notes) |
| `CRON_SECRET` | Run: `openssl rand -base64 32` (shared by all cron routes) |

### Session recording (Cloudflare R2)

Recordings are composited and uploaded by the teacher's browser straight to R2,
so the app server never proxies video. Two bucket settings are required:

1. **CORS** — allow the browser to `PUT` upload parts:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-domain.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   No `ExposeHeaders` entry is needed: the server finalizes each upload via
   ListParts, so the browser never reads ETags.
2. **Lifecycle rules** — keep storage inside the 10 GB free tier:
   - delete objects under the `recordings/` prefix **7 days** after creation;
   - keep R2's default rule that aborts incomplete multipart uploads after 7 days.

Free-tier budget: 720p recording is ~600 MB/hour, so 10 GB holds ~16 hours.
With the 7-day retention above, roughly **2 hours of recording per day** is
sustainable indefinitely. Playback costs nothing extra — R2 has no egress fees.

### Live captions (Agora Signaling)

Captions travel over Agora Signaling (RTM), which must be **enabled for the
project** in Agora Console → your project → Signaling (Signaling 2.x, free
package). No extra credentials: the existing App ID and certificate are used.
If Signaling is left disabled the video call still works and the captions menu
simply reports itself unavailable.

Free-tier limits worth knowing before scaling:

| Limit | Value | Consequence |
|---|---|---|
| Messages | 1M / month | ~4,500 msgs per captioned lesson-hour → ~220 lesson-hours/month. Sending only final captions (no interim updates) drops this to ~700/hour. |
| Peak concurrent users | **20** | Roughly 10 simultaneous captioned lessons platform-wide. **Exceeding a free-tier limit suspends Signaling**, so move to a paid Signaling package before growing past that. |

### AI session notes (Gemini free tier)

Final captions from **group class** sessions are stored as a transcript and
summarized into English/Arabic/Russian notes by `gemini-2.5-flash` on the free
tier (10 requests/minute, 250/day), triggered by the `/api/cron/session-notes`
job. Notes appear in the class details section in each viewer's own language.
Without `GEMINI_API_KEY` the cron job reports that it is not configured and
nothing else is affected.

### Cron schedules and how often to run them

`vercel.json` schedules all three jobs **daily**, because Vercel's Hobby plan
allows nothing more frequent — a shorter expression makes the **deployment
fail**, not just the job. Daily is enough to be correct but slow: each run
generates at most 8 sets of notes (one Gemini call each, sized to finish inside a
function timeout), and a recording abandoned by a crashed tab stays unfinalized
until the next run.

If you teach more than ~8 classes a day, or want notes and recording cleanup
within the hour, call the routes from an external scheduler as
`/api/cron/class-reminders` is already called:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron/session-notes
curl -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron/recordings-sweep
```

Both are idempotent, so running them more often is safe. On a Pro plan you can
simply change the schedules in `vercel.json` to `0 * * * *` instead.

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
| Video | Agora RTC (agora-rtc-react + token auth) |
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
