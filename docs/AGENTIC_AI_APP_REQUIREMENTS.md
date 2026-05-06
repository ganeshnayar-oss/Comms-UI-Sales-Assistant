# Agentic AI Application Requirements

## 1. Purpose

Build a Siebel-backed Comms B2C Sales Assistant application that combines an agentic AI workflow, a dynamic UI canvas, recommendations, catalog browsing, cart management, order capture, and Customer 360.

This document is written so an agentic AI development tool can generate the application from requirements. It should be treated as the build brief and acceptance specification.

## 2. Product Summary

The application is a contact-center sales assistant for onboarding a customer, recommending products, adding products or promotions to an order, completing checkout information, submitting the order, and navigating to Customer 360.

The user experience should feel like a modern Redwood-style enterprise application:

- Agentic assistant for natural-language actions.
- UI canvas that updates as the workflow progresses.
- Recommendation panel with next-best actions.
- Product catalog with search and hierarchical browse.
- Cart with expandable parent-child line items.
- Customer 360 with account insights and recent activity.

## 3. Primary Users

- Contact center sales agent.
- Sales operations user.
- Demo user showing how agentic AI can generate a Siebel experience layer.
- Developer extending the experience for another customer or domain.

## 4. Core User Goals

- Capture a prospect/customer request in natural language.
- Use AI to parse customer name, address, prospect type, and product needs.
- Recommend the best product or promotion semantically from catalog/category/product descriptions.
- Create contact, account, and order using Siebel APIs.
- Add simple products or bundled promotions correctly.
- Complete account, billing/service, address, payment, and summary steps.
- Submit the order.
- View the created account in Customer 360.

## 5. High-Level Architecture

Build a React single-page application with a local runtime server.

### Frontend

- React 18.
- Plain CSS or a lightweight design system implementation.
- Redwood-inspired visual style.
- No hard dependency on a commercial component library.

### Runtime Server

- Node.js runtime server.
- Serves the compiled React app.
- Provides backend-for-frontend API routes under `/api/...`.
- Proxies calls to Siebel REST APIs.
- Calls LLM provider for intake parsing and smart action parsing when configured.
- Supports mock mode when no real Siebel environment is configured.

### Why A Runtime Server Is Required

The browser must not call Siebel directly. The frontend should call local runtime endpoints such as:

```text
/api/siebel/...
/api/intake/parse
/api/workflow/parse-action
```

The runtime server should call the actual Siebel or LLM endpoint, handle auth, normalize response shapes, and avoid exposing secrets in browser code.

## 6. Configuration Requirements

Do not hard-code customer environment values.

Use runtime configuration files:

```text
config/siebel.config.json
config/customer.config.json
```

Commit only examples:

```text
config/siebel.config.example.json
config/customer.config.example.json
```

Local files must be ignored by Git:

```text
.env.local
config/siebel.config.json
config/customer.config.json
```

### Siebel Config

Required fields:

```json
{
  "useRealApi": false,
  "appUrl": "https://your-siebel-host.example.com/siebel/app/ecommunications/enu",
  "apiBaseUrl": "https://your-siebel-host.example.com/siebel/v1.0",
  "endpoints": {
    "account": "/data/Account/Account/?PageSize=1&StartRowNum=0",
    "serviceRequests": "/data/Service Request/Service Request/?PageSize=25&StartRowNum=0",
    "assets": "/data/Asset Management/Asset Mgmt - Asset - Header/?PageSize=20&StartRowNum=0",
    "orders": "/data/Order Entry/Order Entry - Orders/?PageSize=20&StartRowNum=0"
  }
}
```

### Customer Config

Required capabilities:

- Brand workflow title.
- Assistant label.
- LLM mode.
- Default catalog name.
- Default price list name.
- Order number prefix.
- Promotion order number prefix.
- Intake prompt and placeholder.
- Recommendation rules.
- Supported locales.

Example:

```json
{
  "brand": {
    "workflowTitle": "Create order for new customer",
    "assistantLabel": "Ask Oracle"
  },
  "ai": {
    "mode": "llm"
  },
  "globalization": {
    "defaultLocale": "en-US",
    "supportedLocales": ["en-US", "fr-FR", "es-ES"]
  },
  "defaults": {
    "catalogName": "Supremo Catalog",
    "priceListName": "DBE NA Pricelist",
    "orderNumberPrefix": "CODX-ORDER",
    "promotionOrderNumberPrefix": "DX4C_O1"
  }
}
```

