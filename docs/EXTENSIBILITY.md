# Extensibility Model

This application is structured so customer deployments can stay on one shared core codebase while customer-specific behavior is layered in through configuration.

## Current extension points

The shared configuration registry lives in [src/extensions/customerConfig.js](/Users/GNAYAR/Documents/New%20project/src/extensions/customerConfig.js).

Each customer package can define:

- `brand.workflowTitle`
- `brand.assistantLabel`
- `defaults.catalogName`
- `defaults.priceListName`
- `defaults.intakePrompt`
- `defaults.intakePlaceholder`
- `recommendations.rules`

## Recommendation rules

Recommendation rules are matched against the intake text and can bias the scorer toward categories or products.

Example rule shape:

```js
{
  id: "student-mobile-unlimited",
  matchAll: ["student"],
  matchAny: ["mobile", "mobile plan"],
  preferCategory: "Mobile Plans",
  preferProducts: ["Supremo Mobile Unlimited"],
  score: 220,
  reason: "Student mobile requests should prioritize Supremo Mobile Unlimited in Mobile Plans.",
}
```

## Adding a new customer package

1. Add a new config entry to `CUSTOMER_CONFIGS`.
2. Set `VITE_CUSTOMER_CONFIG` and `CUSTOMER_CONFIG` for that deployment.
3. Keep customer-specific logic in the config entry first.
4. Add new code-level extension hooks only when configuration is not enough.

## Deployment guidance

Prefer this model:

- one shared core repo
- one deployment-specific customer config key
- environment-specific secrets outside the bundle

That lets you upgrade core features once and roll them out across customers with lower regression risk.
