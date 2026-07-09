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
- Disable/enable accounts.
- Toggle account-level age verification bypass for testing.
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
- Create, update, delete, collapse, and generate QR assets for admin-owned
  checkout promo codes in the Admin Promo section. Admin-created promos are
  persisted by `bayblaze-api` as `admin_promo` discount records; hidden/open
  card state is only a local dashboard organization preference.
  The storefront no longer hosts an internal promo QR generator route.

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

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```
