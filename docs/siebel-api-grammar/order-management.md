# Order Management Domain Grammar

The Order Management domain covers sales order creation, product add, promotion apply, account assignment, payment, order submission, and order line hierarchy.

## Operations

### Create Sales Order

Business intent: Create a sales order for simple product ordering when promotion workflow is not responsible for order creation.

Preferred API type: Service API or Data API based on customer environment.

Sequencing rules:

- Use this for simple product flows, not for bundled promotion workflow creation.
- Set price list before adding items.
- Associate account when account already exists.
- Do not pass contact fields unless grammar for the target environment requires them.

### Add Simple Product To Order

Business intent: Add a non-promotion product to an existing order.

Preferred API type: Data API or Service API.

Sequencing rules:

- Create order first if missing.
- Set price list before adding product.
- Use product id for simple product line.
- Do not use this path for bundled promotion.

### Apply Bundled Promotion To Order

Business intent: Apply a bundled promotion and let Siebel create/explode order lines.

Preferred API type: Workflow Process API.

Endpoint:

```text
POST /siebel/v1.0/service/Workflow Process Manager/RunProcess
```

Workflow process:

```text
ISS Promotion WS - ApplyProductPromotion - Order
```

Sequencing rules:

- Create or identify account before apply promotion.
- Pass `ProdPromId`, not Product Id.
- Pass non-empty account id and account name.
- Pass order number and price list id.
- Use `Sync = Y`.
- Re-query order lines after workflow completes.

### Assign Owner Account To Order

Business intent: Associate owner account with an order.

Preferred API type: Data API or Service API based on validated endpoint.

Sequencing rules:

- Use account id and account name.
- Do not assign billing/service account fields during owner account step.
- Preserve existing line items.

### Assign Billing And Service Accounts

Business intent: Set billing and service account context once the flow reaches the billing/service step.

Preferred API type: Service API or validated Data API.

Sequencing rules:

- Only run after owner account exists.
- Set billing and service account on order header.
- Set billing and service account on line items only through a safe operation that does not require missing integration component fields.

### Add Payment Details To Order

Business intent: Store payment details against the order.

Preferred API type: Data API or Service API.

Sequencing rules:

- Payment belongs on the order, not account.
- Do not send sensitive card details to LLM parsing.
- Mask stored/displayed card numbers.

### Submit Order

Business intent: Submit or place the order after validation.

Preferred API type: Service API or Workflow Process API.

Sequencing rules:

- Verify account, product, billing/service, address, payment, and summary steps are complete.
- Create account activity summary if grammar says account activity is required.

### Retrieve Order List For Account

Business intent: Retrieve orders associated with an account.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- Sort by order date or last updated date.
- Limit result count for Customer 360 foldouts.

### Retrieve Order Lines With Hierarchy

Business intent: Render cart line items with parent-child hierarchy.

Preferred API type: Data API.

Sequencing rules:

- Query order line items by order id or order number.
- Preserve parent/root line item ids.
- UI should support expand/collapse of parent rows.
