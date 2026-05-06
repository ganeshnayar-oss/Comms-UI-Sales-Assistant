# Agentic AI Application Requirements

## 1. Purpose

Build a Siebel-backed Comms B2C Sales Assistant application that combines an agentic AI workflow, a dynamic UI canvas, recommendations, catalog browsing, cart management, order capture, and Customer 360.

This document is written so an agentic AI development tool can generate the application from requirements. It should be treated as the build brief and acceptance specification.

## 2. Product Summary

The application is a contact-center sales assistant for onboarding a customer, recommending products, adding products or promotions to an order, completing checkout information, submitting the order, and navigating to Customer 360.

The user experience should align to the provided Figma clickthrough prototype and Redwood UX designs. The Figma prototype is the source of truth for look and feel, templates, spacing, navigation patterns, and page composition.

The application should feel like a modern Redwood-style enterprise application:

- Agentic assistant for natural-language actions.
- UI canvas that updates as the workflow progresses.
- Recommendation panel with next-best actions.
- Product catalog with search and hierarchical browse.
- Cart with expandable parent-child line items.
- Customer 360 with account insights and recent activity.

## 3. Design Source Of Truth

The input package for an agentic AI build must include the Figma clickthrough prototype video/screenshots that were provided for the Redwood UX design.

The Figma/clickthrough prototype governs:

- Visual look and feel.
- Redwood styling direction.
- Page templates.
- Navigation patterns.
- Panel composition.
- Layout density.
- Header/action placement.
- Drawer behavior.
- Catalog drawer layout.
- Customer 360 foldout layout.
- Ask Oracle icon placement and interaction patterns.

The agentic AI should use the Figma prototype as design intent, not as a literal clickstream script. The goal is to reproduce the Redwood-aligned experience pattern while still optimizing the business journey for the contact center sales rep.

### Design Expectations

- Use the Redwood visual language shown in the prototype: enterprise-grade spacing, cards, foldouts, subtle separators, Redwood-style controls, and clean hierarchy.
- Recreate the navigation model shown in the clickthrough: home/task entry point, intake flow, agentic workflow, catalog drawer, checkout canvas, and Customer 360.
- Match the template structure shown in the prototype before inventing new layouts.
- Preserve important page regions from the prototype, including header, smart action area, panels, foldouts, drawers, and recommendation surfaces.
- Use the prototype to infer visual hierarchy and interaction affordances.
- Do not replace the Figma navigation pattern with generic chatbot-only UX.
- Do not replace Redwood-style enterprise pages with generic consumer SaaS layouts.
- If exact assets or measurements are unavailable, produce the closest Redwood-aligned approximation and document assumptions.

### Design QA

QA should validate both:

- Business journey success.
- Visual/navigation alignment to the Figma Redwood prototype.

Design QA should check:

- Does the home page resemble the provided Redwood home/task screen?
- Does the intake page align to the provided Redwood intake template?
- Does the workflow page preserve the three-zone pattern: agentic chat, canvas, recommendation panel?
- Does the catalog drawer preserve search/browse navigation and category hierarchy?
- Does Customer 360 preserve the foldout layout and horizontal scroll behavior?
- Are Ask Oracle icon placement, action bar patterns, and drawer interactions aligned to the prototype?

## 4. Primary Users

- Contact center sales agent.
- Sales operations user.
- Demo user showing how agentic AI can generate a Siebel experience layer.
- Developer extending the experience for another customer or domain.

## 5. Core User Goals

- Capture a prospect/customer request in natural language.
- Use AI to parse customer name, address, prospect type, and product needs.
- Recommend the best product or promotion semantically from catalog/category/product descriptions.
- Create contact, account, and order using Siebel APIs.
- Add simple products or bundled promotions correctly.
- Complete account, billing/service, address, payment, and summary steps.
- Submit the order.
- View the created account in Customer 360.

## 6. Persona-Led Journey Requirements

The application is not just a set of screens. It enables a business journey for a contact center sales representative onboarding a prospect with as little friction as possible.

The primary persona journey is:

```text
Contact center sales rep receives a prospect request
  -> captures contact and need in natural language
  -> confirms or refines contact/account information
  -> views or applies recommendations
  -> searches/browses catalog
  -> adds products or promotions to cart
  -> configures/reviews the cart
  -> completes checkout details
  -> submits the order
  -> lands in Customer 360 for the created/used account
```

The UI clickstream is only one expression of this journey. QA should test whether the persona can accomplish the business goal, not whether the user clicked a specific sequence of controls.

### Journey Principles

- The sales rep can use either the agentic AI workflow, the UI canvas, or both interchangeably.
- Natural-language input should reduce friction, not open unnecessary forms.
- The canvas should always provide a visible, editable representation of the workflow state.
- The recommendation panel should guide the next best action and execute it directly when sufficient information is known.
- The agent should never need to re-enter information already captured from intake, Siebel, or prior workflow steps.
- The app should support recovery: if AI parsing misses something, the canvas drawer should allow correction without restarting the journey.
- Every completed step should be visible so the agent trusts where they are in the journey.
- The app should feel like one continuous onboarding journey, not disconnected API demos.

