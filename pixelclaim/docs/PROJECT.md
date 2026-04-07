# PixelClaim — Full Project Documentation

> Maintained by the development team. Update this file whenever a phase is completed,
> a decision is changed, or a new technical constraint is discovered.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Breaking Changes Log](#3-breaking-changes-log)
4. [Architecture](#4-architecture)
5. [Database Schema](#5-database-schema)
6. [Moderation System](#6-moderation-system)
7. [Payment & Concurrency System](#7-payment--concurrency-system)
8. [Pricing Algorithm](#8-pricing-algorithm)
9. [Folder Structure](#9-folder-structure)
10. [Environment Variables](#10-environment-variables)
11. [Setup Guide](#11-setup-guide)
12. [Development Phase Log](#12-development-phase-log)
13. [Product Decisions](#13-product-decisions)
14. [Known Issues & Constraints](#14-known-issues--constraints)

---

## 1. Project Overview

**PixelClaim** is a modernized "Million Dollar Homepage" — a public interactive grid
where users purchase blocks, upload images or GIFs, and optionally link them to
external URLs. Blocks have dynamic pricing based on location, demand, and proximity
to other purchased blocks.

**Core value proposition:**
- Own a permanent, public piece of the internet
- Prices go up as surrounding blocks get purchased (urgency + scarcity)
- All content is moderation-gated before appearing publicly

**Domain target:** `pixelclaim.io`

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 | See Breaking Changes section |
| Language | TypeScript | 5.x | Strict mode enabled |
| Styling | Tailwind CSS | 4.x | New config format (no tailwind.config.js content array) |
| Components | Shadcn/UI | 4.x | Built on Base UI, NOT Radix — see Breaking Changes |
| Auth | Clerk | 7.0.8 | See Breaking Changes |
| ORM | Prisma | 7.6.0 | See Breaking Changes |
| Database | PostgreSQL | via Supabase | |
| Storage | Supabase Storage | latest | Private bucket for pending, public for approved |
| Realtime | Supabase Realtime | latest | Subscribed to ActivityFeed table inserts |
| Payments | Stripe | 22.x | Checkout Sessions (not Payment Intents) |
| Validation | Zod | 4.x | New API — some breaking changes from v3 |
| Deployment | Vercel | — | |

---

## 3. Breaking Changes Log

> CRITICAL: This project uses bleeding-edge versions with breaking changes from
> common documentation and AI training data. Read this section before writing
> any code.

### Next.js 16

| Change | Old | New |
|---|---|---|
| Middleware file | `src/middleware.ts` | `src/proxy.ts` |
| Middleware export | `export function middleware()` | `export function proxy()` |
| cookies() | synchronous | `async` — must `await cookies()` |
| params in pages/layouts | object | Promise — must `await params` |
| searchParams | object | Promise — must `await searchParams` |

### Clerk v7

| Change | Old | New |
|---|---|---|
| Conditional render (signed in) | `<SignedIn>` | `<Show when="signed-in">` |
| Conditional render (signed out) | `<SignedOut>` | `<Show when="signed-out">` |
| Server auth | `auth()` from `@clerk/nextjs/server` | same |
| Middleware helper | `authMiddleware()` | `clerkMiddleware()` from `@clerk/nextjs/server` |
| Route protection | `withClerkMiddleware` | `createRouteMatcher()` + `auth.protect()` |

### Prisma v7

| Change | Old | New |
|---|---|---|
| Generator provider | `prisma-client-js` | `prisma-client` |
| Output path | configurable | `../src/generated/prisma` |
| Import path | `@prisma/client` | `@/generated/prisma/client` |
| Connection config | `url` in schema.prisma | `prisma.config.ts` datasource block |
| `directUrl` | in schema.prisma | NOT SUPPORTED in v7 config type |
| `PrismaClient()` | bare constructor works | REQUIRES `adapter` or `accelerateUrl` |
| Driver adapter | optional | REQUIRED — use `@prisma/adapter-pg` with `pg` |
| Migrations with Supabase | use `directUrl` | set `DATABASE_URL` to direct URL at migrate time |

### Shadcn/UI (Base UI version)

| Change | Old | New |
|---|---|---|
| Underlying primitive | `@radix-ui` | `@base-ui/react` |
| `asChild` prop | supported | NOT SUPPORTED |
| Render-as-link pattern | `<Button asChild><Link /></Button>` | `<Button render={<Link href="..." />}>Label</Button>` |
| Component source | `ui/` components | generated same location, different primitives |

### Zod v4

| Change | Old | New |
|---|---|---|
| `.email()` | `z.string().email()` | same |
| Error maps | `ZodError.format()` | largely same, check release notes for edge cases |

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                   │
│           Browser (Next.js SSR + Client Components)              │
│    ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│    │  Grid Page │  │  Dashboard  │  │   Admin Dashboard    │    │
│    │ (CSS Grid) │  │  (My Blocks)│  │   (Protected)        │    │
│    └─────┬──────┘  └──────┬──────┘  └──────────┬───────────┘    │
└──────────┼────────────────┼─────────────────────┼────────────────┘
           │ RSC + Realtime  │ Server Actions       │ Server Actions
           │                 │                      │
┌──────────▼─────────────────▼──────────────────────▼──────────────┐
│                     Next.js App (Vercel)                          │
│  ┌──────────────────┐  ┌───────────────┐  ┌────────────────────┐ │
│  │  App Router (RSC)│  │ Server Actions │  │  src/proxy.ts      │ │
│  │                  │  │ (all mutation) │  │  (Clerk auth +     │ │
│  │                  │  │               │  │   route protection) │ │
│  └──────────────────┘  └───────┬───────┘  └────────────────────┘ │
│                                 │                                  │
│  ┌─────────────────── Internal Services ──────────────────────┐   │
│  │  PricingEngine  │  ModerationPipeline  │  StorageService   │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬────────────────────────────────────-┘
                              │
         ┌────────────────────┼──────────────────────┐
         │                    │                       │
┌────────▼───────────┐  ┌─────▼───────────┐  ┌───────▼─────────┐
│     Supabase        │  │     Clerk       │  │     Stripe      │
│  - PostgreSQL       │  │  - Auth         │  │  - Checkout     │
│    (via adapter-pg) │  │  - Sessions     │  │  - Webhooks     │
│  - Realtime         │  │  - Social login │  │  - Refunds      │
│  - Storage          │  └─────────────────┘  └─────────────────┘
└────────────────────┘
```

### Data Flow: Block Purchase

```
1. User selects block on grid
2. Client calls reserveBlock() server action
   → DB: block.status = RESERVED, block.reservedById = userId,
         block.reservedUntil = now + 10min
3. Client calls createCheckoutSession() server action
   → Stripe: creates Checkout Session with metadata: { userId, blockId }
   → Returns: { sessionUrl }
4. Client redirects to Stripe hosted checkout
   → Stripe handles card / Apple Pay / Google Pay
5. Stripe fires webhook: checkout.session.completed
   → /api/webhooks/stripe route handler:
     a. Verify Stripe signature
     b. Extract userId + blockId from session.metadata
     c. DB transaction:
        - SELECT block WHERE id = blockId FOR UPDATE
        - IF block.status != RESERVED → issue refund, return
        - IF block.reservedById != userId → issue refund, return
        - IF block.reservedUntil < now() → issue refund, return
        - UPDATE block SET status = SOLD, ownerId = userId
        - INSERT transaction record (COMPLETED)
        - INSERT activity_feed record
     d. Return 200
```

---

## 5. Database Schema

### Tables Overview

| Table | Purpose |
|---|---|
| `User` | Mirrors Clerk user for relational integrity + app metadata |
| `Block` | 10,000 grid cells (100×100), each purchasable |
| `PricingZone` | Admin-defined rectangular zones with price multipliers |
| `BlockContent` | Uploaded image/GIF per block, versioned, moderation-gated |
| `ModerationQueue` | One entry per upload, tracks pipeline state + AI results |
| `ModerationLog` | Immutable audit trail of every moderation state change |
| `PricingRule` | Configurable pricing parameters, editable by admin at runtime |
| `BlockPriceHistory` | Every price recalculation logged for analytics |
| `Transaction` | One record per Stripe Checkout attempt |
| `ActivityFeed` | Powers the live purchase ticker + Supabase Realtime |
| `SystemConfig` | Key/value store for runtime settings (no redeploy needed) |

### Key Constraints

- **Block size**: 1×1 only for MVP. No `width`/`height` fields.
- **One active content per block**: `BlockContent.isActive = true` may only be set
  for one record per `blockId` at a time. Enforced in application logic during
  the moderation approval action.
- **Reservation**: `Block.reservedById` + `Block.reservedUntil` (10-min TTL).
  The Stripe webhook verifies this before confirming any purchase.
- **Moderation fallback**: If any AI handler throws, status always becomes
  `PENDING_REVIEW` — never silently drops or auto-approves on error.

### Enums Reference

```
BlockStatus:            AVAILABLE | RESERVED | SOLD | ADMIN_LOCKED
ContentModerationStatus: PENDING | AI_SCANNING | PENDING_REVIEW |
                         APPROVED | AUTO_APPROVED | FLAGGED | REJECTED
ModerationAction:       SUBMITTED | AI_SCAN_STARTED | AI_SCAN_COMPLETED |
                        AI_FLAGGED | ESCALATED_TO_HUMAN | ADMIN_APPROVED |
                        ADMIN_REJECTED | USER_RESUBMITTED
ActorType:              USER | ADMIN | MODERATOR | SYSTEM | AI
TransactionStatus:      PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED
ActivityType:           BLOCK_PURCHASED | BLOCK_CONTENT_APPROVED | ZONE_TRENDING
PricingRuleType:        BASE_PRICE | LOCATION_MULTIPLIER | DEMAND_MULTIPLIER |
                        PROXIMITY_MULTIPLIER | TIME_MULTIPLIER | ADMIN_OVERRIDE
UserRole:               USER | MODERATOR | ADMIN
```

---

## 6. Moderation System

### Design Principles

- Zero hardcoded logic — pipeline stages are registered handlers
- Interface-driven — each handler implements `ModerationHandler`
- Composable pipeline — stages chain, result of each determines next step
- Audit-first — every state transition logged to `ModerationLog`
- Fail-safe — any error in AI handler escalates to human, never silently passes

### Phase 1 (Current) — Manual Review Only

```
Upload → FileValidation → StorageUpload (private bucket)
       → ModerationQueue entry (PENDING)
       → HumanReviewHandler → PENDING_REVIEW
       → Admin reviews in dashboard
       → APPROVED: move to public bucket, set isActive = true, notify user
       → REJECTED: delete from storage, notify user with reason
```

### Phase 2 (Future) — AI Integration

```
Upload → FileValidation → StorageUpload (private bucket)
       → ModerationQueue entry (PENDING)
       → AIScanHandler (e.g. AWS Rekognition)
           → confidence > threshold + safe → AUTO_APPROVED → public
           → explicit violation (high confidence) → AUTO_REJECTED → notify
           → uncertain OR error → ESCALATED_TO_HUMAN → PENDING_REVIEW
       → Admin reviews flagged items
```

### Adding an AI Provider (Phase 2)

1. Create `src/lib/moderation/handlers/your-provider.ts`
   implementing the `ModerationHandler` interface
2. Register it in `src/lib/moderation/pipeline.ts`
3. Set `MODERATION_AI_ENABLED=true` in env

No other code changes required.

### Handler Interface

```typescript
interface ModerationHandler {
  name: string;
  enabled: boolean;
  handle(ctx: ModerationContext): Promise<ModerationResult>;
}

type ModerationResult =
  | { status: 'APPROVED'; confidence?: number }
  | { status: 'AUTO_APPROVED'; confidence: number }
  | { status: 'REJECTED'; reason: string; confidence?: number }
  | { status: 'FLAGGED'; flags: string[]; confidence: number }
  | { status: 'ESCALATE_TO_HUMAN'; reason: string };
```

---

## 7. Payment & Concurrency System

### Why Stripe Checkout (not Payment Intents)

- Stripe hosts the payment page — less PCI compliance burden
- Apple Pay + Google Pay enabled automatically in Stripe Dashboard
- Built-in 3D Secure and fraud detection
- Simpler webhook-based confirmation flow

### Race Condition Protection

Multiple users can attempt to buy the same block simultaneously. Protection layers:

1. **Reservation lock** — first user to call `reserveBlock()` acquires the lock.
   DB enforces this: `reservedById` is only set when `status = AVAILABLE`.
2. **10-minute TTL** — `reservedUntil` timestamp. Expired reservations are
   cleared by a background check (or checked on next access).
3. **Webhook double-check** — before marking a block SOLD, the webhook handler:
   - Verifies `block.status === RESERVED`
   - Verifies `block.reservedById === userId` from session metadata
   - Verifies `block.reservedUntil > now()`
   - Runs inside a DB transaction with `SELECT FOR UPDATE`
4. **Auto-refund** — if any check fails, Stripe refund is issued immediately
   via `stripe.refunds.create({ payment_intent: ... })`

### Bank Connection

No code needed. After deployment:
Stripe Dashboard → Settings → Bank Accounts → Add account.
Stripe pays out on a rolling 2-day schedule.

---

## 8. Pricing Algorithm

### Formula

```
finalPrice = BASE_PRICE
  × locationMultiplier(x, y)        // center blocks cost more
  × proximityMultiplier(x, y)       // nearby sold blocks raise price
  × demandMultiplier(x, y)          // recent purchases in zone
  × globalVelocityMultiplier()      // platform-wide purchase rate
  [× adminOverride if set]          // bypasses all computation
```

All multiplier values and thresholds are stored in `PricingRule` DB records.
Admin can tune them at runtime via the dashboard. No redeployment needed.

### Component Details

**Location Multiplier**
```
distFromCenter = sqrt((x - 50)^2 + (y - 50)^2)
maxDist = sqrt(50^2 + 50^2) ≈ 70.7
normalized = distFromCenter / maxDist
multiplier = maxMult - (normalized × (maxMult - minMult))
// e.g., center = 3.0×, corners = 0.8×
```

**Proximity Multiplier**
```
soldNeighbors = count of SOLD blocks within radius R
multiplier = 1.0 + (soldNeighbors × perNeighborBonus)
// e.g., each neighbor = +5%, capped at 2.0×
```

**Demand Multiplier**
```
recentSales = count of SOLD blocks in zone within last 24h
multiplier = 1.0 + (recentSales × demandStep)
// e.g., 10 sales in zone = +50%
```

**Global Velocity**
```
salesLastHour = count of all SOLD blocks in last 1h
multiplier = lerp(1.0, 1.5, clamp(salesLastHour / 100, 0, 1))
```

### Caching

`Block.currentPrice` caches the computed price. Invalidated when:
- A neighboring block is purchased
- A pricing rule is updated
- 1-hour TTL expires

Price recalculation runs in the background after a purchase, not in the
request path. Every recalculation is logged to `BlockPriceHistory`.

---

## 9. Folder Structure

```
pixelclaim/
├── docs/
│   └── PROJECT.md                  ← you are here
│
├── prisma/
│   ├── schema.prisma               ← full DB schema
│   ├── migrations/                 ← auto-generated by prisma migrate
│   └── seed.ts                     ← seeds grid blocks + pricing rules (Phase 2)
│
├── prisma.config.ts                ← Prisma v7 datasource config
│
├── src/
│   ├── proxy.ts                    ← Next.js 16 "middleware" (Clerk auth)
│   │
│   ├── app/
│   │   ├── layout.tsx              ← root layout (ClerkProvider, Toaster)
│   │   ├── page.tsx                ← homepage (grid in Phase 4)
│   │   ├── globals.css
│   │   │
│   │   ├── sign-in/[[...sign-in]]/ ← Clerk hosted sign-in UI
│   │   ├── sign-up/[[...sign-up]]/ ← Clerk hosted sign-up UI
│   │   │
│   │   ├── dashboard/              ← authenticated user area (Phase 1+)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            ← owned blocks overview
│   │   │   └── blocks/[id]/page.tsx
│   │   │
│   │   ├── admin/                  ← admin-only area (Phase 7)
│   │   │   ├── layout.tsx          ← admin role guard
│   │   │   ├── page.tsx
│   │   │   ├── moderation/page.tsx
│   │   │   ├── blocks/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   └── analytics/page.tsx
│   │   │
│   │   └── api/
│   │       └── webhooks/
│   │           └── stripe/route.ts ← Stripe webhook (Phase 5)
│   │
│   ├── actions/                    ← all Server Actions (no separate backend)
│   │   ├── blocks.ts               ← getBlocks, reserveBlock, releaseBlock
│   │   ├── purchases.ts            ← createCheckoutSession, confirmPurchase
│   │   ├── uploads.ts              ← uploadContent, updateContent
│   │   ├── moderation.ts           ← approveContent, rejectContent, getQueue
│   │   └── admin.ts                ← admin overrides, pricing rule CRUD
│   │
│   ├── components/
│   │   ├── grid/                   ← grid rendering components (Phase 4)
│   │   │   ├── GridCanvas.tsx      ← main 100×100 CSS grid
│   │   │   ├── GridBlock.tsx       ← single block cell
│   │   │   ├── GridControls.tsx    ← zoom + pan
│   │   │   ├── BlockTooltip.tsx    ← hover: price, status, owner
│   │   │   └── ActivityTicker.tsx  ← live purchase feed
│   │   │
│   │   ├── purchase/               ← purchase flow (Phase 5)
│   │   │   ├── PurchaseModal.tsx
│   │   │   └── PriceBreakdown.tsx
│   │   │
│   │   ├── upload/                 ← content upload (Phase 6)
│   │   │   ├── UploadForm.tsx
│   │   │   └── ImagePreview.tsx
│   │   │
│   │   ├── moderation/             ← admin moderation UI (Phase 6)
│   │   │   ├── ModerationCard.tsx
│   │   │   └── RejectDialog.tsx
│   │   │
│   │   ├── admin/                  ← admin dashboard UI (Phase 7)
│   │   │   ├── PricingRuleEditor.tsx
│   │   │   ├── ZoneHighlighter.tsx
│   │   │   └── DemandHeatmap.tsx
│   │   │
│   │   └── ui/                     ← Shadcn/Base UI components
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   └── index.ts            ← Prisma client singleton (adapter-pg)
│   │   │
│   │   ├── moderation/             ← moderation pipeline (Phase 6)
│   │   │   ├── pipeline.ts         ← runner: chains handlers in order
│   │   │   ├── types.ts            ← ModerationHandler interface
│   │   │   └── handlers/
│   │   │       ├── file-validation.ts
│   │   │       ├── human-review.ts
│   │   │       └── ai-scan.ts      ← stub, enabled in Phase 2
│   │   │
│   │   ├── pricing/                ← pricing engine (Phase 3)
│   │   │   ├── engine.ts           ← PricingEngine class
│   │   │   ├── types.ts
│   │   │   └── calculators/
│   │   │       ├── location.ts
│   │   │       ├── proximity.ts
│   │   │       ├── demand.ts
│   │   │       └── global-velocity.ts
│   │   │
│   │   ├── stripe/
│   │   │   └── index.ts            ← Stripe client singleton (Phase 5)
│   │   │
│   │   └── supabase/
│   │       ├── client.ts           ← browser client (Realtime subscriptions)
│   │       ├── server.ts           ← server client (Storage operations)
│   │       └── storage.ts          ← upload / move / delete helpers
│   │
│   ├── hooks/                      ← client-side React hooks
│   │   ├── useGridRealtime.ts      ← Supabase Realtime channel (Phase 8)
│   │   ├── useBlockSelection.ts    ← multi-block selection state (Phase 4)
│   │   └── usePriceCalculator.ts   ← real-time price display (Phase 5)
│   │
│   └── types/                      ← shared TypeScript types
│       ├── blocks.ts
│       ├── moderation.ts
│       └── pricing.ts
│
├── .env.local                      ← secrets (gitignored)
├── next.config.ts
├── tailwind.config.ts
├── prisma.config.ts
└── package.json
```

---

## 10. Environment Variables

```bash
# CLERK
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
CLERK_WEBHOOK_SECRET=whsec_...     # for user sync webhook

# DATABASE (Supabase)
DATABASE_URL=postgresql://...      # pooled (port 6543, ?pgbouncer=true)
DIRECT_URL=postgresql://...        # direct (port 5432) — use for migrations

# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-side only, never expose to client

# STRIPE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...    # for purchase confirmation webhook

# APP
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 11. Setup Guide

### Prerequisites

- Node.js 20+
- Accounts: Clerk, Supabase, Stripe

### First-time setup

```bash
# Install dependencies
npm install

# Fill in environment variables
# Edit .env.local with your real keys from Clerk, Supabase, Stripe dashboards

# Run initial database migration (use DIRECT_URL, not pooled)
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres" \
  npx prisma migrate dev --name init

# Generate Prisma client (run after any schema change)
npx prisma generate

# Start development server
npm run dev
```

### After any schema change

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply migration (use direct URL)
DATABASE_URL="<direct_url>" npx prisma migrate dev --name describe_your_change
# 3. Regenerate client
npx prisma generate
```

### Supabase Storage Buckets (create manually in Supabase dashboard)

| Bucket name | Public? | Purpose |
|---|---|---|
| `block-content-pending` | No (private) | Uploaded images awaiting moderation |
| `block-content-public` | Yes (public) | Approved images served on the grid |

### Stripe Webhook (local dev)

```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret into STRIPE_WEBHOOK_SECRET
```

---

## 12. Development Phase Log

### Phase 0 — Foundation ✅ COMPLETE

**Completed:** 2026-04-06

**What was built:**
- Next.js 16 project initialized
- Shadcn/UI configured (Base UI version)
- Clerk v7 auth configured (`src/proxy.ts`)
- Prisma v7 schema written, validated, client generated
- DB singleton with `@prisma/adapter-pg`
- Root layout with `ClerkProvider` + `Toaster`
- Sign-in / sign-up pages
- Placeholder homepage

**Key discoveries (breaking changes found):**
- Next.js 16: `middleware.ts` → `proxy.ts`, export `proxy` not `middleware`
- Clerk v7: `<SignedIn>` / `<SignedOut>` → `<Show when="...">`
- Prisma v7: bare `PrismaClient()` no longer works, needs driver adapter
- Shadcn/Base UI: no `asChild` — use `render` prop instead

**Verification:** `npx tsc --noEmit` → 0 errors. `npm run dev` → starts in ~7s.

---

### Phase 1 — DB Setup & Verification ✅ COMPLETE

**Completed:** 2026-04-07

**What was built:**
- Initial Prisma migration applied (`20260407001312_init`) — all 11 tables created in Supabase
- `/api/health` route: hits DB, returns row counts for SystemConfig, Block, User
- Confirmed live DB response: `{"status":"ok","database":"connected","tables":{...}}`

**⚠️ Known issue (low risk for now):**
`NEXT_PUBLIC_SUPABASE_ANON_KEY` is set to the `service_role` key instead of the `anon` key.
Must be corrected before Phase 8 (Storage + Realtime). The `anon` key is on the same
Supabase API settings page — it has `"role":"anon"` in the JWT payload.

---

### Phase 2 — Database Seed ⏳ NEXT

**Goal:** When a user signs up via Clerk, sync their data into the `User` table.

**What will be built:**
- Clerk webhook endpoint (`/api/webhooks/clerk/route.ts`)
  - Listens for `user.created` and `user.updated` events
  - Upserts `User` record in DB
- User is now queryable from DB for relational joins (blocks, transactions, etc.)
- Basic dashboard layout (protected route)

**Prerequisite before starting:**
1. `.env.local` fully filled with real credentials
2. `DATABASE_URL="<direct_url>" npx prisma migrate dev --name init` run successfully
3. `npm run dev` loads without errors

---

### Phase 2 — Database Seed ⏳ PENDING

**Goal:** Populate the DB with the initial grid and configuration.

**What will be built:**
- `prisma/seed.ts`: creates 10,000 `Block` records (100×100 grid)
- Seeds default `PricingRule` records (base price, multiplier configs)
- Seeds default `SystemConfig` entries (grid dimensions, reservation TTL, etc.)
- Seeds one example `PricingZone` (center premium zone)

---

### Phase 3 — Pricing Engine ⏳ PENDING

**Goal:** Implement the pricing algorithm as a modular, testable service.

---

### Phase 4 — Grid System ⏳ PENDING

**Goal:** Render the 100×100 interactive grid on the homepage.

---

### Phase 5 — Purchase Flow ⏳ PENDING

**Goal:** End-to-end block purchase with Stripe Checkout.

---

### Phase 6 — Moderation System ⏳ PENDING

**Goal:** Upload pipeline, admin review queue, content approval.

---

### Phase 7 — Admin Dashboard ⏳ PENDING

**Goal:** Full admin control panel (no code changes required for admin operations).

---

### Phase 8 — Realtime Updates ⏳ PENDING

**Goal:** Live activity ticker + grid updates via Supabase Realtime.

---

### Phase 9 — Polish & Launch ⏳ PENDING

**Goal:** Performance, SEO, rate limiting, security audit, load testing.

---

## 13. Product Decisions

| Decision | Choice | Reason |
|---|---|---|
| Grid size | 100×100 (10,000 blocks) | Scalable to 1000×1000 post-launch |
| Block size | 1×1 only (MVP) | Multi-block purchases are post-MVP |
| Grid renderer | CSS Grid (MVP) | Simpler; upgrade to Canvas/Pixi later if perf requires |
| ORM | Prisma | Better TypeScript integration vs Drizzle for this team |
| Auth | Clerk | Faster to ship than NextAuth; handles social login out of box |
| Base price | $1 USD | Low barrier to entry; center can reach $20–50+ via multipliers |
| Payment method | Stripe Checkout | Hosted page = less PCI scope, Apple/Google Pay auto-enabled |
| Storage | Supabase Storage | Already in stack; two buckets: pending (private) + public |
| Moderation | Manual first, AI-ready | Don't over-engineer Phase 1; pipeline is pluggable |

---

## 14. Known Issues & Constraints

| Issue | Impact | Status |
|---|---|---|
| `DIRECT_URL` not supported in Prisma v7 config type | Must pass direct URL via env var when migrating | Documented in setup guide |
| Prisma v7 requires driver adapter | Extra package (`adapter-pg` + `pg`) | Implemented in `src/lib/db/index.ts` |
| Shadcn Button has no `asChild` | Must use `render` prop for link-buttons | Documented; affects all link-buttons |
| Clerk `SignedIn`/`SignedOut` removed | Use `<Show when="...">` | Documented; affects all conditional auth rendering |
| Next.js 16 `proxy.ts` is new | Clerk middleware works because `NextProxy = NextMiddleware` | Confirmed via type inspection |
| Supabase Realtime requires client component | Grid realtime hook must be in a Client Component | Noted for Phase 4/8 |
