function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  if (value.items && typeof value.items === "object") {
    return [value.items];
  }

  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

function getNested(record, path) {
  return path.split(".").reduce((value, key) => (value && value[key] != null ? value[key] : undefined), record);
}

function pickFirst(record, paths, fallback = "") {
  for (const path of paths) {
    const value = getNested(record, path);
    if (value != null && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (!value) return "Open";
  if (value.includes("pend")) return "Pending";
  if (value.includes("clos") || value.includes("complete")) return "Closed";
  if (value.includes("suspend")) return "Suspended";
  if (value.includes("active")) return "Active";
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTone(status) {
  const value = normalizeStatus(status).toLowerCase();
  if (value === "pending") return "warning";
  if (value === "closed" || value === "completed") return "success";
  if (value === "active") return "success";
  if (value === "suspended") return "warning";
  return "info";
}

function normalizeCurrency(value, fallback = "") {
  if (value == null || value === "") {
    return fallback;
  }

  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function parsePercentValue(value) {
  const numeric = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, numeric));
}

function parseCurrencyAmount(value) {
  const numeric = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function resolveCltvStrength(amount) {
  if (amount >= 20000) return 5;
  if (amount >= 15000) return 4;
  if (amount >= 10000) return 3;
  if (amount >= 5000) return 2;
  if (amount > 0) return 1;
  return 0;
}

function buildSpotlightMetric(kind, label, value) {
  if (kind === "bar") {
    return {
      kind,
      label,
      value,
      score: parsePercentValue(value),
    };
  }

  const amount = parseCurrencyAmount(value);
  return {
    kind,
    label,
    value,
    amount,
    strength: resolveCltvStrength(amount),
  };
}

function defaultAccountResponse() {
  return {
    accountMeta: [
      { label: "Account number", value: "1-J6L5" },
      { label: "Address", value: "123 Main Street, Springfield, IL 62701" },
      { label: "Email", value: "james.kelly@email.com" },
      { label: "Phone", value: "(412) 312-4031" },
    ],
    customer: {
      name: "James Kelly",
      status: "Active",
    },
    spotlightStats: [
      buildSpotlightMetric("bar", "Churn", "30%"),
      buildSpotlightMetric("bar", "Credit Rating", "85%"),
      buildSpotlightMetric("bar", "NPS", "85%"),
      buildSpotlightMetric("currency_meter", "CLTV", "$15,000"),
    ],
    recommendations: [
      {
        title: "Supremo 5G essentials",
        body: "Enhance your connectivity with fast and reliable 5G performance.",
        price: "Your price $50.00",
      },
      {
        title: "Supremo home monitoring",
        body: "Keep your home secure with smart, real-time monitoring solutions.",
        price: "Your price $50.00",
      },
    ],
  };
}

export function transformSiebelAccountResponse(payload) {
  const rows = toArray(payload);
  const first = rows[0] || payload || {};
  const name = pickFirst(first, ["Name", "AccountName", "Account Name", "PrimaryContactName"], "James Kelly");
  const status = normalizeStatus(pickFirst(first, ["Status", "AccountStatus", "Account Status"], "Active"));
  const accountNumber = pickFirst(first, ["Id", "IntegrationId", "AccountNumber", "Account Number"], "1-J6L5");
  const address = pickFirst(
    first,
    [
      "PrimaryAddress",
      "Address",
      "Primary Account Street Address",
      "StreetAddress",
      "BillingAddress",
      "Billing Street Address",
    ],
    "123 Main Street, Springfield, IL 62701",
  );
  const email = pickFirst(
    first,
    ["Main Email Address", "PrimaryEmailAddress", "EmailAddress", "Email", "EMailAddr"],
    "james.kelly@email.com",
  );
  const phone = pickFirst(
    first,
    ["Main Phone Number", "MainPhoneNumber", "PhoneNumber", "Phone", "CellularPhone"],
    "(412) 312-4031",
  );
  const accountValue = normalizeCurrency(pickFirst(first, ["Revenue", "AccountValue", "Value"]), "$15,000");

  return {
    accountMeta: [
      { label: "Account number", value: accountNumber },
      { label: "Address", value: address },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
    ],
    customer: {
      name,
      status,
    },
    spotlightStats: [
      buildSpotlightMetric("bar", "Churn", pickFirst(first, ["ChurnScore", "Churn Score"], "30%")),
      buildSpotlightMetric("bar", "Credit Rating", pickFirst(first, ["CreditRating", "Credit Rating"], "85%")),
      buildSpotlightMetric("bar", "NPS", pickFirst(first, ["NPSScore", "NPS Score"], "85%")),
      buildSpotlightMetric("currency_meter", "CLTV", accountValue),
    ],
    recommendations: defaultAccountResponse().recommendations,
  };
}

export function transformSiebelServiceRequests(payload) {
  return toArray(payload).map((record, index) => ({
    sr: pickFirst(record, ["SRNumber", "SR Id", "Id", "ServiceRequestNumber"], `SR-${index + 1}`),
    priority: pickFirst(record, ["Priority", "Severity"], "Medium"),
    status: normalizeStatus(pickFirst(record, ["Status", "SRStatus"], "Open")),
    dateCreated: pickFirst(record, ["Created", "CreatedDate", "CreatedDateTime"], "01/04/2025"),
  }));
}

export function transformSiebelServiceSummary(summaryPayload, requestRowsPayload) {
  const rows = transformSiebelServiceRequests(requestRowsPayload);
  const summary = summaryPayload || {};
  const open = Number(pickFirst(summary, ["open", "Open", "OpenCount"], "")) || rows.filter((row) => row.status === "Open").length;
  const total = Number(pickFirst(summary, ["total", "Total", "TotalCount"], "")) || rows.length;
  return { open, total };
}

export function transformSiebelServicePreview(payload) {
  return toArray(payload).slice(0, 4).map((record, index) => {
    const status = normalizeStatus(pickFirst(record, ["Status", "SRStatus"], "Open"));
    return {
      id: pickFirst(record, ["SRNumber", "Id", "ServiceRequestNumber"], `#${index + 1}`),
      title: pickFirst(record, ["Abstract", "Summary", "Description", "Name"], "Service request"),
      updated: pickFirst(record, ["Updated", "UpdatedDate", "LastUpdatedDate"], "Last updated on 06/08/2024"),
      status,
      tone: normalizeTone(status),
    };
  });
}

export function transformSiebelAssets(payload) {
  return toArray(payload).map((record, index) => {
    const status = normalizeStatus(pickFirst(record, ["Status", "AssetStatus"], "Active"));
    return {
      id: pickFirst(record, ["Id", "AssetNumber", "IntegrationId"], `#A-${index + 1}`),
      title: pickFirst(record, ["Name", "ProductName", "Product"], "Customer asset"),
      subtitle: pickFirst(record, ["NetPrice", "Price", "RecurringCharge"], "Your price $66.00"),
      status,
      tone: normalizeTone(status),
    };
  });
}

export function transformSiebelRecentOrders(payload) {
  return toArray(payload).map((record, index) => {
    const status = normalizeStatus(pickFirst(record, ["Status", "OrderStatus"], "Open"));
    const orderNumber = pickFirst(record, ["Order Number", "OrderNumber", "Id", "IntegrationId"], `#O-${index + 1}`);
    return {
      id: orderNumber,
      title: pickFirst(record, ["Name", "Description", "OrderName"], `Order ${orderNumber}`),
      updated: pickFirst(record, ["Updated", "UpdatedDate", "LastUpdatedDate"], "Last updated on 04/28/2024"),
      status,
      tone: normalizeTone(status),
    };
  });
}
