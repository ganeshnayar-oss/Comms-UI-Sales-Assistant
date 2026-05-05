# Asset Management Domain Grammar

The Asset Management domain covers retrieval and presentation of installed products, subscriptions, and asset hierarchy.

## Operations

### Retrieve Customer Assets

Business intent: Show the customer's active products and subscriptions.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- Limit Customer 360 display to the last or most relevant three assets unless user opens full view.

### Retrieve Asset Details

Business intent: Open details for a selected asset.

Preferred API type: Data API.

Sequencing rules:

- Query by asset id.
- Include product name, status, start date, and recurring charge when available.

### Retrieve Asset Hierarchy

Business intent: Show parent-child relationships for bundled services.

Preferred API type: Data API.

Sequencing rules:

- Preserve root asset and parent asset ids.
- Do not flatten bundle hierarchy when presenting details.

### Retrieve Asset Service Status

Business intent: Show whether the customer service is active, pending, suspended, or disconnected.

Preferred API type: Data API.

Sequencing rules:

- Normalize statuses for UI display.
- Keep raw Siebel value available for diagnostics.

### Map Asset To Product Subscription

Business intent: Connect asset information to product/subscription context for Customer 360.

Preferred API type: Data API.

Sequencing rules:

- Use product id, integration id, or subscription id when available.
- Do not infer subscription state from display name alone.

### Modify Asset

Business intent: Change an existing customer's asset or subscription.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Retrieve current asset hierarchy first.
- Validate modification eligibility.
- Preserve account and asset identifiers.

### Upgrade Or Downgrade Promotion

Business intent: Move an existing customer from one promotion to another.

Preferred API type: Workflow Process API.

Sequencing rules:

- Retrieve current asset/promotion.
- Check eligibility for target promotion.
- Use workflow that preserves child item and pricing behavior.

### Suspend Asset

Business intent: Temporarily suspend service for an asset.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Validate asset is active.
- Capture reason and effective date when required.

### Resume Asset

Business intent: Resume a suspended asset.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Validate asset is suspended.
- Reprice or refresh service state if required.

### Cancel Asset

Business intent: Disconnect or cancel an existing asset.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Validate disconnect eligibility.
- Capture reason and effective date.
- Preserve audit trail.
