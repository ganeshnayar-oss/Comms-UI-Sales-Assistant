# Siebel API Domain Grammar And Skill Library Requirements

## 1. Purpose

Create a Codex-assisted development capability for generating, validating, and maintaining a curated Siebel API domain grammar. This grammar will allow agentic platforms to generate experience-layer UIs over Siebel APIs more reliably by mapping business intent to the correct Siebel API type, endpoint, payload, sequencing rules, and error-handling behavior.

The goal is not to hand-craft one-off documentation. The goal is to use Codex as the development partner to discover, structure, generate, validate, and continuously improve a reusable Siebel API grammar and skill library.

## 2. Problem Statement

Agentic platforms can generate UI code quickly, but they can fail when they must infer Siebel API behavior from sparse context. The most common failure modes are:

- Choosing the wrong API type, such as using Data API where a Service API or Workflow Process API is required.
- Guessing payload structure.
- Passing the wrong ID, such as Product Id instead of ProdPromId.
- Creating objects in the wrong sequence.
- Introducing regressions in flows that already work.
- Treating all CRUD operations as Data API operations when Siebel business logic is actually exposed through service or workflow APIs.

For example, adding a bundled promotion to an order should use the promotion workflow API, not a simple order line Data API call. The grammar must make that business rule explicit and reusable.

## 3. Vision

Build a curated, versioned, domain-organized grammar that Codex and other agentic platforms can use as a source of truth when building UIs on top of Siebel.

The grammar should answer:

- What business intent is the user trying to perform?
- Which Siebel API type should be used?
- Which endpoint or workflow process is correct?
- What payload is required?
- What fields are optional?
- What sequence must be followed?
- What errors are common and how should they be resolved?
- What is an example request and response?
- What tests should be generated to prevent regressions?

## 4. Guiding Principle

Codex should generate and maintain the grammar from trusted inputs, examples, test results, API behavior, and human validation. Humans guide and approve; Codex does the heavy lifting of drafting, normalizing, comparing, and converting the grammar into useful development artifacts.

This changes the activity from:

```text
Humans manually write all integration docs
```

to:

```text
Humans provide examples, constraints, and corrections
Codex generates grammar, skills, tests, and implementation guidance
Humans validate and approve
```

## 5. Target Users

- UI developers building React or Redwood-style experiences over Siebel.
- Codex users generating or modifying Siebel-backed applications.
- Solution architects defining integration patterns.
- QA engineers generating regression tests from business intent.
- Customer teams extending the experience layer without rewriting core Siebel logic.

## 6. In Scope

The grammar should cover these initial domains:

- Catalog
- Customer Management
- Order Management
- Product Configurator
- Pricing
- Quote Management
- Asset Management
- Customer 360
- Service Requests

The grammar should include Data API, Service API, and Workflow Process API usage rules.

The grammar should support both documentation and executable development workflows:

- Markdown grammar files for human review.
- JSON/YAML grammar files for tool consumption.
- Codex skills that instruct Codex how to use the grammar.
- Test templates generated from grammar entries.
- Optional MCP server tool definitions generated from the same grammar.

## 7. Out Of Scope For Initial Version

- Full automated discovery of every Siebel object and workflow.
- Replacing Siebel security or responsibility configuration.
- Automatically modifying Siebel repository configuration.
- Storing credentials, passwords, session cookies, or customer secrets.

## 8. Domain Organization

Recommended repository structure:

```text
docs/siebel-api-grammar/
  README.md
  grammar-schema.md
  catalog.md
  customer-management.md
  order-management.md
  asset-management.md
  customer-360.md
  service-requests.md
  common-errors.md
  validation-checklist.md

skills/siebel-api-grammar/
  SKILL.md

grammar/
  catalog.operations.json
  customer-management.operations.json
  order-management.operations.json
  asset-management.operations.json
  customer-360.operations.json
  service-requests.operations.json
```

## 9. Operation Grammar Template

Each operation within a domain must include the following sections:

```text
Domain
Operation name
Business intent
Preferred API type
Endpoint
Required payload
Optional payload
Input identifiers
Output identifiers
Sequencing rules
Preconditions
Postconditions
Common errors
Example request
Example response
Regression checks
Do not rules
Related operations
Human validation status
```

## 10. API Type Decision Rules

The grammar must help Codex choose among Siebel API types.

### Data API

Use Data API when the operation is simple CRUD against a business component and does not require Siebel business process orchestration.

Examples:

- Query account details.
- Query recent service requests.
- Query assets.
- Retrieve order header or line items.

### Service API

Use Service API when the operation is exposed as a Siebel business service and encapsulates business logic beyond simple CRUD.

