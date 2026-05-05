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

Create a local Siebel config from the example and update it with the target environment:

```bash
cp config/siebel.config.example.json config/siebel.config.json
```

- `appUrl`
- `apiBaseUrl`
- `useRealApi`
- any environment-specific Siebel object endpoints

Use `config/siebel.config.example.json` as the template for new deployments.

Copy `.env.example` to `.env.local` only for auth and local runtime settings:

```bash
cp .env.example .env.local
```

Customer-facing workflow defaults are runtime-loaded from `config/customer.config.json`.
You can point to a different file with `CUSTOMER_CONFIG_PATH`.

For local overrides, copy the example:

```bash
cp config/customer.config.example.json config/customer.config.json
```

After changing the customer config file, refresh the browser page to pick up the new values.

Optional first-page intake LLM settings:

- `INTAKE_LLM_PROVIDER`
- `INTAKE_LLM_API_KEY`
- `INTAKE_LLM_MODEL`
- `INTAKE_LLM_BASE_URL`
- `INTAKE_LLM_PROJECT`
- `INTAKE_LLM_OCI_REGION`

Supported intake providers:

- `openai`
- `oci`
- `custom`
- `disabled`

If intake LLM settings are configured, the first-page intake prompt is parsed through the runtime's `/api/intake/parse` endpoint before contact creation. If the provider is disabled or the runtime credentials are invalid, the runtime returns a fallback parse result and the UI surfaces that status.

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

Customer-specific defaults and recommendation overrides live in `config/customer.config.json`.

That config currently supports:

- workflow title and brand label
- default catalog and price list
- default order-number prefixes
- default intake prompt and placeholder
- recommendation override rules

See `docs/EXTENSIBILITY.md` for how to add a customer package cleanly without forking the core application.
