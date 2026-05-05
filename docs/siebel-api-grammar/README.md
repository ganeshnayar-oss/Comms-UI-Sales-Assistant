# Siebel API Domain Grammar

This folder contains the first reusable Siebel API grammar pack for Codex-assisted UI development over Siebel APIs.

The grammar maps business intent to the right Siebel integration pattern:

- Data API
- Service API
- Workflow Process API

The goal is to help Codex and other agentic platforms generate Siebel-backed UIs without guessing endpoints, payloads, or sequencing rules.

## How To Use

When changing Siebel integration code:

1. Identify the business intent.
2. Open the matching domain grammar file.
3. Select the operation that best matches the intent.
4. Follow the preferred API type, endpoint, payload, sequencing rules, and regression checks.
5. If no operation exists, add one before implementing code.

## Domain Files

- `catalog.md`
- `customer-management.md`
- `order-management.md`
- `product-configurator.md`
- `pricing.md`
- `quote-management.md`
- `asset-management.md`
- `customer-360.md`
- `service-requests.md`
- `common-errors.md`
- `grammar-schema.md`

## Machine-Readable Grammar

Machine-readable operation files live under:

```text
grammar/
```

Each domain has a JSON file:

```text
grammar/catalog.operations.json
grammar/customer-management.operations.json
grammar/order-management.operations.json
grammar/product-configurator.operations.json
grammar/pricing.operations.json
grammar/quote-management.operations.json
grammar/asset-management.operations.json
grammar/customer-360.operations.json
grammar/service-requests.operations.json
```

The JSON files are intended for tool generation, validation scripts, MCP tool scaffolding, and Codex-assisted implementation.

## Human Validation Levels

Each operation should carry one of these validation states:

- `draft`: Initial Codex-generated entry, not validated by a Siebel expert.
- `reviewed`: Reviewed by a human but not tested end-to-end.
- `validated`: Tested against a real Siebel environment.
- `deprecated`: No longer recommended.

## Rule

Do not treat the grammar as static documentation. Treat it as a living implementation asset that Codex updates as new Siebel API behavior is discovered.