Examples:

- Create account through `SWI Customer Party Service`.
- Insert customer party data.
- Execute service-layer operations that maintain related objects.

### Workflow Process API

Use Workflow Process API when the operation requires workflow orchestration, pricing, eligibility, promotion explosion, or complex order behavior.

Examples:

- Apply bundled promotion to order.
- Execute order validation workflows.
- Invoke promotion or asset transformation processes.

## 11. Required Domains And Example Operations

### 11.1 Catalog

Initial operations:

- Browse catalog hierarchy.
- Search product by name.
- Retrieve products by category.
- Identify simple product vs bundled promotion.
- Resolve price list.
- Retrieve product eligibility or pricing data.

### 11.2 Customer Management

Initial operations:

- Create contact.
- Create account.
- Create residential account.
- Associate contact to account.
- Set primary contact on account.
- Create and associate billing profile for an account
- Associate address to account.
- Retrieve customer/account profile.

### 11.3 Order Management

Initial operations:

- Create sales order.
- Create order with account context.
- Set price list on order.
- Add simple product to order.
- Apply bundled promotion to order.
- Assign owner account.
- Assign billing account.
- Assign service account.
- Add payment details to order.
- Add order summary or related activity.
- Submit order.
- Retrieve order list for an account
- Retrieve order lines with parent-child hierarchy.

### 11.4 Asset Management

Initial operations:

- Retrieve customer assets.
- Retrieve asset details.
- Retrieve asset hierarchy.
- Retrieve asset service status.
- Map asset to product subscription.
- Modify asset
- Upgrade / downgrade promotion
- Suspend asset
- Resume asset
- Cancel asset

### 11.5 Customer 360

Initial operations:

- Retrieve account profile.
- Retrieve last 3 orders.
- Retrieve last 3 service requests.
- Retrieve last 3 assets.
- Retrieve billing summary.
- Retrieve spotlight metrics such as churn, NPS, credit rating, and CLTV.

### 11.6 Service Requests

Initial operations:

- Create service request.
- Retrieve service request list.
- Retrieve service request details.
- Update service request status.
- Add note or activity to service request.
- Assign service request.

## 12. Example Grammar Entry

### Domain

Order Management

### Operation Name

Apply Bundled Promotion To Order

### Business Intent

When an agent or UI user adds a bundled promotion to the cart or order, invoke the Siebel promotion workflow so Siebel can create the order context, apply pricing and eligibility, and explode parent-child promotion line items correctly.

### Preferred API Type

Workflow Process API

### Endpoint

```text
POST /siebel/v1.0/service/Workflow Process Manager/RunProcess
```

### Workflow Process

```text
ISS Promotion WS - ApplyProductPromotion - Order
```

### Required Payload