### Environment Variables

Support:

```text
SIEBEL_SESSION_COOKIE
SIEBEL_BEARER_TOKEN
SIEBEL_BASIC_USERNAME
SIEBEL_BASIC_PASSWORD
INTAKE_LLM_PROVIDER
INTAKE_LLM_API_KEY
INTAKE_LLM_MODEL
INTAKE_LLM_BASE_URL
OPENAI_API_KEY
OPENAI_MODEL
```

Never commit secrets.

## 7. AI Requirements

The application must support two modes:

```text
llm
deterministic
```

### LLM Mode

Use LLM-backed structured parsing for:

- First-page intake.
- Smart action bar commands.
- Agentic chat action interpretation.

The LLM should parse natural-language input into structured intent without opening manual forms unless the user explicitly asks to edit.

Examples:

```text
The prospect is a student Alia Herbert, interested in a mobile plan. Resides at address is 123 East 85th Street, Apt 5G, New York, NY 10028.
```

Expected parse:

```json
{
  "contactName": "Alia Herbert",
  "firstName": "Alia",
  "lastName": "Herbert",
  "address": "123 East 85th Street, Apt 5G, New York, NY 10028",
  "prospectType": "student",
  "productInterest": "mobile plan",
  "requestedProductCategories": ["Mobile Plans"]
}
```

Smart action examples:

```text
Use billing and service account the same as the owner account
```

Expected action:

```json
{
  "actionType": "assign_service_billing",
  "serviceBillingMode": "same_as_owner"
}
```

```text
Create account as Mary Jones
```

Expected action:

```json
{
  "actionType": "create_account",
  "accountName": "Mary Jones"
}
```

### Deterministic Mode

If LLM is disabled, use deterministic parsing fallbacks for basic workflows.

### Sensitive Data Rule

Do not send sensitive payment/card details to the LLM. Parse payment locally and mask values.

## 8. UX Requirements

### Home Page

Provide a Redwood-style home screen with:

- Header.
- Language selector.
- Activities panel.
- Tasks panel.
- Calendar panel.
- Task link for `Create order for new customer`.

The task link starts the sales onboarding flow.

### Intake Page

Provide a first-page intake screen:

- Page title from config.
- Language selector.
- Large headline: ask agent to describe customer and requirements.
- Ask Oracle-style input field.
- Continue button.
- Recommendation preview card if a product recommendation can be made from intake text.

If a recommendation is shown, the agent should be able to add/apply the recommendation directly from the first page. In that case the app should create contact/account as needed and apply product/promotion without requiring the user to manually step through account creation.

### Main Workflow Page

Use a three-column layout:

```text
Left: agentic chat
Middle: dynamic UI canvas
Right: recommendation / next-best-action panel
```

The agentic chat must be collapsible. When collapsed, show a `>` icon inside the smart action bar.

At the top, provide a smart action bar with Ask Oracle icon and input. Do not label it `Smart actions`.

The chat composer input must always be visible without requiring scroll.

### Step Tracker

The top of the canvas must always show workflow steps. As each step completes, show a checkbox/check state.

Required steps:

- Customer details.
- Account and contact details.
- Product selected.
- Service and billing accounts.
- Billing and shipping information.
- Payment information.
- Call summary.
- Submit order.

### Dynamic Canvas

The middle UI canvas must dynamically build as the agentic workflow advances. Every action available through the assistant should also be possible through the canvas.

Examples:

- Edit customer details opens a drawer form.
- Edit account details opens a drawer form.
- Edit billing/service account opens a drawer form.
- Edit billing/shipping opens a drawer form.
- Edit payment opens a drawer form.
- Edit summary opens a drawer form.

### Recommendation Panel

The right panel should show next-best actions aligned to workflow state, not just passive information.

Examples:

- Create/use account.
- View product catalog.
- Add recommended product.
- Copy owner account to billing/service.
- Copy customer address to billing/shipping.
- Apply saved payment.
- Generate summary.
- Place order.

Recommendation panel actions should execute directly when possible and should not force the agent to re-enter information that is already known.

## 9. Product Recommendation Requirements

The app must use semantic matching to recommend a product/promotion from catalog/category/product descriptions.

Example:

Input:

```text
Robert Pierce is a student interested in mobile plan
```

Expected behavior:

