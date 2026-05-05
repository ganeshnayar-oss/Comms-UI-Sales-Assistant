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
3. If the operation requires API discovery, perform discovery first and stop for confirmation before finalizing the grammar.
4. If the operation exists, update both the Markdown domain file and the matching `grammar/*.operations.json`.
5. If the operation does not exist, add a new operation to both files.
6. Preserve the operation schema from `docs/siebel-api-grammar/grammar-schema.md`.
7. Include business intent, preferred API type, endpoint, required payload, optional payload, sequencing rules, common errors, example request, example response, regression checks, and do-not rules.
8. Mark new entries as `draft` unless the user says the API was validated.
9. Validate all edited JSON files.
10. Do not change application code unless the user explicitly asks for implementation.

## API Discovery Confirmation Gate

Use this gate whenever the endpoint, API type, workflow process, business service, required payload, or sequencing is unknown or inferred.

Discovery sources can include:

- Existing repo code such as `server.mjs`, `src/api/siebelApi.js`, and prior grammar entries.
- User-provided payloads, network traces, screenshots, or errors.
- Siebel documentation or environment discovery when the user authorizes it.
- Safe test calls against non-production environments when the user authorizes them.

After discovery, stop and present a concise confirmation summary before marking the entry `reviewed` or using it for implementation:

```text
Discovered operation:
- Business intent:
- Domain:
- Preferred API type:
- Endpoint or workflow/service:
- Required payload:
- Sequencing:
- Risks/unknowns:
- Proposed validation status:

Please confirm this is correct before I update the grammar as reviewed/validated or implement against it.
```

Rules:

- If the user confirms, update the grammar and set `humanValidationStatus` to `reviewed` unless the user says it was tested end-to-end.
- If the user says it was tested successfully, set `humanValidationStatus` to `validated`.
- If the user does not confirm, keep the entry `draft` and clearly mark unknowns with template placeholders.
- Do not silently convert a discovered guess into a validated grammar rule.
- Do not implement app code against a newly discovered API until the user confirms the discovered mapping or explicitly accepts a `draft` implementation.

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
