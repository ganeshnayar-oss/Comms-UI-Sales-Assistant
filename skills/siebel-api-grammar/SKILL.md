---
name: siebel-api-grammar
description: Use when creating, updating, validating, or applying the reusable Siebel API domain grammar for agentic UI development. Trigger this skill when the user asks in natural language to add or revise Siebel API grammar entries, map a Siebel business intent to Data API, Service API, or Workflow Process API, generate tests from grammar, or prevent regressions in Siebel-backed UI flows.
---

# Siebel API Grammar

Use this skill to update the repo's reusable Siebel API grammar from natural language requests.

## Source Of Truth

Read these files before editing grammar:

- `docs/SIEBEL_API_GRAMMAR_REQUIREMENTS.md`
- `docs/siebel-api-grammar/grammar-schema.md`
- Matching domain file under `docs/siebel-api-grammar/`
- Matching JSON file under `grammar/`

## Supported Domains

- `catalog`
- `customer-management`
- `order-management`
- `product-configurator`
- `pricing`
- `quote-management`
- `asset-management`
- `customer-360`
- `service-requests`

## Workflow

1. Interpret the user's natural-language request as a Siebel business intent.
2. Pick the closest domain and operation.
3. If the operation exists, update both the Markdown domain file and the matching `grammar/*.operations.json`.
4. If the operation does not exist, add a new operation to both files.
5. Preserve the operation schema from `docs/siebel-api-grammar/grammar-schema.md`.
6. Include business intent, preferred API type, endpoint, required payload, optional payload, sequencing rules, common errors, example request, example response, regression checks, and do-not rules.
7. Mark new entries as `draft` unless the user says the API was validated.
8. Validate all edited JSON files.
9. Do not change application code unless the user explicitly asks for implementation.

## API Selection Rules

- Use Data API for simple query or CRUD when no Siebel business orchestration is needed.
- Use Service API when a Siebel business service encapsulates related object handling or business rules.
- Use Workflow Process API when the operation needs orchestration, pricing, eligibility, promotion explosion, validation, or order process behavior.
- If product type is promotion or bundled promotion, route add-to-cart behavior to `order-management.apply-bundled-promotion-to-order`.
- If product type is not promotion, route add-to-cart behavior to `order-management.add-simple-product-to-order`.

## Regression Discipline

When updating an operation, preserve working flows. Add or update regression checks when the user's request mentions:

- contact/account creation
- promotion apply
- pricing
- quote management
- product configuration
- simple product add
- asset modify/upgrade/downgrade/suspend/resume/cancel
- order/account association
- billing or service account assignment
- payment
- Customer 360
- catalog search/browse

## Safety Rules

- Never include credentials, passwords, bearer tokens, session cookies, or real customer secrets.
- Use template variables such as `{{accountId}}`.
- Do not invent a validated endpoint if the endpoint is unknown. Use a placeholder like `{{orderAccountAssignmentEndpoint}}` and mark status as `draft`.
- Do not replace a Service API or Workflow Process API with Data API just because it is simpler.
- If the user provides a working payload, preserve exact field names unless there is a clear reason to normalize.

## Natural-Language Update Examples

User:

```text
Add a grammar entry for applying a promotion to an order. It must use ProdPromId and Price List Id.
```

Action:

- Update `docs/siebel-api-grammar/order-management.md`.
- Update `grammar/order-management.operations.json`.
- Ensure operation uses Workflow Process API.
- Add regression checks for `ProdPromId`, account id, and price list id.

User:

```text
Service request note fails when description is over 100 characters.
```

Action:

- Update `docs/siebel-api-grammar/service-requests.md`.
- Update `grammar/service-requests.operations.json`.
- Add common error and sequencing rule for field-length truncation or long-text mapping.
