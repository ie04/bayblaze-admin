# BayBlaze Admin

BayBlaze Admin is the operator dashboard for BayBlaze account, storefront,
driver, route, order, promo, email, and activity workflows. It gives internal
operators a focused interface for running the BayBlaze delivery-commerce
business from one browser app.

## Highlights

- React, TypeScript, Vite, Tailwind CSS, and PWA support.
- Account search and role/badge management.
- Storefront settings, promo code, price adjustment, and age-verification test
  controls.
- Live driver map, driver route, coverage-area, and order-detail views.
- Storefront activity analytics, including unique visitor trends over time.
- Email automation templates and send logs.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Repository Notes

The browser app talks to BayBlaze API for privileged operations. Production
credentials, service tokens, and provider keys are intentionally not included in
this repository.
