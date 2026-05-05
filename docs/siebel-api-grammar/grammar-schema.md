# Grammar Schema

Every operation entry should follow this structure.

## Required Fields

```json
{
  "id": "order-management.apply-bundled-promotion-to-order",
  "domain": "order-management",
  "operationName": "Apply Bundled Promotion To Order",
  "businessIntent": "Apply a bundled promotion and create/explode order lines.",
  "preferredApiType": "Workflow Process API",
  "endpoint": {
    "method": "POST",
    "path": "/siebel/v1.0/service/Workflow Process Manager/RunProcess"
  },
  "requiredPayload": {},
  "optionalPayload": {},
  "inputIdentifiers": [],
  "outputIdentifiers": [],
  "sequencingRules": [],
  "preconditions": [],
  "postconditions": [],
  "commonErrors": [],
  "exampleRequest": {},
  "exampleResponse": {},
  "regressionChecks": [],
  "doNotRules": [],
  "relatedOperations": [],
  "humanValidationStatus": "draft"
}
```

## API Type Values

Use one of:

- `Data API`
- `Service API`
- `Workflow Process API`
- `Hybrid`

## Endpoint Rules

For Data API operations:

```json
{
  "method": "GET",
  "path": "/siebel/v1.0/data/Account/Account"
}
```

For Service API operations:

```json
{
  "method": "POST",
  "path": "/siebel/v1.0/service/SWI Customer Party Service/Insert"
}
```

For Workflow Process API operations:

```json
{
  "method": "POST",
  "path": "/siebel/v1.0/service/Workflow Process Manager/RunProcess",
  "processName": "ISS Promotion WS - ApplyProductPromotion - Order"
}
```

## Payload Rules

- Required payload must contain the minimum fields needed for a successful call.
- Optional payload should contain fields that can be added safely without changing operation semantics.
- Use template variables wrapped in `{{ }}`.
- Never include credentials, tokens, cookies, or real customer secrets.

## Regression Rule

Every operation must include at least one regression check. If a code change touches an operation, Codex should update or run the associated checks.

