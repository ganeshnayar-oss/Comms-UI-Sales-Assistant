# Customer 360 Domain Grammar

The Customer 360 domain covers account profile, spotlight insights, recent orders, service requests, assets, and billing summary.

## Operations

### Retrieve Account Profile

Business intent: Show customer identity, account number, address, phone, email, and status.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- If launched after order submission, use the account created during onboarding.

### Retrieve Spotlight Metrics

Business intent: Show churn, NPS, credit rating, and CLTV.

Preferred API type: Data API or analytics service, depending on deployment.

Sequencing rules:

- Normalize percentages to numeric values for bars.
- Format CLTV as currency.
- Preserve raw values for diagnostics.

### Retrieve Recent Orders

Business intent: Show last three orders in Customer 360.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- Sort by most recent date.
- Limit foldout to three records.

### Retrieve Recent Service Requests

Business intent: Show last three service requests in Customer 360.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- Sort by most recently updated.
- Limit foldout to three records.

### Retrieve Billing Summary

Business intent: Show latest billing state and payment information.

Preferred API type: Data API or billing integration service.

Sequencing rules:

- Query by account id.
- Keep billing foldout horizontally scrollable when needed.