- Identify `student`.
- Identify `mobile plan`.
- Prefer `Mobile Plans` category.
- Recommend `Supremo Mobile Unlimited` if its description indicates it is good for students and people on the move.

Do not simply pick the first product in a category.

Support customer-configured recommendation rules that bias product selection.

## 10. Catalog Requirements

The product catalog must support separate tabs:

- Search.
- Browse.

### Search

Search should allow product-name search.

The search bar should:

- Show catalog name as a chip inside the search bar.
- Not require agent to type catalog or price list.
- Show smart category filter chips below the search bar, such as Broadband Plans, Mobile Plans, Streaming Plans.

Selecting a category chip refreshes the product list to show products under that category.

### Browse

Browse should show hierarchical catalog structure:

```text
Category
  Product
  Product
Category
  Product
```

Preserve category/product hierarchy.

## 11. Cart Requirements

Cart should support:

- Simple standalone products.
- Bundled promotions with parent-child order line items.
- Expand/collapse behavior for parent rows.

Default behavior:

- Root parent rows start collapsed.
- Newly added bundle/promotion auto-expands once so child items are visible.

Cart columns:

- Product.
- Quantity.
- Monthly or recurring price.
- One-time price.
- Line number.

Use Siebel line item parent/root identifiers when available.

## 12. Siebel Integration Requirements

Use a local runtime proxy for Siebel.

Frontend functions call:

```text
/api/siebel/...
```

The runtime server maps those to real Siebel APIs.

### Contact Flow

- Create contact from intake.
- Store contact id.
- Use contact name from intake, not sample defaults.

### Account Flow

- Create account after contact when required.
- Account type should be Residential for residential customer flow.
- Set created contact as primary contact when supported.
- Associate contact address to account when user says to use contact address.
- Reuse account during the workflow; do not create duplicate accounts per product action.

### Order Flow

For simple products:

- Create sales order if required.
- Set account and price list.
- Add item.
- Re-query order lines.

For bundled promotions:

- Use Workflow Process API.
- Use process:

```text
ISS Promotion WS - ApplyProductPromotion - Order
```

- Pass `ProdPromId`, not Product Id.
- Pass account name and account id.
- Pass order number.
- Pass price list id.
- Use `Sync = Y`.
- Re-query order lines after apply.

Promotion payload pattern:

```json
{
  "ProcessName": "ISS Promotion WS - ApplyProductPromotion - Order",
  "ProdPromId": "{{prodPromId}}",
  "Sync": "Y",
  "PricingMode": "Y",
  "EligibilityMode": "1",
  "Quantity": "1",
  "SiebelMessage": {
    "MessageId": "",
    "MessageType": "Integration Object",
    "IntObjectName": "PDS Order",
    "IntObjectFormat": "Siebel Hierarchical",
    "ListOfPDS Order": {
      "Header": {
        "Account": "{{accountName}}",
        "Account Id": "{{accountId}}",
        "Order Type": "Sales Order",
        "Order Number": "{{orderNumber}}",
        "Price List Id": "{{priceListId}}"
      }
    }
  }
}
```

### Billing And Service Account Flow

- Owner account assignment is separate from billing/service account assignment.
- Do not set billing/service accounts before the workflow reaches that step.
- When assigning billing/service accounts, set header fields and line item fields through safe Siebel operation that does not break required line item fields.

### Payment Flow

- Payment belongs on order, not account.
- Mask sensitive payment values.

### Summary Flow

- Generate or capture call summary.
- If creating an activity, respect Siebel field length limits.

## 13. Customer 360 Requirements

After order submission, navigate to Customer 360 for the account created or used in the workflow.

Customer 360 should show:

- Account profile.
- Spotlight insights.
- Service requests.
- Purchases/orders.
- Billing.
- Assets.

Layout:

- Show four foldouts on screen.
- Fifth foldout requires horizontal scrolling.
- Customer 360 should retrieve data for the active account, not a generic account.

### Spotlight Insights

Render:

- Churn as horizontal bar.
- NPS as horizontal bar.
- Credit Rating as horizontal bar.
- CLTV as dollar value with dollar-strength meter.

Show last three records for:

- Orders.
- Service requests.
- Assets.
- Billing items where applicable.

## 14. Localization And Globalization Requirements

Support:

- English.
- French.
- Spanish.

Provide a language selector.

Localize:

