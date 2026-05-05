async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

function buildAccountScopedQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.accountId) {
    params.set("accountId", filters.accountId);
  }
  return params.toString();
}

export function getSiebelAccountData(filters = {}) {
  const query = buildAccountScopedQuery(filters);
  return getJson(`/api/siebel/account${query ? `?${query}` : ""}`);
}

export function getSiebelServiceSummary(filters = {}) {
  const query = buildAccountScopedQuery(filters);
  return getJson(`/api/siebel/service-requests/summary${query ? `?${query}` : ""}`);
}

export function getSiebelServicePreview(filters = {}) {
  const query = buildAccountScopedQuery(filters);
  return getJson(`/api/siebel/service-requests/preview${query ? `?${query}` : ""}`);
}

export function getSiebelServiceRequests(filters = {}) {
  const params = new URLSearchParams(buildAccountScopedQuery(filters));
  if (filters.status && filters.status !== "All") {
    params.set("status", filters.status);
  }

  const query = params.toString();
  return getJson(`/api/siebel/service-requests${query ? `?${query}` : ""}`);
}

export function getSiebelAssets(filters = {}) {
  const query = buildAccountScopedQuery(filters);
  return getJson(`/api/siebel/assets${query ? `?${query}` : ""}`);
}

export function getSiebelRecentOrders(filters = {}) {
  const query = buildAccountScopedQuery(filters);
  return getJson(`/api/siebel/orders/recent${query ? `?${query}` : ""}`);
}

export function getSiebelCatalogs() {
  return getJson("/api/siebel/catalogs");
}

export function getSiebelPriceLists() {
  return getJson("/api/siebel/price-lists");
}

export function getSiebelCatalogProducts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.catalogName) {
    params.set("catalogName", filters.catalogName);
  }
  if (filters.priceListName) {
    params.set("priceListName", filters.priceListName);
  }

  const query = params.toString();
  return getJson(`/api/siebel/catalog-products${query ? `?${query}` : ""}`);
}

export function getSiebelCatalogHierarchy(filters = {}) {
  const params = new URLSearchParams();
  if (filters.catalogName) {
    params.set("catalogName", filters.catalogName);
  }
  if (filters.priceListName) {
    params.set("priceListName", filters.priceListName);
  }

  const query = params.toString();
  return getJson(`/api/siebel/catalog-hierarchy${query ? `?${query}` : ""}`);
}

export function parseIntakePrompt(prompt) {
  return getJson("/api/intake/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
}

export function parseWorkflowAction(prompt, context = {}) {
  return getJson("/api/workflow/parse-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, context }),
  });
}

export function createSiebelContact(payload) {
  return getJson("/api/siebel/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createSiebelAccount(payload) {
  return getJson("/api/siebel/accounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateSiebelAccount(accountId, payload) {
  return getJson(`/api/siebel/accounts/${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createSiebelAccountAction(accountId, payload) {
  return getJson(`/api/siebel/accounts/${encodeURIComponent(accountId)}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createSiebelOrderPayment(orderId, payload) {
  return getJson(`/api/siebel/orders/${encodeURIComponent(orderId)}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createSiebelOrder(payload) {
  return getJson("/api/siebel/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateSiebelOrder(orderId, payload) {
  return getJson(`/api/siebel/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function addSiebelOrderItem(orderId, payload) {
  return getJson(`/api/siebel/orders/${encodeURIComponent(orderId)}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function applySiebelPromotion(orderId, payload) {
  return getJson(`/api/siebel/orders/${encodeURIComponent(orderId)}/promotions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
