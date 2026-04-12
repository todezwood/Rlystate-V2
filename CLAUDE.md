# Rlystate Project Guidelines

## Writing Style

Never use dashes of any kind in written output. This includes em dashes, en dashes, and dashes used as separators or bullet points. Rewrite sentences to avoid them entirely.

---

## What This Project Is

Rlystate V2 is an AI-powered recommerce marketplace for iOS. Sellers snap a photo, AI generates the listing and suggests a price with a realistic floor and ceiling based on live market data. From that point forward, an AI agent acts as the seller's personal broker: answering buyer questions, negotiating within agreed parameters, scheduling pickup via Google Calendar, and requiring a deposit or full payment before any pickup is confirmed. The seller is out of the loop until a verified buyer shows up at an agreed time with money already paid.

The product has two layers:
- **Shervin's layer**: photo to AI listing to price. The front door.
- **Jarmar's layer**: AI agent as seller broker. The thing that makes people stay.

## Who Is Building This

Jarmar does backend engineering, AI agent development, workflow orchestration, and prompt engineering full time. He builds AI agents and agentic systems professionally. He was also the backend engineer on Rlystate V1. Trust his technical judgment on agent architecture, tool design, and backend decisions.

Shervin is a senior product manager at JPMorgan Chase. Sharp on product strategy, market positioning, user behavior, and business model. He originated the V2 concept. He gets credit in any document we produce.

## Tech Stack

**Mobile**
- React Native with Expo (iOS first, Android later)
- Bare workflow when native integrations require it
- Apple Sign In required by App Store rules
- TestFlight for beta distribution

**API**
- Node.js with Fastify
- PostgreSQL via Prisma ORM
- Redis for session cache, price cache, and agent conversation context
- Elasticsearch for full-text and geo listing search

**AI Pipeline**
- Vision: GPT-4o Vision or Gemini 2.5 Flash for item identification
- Copy: Claude or GPT-4o mini for listing generation
- Pricing: custom layer using eBay Finding API plus own transaction data over time
- Agent runtime: LLM with structured tool use (function calling)

**Agent Tools**
The seller agent operates with these tools only. It does not act outside these bounds.
- `get_listing_details()` — item info, photos, price floor and ceiling
- `get_seller_availability()` — reads seller Google Calendar via OAuth
- `send_message_to_buyer()` — responds in buyer conversation thread
- `propose_pickup_time()` — offers windows from calendar availability
- `create_calendar_invite()` — fires on deposit confirmation
- `confirm_deposit_status()` — checks Stripe before confirming pickup
- `update_listing_status()` — pending, sold, or relisted
- `escalate_to_seller()` — notification when human judgment is needed

**Payments**
- Stripe Connect for marketplace payments, deposit holds, take-rate capture, and payouts
- Route outside IAP to avoid Apple/Google 30% cut (allowed for physical goods)

**Auth**
- Apple Sign In (required for iOS)
- Google OAuth
- LinkedIn OAuth (higher trust tier, verified badge)

**Notifications**
- Twilio or Firebase for push and SMS

**Storage**
- AWS S3 plus CloudFront CDN
- AWS Lambda for async AI pipeline jobs
- SQS for decoupling photo upload from AI processing

**External APIs**
- eBay Finding API for price seed data
- Google Calendar API for seller scheduling
- Amazon PA API or Walmart Affiliate for retail adjacency ads

## Project Structure

```
/Rlystate
  /api          Node.js/Fastify REST API
  /mobile       React Native Expo iOS app
  /agent        AI agent runtime and tool implementations
  /infra        Infrastructure and environment config
```

## Key Product Decisions (Do Not Revisit Without Good Reason)

- iOS beta first, Android later
- Launch vertical is furniture and items above roughly $100
- Buyer must pay deposit or full amount before pickup is confirmed by agent
- Agent negotiates within seller-defined price floor. It never accepts below floor.
- Agent escalates to seller when outside parameters. Seller is otherwise not in the loop.
- Tiered verification: Apple/Google at base, LinkedIn for verified tier
- Take rate target: 8 to 12 percent on completed transactions
- Geo-focused launch in one city first. NYC is the likely candidate.
- Free to list. We make money only when the seller does.

## Deployment Permissions

Claude is authorized to run `git add`, `git commit`, `git push`, and `firebase deploy` commands as part of normal work. Always commit only the files relevant to the current change. Never use `git add -A` or `git add .`. Always confirm with Jarmar before pushing or deploying and wait for explicit approval before proceeding.

## Open Questions (As Of April 2026)

- Buyer hook: why does a buyer open this app instead of FB Marketplace? Not solved yet.
- Exact price floor threshold (instinct: $100 minimum for launch)
- Full upfront payment vs deposit percentage (leaning toward deposit to reduce buyer friction)
- Dispute resolution flow when buyer claims item is not as described
