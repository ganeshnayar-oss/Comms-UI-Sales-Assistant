# Technical Documentation

## Overview

This application is a single-page React prototype for a telco `Customer 360` experience built on a Redwood-style foldout layout.

The current product combines three major interaction models:

1. A `Customer 360` canvas with four primary columns:
   - `Spotlight`
   - `Service requests`
   - `Purchases`
   - `Billing`
2. A left-side AI workflow drawer used for invoice-to-payment tasks
3. A drill-in `Service requests` table view that overlays the main canvas

The app is intentionally frontend-only at this stage. There is no backend, router, or persistence layer. All state is local to the root React component and all business behavior is driven by in-memory mock data and deterministic prompt parsing.

## Stack

- `React 18`
- `Vite 5`
- Plain CSS
- No component library
- No routing library
- No server state library

Project entry points:

- [package.json](/Users/GNAYAR/Documents/New%20project/package.json)
- [index.html](/Users/GNAYAR/Documents/New%20project/index.html)
- [src/main.jsx](/Users/GNAYAR/Documents/New%20project/src/main.jsx)

## File Structure

Key files:

- [src/main.jsx](/Users/GNAYAR/Documents/New%20project/src/main.jsx)
  Bootstraps React and mounts `App`.
- [src/App.jsx](/Users/GNAYAR/Documents/New%20project/src/App.jsx)
  Contains the root UI, local state, prompt-processing logic, and conditional overlay rendering.
- [src/data.js](/Users/GNAYAR/Documents/New%20project/src/data.js)
  Holds all mock data used by the UI and seeded workflow state.
- [src/styles.css](/Users/GNAYAR/Documents/New%20project/src/styles.css)
  Contains the full visual system and layout rules for the Redwood-style canvas, drawer, and service table overlay.

## Runtime Architecture

The application currently uses a `single-root stateful architecture`.

`App` is responsible for:

- managing all UI state
- rendering the main foldout canvas
- rendering the left AI drawer
- rendering the service-requests overlay
- processing billing prompts

There are no extracted React child components yet. The app instead uses:

- root-level state via `useState`
- pure helper functions for prompt handling
- shared mock data from `data.js`

This keeps iteration fast, but it also means the root component is growing in responsibility. If the app is extended substantially, component extraction should be one of the first refactors.

## State Model

The primary state in [src/App.jsx](/Users/GNAYAR/Documents/New%20project/src/App.jsx) is:

- `drawerOpen`
  Controls whether the AI drawer is visible.
- `draft`
  Holds the current input in the top action bar.
- `messages`
  Stores the billing-agent conversation history shown in the drawer.
- `workflow`
  Stores the mutable invoice/payment workflow state.
- `serviceRequestView`
  Controls whether the service requests overlay is visible, and whether it is filtered.

### `workflow` shape

The initial workflow lives in [src/data.js](/Users/GNAYAR/Documents/New%20project/src/data.js) as `initialWorkflow`.

It contains:

- `outstandingBalance`
- `paymentStatus`
- `paymentNeededText`
- `ctaLabel`
- `lastPayment`
- `lastPaymentDate`
- `receiptSent`
- `autopay`
- `plan`
- `summary`
- `checklist`
- `activity`

This object is the canonical state for the billing foldout and AI workflow.

### `messages` shape

Each message is a plain object:

- `id`
- `role` with value `user` or `assistant`
- `text`

The AI drawer renders this list directly.

### `serviceRequestView` values

Current values:

- `null`
  Main canvas only
- `"all"`
  Open full service requests overlay with all rows
- `"open"`
  Open service requests overlay filtered to `status === "Open"`

## Prompt Processing Architecture

The prompt-to-workflow behavior is implemented through a simple deterministic interpreter:

- `normalize(input)`
- `applyBillingPrompt(workflow, rawPrompt)`

These functions live in [src/App.jsx](/Users/GNAYAR/Documents/New%20project/src/App.jsx).

### Flow

