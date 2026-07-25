# BayBlaze Admin Dashboard Notes

## Durable Project Memory

Record durable project facts, recurring commands, deployment details, service
boundaries, and workflow preferences in this file so future Codex sessions can
pick them up after context compaction or a new chat.

When code changes are complete, automatically commit and push the changes unless
the user explicitly says not to. Use a concise commit message that reflects the
completed work.

When infrastructure, deployment, environment variables, service topology,
runner setup, or cross-repo integration details change, update the relevant
`AGENTS.md` files in the same work session so future Codex/LLM sessions inherit
the current operating model.

## Repo Purpose

`bayblaze-admin` is the BayBlaze Admin Dashboard: a React, TypeScript, Vite,
Tailwind CSS PWA for BayBlaze operators.

The app should follow the shared BayBlaze UI topology and design language used
by `bayblaze-inventory` and `bayblaze-driver`: compact operational screens,
Jost typography, Blaze orange/charcoal/off-white tokens, rounded controls,
large tap targets, and scan-friendly status chips.

## API Boundary

- The browser app must strictly call `bayblaze-api` for BayBlaze operational
  data.
- It must not import Firebase SDKs, Firestore collection names, Firebase
  Storage APIs, Medusa admin clients, service tokens, or backend-only
  credentials.
- The live driver map uses the Google Maps JavaScript API with a public browser
  key restricted to `admin.bayblaze.net`. This key is separate from the
  server-only `GOOGLE_MAPS_API_KEY` used by `bayblaze-api`.
- Required browser variable:
  `VITE_BAYBLAZE_API_URL=https://api.bayblaze.net`.
- Required for the Google driver map widget:
  `VITE_GOOGLE_MAPS_BROWSER_API_KEY=<browser restricted Maps JavaScript key>`.
- Local development may use:
  `VITE_BAYBLAZE_API_URL=http://localhost:3040`.

Current dashboard API routes:

```text
POST  /v1/auth/login
POST  /v1/auth/google/start
POST  /v1/auth/google/callback
GET   /v1/auth/me
GET   /v1/admin/accounts
PATCH /v1/admin/accounts/:uid
GET   /v1/admin/partners
PATCH /v1/admin/partners/:uid
POST  /v1/admin/partners/:uid/approve
GET   /v1/admin/drivers/map
GET   /v1/admin/drivers/routes
POST  /v1/admin/isochrones
GET   /v1/admin/coverage-areas
POST  /v1/admin/coverage-areas
PATCH /v1/admin/coverage-areas/:coverageAreaId
DELETE /v1/admin/coverage-areas/:coverageAreaId
POST  /v1/admin/coverage-areas/:coverageAreaId/regenerate
POST  /v1/admin/coverage-areas/regenerate-due
GET   /v1/admin/promo-codes
POST  /v1/admin/promo-codes
PATCH /v1/admin/promo-codes/:code
DELETE /v1/admin/promo-codes/:code
GET   /v1/admin/email-automations
PATCH /v1/admin/email-automations/:eventType
POST  /v1/admin/email-automations/:eventType/test
GET   /v1/admin/orders
GET   /v1/admin/orders/:orderId
DELETE /v1/admin/orders/:orderId
```

`/v1/admin/*` routes require a BayBlaze account session bearer token from an
employee account with the `admin` role.

## Account Model

BayBlaze accounts are Firebase Auth users with API-owned account records in
Firestore collection `accounts/{uid}`. Account records expose:

- `badges`: `customer` or `employee`.
- `roles`: `admin`, `driver`, and/or `inventory`.
- `settings.ageVerificationDisabled`: operator-controlled test switch for age
  verification bypass behavior in client flows that support it.
- `disabled`: mirrored with Firebase Auth disabled state.

Customer accounts are storefront shoppers. Employee accounts can receive any
combination of `driver`, `inventory`, and `admin` roles. Badge changes, role
grants, and account settings must be changed through `bayblaze-api`; do not
write account docs from the dashboard.

## Dashboard Features

- Search accounts, set customer/employee badges, and grant/remove employee
  roles.
- Expanded account cards include a Referrals section for BayBlaze Win reward
  records created by that account, showing whether a Win referral was generated,
  whether the friend-code referral was consumed by a qualifying order, and
  whether the referrer's freebie was consumed.
- Disable/enable accounts.
- Toggle account-level age verification bypass for testing.
- Manage referral partner applications and accounts in the dedicated Partners
  section. Operators can approve pending applications, create an active
  referral account from an existing unified customer account, search for the
  account by name or email, configure its stable promo code, discount,
  commission, optional minimum spend, and per-account use restriction, and
  suspend/reactivate or reject partner access. Creation uses
  `POST /v1/admin/partners/:uid/approve`; the browser never creates a parallel
  identity or accepts a client-chosen partner UID outside the authenticated
  admin route.
- View drivers on a Google Maps JavaScript map widget using API-provided live
  location snapshots.
