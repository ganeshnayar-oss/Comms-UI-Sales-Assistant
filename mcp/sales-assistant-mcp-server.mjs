#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_RUNTIME_BASE_URL = "http://127.0.0.1:4173";
const runtimeBaseUrl = process.env.SALES_ASSISTANT_RUNTIME_URL || DEFAULT_RUNTIME_BASE_URL;

const server = new McpServer({
  name: "comms-sales-assistant",
  version: "0.1.0",
});

const optionalString = z.string().trim().optional();
const optionalNumber = z.number().optional();
const optionalBoolean = z.boolean().optional();
const jsonObject = z.record(z.unknown()).optional();

function appendQuery(url, query = {}) {
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
}

function buildRuntimeUrl(path, query) {
  const url = new URL(path, runtimeBaseUrl);
  appendQuery(url, query);
  return url;
}

function parseJsonPayload(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function runtimeJson(path, { method = "GET", query, body } = {}) {
  const url = buildRuntimeUrl(path, query);
  const headers = {};
  const request = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(body);
  }

  const response = await fetch(url, request);
  const text = await response.text();
  const payload = parseJsonPayload(text);

  if (!response.ok) {
    const detail = typeof payload === "object" && payload ? payload.detail || payload.error : payload;
    throw new Error(`Runtime request failed (${response.status}) ${url.pathname}: ${detail || response.statusText}`);
  }

  return payload;
}

function asJsonContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function asErrorContent(error) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

function registerRuntimeTool(name, config, handler) {
  server.registerTool(name, config, async (args) => {
    try {
      const result = await handler(args);
      return asJsonContent(result);
    } catch (error) {
      return asErrorContent(error);
    }
  });
}

function normalizeCatalogRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function productMatchesQuery(product, query) {
  if (!query) return true;

  const haystack = [
    product.name,
    product.productName,
    product.displayName,
    product.description,
    product.category,
    product.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

registerRuntimeTool(
  "get_siebel_health",
  {
    title: "Get Siebel Runtime Health",
    description: "Checks whether the sales assistant runtime can reach the configured Siebel environment.",
    inputSchema: {},
  },
  () => runtimeJson("/api/siebel/health"),
);

registerRuntimeTool(
  "parse_intake",
  {
    title: "Parse Prospect Intake",
    description:
      "Turns natural-language prospect intake into structured contact, address, need, and recommendation signals using the configured LLM or deterministic parser.",
    inputSchema: {
      prompt: z.string().min(1),
    },
  },
  ({ prompt }) => runtimeJson("/api/intake/parse", { method: "POST", body: { prompt } }),
);

registerRuntimeTool(
  "parse_workflow_action",
  {
    title: "Parse Workflow Action",
    description:
      "Interprets the agent's natural-language action in the sales workflow, such as copying owner account to billing and service or using a payment method.",
    inputSchema: {
      prompt: z.string().min(1),
      context: jsonObject,
    },
  },
  ({ prompt, context = {} }) =>
    runtimeJson("/api/workflow/parse-action", { method: "POST", body: { prompt, context } }),
);

registerRuntimeTool(
  "get_catalog_hierarchy",
  {
    title: "Get Catalog Hierarchy",
    description: "Loads the catalog category hierarchy and nested products from the configured runtime catalog.",
    inputSchema: {
      catalogName: optionalString,
      priceListName: optionalString,
    },
  },
  ({ catalogName, priceListName }) =>
    runtimeJson("/api/siebel/catalog-hierarchy", { query: { catalogName, priceListName } }),
);

registerRuntimeTool(
  "search_catalog_products",
  {
    title: "Search Catalog Products",
    description:
      "Searches products and promotions in the configured catalog. The runtime controls the real Siebel catalog and price list lookup.",
    inputSchema: {
      catalogName: optionalString,
      priceListName: optionalString,
      query: optionalString,
    },
  },
  async ({ catalogName, priceListName, query }) => {
    const payload = await runtimeJson("/api/siebel/catalog-products", { query: { catalogName, priceListName } });
    const rows = normalizeCatalogRows(payload).filter((product) => productMatchesQuery(product, query));
    return Array.isArray(payload) ? rows : { ...payload, products: rows };
  },
);

registerRuntimeTool(
  "create_contact",
  {
    title: "Create Contact",
    description: "Creates a Siebel contact from structured intake fields.",
    inputSchema: {
      firstName: optionalString,
      lastName: optionalString,
      name: optionalString,
      email: optionalString,
      workPhone: optionalString,
      mobilePhone: optionalString,
      address: optionalString,
      city: optionalString,
      state: optionalString,
      postalCode: optionalString,
      country: optionalString,
    },
  },
  (payload) => runtimeJson("/api/siebel/contacts", { method: "POST", body: payload }),
);

registerRuntimeTool(
  "create_account",
  {
    title: "Create Account",
    description:
      "Creates a Siebel account using the runtime's preferred customer-party/service API behavior and account defaults.",
    inputSchema: {
      name: z.string().min(1),
      type: optionalString,
      primaryContactId: optionalString,
      mainPhone: optionalString,
      mainEmail: optionalString,
      address: optionalString,
      city: optionalString,
      state: optionalString,
      postalCode: optionalString,
      country: optionalString,
      priceListId: optionalString,
      priceListName: optionalString,
    },
  },
  (payload) => runtimeJson("/api/siebel/accounts", { method: "POST", body: payload }),
);

registerRuntimeTool(
  "update_account",
  {
    title: "Update Account",
    description: "Updates an existing Siebel account through the runtime API.",
    inputSchema: {
      accountId: z.string().min(1),
      payload: z.record(z.unknown()),
    },
  },
  ({ accountId, payload }) =>
    runtimeJson(`/api/siebel/accounts/${encodeURIComponent(accountId)}`, { method: "PATCH", body: payload }),
);

registerRuntimeTool(
  "create_account_activity",
  {
    title: "Create Account Activity",
    description: "Adds a summarized activity to a Siebel account, such as the final ordering summary.",
    inputSchema: {
      accountId: z.string().min(1),
      type: optionalString,
      description: optionalString,
      summaryText: optionalString,
      dueDate: optionalString,
      status: optionalString,
    },
  },
  ({ accountId, ...payload }) =>
    runtimeJson(`/api/siebel/accounts/${encodeURIComponent(accountId)}/actions`, { method: "POST", body: payload }),
);

registerRuntimeTool(
  "create_order",
  {
    title: "Create Sales Order",
    description:
      "Creates a Siebel sales order through the runtime API. For bundled promotions, prefer apply_promotion_to_order because the workflow can create the order with exploded child lines.",
    inputSchema: {
      accountId: optionalString,
      accountName: optionalString,
      orderNumber: optionalString,
      orderTypeCode: optionalString,
      currencyCode: optionalString,
      status: optionalString,
      priceListId: optionalString,
      priceListName: optionalString,
    },
  },
  (payload) => runtimeJson("/api/siebel/orders", { method: "POST", body: payload }),
);

registerRuntimeTool(
  "update_order",
  {
    title: "Update Sales Order",
    description: "Updates order-level fields such as owner, billing, service, or payment-related account references.",
    inputSchema: {
      orderId: z.string().min(1),
      payload: z.record(z.unknown()),
    },
  },
  ({ orderId, payload }) =>
    runtimeJson(`/api/siebel/orders/${encodeURIComponent(orderId)}`, { method: "PATCH", body: payload }),
);

registerRuntimeTool(
  "add_simple_product_to_order",
  {
    title: "Add Simple Product To Order",
    description:
      "Adds a non-promotion product to an existing sales order. Do not use this for bundled promotions because child lines would be lost.",
    inputSchema: {
      orderId: z.string().min(1),
      productId: z.string().min(1),
      name: optionalString,
      quantity: optionalNumber,
      priceListId: optionalString,
      priceListName: optionalString,
      currencyCode: optionalString,
    },
  },
  ({ orderId, ...payload }) =>
    runtimeJson(`/api/siebel/orders/${encodeURIComponent(orderId)}/items`, { method: "POST", body: payload }),
);

registerRuntimeTool(
  "apply_promotion_to_order",
  {
    title: "Apply Promotion To Order",
    description:
      "Applies a bundled promotion through the Siebel promotion workflow. Pass ProdPromId/promotionId, account, order, and price list context so child line items are created correctly.",
    inputSchema: {
      orderId: optionalString,
      prodPromId: z.string().min(1),
      promotionName: optionalString,
      accountId: z.string().min(1),
      accountName: z.string().min(1),
      orderNumber: optionalString,
      priceListId: z.string().min(1),
      priceListName: optionalString,
      quantity: optionalNumber,
      sync: optionalBoolean,
      eligibilityMode: optionalString,
      pricingMode: optionalString,
    },
  },
  ({ orderId = "new", prodPromId, sync, eligibilityMode, pricingMode, ...payload }) =>
    runtimeJson(`/api/siebel/orders/${encodeURIComponent(orderId)}/promotions`, {
      method: "POST",
      body: {
        ...payload,
        prodPromId,
        promotionId: prodPromId,
        sync: sync === false ? "N" : "Y",
        eligibilityMode: eligibilityMode || "1",
        pricingMode: pricingMode || "Y",
      },
    }),
);

registerRuntimeTool(
  "add_payment_to_order",
  {
    title: "Add Payment To Order",
    description:
      "Adds or updates payment details on the order. Use masked or tokenized card data where possible; do not send raw card details to LLM parsing tools.",
    inputSchema: {
      orderId: z.string().min(1),
      paymentMethod: optionalString,
      paymentType: optionalString,
      cardType: optionalString,
      cardholderName: optionalString,
      maskedCardNumber: optionalString,
      paymentProfileName: optionalString,
      expirationMonth: optionalString,
      expirationYear: optionalString,
      billingAccountId: optionalString,
    },
  },
  ({ orderId, ...payload }) =>
    runtimeJson(`/api/siebel/orders/${encodeURIComponent(orderId)}/payments`, { method: "POST", body: payload }),
);

registerRuntimeTool(
  "get_customer360",
  {
    title: "Get Customer 360",
    description: "Loads account, recent orders, assets, and service requests for the Customer 360 experience.",
    inputSchema: {
      accountId: z.string().min(1),
    },
  },
  async ({ accountId }) => {
    const query = { accountId };
    const [account, recentOrders, assets, serviceRequests] = await Promise.all([
      runtimeJson("/api/siebel/account", { query }),
      runtimeJson("/api/siebel/orders/recent", { query }),
      runtimeJson("/api/siebel/assets", { query }),
      runtimeJson("/api/siebel/service-requests", { query }),
    ]);

    return {
      account,
      recentOrders,
      assets,
      serviceRequests,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