```json
{
  "ProcessName": "ISS Promotion WS - ApplyProductPromotion - Order",
  "ProdPromId": "{{promotionId}}",
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

### Optional Payload

```json
{
  "Due Date": "{{dueDate}}",
  "Requested Ship Date": "{{requestedShipDate}}",
  "Currency Code": "USD"
}
```

### Input Identifiers

- `promotionId`
- `accountId`
- `accountName`
- `priceListId`
- `orderNumber`

### Output Identifiers

- `orderId`
- `orderNumber`
- `orderLineIds`
- `parentLineItemIds`
- `childLineItemIds`

### Sequencing Rules

- Create or identify the contact first if the flow starts from a prospect.
- Create or identify the account before applying the promotion.
- Pass the created account name and account id in the promotion payload.
- Pass `ProdPromId`, not simple Product Id.
- Do not create a separate order first when this workflow is responsible for order creation.
- Re-query order lines after workflow completion to render the parent-child cart hierarchy.

### Preconditions

- User has workflow process access.
- Promotion product id is known.
- Account exists.
- Price list exists and is compatible with the catalog/product.

### Postconditions

- Order exists in Siebel.
- Order is associated with the account.
- Parent promotion line item exists.
- Child line items are created by Siebel.
- Cart can render line item hierarchy.

### Common Errors

```text
SBL-DAT-00825
Access to workflow process is denied.
Fix: verify responsibility/workflow access for the authenticated user.
```

```text
SBL-PRM-50027
Required workflow input missing.
Fix: verify ProdPromId, SiebelMessage, Account Id, Order Number, and Price List Id.
```

```text
No backend line items after successful UI response
Fix: verify Sync = Y and re-query order lines after workflow completion.
```

### Example Response

```json
{
  "SiebelMessage": {
    "MessageType": "Integration Object",
    "IntObjectName": "PDS Order",
    "ListOfPDS Order": {
      "Header": {
        "Id": "88-ORDERID",
        "Order Number": "DX4C_O11234567890",
        "Account Id": "88-ACCOUNTID",
        "Account": "Alia Herbert"
      }
    }
  }
}
```

### Regression Checks

- Adding a simple product still uses the simple product path.
- Adding a bundled promotion uses the workflow path.
- Promotion payload contains `ProdPromId`.
- Promotion payload contains non-empty `Account Id`.
- Promotion payload contains `Price List Id`.
- Order line query returns parent-child line items.
- Existing account is reused during the same flow.

### Do Not Rules

- Do not use Data API to add only the promotion parent line.
- Do not omit account id.
- Do not omit price list id.
- Do not recreate account for each promotion.
- Do not patch order line integration objects unless all required fields are present.

## 13. Codex Development Workflow

The grammar should be developed using Codex through an iterative loop.

### Step 1: Seed Domain Requirements

Humans provide:

- Domain names.
- Business operations.
- Known working payloads.
- Known failed payloads.
- Error messages.
- Screenshots or API traces when available.
- Siebel documentation references when available.

Codex produces:

- First-draft domain grammar files.
- Operation-level templates.
- Common error catalog.

### Step 2: Generate Structured Grammar

Codex converts Markdown grammar into JSON/YAML operation files.

Example shape:

```json
{
  "domain": "order-management",
  "operation": "apply-bundled-promotion-to-order",
  "businessIntent": "Apply a bundled promotion and create/explode order lines.",
  "preferredApiType": "Workflow Process API",
  "endpoint": "/siebel/v1.0/service/Workflow Process Manager/RunProcess",
  "requiredFields": ["ProcessName", "ProdPromId", "SiebelMessage"],
  "sequencingRules": [
    "Create account before applying promotion",
    "Use ProdPromId, not Product Id"
  ]
}
```

### Step 3: Generate Codex Skill

Codex generates a skill instruction file that tells Codex:

- Read the grammar before touching Siebel code.
- Identify the business intent.
- Select the correct operation.
- Validate payloads against grammar.
- Preserve known working flows.
- Generate regression tests from the operation rules.

### Step 4: Generate Tests

Codex generates tests or validation scripts for each operation.

Examples:

- Payload shape tests.
- API routing tests.
- Mock-response transformation tests.
- Regression checks for simple product vs promotion.
- Error mapping tests.

### Step 5: Generate Implementation

Codex modifies application code only after:

- Reading the grammar.
- Identifying the intended operation.
- Validating against sequencing rules.
- Checking regression criteria.

### Step 6: Human Review

Humans review:

- Whether the API selection is correct.
- Whether required fields are complete.
- Whether sequencing matches Siebel behavior.
- Whether known regressions are covered.

## 14. Codex Skill Requirements

The skill should instruct Codex to:

- Never guess Siebel payloads when grammar exists.
- Prefer service/workflow APIs when the grammar says so.
- Treat Data API as one option, not the default.
- Read domain grammar before code changes.
- Preserve working Siebel flows.
- Generate or update tests with each integration change.
- Add a new grammar entry when an unsupported operation is discovered.
- Ask for a human decision when a required field or API type is ambiguous.

## 15. MCP Alignment

The grammar should be designed so it can later generate MCP tools.

Example:

```text
Grammar operation:
Apply Bundled Promotion To Order
```

Can become MCP tool:

```text
applyPromotionToOrder(accountId, accountName, prodPromId, priceListId, quantity)
```

The MCP server would enforce the grammar at runtime, while Codex uses the same grammar at development time.

## 16. Acceptance Criteria

The first version is complete when:

- It covers the B2C UI flows for:
  - Customer 360
  - New customer ordering.
  - Existing customer ordering.
  - Existing customer modify asset.
  - Existing customer disconnect asset.
  - Existing customer upgrade / downgrade promotion.
  - Existing customer suspend and resume services.

- The grammar avoids storing secrets or customer credentials.

## 17. Success Metrics

- Faster UI generation over Siebel APIs.
- Faster onboarding for developers and Codex users.
- Higher reuse across customer demos and implementations.
- Clear separation between domain grammar, customer configuration, and application code.


## 19. Recommended Next Step

Use Codex to generate the first domain grammar pack from the Sales Assistant app and the known Siebel API patterns captured during development.

Recommended first Codex task:

```text
Read server.mjs, src/api/siebelApi.js, SIEBEL_INTEGRATION.md, and docs/SIEBEL_API_GRAMMAR_REQUIREMENTS.md.
Generate docs/siebel-api-grammar/order-management.md and grammar/order-management.operations.json for the currently implemented contact/account/order/promotion flows.
Do not change application behavior.
```
