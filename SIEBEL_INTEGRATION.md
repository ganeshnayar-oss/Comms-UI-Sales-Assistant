# Siebel Integration

This project now supports two Siebel modes during local development:

- `mock mode`
  Uses the existing in-memory Vite endpoints.
- `live mode`
  Proxies the UI's `/api/siebel/*` requests to a real Siebel REST environment and normalizes the response shape for the C360 UI.

## Setup

1. Copy `.env.example` to `.env`.
2. Set:

```env
SIEBEL_USE_REAL_API=true
SIEBEL_APP_URL=https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/app/ecommunications/enu
SIEBEL_API_BASE_URL=https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0
```

3. Add one auth method:

```env
SIEBEL_SESSION_COOKIE=
```

or

```env
SIEBEL_BEARER_TOKEN=
```

or

```env
SIEBEL_BASIC_USERNAME=
SIEBEL_BASIC_PASSWORD=
```

## Endpoint Skills

These endpoint-level skills now exist in the dev proxy:

- `/api/siebel/account`
- `/api/siebel/service-requests/summary`
- `/api/siebel/service-requests/preview`
- `/api/siebel/service-requests`
- `/api/siebel/assets`
- `/api/siebel/orders/recent`

Each one can be remapped with `.env` overrides:

```env
SIEBEL_ACCOUNT_ENDPOINT=/data/Account/Account/?PageSize=1&StartRowNum=0
SIEBEL_SERVICE_REQUESTS_ENDPOINT=/data/Service Request/Service Request/?PageSize=25&StartRowNum=0
SIEBEL_ASSETS_ENDPOINT=/data/Asset Management/Asset Mgmt - Asset - Header/?PageSize=20&StartRowNum=0
SIEBEL_ORDERS_ENDPOINT=/data/Order Entry/Order Entry - Orders/?PageSize=20&StartRowNum=0
```

You can also inspect the current proxy status at:

- `/api/siebel/health`

The runtime server will now fall back per resource if a live Siebel object is reachable but returns no data or requires stronger authentication than the current session provides.

## UI Wiring

The C360 screen now loads these API resources when the app enters `customer360` view.

The normalization logic lives in:

- `src/domain/siebelTransformers.js`

The proxy layer lives in:

- `vite.config.js`

The UI client functions live in:

- `src/api/siebelApi.js`

## Current Limitation

The supplied environment is reachable and exposes a valid REST catalog, including `Account`, `Asset Management`, `Order Entry`, `Payments`, and `Service Request`. In this workspace, anonymous probing still returns "There is no data for the requested resource" for the collection endpoints, so a valid authenticated session cookie, bearer token, or basic auth credential is still required for live customer data to flow through the UI.