- Navigation labels.
- Button labels.
- Workflow labels.
- Recommendation UI labels.
- Canvas labels.
- Customer 360 labels.

Product descriptions and Siebel LOV values should come translated from Siebel when available. If not available, provide language-pack fallback mappings for demo data.

Selected locale should persist in local storage.

## 15. Accessibility Requirements

React does not automatically provide accessibility. Implement:

- Keyboard-operable buttons and drawers.
- ARIA labels for icon-only buttons.
- Visible focus states.
- `aria-live` or equivalent for important workflow updates.
- Escape-to-close for drawers where appropriate.
- Semantic headings and form labels.

## 16. Extensibility Requirements

The app must support customer-specific extension without forking core code.

Use:

```text
config/customer.config.json
```

for:

- branding.
- catalog defaults.
- price list defaults.
- order number prefixes.
- AI mode.
- supported locales.
- recommendation rules.

Use:

```text
docs/siebel-api-grammar/
grammar/
skills/siebel-api-grammar/
```

to guide future Siebel API mapping and agentic implementation.

## 17. File Structure Requirements

Expected structure:

```text
config/
  customer.config.example.json
  siebel.config.example.json
docs/
  TEAM_ONBOARDING.md
  EXTENSIBILITY.md
  SIEBEL_API_GRAMMAR_REQUIREMENTS.md
  AGENTIC_AI_APP_REQUIREMENTS.md
  siebel-api-grammar/
grammar/
skills/
  siebel-api-grammar/
server.mjs
src/
  App.jsx
  api/
  domain/
  extensions/
  i18n/
  mocks/
  styles.css
```

## 18. Security Requirements

- Never commit secrets.
- Never expose OpenAI, OCI, or Siebel credentials to browser code.
- Use `.env.local` for local credentials.
- Ignore local runtime config files.
- Runtime server handles auth and proxying.
- Do not send payment/card data to LLM.

## 19. Build And Run Requirements

Required commands:

```bash
npm install
npm run build
npm run start:runtime
```

Runtime URL:

```text
http://127.0.0.1:4173/
```

The runtime server should serve its own build output and proxy API routes.

## 20. Acceptance Criteria

The app is acceptable when:

- Home page loads.
- Create order flow starts from home.
- Intake text can be parsed into contact/account/customer needs.
- Recommendation is semantically relevant.
- Agent can add recommendation from intake page.
- Main workflow shows agentic chat, canvas, and recommendation panel.
- Smart action bar executes natural-language actions.
- Chat can be collapsed and expanded.
- Canvas supports all workflow actions through drawers or buttons.
- Catalog search and browse work separately.
- Category chips filter products.
- Cart shows expandable parent-child lines.
- Simple products and bundled promotions follow distinct Siebel flows.
- Payment is added to order, not account.
- Order submit navigates to Customer 360.
- Customer 360 shows active account data.
- Language selector supports English, French, and Spanish.
- Runtime config avoids hard-coded customer environment values.
- `npm run build` passes.

## 21. Regression Tests To Generate

Generate tests or smoke scripts for:

- Intake parsing of varied natural-language name/address patterns.
- Student/mobile recommendation selects the student-friendly mobile product.
- Search by product name.
- Browse catalog hierarchy.
- Add simple product.
- Apply bundled promotion with `ProdPromId`.
- Re-query cart line hierarchy.
- Owner account assignment does not set billing/service account prematurely.
- Billing/service account assignment does not break line items.
- Payment attaches to order.
- Summary field truncation or safe long-text handling.
- Customer 360 uses created account id.
- Spanish/French labels render without obvious English leakage for app-owned strings.

## 22. Development Instructions For Agentic AI

When building this app:

1. Create the runtime config and secret model first.
2. Build mock mode before live Siebel mode.
3. Build UI screens before wiring destructive operations.
4. Add Siebel API calls behind runtime endpoints.
5. Use the Siebel grammar files before adding or changing integration behavior.
6. If an API mapping is inferred or discovered, stop and ask for confirmation before editing grammar or implementation.
7. Preserve working flows. Do not regress simple product add when fixing promotion apply, and vice versa.
8. Run `npm run build` after code changes.
9. Keep code, config, and customer-specific data separated.

## 23. Non-Goals

- Do not build a full production identity system.
- Do not store real payment card data.
- Do not hard-code one customer environment.
- Do not bypass Siebel business services/workflows when they are required.
- Do not make the browser call Siebel directly.