- Use the Map page to show live drivers and manage API-owned coverage areas.
  Coverage areas are bidirectional drive-time isochrone polygons centered on a
  warehouse point, with label, optional description, max one-way drive minutes,
  polygon granularity, active state, and optional regeneration schedule
  metadata.
- Create, edit, delete, show/hide, manually regenerate, and process due
  scheduled regeneration for coverage areas through `bayblaze-api`.
- View driver delivery route stop geometry.
- View live Medusa orders and order details through `bayblaze-api`.
- Delete orders from the Orders screen through `bayblaze-api`. Deleting an
  order asks whether to release products back to stock; choosing yes restores
  the ordered variant quantities before the backend marks the order deleted.
  Deleted orders stay visible with a grey `DELETED` pill and are hidden inside
  the collapsed Deleted dropdown below active orders.
- Create, update, delete, collapse, and generate QR assets for checkout promo
  codes in the Admin Promo section. Admin-created promos are persisted by
  `bayblaze-api` as `admin_promo` discount records. BayBlaze Win friend codes
  are returned by the same `/v1/admin/promo-codes` listing as `win_referral`
  discount records for centralized visibility, but the dashboard treats them as
  API-managed/read-only customer reward records. Hidden/open card state is only
  a local dashboard organization preference.
  Admin Promo can optionally set a minimum basket size before tax; enabled
  minimums are sent as `minimumSpendCents`, and disabled minimums are sent as
  `0`. Admin Promo can also set `singleUsePerAccount`, which lets each signed-in
  customer account successfully use that promo on only one checkout; the
  backend records usage after successful orders and rejects later attempts by
  the same account. BayBlaze Win referral promos are API-managed/read-only here
  and default to one successful use per customer account, with the referrer's
  own account blocked from using its generated friend code.
  Referral partner promos are individualized records in the same promo system.
  Admins select an existing unified BayBlaze account as the owner and configure
  the customer discount percentage, partner commission percentage, and optional
  minimum product spend. The promo card reports unique referred accounts,
  qualifying purchases, post-discount customer spend, commission owed, and the
  per-order referral ledger. A referral promo cannot be transferred, renamed,
  or deleted after it has tracked a purchase, preserving its audit history.
  Promo creation starts from one `New Promo` action and uses a four-step modal
  wizard: type, type-specific details, review, and explicit creation. Opening or
  advancing the wizard must never add a draft card or call the API. Standard
  creation exposes percent-off or BOGO; referral creation exposes account owner,
  percent-off, and commission. Both share code, optional pre-tax minimum, and
  per-account-use fields. The existing `POST /v1/admin/promo-codes` contract
  remains the only create boundary.
  The storefront no longer hosts an internal promo QR generator route.
- Manage storefront-wide operational settings in the dedicated Settings
  section, not inside Promo. Settings has separate sibling entries for
  sitewide price adjustment and global AgeChecker testing bypass. Both read and
  write through `GET/PATCH /v1/admin/storefront-settings`; the storefront
  consumes the public `/v1/storefront/settings` value for price adjustment and
  global age-verification behavior.
- View storefront analytics in the Activity section. The dashboard reads
  `GET /v1/admin/storefront-activity/analytics` from `bayblaze-api` for daily
  unique visitor, session, and page-view buckets over time, and reads
  `GET /v1/admin/storefront-activity/sessions` for recent session details such
  as last page, last event, cart count/value, and lifecycle breadcrumbs. The
  admin browser must not read Firestore directly for activity tracking.
- Configure API-owned automated email actions in the Email section. The browser
  edits only `bayblaze-api` automation records and never stores Resend keys.
  Supported automations include `order_placed`, with editable enablement,
  recipient mode, sender/reply-to, subject, text, HTML, internal recipients,
  test sends, and recent send logs.

The dashboard renders route plots from API data and draws active coverage
polygons inside the Map page's Google Map. The live map is the one browser
Google Maps integration and must use a restricted public browser key, never the
server-side Google Maps key. The legacy `POST /v1/admin/isochrones` route may
exist as a backend compatibility preview, but the admin UI should manage
persistent coverage through `/v1/admin/coverage-areas`.

## Deployment Assumptions

- Production domain: `admin.bayblaze.net`.
- The dashboard can deploy as a static Vite app to Firebase Hosting, Vercel, or
  another static host.
- Static hosting should serve only the built `dist` app.
- Browser-exposed environment variables must use the `VITE_` prefix and be safe
  for public clients.
- Google OAuth redirect URI for the admin PWA:
  `https://admin.bayblaze.net/auth/google/callback` in production and
  `http://localhost:5173/auth/google/callback` for local Vite development when
  testing Google login.
- After pushing changes that affect a dashboard screen, wait for the Vercel
  deployment to finish and smoke-test the deployed screen against
  `https://api.bayblaze.net`. For changed API-backed screens, verify the API
  preflight from the active Vercel preview origin as well as
  `https://admin.bayblaze.net`; a missing CORS allow-origin surfaces in the app
  as `Failed to fetch`.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```
