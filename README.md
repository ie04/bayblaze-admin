# BayBlaze Admin

Operator dashboard for BayBlaze accounts, drivers, route geometry, driver map
isochrones, and live order details.

```bash
npm install
npm run dev
npm run build
npm run lint
```

Set `VITE_BAYBLAZE_API_URL` to the BayBlaze API origin. Production is expected
to run at `admin.bayblaze.net` against `https://api.bayblaze.net`.

Set `VITE_GOOGLE_MAPS_BROWSER_API_KEY` to a Google Maps JavaScript API key
restricted to `admin.bayblaze.net` to render the live driver map widget.
