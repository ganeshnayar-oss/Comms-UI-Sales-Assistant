# Pricing Domain Grammar

The Pricing domain covers price list resolution, product pricing, order pricing, promotion pricing, and price refresh.

## Operations

### Resolve Price List

Business intent: Resolve price list name into price list id.

Preferred API type: Data API.

Sequencing rules:

- Resolve before order creation, simple item add, or promotion apply.
- Store both display name and id.

### Price Product

Business intent: Retrieve price for a product in catalog context.

Preferred API type: Service API or Data API.

Sequencing rules:

- Requires price list id.
- Respect product price type when displaying one-time versus recurring values.
- Use Net Price where Siebel returns net price rather than one-time/recurring fields.

### Price Promotion

Business intent: Price a promotion including child components.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Use promotion workflow when pricing is part of apply promotion.
- Do not price only the parent promotion line.

### Price Order

Business intent: Reprice an order after line item, account, or configuration changes.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Requires order id or order number.
- Requires price list id.
- Re-query order totals and line items after pricing.

### Refresh Line Item Pricing

Business intent: Refresh pricing for existing order lines.

Preferred API type: Service API or Workflow Process API.

Sequencing rules:

- Avoid direct line-item patches that omit required fields.
- Prefer pricing services/workflows that understand order context.

