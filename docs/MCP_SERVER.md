# Sales Assistant MCP Server

This project includes an MCP server that exposes the Comms Sales Assistant runtime as AI-agent tools. The MCP server is intentionally a thin interface over the existing local runtime APIs so Siebel payload construction, service API usage, workflow execution, and regression-sensitive ordering logic stay in one place.

## Why It Exists

The React app is the human-facing experience. The MCP server is the agent-facing interface. An AI agent can use these tools to help the contact center rep interpret natural language, search the catalog, create contacts and accounts, add products or promotions, update orders, add payment, and load Customer 360 data without calling Siebel directly.

The chat window calls the runtime endpoint below:

```text
POST /api/agent/order-assistant
```

That endpoint creates an MCP client, calls the MCP tools needed for the user's instruction, returns the selected workflow action to the browser, and then the existing canvas workflow executes the action. If the agent endpoint is unavailable, the app falls back to the earlier workflow parser and then to deterministic handling.

## Start The Runtime

Start the application runtime first:

```bash
npm run start:runtime
```

By default, the runtime listens on:

```text
http://127.0.0.1:4173
```

## Start The MCP Server

In a second terminal, start the MCP server:

```bash
npm run start:mcp
```

The MCP server uses stdio transport, so it will appear to wait for input. That is expected. MCP clients launch it and communicate with it over stdin/stdout.

## Runtime URL Configuration

If the runtime is not on the default port, set `SALES_ASSISTANT_RUNTIME_URL`:

```bash
SALES_ASSISTANT_RUNTIME_URL=http://127.0.0.1:4173 npm run start:mcp
```

## MCP Client Configuration

Use this command when configuring an MCP-capable agent client:

```json
{
  "mcpServers": {
    "comms-sales-assistant": {
      "command": "/usr/local/bin/node",
      "args": ["mcp/sales-assistant-mcp-server.mjs"],
      "cwd": "/Users/GNAYAR/Documents/New project",
      "env": {
        "SALES_ASSISTANT_RUNTIME_URL": "http://127.0.0.1:4173"
      }
    }
  }
}
```

## Tools

The server exposes these tools:

| Tool | Purpose |
| --- | --- |
| `get_siebel_health` | Checks runtime and Siebel connectivity. |
| `parse_intake` | Parses natural-language prospect intake into structured contact and buying signals. |
| `parse_workflow_action` | Parses natural-language workflow actions such as account, billing, service, and payment instructions. |
| `get_catalog_hierarchy` | Loads catalog categories and nested products. |
| `search_catalog_products` | Searches catalog products and promotions by text. |
| `create_contact` | Creates a Siebel contact through the runtime API. |
| `create_account` | Creates a Siebel account through the runtime API. |
| `update_account` | Updates account fields through the runtime API. |
| `create_account_activity` | Adds an activity or summary to the account. |
| `create_order` | Creates a sales order for non-promotion flows. |
| `update_order` | Updates order owner, billing, service, and related account fields. |
| `add_simple_product_to_order` | Adds a non-promotion product line to an order. |
| `apply_promotion_to_order` | Applies a bundled promotion through the Siebel promotion workflow. |
| `add_payment_to_order` | Adds or updates order payment details. |
| `get_customer360` | Loads account, recent orders, assets, and service requests. |

## Ordering Rules

Use `apply_promotion_to_order` for bundled promotions. Do not use `add_simple_product_to_order` for promotions because promotion child line items must come from the Siebel workflow.

Use `add_simple_product_to_order` only when the selected catalog item is not a promotion.

Keep raw card details out of general LLM parsing tools. Use `add_payment_to_order` with masked or tokenized payment fields where possible.

## Validation

Validate syntax without starting the long-running stdio process:

```bash
/usr/local/bin/node --check mcp/sales-assistant-mcp-server.mjs
```

Validate the React build:

```bash
npm run build
```
