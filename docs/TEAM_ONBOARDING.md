# Team Onboarding

This repository contains the Siebel-backed Sales Assistant React application. The app includes the Redwood-style agentic workflow, synchronized UI canvas, recommendation panel, product catalog, cart, Customer 360, localization, and a local runtime server that proxies Siebel and LLM calls.

## 1. Prerequisites

- Node.js 18 or newer
- npm
- Git
- Access to the target Siebel environment if you want to run against real APIs
- Optional OpenAI or compatible LLM API key if `ai.mode` is set to `llm`

## 2. Clone The Repo

```bash
git clone <repo-url>
cd <repo-folder>
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Create Local Config Files

Local config files are intentionally ignored by Git. Each developer should create their own copies from the examples:

```bash
cp .env.example .env.local
cp config/siebel.config.example.json config/siebel.config.json
cp config/customer.config.example.json config/customer.config.json
```

## 5. Configure Siebel

Edit `config/siebel.config.json`.

For mock mode:

```json
{
  "useRealApi": false
}
```

For real Siebel APIs:

```json
{
  "useRealApi": true,
  "appUrl": "https://your-siebel-host.example.com/siebel/app/ecommunications/enu",
  "apiBaseUrl": "https://your-siebel-host.example.com/siebel/v1.0"
}
```

Put credentials or tokens in `.env.local`, not in JSON config:

```bash
SIEBEL_BASIC_USERNAME=
SIEBEL_BASIC_PASSWORD=
SIEBEL_SESSION_COOKIE=
SIEBEL_BEARER_TOKEN=
```

Use one auth mode at a time.

## 6. Configure LLM Mode

The application can run with or without LLM-backed parsing.

In `config/customer.config.json`:

```json
{
  "ai": {
    "mode": "deterministic"
  }
}
```

or:

```json
{
  "ai": {
    "mode": "llm"
  }
}
```

If using LLM mode, configure `.env.local`:

```bash
INTAKE_LLM_PROVIDER=openai
INTAKE_LLM_API_KEY=
INTAKE_LLM_MODEL=gpt-5.4-mini
```

Do not commit `.env.local`.

## 7. Start The Runtime App

```bash
npm run start:runtime
```

Open:

```text
http://127.0.0.1:4173/
```

The runtime server builds and serves `dist-runtime/`. If you change source files, restart `npm run start:runtime`.

## 8. Validate Before Pushing

```bash
npm run build
```

Use the browser to smoke test:

- Home page loads
- Spanish/French language selector works
- Intake page starts workflow
- Catalog opens in mock mode
- Cart and Customer 360 render

If testing real Siebel:

- Create contact
- Create account
- Add simple product
- Apply bundled promotion
- Assign billing/service account
- Submit order

## 9. Git Workflow

Create a branch for each task:

```bash
git checkout -b codex/my-change
```

Commit only source, docs, and example config files:

```bash
git add .
git commit -m "Describe the change"
```

Open a pull request to `main`.

## 10. Files That Must Stay Local

These files are ignored and should not be pushed:

- `.env`
- `.env.local`
- `.env.*.local`
- `config/siebel.config.json`
- `config/customer.config.json`
- `dist/`
- `dist-runtime/`
- `node_modules/`

## 11. Important Architecture Notes

- The browser calls the local runtime at `/api/...`, not Siebel directly.
- `server.mjs` is the backend-for-frontend and Siebel proxy.
- `src/api/siebelApi.js` contains browser-side API wrappers.
- `config/siebel.config.json` controls environment-specific Siebel endpoints.
- `config/customer.config.json` controls customer-specific defaults, branding, LLM mode, localization, and recommendation rules.
- `src/i18n/languagePacks.js` contains English, French, and Spanish UI language packs.