1. User types a prompt in the top action bar.
2. `handleSubmit` calls `submitPrompt`.
3. `submitPrompt` validates the text and passes it into `applyBillingPrompt`.
4. `applyBillingPrompt` clones the current workflow with `structuredClone`.
5. The function mutates the cloned workflow according to rule-based prompt matching.
6. `submitPrompt` writes the updated workflow into React state.
7. `submitPrompt` appends both user and assistant messages to the message history.
8. The drawer is forced open so the user can see the updated workflow.

### Supported prompt intents

The current implementation recognizes these behaviors through keyword matching:

- payment plan / installment plan
- send receipt
- enable autopay
- make payment / pay bill / outstanding bill

### Important limitation

This is not a true LLM-integrated agent yet. It is a frontend prototype that simulates agentic behavior with deterministic string checks. That makes the UI stable for demos, but it also means:

- prompts are brittle
- phrasing matters
- there is no tool orchestration
- there is no async step execution
- there is no audit or recovery behavior

If you extend the agent workflow, consider moving prompt interpretation into a dedicated domain layer or backend API.

## UI Architecture

### 1. Main canvas

The main Redwood-style foldout canvas is rendered inside `canvas-shell`.

Major regions:

- `masthead`
  Customer identity, metadata, and action bar
- `divider-band`
  Decorative stripe between header and board
- `board`
  Four-column main content grid

Columns:

- `Spotlight`
  Static account-value and recommendation content
- `Service requests`
  Summary card, list rows, and drill-in entry points
- `Purchases`
  Assets and orders
- `Billing`
  Outstanding bill card and recent billing information

### 2. AI drawer

The left-side drawer is rendered as `agent-drawer`.

It contains:

- drawer header
- workflow summary card
- starter prompts
- checklist
- message list

Behavior:

- hidden by default
- opened by the action-bar drawer control
- also auto-opens after any submitted billing prompt

### 3. Service requests overlay

The overlay is conditionally rendered when `serviceRequestView` is non-null.

It is designed to match the provided screenshot and includes:

- page header
- Ask Oracle search box
- filter pills
- patterned divider
- results table

Entry points:

- `View open service requests` sets `serviceRequestView` to `"open"`
- `View all service requests` sets `serviceRequestView` to `"all"`

Filtering behavior:

- `"open"` filters `serviceRequestRows` to rows where `status === "Open"`
- `"all"` renders all rows

## Data Architecture

All mock content is centralized in [src/data.js](/Users/GNAYAR/Documents/New%20project/src/data.js).

This file currently provides:

- account metadata
- spotlight statistics
- recommendation cards
- service request summary
- service request preview rows
- service request table rows
- assets
- recent orders
- latest bills
- starter prompts
- initial AI messages
- initial billing workflow

### Why this matters

Keeping seed data in one file makes the prototype easy to edit without touching rendering logic. It also provides a simple boundary for future migration to API-driven data.

### Recommended next step

If the app grows, split `data.js` into domain-specific files:

- `data/account.js`
- `data/serviceRequests.js`
- `data/billing.js`
- `data/agent.js`

## Styling Architecture

All styles live in [src/styles.css](/Users/GNAYAR/Documents/New%20project/src/styles.css).

The stylesheet currently mixes:

- design tokens in `:root`
- layout primitives
- page-specific styling
- overlay styling
- responsive rules

### Major style regions

- root theme variables
- drawer styles
- masthead/action-bar styles
- board and column styles
- billing card decorations
- service requests overlay and table styles
- responsive breakpoints

### CSS tradeoff

This approach is efficient for a prototype, but there is no style encapsulation. Class naming is currently the only isolation mechanism.

If the UI expands significantly, consider one of these paths:

- split CSS by feature
- adopt CSS Modules
- introduce a design-system token layer

## Developer Extension Guide

### Extending billing prompts

The simplest place to add new agent actions is `applyBillingPrompt` in [src/App.jsx](/Users/GNAYAR/Documents/New%20project/src/App.jsx).

