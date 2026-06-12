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

- The browser app must strictly call `bayblaze-api`.
- It must not import Firebase SDKs, Firestore collection names, Firebase
  Storage APIs, Medusa admin clients, Google Maps clients, service tokens, or
  backend-only credentials.
- Required browser variable:
  `VITE_BAYBLAZE_API_URL=https://api.bayblaze.net`.
- Local development may use:
  `VITE_BAYBLAZE_API_URL=http://localhost:3040`.

Current dashboard API routes:

```text
POST  /v1/auth/login
GET   /v1/auth/me
GET   /v1/admin/accounts
PATCH /v1/admin/accounts/:uid
GET   /v1/admin/drivers/map
GET   /v1/admin/drivers/routes
POST  /v1/admin/isochrones
GET   /v1/admin/orders
GET   /v1/admin/orders/:orderId
```

`/v1/admin/*` routes require a BayBlaze account session bearer token with the
`admin` role.

## Account Model

BayBlaze accounts are Firebase Auth users with API-owned account records in
Firestore collection `accounts/{uid}`. Account records expose:

- `roles`: `admin`, `driver`, and/or `inventory`.
- `settings.ageVerificationDisabled`: operator-controlled test switch for age
  verification bypass behavior in client flows that support it.
- `disabled`: mirrored with Firebase Auth disabled state.

Role grants and account settings must be changed through `bayblaze-api`; do not
write account docs from the dashboard.

## Dashboard Features

- Search accounts and grant/remove roles.
- Disable/enable accounts.
- Toggle account-level age verification bypass for testing.
- View drivers on an API-provided map snapshot.
- View driver delivery route stop geometry.
- Create an API-generated isochrone/coverage plot.
- View live Medusa orders and order details through `bayblaze-api`.

The dashboard renders lightweight SVG plots from API data. It must not call
paid Google Maps APIs directly from browser code.

## Deployment Assumptions

- Production domain: `admin.bayblaze.net`.
- The dashboard can deploy as a static Vite app to Firebase Hosting, Vercel, or
  another static host.
- Static hosting should serve only the built `dist` app.
- Browser-exposed environment variables must use the `VITE_` prefix and be safe
  for public clients.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```