### Primary Journey: New Prospect Onboarding To Submitted Order

Persona: Contact center sales representative.

Business goal: Convert a prospect into an order with minimal friction.

Starting point:

- Rep has a natural-language description of a prospect.
- Prospect may provide name, address, phone/email, customer type, need, and product interest in any order.

Journey stages:

1. Capture prospect intent in natural language.
2. AI extracts contact identity, address, customer segment, and product need.
3. System creates or prepares contact/account context.
4. System recommends the best product or promotion based on semantic match.
5. Rep accepts recommendation or browses/searches catalog.
6. Rep adds product/promotion to cart.
7. System creates/updates Siebel order/cart correctly.
8. Rep completes account, billing/service, address, payment, and summary steps.
9. Rep submits order.
10. System navigates to Customer 360 for the account.

Success outcome:

- Contact exists.
- Account exists where required.
- Cart/order contains intended products and promotion child lines.
- Checkout data is complete.
- Order is submitted.
- Customer 360 reflects the created/used account.

### Alternate Journey: Recommendation-First Order

Persona: Contact center sales representative.

Business goal: Accept the recommended offer directly from the intake page.

Journey stages:

1. Rep enters natural-language prospect description.
2. App recommends a semantically relevant product/promotion.
3. Rep clicks add/apply recommendation.
4. App creates contact and account as needed.
5. App applies product or promotion to cart/order.
6. App opens the workflow page with the completed steps reflected.
7. Rep finishes checkout and submits order.

Success outcome:

- Rep is not forced to manually perform account setup before recommendation apply when the app already has enough information.
- Product/promotion is added through the correct Siebel flow.
- Workflow state reflects actions completed behind the scenes.

### Alternate Journey: Canvas-First Correction

Persona: Contact center sales representative.

Business goal: Correct or complete details through the canvas when AI-parsed data is incomplete or wrong.

Journey stages:

1. Rep enters intake.
2. AI parses available information.
3. Rep notices missing or incorrect account/contact/billing/payment detail.
4. Rep clicks edit on the relevant canvas card.
5. Drawer opens with editable fields.
6. Rep saves correction.
7. Workflow and recommendation panel update accordingly.

Success outcome:

- Rep can recover without restarting.
- Corrected data becomes the source of truth for later Siebel calls.

### Alternate Journey: Agentic Natural-Language Action

Persona: Contact center sales representative.

Business goal: Execute workflow actions by typing natural language.

Example prompts:

```text
Create account as Mary Jones
Use billing and service account the same as the owner account
Use contact address for billing and shipping
Use saved Visa card
Place order
```

Success outcome:

- App interprets the business intent.
- App executes the action directly if enough information is known.
- App does not open a drawer just because the user typed an action.
- Canvas and step tracker update after the action.

### Existing Customer Extension Journeys

The grammar and architecture should also support future existing-customer journeys:

- Existing customer ordering.
- Modify asset.
- Disconnect asset.
- Upgrade or downgrade promotion.
- Suspend service.
- Resume service.

These journeys do not need to be fully implemented in the first app, but the requirements and grammar should be structured so an agentic AI can extend the app into these flows.

## 7. Journey-Based QA And Test Strategy

QA should validate persona outcomes and business journeys, not only UI clickstream mechanics.

The UI clickstream is still useful for automation, but it is not the primary requirement. The primary requirement is whether a contact center sales rep can complete the intended journey with zero friction.

### QA Testing Principles

- Test the journey from the persona's point of view.
- Validate business state transitions, not only button clicks.
- Test both agentic AI path and canvas path for the same business goal.
- Test recovery when AI parsing is incomplete.
- Test that known information is reused and not requested again.
- Test that Siebel records are created or updated in the correct sequence.
- Test that recommendation, cart, checkout, and Customer 360 stay synchronized.

### Journey Test Template

Each journey test should include:

```text
Persona:
Business goal:
Starting context:
Natural-language input:
Allowed interaction paths:
Expected system interpretation:
Expected UI state:
Expected Siebel operations:
Expected business outcome:
Recovery expectations:
Regression risks:
```

### Example Journey Test

Persona: Contact center sales rep.

Business goal: Onboard a student prospect and submit a mobile plan order.

Natural-language input:

```text
The prospect is a student Alia Herbert, interested in a mobile plan. Resides at address is 123 East 85th Street, Apt 5G, New York, NY 10028.
```

Expected system interpretation:

- Contact name is Alia Herbert.
- Prospect type is student.
- Address is captured.
- Product interest is mobile plan.
- Recommended category is Mobile Plans.

Expected recommendation:

- Student-friendly mobile product/promotion is recommended.
- Recommendation is not chosen merely because it is first in the category.

Allowed interaction paths:

- Agent accepts recommendation from intake page.
- Agent uses smart action bar to add recommendation.
- Agent opens catalog and selects product from canvas.