Pattern:

1. Add a new prompt-recognition branch.
2. Update the `workflow` object.
3. Push a new `activity` entry if needed.
4. Update `summary`, `checklist`, and any billing-card values.
5. Return an assistant response string.

Good candidates:

- partial payment amount collection
- fee waiver approval flow
- dispute creation
- autopay method selection
- payment retry logic

### Extending the drawer

The drawer is currently billing-specific. To support multiple agent workflows:

1. Add a workflow type discriminator such as `activeAgent`.
2. Move billing-specific copy into a workflow config.
3. Render different checklist, prompts, and summaries by workflow type.

Potential future workflows:

- billing
- service resolution
- retention
- order modification

### Extending the service request table

Right now the overlay is static and read-only.

To extend it:

1. Move table state into its own component.
2. Add filter state for:
   - status
   - date range
   - priority
   - text search
3. Add sortable columns with an explicit sort model.
4. Replace hard-coded summary text with row-level summary fields from data.

### Splitting `App.jsx`

If maintainability becomes a concern, the best first refactor is component extraction.

Recommended component candidates:

- `AgentDrawer`
- `CustomerHeader`
- `SpotlightColumn`
- `ServiceRequestsColumn`
- `PurchasesColumn`
- `BillingColumn`
- `ServiceRequestsOverlay`

Recommended utility extraction:

- `utils/formatters.js`
  for `currency`
- `utils/ids.js`
  for `createId`
- `domain/billingAgent.js`
  for `applyBillingPrompt`

## Suggested Future Architecture

For a production-grade version, the architecture should likely move toward:

### Presentation layer

- componentized React tree
- routing for foldout/detail pages
- reusable cards, tables, filters, and drawer primitives

### State layer

- local UI state for view concerns
- remote/server state for account, billing, requests, and orders
- a reducer or state machine for workflow execution

### Agent layer

- backend prompt orchestration
- structured action outputs instead of string parsing
- server-generated workflow events
- audit log and failure handling

### API layer

- account API
- service requests API
- billing API
- workflow execution API

## Known Technical Limitations

- No routing library is used.
- Overlay navigation is local state only.
- Prompt interpretation is deterministic and string-based.
- All data is mock data.
- There is no persistence across refreshes.
- There are no tests.
- `App.jsx` currently owns too many responsibilities.

## Testing Recommendations

Current repo state does not include tests. If this app is going to be extended, add tests in this order:

1. Unit tests for `applyBillingPrompt`
2. Render tests for:
   - drawer open/close behavior
   - service request overlay mode switching
   - open-status filtering
3. Interaction tests for:
   - top action-bar submission
   - starter prompt clicks
   - overlay back navigation

Suggested tooling:

- `Vitest`
- `React Testing Library`

## Build and Run

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Create production build:

```bash
npm run build
```

## Practical Notes for the Next Developer

- Treat [src/data.js](/Users/GNAYAR/Documents/New%20project/src/data.js) as the current source of truth for seeded demo data.
- Treat `applyBillingPrompt` as the only place where the AI drawer mutates billing behavior.
- Treat `serviceRequestView` as the navigation switch for the service request overlay.
- Preserve the screenshot-driven layout in [src/styles.css](/Users/GNAYAR/Documents/New%20project/src/styles.css) unless a redesign is explicitly requested.
- If you add more features, prioritize extracting components before adding more state branches to `App`.

## Recommended Immediate Refactors

These are safe improvements that would reduce future complexity without changing behavior:

1. Extract `AgentDrawer` from [src/App.jsx](/Users/GNAYAR/Documents/New%20project/src/App.jsx)
2. Extract `ServiceRequestsOverlay` from [src/App.jsx](/Users/GNAYAR/Documents/New%20project/src/App.jsx)
3. Move `applyBillingPrompt` into a domain utility file
4. Replace anchor placeholders using `href="/"` with button-based actions or real navigation
5. Add tests around open-filter behavior in the service request overlay
