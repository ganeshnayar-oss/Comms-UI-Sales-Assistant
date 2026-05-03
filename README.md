# Sales Assistant

Siebel-backed contact center sales assistant with an agentic workflow, synchronized canvas UI, recommendations, catalog browsing, and Customer 360.

## Local development

```bash
npm install
npm run build
npm run start:runtime
```

The runtime serves the app at `http://127.0.0.1:4173`.

## Environment

Copy `.env.example` to `.env.local` and set the Siebel values for your environment.

Supported customer package selection:

```bash
VITE_CUSTOMER_CONFIG=supremo
CUSTOMER_CONFIG=supremo
```

`VITE_CUSTOMER_CONFIG` affects the browser bundle.
`CUSTOMER_CONFIG` affects the runtime server defaults and fallback behavior.

## Git workflow for teams using Codex

1. Keep `main` releasable.
2. Create one short-lived branch per task, for example `codex/catalog-recommendation-fix`.
3. Open a pull request back into `main`.
4. Require `npm run build` to pass before merge.
5. Avoid direct pushes to `main`.

Recommended commands:

```bash
git checkout -b codex/my-task
npm run build
git add .
git commit -m "Implement my task"
```

See [CONTRIBUTING.md](/Users/GNAYAR/Documents/New%20project/CONTRIBUTING.md) for the detailed team workflow.

## Customer extensibility

Customer-specific defaults and recommendation overrides live in [src/extensions/customerConfig.js](/Users/GNAYAR/Documents/New%20project/src/extensions/customerConfig.js).

That config currently supports:

- workflow title and brand label
- default catalog and price list
- default intake prompt and placeholder
- recommendation override rules

See [docs/EXTENSIBILITY.md](/Users/GNAYAR/Documents/New%20project/docs/EXTENSIBILITY.md) for how to add a customer package cleanly without forking the core application.