Expected business outcome:

- Contact/account context is created as needed.
- Product/promotion is added to cart using correct Siebel flow.
- Checkout can be completed.
- Order can be submitted.
- Customer 360 opens for Alia Herbert's account.

## 8. High-Level Architecture

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

## 9. Configuration Requirements

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

## 10. AI Requirements

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

## 11. UX Requirements

All UX must align to the supplied Figma clickthrough prototype and Redwood UX design language. The sections below describe the required behavior, but visual structure and navigation patterns should be derived from the prototype.

### Redwood/Figma Alignment

- Use the prototype as the baseline for templates and navigation.
- Use Redwood-style page headers, cards, panels, drawers, buttons, forms, foldouts, and separators.
- Preserve the clickthrough's high-level navigation sequence while optimizing the persona journey.
- Maintain the visual relationship between agentic workflow, UI canvas, and recommendation panel.
- Match the prototype's page density and enterprise layout style.
- Keep Ask Oracle iconography and placement consistent with the provided design.

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

## 12. Product Recommendation Requirements

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

## 13. Catalog Requirements

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

## 14. Cart Requirements

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

## 15. Siebel Integration Requirements

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

## 16. Customer 360 Requirements

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

## 17. Localization And Globalization Requirements

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

## 18. Accessibility Requirements

React does not automatically provide accessibility. Implement:

- Keyboard-operable buttons and drawers.
- ARIA labels for icon-only buttons.
- Visible focus states.
- `aria-live` or equivalent for important workflow updates.
- Escape-to-close for drawers where appropriate.
- Semantic headings and form labels.

## 19. Extensibility Requirements

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

## 20. File Structure Requirements

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

## 21. Security Requirements

- Never commit secrets.
- Never expose OpenAI, OCI, or Siebel credentials to browser code.
- Use `.env.local` for local credentials.
- Ignore local runtime config files.
- Runtime server handles auth and proxying.
- Do not send payment/card data to LLM.

## 22. Build And Run Requirements

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

## 23. Acceptance Criteria

The app is acceptable when:

- A contact center sales rep can complete the new prospect onboarding journey from natural-language intake through submitted order.
- The same business journey can be completed through agentic AI actions, canvas interactions, or a mix of both.
- The rep can capture contact information in natural language without following a rigid form-first clickstream.
- The app reuses known customer/contact/account/order data and does not ask the rep to re-enter information already captured.
- Recommendation is semantically relevant to the persona need and not merely the first product in a category.
- Agent can add or apply recommendation from the intake page when sufficient information exists.
- Main workflow shows agentic chat, dynamic canvas, and recommendation panel as synchronized parts of one journey.
- Visual design, templates, navigation patterns, and panel composition align to the provided Figma Redwood clickthrough prototype.
- The app does not replace the prototype's enterprise Redwood experience with a generic chatbot or generic SaaS layout.
- Smart action bar executes natural-language business actions.
- Canvas supports correction and recovery through drawers or buttons without restarting the journey.
- Catalog search and browse support product discovery as part of the journey.
- Cart shows expandable parent-child lines so the rep can understand bundled promotions.
- Simple products and bundled promotions follow distinct Siebel flows.
- Checkout captures account, billing/service, address, payment, and summary information.
- Payment is added to order, not account.
- Order submit navigates to Customer 360 for the created/used account.
- Customer 360 shows active account data and confirms the journey outcome.
- Language selector supports English, French, and Spanish.
- Runtime config avoids hard-coded customer environment values.
- `npm run build` passes.

## 24. Regression Tests To Generate

Generate journey-based tests and supporting smoke scripts for:

- New prospect onboarding from natural-language intake to submitted order.
- Recommendation-first journey where the rep applies the recommendation directly from intake.
- Canvas-first correction journey where the rep fixes parsed contact/account details without restarting.
- Agentic natural-language action journey for account, billing/service, address, payment, summary, and submit actions.
- Design parity smoke checks against the Figma Redwood prototype for home, intake, workflow, catalog drawer, checkout canvas, and Customer 360.
- Intake parsing of varied natural-language name/address patterns.
- Student/mobile recommendation selects the student-friendly mobile product.
- Search by product name as part of product discovery.
- Browse catalog hierarchy as part of product discovery.
- Add simple product to cart/order.
- Apply bundled promotion with `ProdPromId`.
- Re-query cart line hierarchy after add/apply.
- Owner account assignment does not set billing/service account prematurely.
- Billing/service account assignment does not break line items.
- Payment attaches to order.
- Summary field truncation or safe long-text handling.
- Customer 360 uses created account id.
- Spanish/French labels render without obvious English leakage for app-owned strings.

## 25. Development Instructions For Agentic AI

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

## 26. Non-Goals

- Do not build a full production identity system.
- Do not store real payment card data.
- Do not hard-code one customer environment.
- Do not bypass Siebel business services/workflows when they are required.
- Do not make the browser call Siebel directly.
