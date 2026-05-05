# Siebel Integration

This project now supports two Siebel modes during local development:

- `mock mode`
  Uses the existing in-memory Vite endpoints.
- `live mode`
  Proxies the UI's `/api/siebel/*` requests to a real Siebel REST environment and normalizes the response shape for the C360 UI.

## Setup

1. Update [config/siebel.config.json](/Users/GNAYAR/Documents/New%20project/config/siebel.config.json).
2. Set:

```json
{
  "useRealApi": true,
  "appUrl": "https://your-siebel-host.example.com/siebel/app/ecommunications/enu",
  "apiBaseUrl": "https://your-siebel-host.example.com/siebel/v1.0"
}
```

3. Copy `.env.example` to `.env.local`.
4. Add one auth method:

```env
SIEBEL_CONFIG_PATH=./config/siebel.config.json
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

Optional first-page intake parsing can be LLM-backed by adding:

```env
INTAKE_LLM_PROVIDER=openai
INTAKE_LLM_API_KEY=
INTAKE_LLM_MODEL=gpt-5.4-mini
```

For OCI-compatible endpoints:

```env
INTAKE_LLM_PROVIDER=oci
INTAKE_LLM_API_KEY=
INTAKE_LLM_MODEL=
INTAKE_LLM_OCI_REGION=us-chicago-1
INTAKE_LLM_PROJECT=
```

For a customer gateway or other OpenAI-compatible endpoint:

```env
INTAKE_LLM_PROVIDER=custom
INTAKE_LLM_API_KEY=
INTAKE_LLM_MODEL=
INTAKE_LLM_BASE_URL=https://your-model-gateway.example.com/v1
```

## Endpoint Skills

These endpoint-level skills now exist in the dev proxy:

- `/api/siebel/account`
- `/api/siebel/service-requests/summary`
- `/api/siebel/service-requests/preview`
- `/api/siebel/service-requests`
- `/api/siebel/assets`
- `/api/siebel/orders/recent`

Each one can be remapped in the Siebel config file:

```json
{
  "endpoints": {
    "account": "/data/Account/Account/?PageSize=1&StartRowNum=0",
    "serviceRequests": "/data/Service Request/Service Request/?PageSize=25&StartRowNum=0",
    "assets": "/data/Asset Management/Asset Mgmt - Asset - Header/?PageSize=20&StartRowNum=0",
    "orders": "/data/Order Entry/Order Entry - Orders/?PageSize=20&StartRowNum=0"
  }
}
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
