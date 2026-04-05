# Rlystate V2 — Prototype Plan
*Written April 2026 — save this before restarting*

## The Goal

A shareable URL Shervin can open on his phone in a few days and experience both product layers for real. Apple developer account is lapsed so no iOS for now.

## Approach

Next.js 14 (App Router) full-stack web app deployed to Vercel. One deployment, one URL, no CORS. The existing `agent.ts` and `aiPipeline.ts` services copy directly into Next.js API routes with no rewriting.

## Vercel Infrastructure (zero config)

- Vercel Postgres (Neon) for the database
- Upstash Redis via `rediss://` URL so existing `ioredis` code works unchanged
- Vercel Blob for photo storage (replaces S3)
- **Must be on Vercel Pro plan** — agent route needs `maxDuration = 60` or the 10-second serverless timeout kills the agent mid-run

## What Gets Cut for the Prototype

| Cut | Replace with |
|---|---|
| Stripe / real payments | "Simulate Deposit" button that writes a real Transaction row |
| OAuth (Apple/Google/LinkedIn) | Name + email stored in a browser cookie |
| Elasticsearch | Postgres ILIKE search on title + description |
| Twilio push notifications | Escalation badge on seller dashboard |
| S3 / CloudFront | Vercel Blob |
| SQS / Lambda async queue | Synchronous Vercel function calls |

**Keep:** Full Claude vision pipeline, full 8-tool agent loop, Google Calendar invite (the money moment of the demo), simulated deposit that triggers the real confirmDepositStatus tool path.

## New Project Location

Create `/Users/jarmarledesma/Documents/Rlystate/rlystate-web` as the Next.js app. It lives inside the existing monorepo.

## Files to Copy from Existing Backend (no rewriting needed)

| From | To |
|---|---|
| `api/prisma/schema.prisma` | `rlystate-web/prisma/schema.prisma` |
| `api/src/lib/prisma.ts` | `rlystate-web/src/lib/prisma.ts` |
| `api/src/lib/redis.ts` | `rlystate-web/src/lib/redis.ts` |
| `api/src/services/agent.ts` | `rlystate-web/src/lib/agent.ts` |
| `api/src/services/aiPipeline.ts` | `rlystate-web/src/lib/aiPipeline.ts` |
| `agent/src/tools/` (all 8 files) | `rlystate-web/src/agent/tools/` |
| `agent/src/prompts/sellerAgent.ts` | `rlystate-web/src/agent/prompts/sellerAgent.ts` |

**One code change needed:** In the 3 tool files that import from `../../../api/src/lib/`, change those paths to `../../lib/`. That is the only code change across all copied files.

**One logic change in aiPipeline.ts:** Vercel Blob returns a full URL. Pass it directly to `runAIPipeline` instead of constructing `${CDN_BASE_URL}/${imageKey}`.

## Pages to Build

- `/join` — name + email form, sets cookie, entire auth system
- `/browse` — marketplace listing grid (buyer entry point)
- `/sell` — camera capture + AI pipeline + publish form
- `/listings/[id]` — listing detail + buyer chat UI
- `/dashboard` — seller view: listings, conversation threads, escalation badges

## API Routes to Build

- `POST /api/analyze` — photo upload to Vercel Blob, calls runAIPipeline, returns draft
- `GET /api/listings` — browse with Postgres ILIKE search
- `POST /api/listings` — publish confirmed listing
- `GET /api/listings/[id]` — single listing
- `POST /api/agent/message` — runs full agent turn (maxDuration = 60)
- `GET /api/agent/thread/[listingId]/[buyerId]` — conversation history
- `POST /api/deposit/simulate` — writes Transaction row as DEPOSIT_HELD

## Agent Response UX

Simple POST and wait. No SSE or WebSocket needed. Show a typing indicator while the 3 to 8 second call runs. Return `toolsCalled` in the response and show a small secondary line under the agent reply such as "Checked your calendar for availability" so the AI reasoning is visible without streaming complexity.

## 3-Day Build Order

### Day 1 — Seller flow end-to-end

1. `npx create-next-app@latest rlystate-web --typescript --tailwind --app --src-dir`
2. Connect Vercel Postgres and Upstash Redis in the Vercel dashboard. Run `prisma migrate deploy`.
3. Copy all service and tool files. Fix the 3 import paths.
4. Build `/api/analyze` route with Vercel Blob upload and `runAIPipeline`.
5. Build `/api/listings` POST route (upsert user from cookie, create listing).
6. Build `/sell` page: photo capture, AI loading state, draft review form, publish.

**Checkpoint:** Photo to published listing works on mobile Safari.

### Day 2 — Buyer flow and agent

7. Build `/join` page (name + email cookie).
8. Build `/browse` page and `GET /api/listings` with ILIKE search.
9. Build `/listings/[id]` page and `POST /api/agent/message` route.
10. Build chat UI: message thread, input, typing indicator.
11. Build deposit simulator button and `/api/deposit/simulate` route.
12. Set up Google Calendar OAuth tokens for the demo seller account via a one-off Prisma script (write tokens directly to the users table). This is worth doing because the live calendar invite is the moment that makes Shervin understand the product.

**Checkpoint:** Buyer chats with agent, places deposit, real Google Calendar invite arrives in seller's inbox.

### Day 3 — Dashboard, polish, deploy

13. Build `/dashboard`: listing grid with status badges, conversation list with escalation badges, thread viewer.
14. Verify all flows at 390px (iPhone 15 width) on real mobile Safari.
15. Seed 5 to 6 realistic listings with images (Unsplash URLs are fine).
16. `vercel deploy --prod`. Share URL with Shervin.

## Verification Checklist Before Sharing

1. Open URL on actual iPhone in Safari
2. Take a photo of a real object, verify AI generates a plausible listing
3. Publish the listing, verify it appears on browse page
4. Open listing as a buyer (incognito or different device), send a message about price
5. Verify agent responds, negotiates, proposes a pickup time
6. Tap Simulate Deposit, send one more message
7. Verify agent confirms pickup and real Google Calendar invite arrives in seller inbox
8. Open seller dashboard, verify conversation thread and escalation badge work

## Environment Variables Needed

```
ANTHROPIC_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DATABASE_URL               (auto-set by Vercel Postgres)
REDIS_URL                  (from Upstash, use the rediss:// connection string)
BLOB_READ_WRITE_TOKEN      (auto-set by Vercel Blob)
```

Not needed for prototype: STRIPE_*, TWILIO_*, AWS_*
