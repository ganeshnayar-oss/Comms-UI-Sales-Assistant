# Catalog Domain Grammar

The Catalog domain covers product discovery, category browsing, product search, price list resolution, and product classification.

## Operations

### Browse Catalog Hierarchy

Business intent: Show the agent a navigable hierarchy of catalog categories and products.

Preferred API type: Data API or Service API, depending on the Siebel catalog exposure available in the customer environment.

Endpoint: Environment-specific catalog/category endpoint configured in `config/siebel.config.json`.

Sequencing rules:

- Resolve catalog name first.
- Resolve price list before showing priced products.
- Preserve category-product hierarchy for browse mode.
- Do not flatten browse results into a search-only list.

### Search Products By Name

Business intent: Let the agent search by product name inside the active catalog.

Preferred API type: Data API.

Sequencing rules:

- Query active catalog context.
- Apply price list context when available.
- Search product name and optionally description.
- Keep search and browse as separate UI tabs.

### Retrieve Products By Category

Business intent: When a user selects a category chip such as Mobile Plans, show products underneath that category.

Preferred API type: Data API.

Sequencing rules:

- Category selection should filter products.
- Product cards must retain product type and promotion indicators.

### Identify Promotion Versus Simple Product

Business intent: Decide whether add-to-cart should use simple product add or promotion workflow.

Preferred API type: Data API.

Sequencing rules:

- If product type is promotion or bundled promotion, route to Order Management `apply-bundled-promotion-to-order`.
- If product type is not promotion, route to Order Management `add-simple-product-to-order`.
- Do not add a promotion as a simple parent-only line item.

### Resolve Price List

Business intent: Resolve default or user-selected price list into the price list id required by order and pricing APIs.

Preferred API type: Data API.

Sequencing rules:

- Default price list can come from customer config.
- Store both price list name and id.
- Pass price list id into order and promotion operations before pricing.

