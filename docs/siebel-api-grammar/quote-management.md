# Quote Management Domain Grammar

The Quote Management domain covers quote creation, quote line management, quote-to-order conversion, and quote retrieval.

## Operations

### Create Quote

Business intent: Create a quote for a customer before order submission when the process requires quote capture.

Preferred API type: Service API or Data API.

Sequencing rules:

- Requires account context when available.
- Set price list before adding lines.

### Add Simple Product To Quote

Business intent: Add a non-promotion product to a quote.

Preferred API type: Data API or Service API.

Sequencing rules:

- Use only for non-promotion products.
- Use promotion workflow for bundled promotions if quote process requires explosion.

### Apply Promotion To Quote

Business intent: Apply a bundled promotion to a quote.

Preferred API type: Workflow Process API.

Sequencing rules:

- Use quote-specific promotion workflow, not order-specific workflow.
- Pass ProdPromId, account id, and price list id.

### Convert Quote To Order

Business intent: Convert accepted quote into sales order.

Preferred API type: Workflow Process API or Service API.

Sequencing rules:

- Quote must be valid and priced.
- Preserve account, contact, billing, service, and line hierarchy.

### Retrieve Quotes For Account

Business intent: Show quote history or active quotes for an account.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- Limit Customer 360 foldouts when used in summary UI.
