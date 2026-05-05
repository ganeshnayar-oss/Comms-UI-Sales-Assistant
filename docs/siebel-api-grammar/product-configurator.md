# Product Configurator Domain Grammar

The Product Configurator domain covers configurable products, promotion components, eligibility, cardinality, and configuration validation.

## Operations

### Start Product Configuration Session

Business intent: Open or initialize configuration for a selected product or promotion.

Preferred API type: Service API or Workflow Process API.

Sequencing rules:

- Identify whether the selected product is configurable.
- Carry account, price list, and order context when available.
- Do not configure a promotion by adding only the parent item.

### Retrieve Configurable Components

Business intent: Retrieve child components, choices, default selections, and cardinality rules.

Preferred API type: Service API.

Sequencing rules:

- Use product or promotion id from catalog.
- Preserve component hierarchy.
- Keep min/max cardinality with each relationship.

### Validate Product Configuration

Business intent: Validate selected components before add-to-order or submit.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Run validation before pricing or order submit when configuration changed.
- Return user-actionable validation errors to the UI.

### Apply Configuration To Order

Business intent: Persist a validated configuration to an order.

Preferred API type: Service API or Workflow Process API.

Sequencing rules:

- Requires order context.
- Requires selected component hierarchy.
- Re-query line items after apply to verify parent-child structure.

### Reset Product Configuration

Business intent: Discard user-selected component changes and return to defaults.

Preferred API type: UI/local action plus Service API when server session exists.

Sequencing rules:

- Do not mutate order lines unless the configuration was already applied.

