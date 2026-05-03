import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { build } from "esbuild";
import { brmBillingOverviewResponse } from "./src/mocks/brmMockData.js";
import {
  siebelAccountResponse,
  siebelAssetsResponse,
  siebelRecentOrdersResponse,
  siebelServicePreviewResponse,
  siebelServiceRequestRowsResponse,
  siebelServiceSummaryResponse,
} from "./src/mocks/siebelMockData.js";
import {
  transformSiebelAccountResponse,
  transformSiebelAssets,
  transformSiebelRecentOrders,
  transformSiebelServicePreview,
  transformSiebelServiceRequests,
  transformSiebelServiceSummary,
} from "./src/domain/siebelTransformers.js";
import { applyBillingWorkflow } from "./src/domain/billingWorkflow.js";
import { DEFAULT_CUSTOMER_CONFIG_KEY, getCustomerConfig } from "./src/extensions/customerConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const distDir = path.join(rootDir, "dist-runtime");
const customerConfig = getCustomerConfig(process.env.CUSTOMER_CONFIG || process.env.VITE_CUSTOMER_CONFIG || DEFAULT_CUSTOMER_CONFIG_KEY);
const DEFAULT_CATALOG_NAME = customerConfig.defaults.catalogName;
const DEFAULT_PRICE_LIST_NAME = customerConfig.defaults.priceListName;

function parseEnvFile(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .reduce((acc, line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

async function loadLocalEnv() {
  const env = {};
  for (const name of [".env", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(rootDir, name), "utf8");
      Object.assign(env, parseEnvFile(raw));
    } catch {
      // Ignore missing env files.
    }
  }
  return { ...env, ...process.env };
}

function sendJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendText(res, payload, statusCode = 200, type = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", type);
  res.end(payload);
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function bootstrapSiebelSession(appUrl) {
  if (!appUrl) {
    return "";
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      appUrl,
      {
        method: "GET",
        rejectUnauthorized: false,
      },
      (res) => {
        const cookies = (res.headers["set-cookie"] || []).map((cookie) => cookie.split(";")[0]).join("; ");
        res.resume();
        res.on("end", () => resolve(cookies));
      },
    );

    req.on("error", reject);
    req.end();
  });
}

function normalizeSiebelUrl(baseUrl, endpoint) {
  return new URL(endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`);
}

function encodeSiebelPathSegment(value) {
  return encodeURIComponent(String(value || "")).replace(/%2F/g, "/");
}

function escapeSiebelSearchValue(value) {
  return String(value || "").replace(/"/g, '\\"');
}

function normalizeSiebelReferenceValue(value) {
  const normalized = String(value || "").trim();
  return normalized === "No Match Row Id" ? "" : normalized;
}

function truncateSiebelText(value, maxLength) {
  const normalized = String(value || "").trim();
  if (!maxLength || normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function getPromotionResponseHeader(response) {
  const headerNode = response?.SiebelMessage?.["ListOfPDS Order"]?.Header;
  if (Array.isArray(headerNode)) {
    return headerNode[0] || null;
  }
  return headerNode || null;
}

function getPromotionResponseLineItems(response) {
  const header = getPromotionResponseHeader(response);
  const lineItemNode = header?.["ListOfLine Item"]?.["Line Item"];
  if (Array.isArray(lineItemNode)) {
    return lineItemNode;
  }
  return lineItemNode ? [lineItemNode] : [];
}

function getSiebelLinkHref(payload, options = {}) {
  const { rel, name } = options;
  const links = Array.isArray(payload?.Link) ? payload.Link : payload?.Link ? [payload.Link] : [];
  const match = links.find((link) => {
    if (!link?.href) {
      return false;
    }
    if (rel && link.rel !== rel) {
      return false;
    }
    if (name && link.name !== name) {
      return false;
    }
    return true;
  });
  return match?.href || "";
}

function parseAddressFields(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      raw: "",
      street: "",
      street2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    };
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return {
      raw,
      street: raw,
      street2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    };
  }

  let country = "";
  let state = "";
  let postalCode = "";
  let city = "";
  let streetParts = [...parts];
  const trailingPart = parts[parts.length - 1];
  const trailingStatePostal = trailingPart.match(/^([A-Za-z]{2,})(?:\s+(\d{5}(?:-\d{4})?))?$/);

  if (parts.length >= 3 && !trailingStatePostal && /^[A-Za-z][A-Za-z\s.]+$/.test(trailingPart)) {
    country = trailingPart;
    streetParts = parts.slice(0, -1);
  }

  const statePostalPart = streetParts[streetParts.length - 1] || "";
  const statePostalMatch = statePostalPart.match(/^([A-Za-z]{2,})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  if (statePostalMatch) {
    state = statePostalMatch[1].toUpperCase();
    postalCode = statePostalMatch[2] || "";
    city = streetParts[streetParts.length - 2] || "";
    streetParts = streetParts.slice(0, -2);
  } else {
    city = streetParts[streetParts.length - 1] || "";
    streetParts = streetParts.slice(0, -1);
  }

  const street = streetParts[0] || raw;
  const street2 = streetParts.length > 1 ? streetParts.slice(1).join(", ") : "";

  return {
    raw,
    street,
    street2,
    city,
    state,
    postalCode,
    country: country || "USA",
  };
}

function formatAddressFields(address) {
  if (!address) {
    return "";
  }

  return [
    [address.street, address.street2].filter(Boolean).join(", "),
    address.city,
    [address.state, address.postalCode].filter(Boolean).join(" "),
    address.country && address.country !== "USA" ? address.country : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function buildAccountAddressPayload(addressValue) {
  const address = parseAddressFields(addressValue);
  if (!address.raw) {
    return {};
  }

  return {
    "Primary Account Street Address": address.street,
    ...(address.street2 ? { "Primary Account Address Street Address2": address.street2 } : {}),
    ...(address.city ? { "Primary Account City": address.city } : {}),
    ...(address.state ? { "Primary Account State": address.state } : {}),
    ...(address.postalCode ? { "Primary Account Postal Code": address.postalCode } : {}),
    ...(address.country ? { "Primary Account Country": address.country } : {}),
  };
}

function toSiebelArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (payload?.items && typeof payload.items === "object") {
    return [payload.items];
  }

  return [];
}

function slugifyId(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function normalizeLookupName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findByPreferredName(rows, preferredName) {
  if (!rows.length) {
    return null;
  }

  const desired = normalizeLookupName(preferredName);
  const getName = (row) => row?.Name || row?.name || "";
  if (!desired) {
    return rows[0];
  }

  const exact = rows.find((row) => normalizeLookupName(getName(row)) === desired);
  if (exact) {
    return exact;
  }

  const containsDesired = rows.find((row) => normalizeLookupName(getName(row)).includes(desired));
  if (containsDesired) {
    return containsDesired;
  }

  const desiredContains = rows.find((row) => desired.includes(normalizeLookupName(getName(row))));
  if (desiredContains) {
    return desiredContains;
  }

  if (desired.includes("dbe na pricelist")) {
    const northAmerica = rows.find((row) => normalizeLookupName(getName(row)).includes("north america"));
    if (northAmerica) {
      return northAmerica;
    }
  }

  return rows[0];
}

function mapThumbFromName(name) {
  const normalized = normalizeLookupName(name);
  if (normalized.includes("internet")) return "internet";
  if (normalized.includes("family")) return "deal";
  if (normalized.includes("water")) return "mobility";
  if (normalized.includes("cafe")) return "infinity";
  return "deal";
}

function mapLiveProduct(product, fallbackCatalogName = DEFAULT_CATALOG_NAME) {
  const price = product["Price List Item List Price"] || product.ReferencePrice || product["Original List Price"] || "";
  const formattedPrice = price ? `$${price}` : "$0.00";

  return {
    id: product.Id || product["Product Id"] || slugifyId(product.Name),
    siebelProductId: product.Id || product["Product Id"] || "",
    family: fallbackCatalogName,
    name: product.Name || "Siebel product",
    description: product.Description || `Live product from ${fallbackCatalogName}.`,
    recommendation: `Queried from ${fallbackCatalogName}.`,
    listPrice: formattedPrice,
    yourPrice: formattedPrice,
    fee: formattedPrice,
    thumb: mapThumbFromName(product.Name),
    source: "live",
    productCategory: product["Product Category"] || "",
    promotionType: product["Promotion Type"] || "",
    classProductCode: product["Class Product Code"] || "",
    isBundledPromotion:
      normalizeLookupName(product["Promotion Type"]).includes("bundled promotion") ||
      normalizeLookupName(product["Product Category"]).includes("promotion") ||
      normalizeLookupName(product["Class Product Code"]).includes("promotion"),
  };
}

function requestJson(url, headers = {}, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const serializedBody = body ? JSON.stringify(body) : "";
    const req = https.request(
      url,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(serializedBody),
              }
            : {}),
          ...headers,
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Siebel request failed (${res.statusCode}): ${raw || "No response body"}`));
            return;
          }

          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (parsed && typeof parsed === "object" && typeof parsed.ERROR === "string") {
              reject(new Error(parsed.ERROR));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse Siebel response from ${url.pathname}: ${error.message}`));
          }
        });
      },
    );

    req.on("error", reject);
    if (body) {
      req.write(serializedBody);
    }
    req.end();
  });
}

function formatSiebelDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
}

function buildExplicitAuthHeaders(env) {
  if (env.SIEBEL_SESSION_COOKIE) {
    return { Cookie: env.SIEBEL_SESSION_COOKIE };
  }

  if (env.SIEBEL_BEARER_TOKEN) {
    return { Authorization: `Bearer ${env.SIEBEL_BEARER_TOKEN}` };
  }

  if (env.SIEBEL_BASIC_USERNAME && env.SIEBEL_BASIC_PASSWORD) {
    const encoded = Buffer.from(`${env.SIEBEL_BASIC_USERNAME}:${env.SIEBEL_BASIC_PASSWORD}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  return {};
}

function createApiRuntime(env) {
  let bootstrappedCookie = "";
  let siebelHealth = {
    mode: env.SIEBEL_USE_REAL_API === "true" ? "live" : "mock",
    resources: {},
  };

  async function getAuthHeaders() {
    const explicit = buildExplicitAuthHeaders(env);
    if (Object.keys(explicit).length > 0) {
      return explicit;
    }

    if (!bootstrappedCookie) {
      bootstrappedCookie = await bootstrapSiebelSession(env.SIEBEL_APP_URL);
    }

    return bootstrappedCookie ? { Cookie: bootstrappedCookie } : {};
  }

  async function getAccountScopedDataset(accountId) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const scopedAccountId = String(accountId || "").trim();

    if (!scopedAccountId) {
      return null;
    }

    async function fetchOrFallback(key, endpoint, transformer, fallbackData) {
      try {
        const payload = await requestJson(normalizeSiebelUrl(baseUrl, endpoint), headers);
        const data = transformer(payload);
        siebelHealth.resources[key] = {
          source: "live",
          endpoint,
          accountId: scopedAccountId,
        };
        return data;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown Siebel integration error";
        siebelHealth.resources[key] = {
          source: "fallback",
          endpoint,
          detail,
          accountId: scopedAccountId,
        };
        return structuredClone(fallbackData);
      }
    }

    const serviceEndpoint = `/data/Account/Account/${encodeURIComponent(scopedAccountId)}/Service Request?PageSize=3&StartRowNum=0&uniformresponse=Y`;
    const assetsEndpoint = `/data/Account/Account/${encodeURIComponent(scopedAccountId)}/Asset Mgmt - Asset - Header?PageSize=3&StartRowNum=0&uniformresponse=Y`;
    const ordersEndpoint = `/data/Account/Account/${encodeURIComponent(scopedAccountId)}/Order Entry - Orders?PageSize=3&StartRowNum=0&uniformresponse=Y`;

    const [account, assets, recentOrders] = await Promise.all([
      (async () => {
        try {
          const row = await getAccountById(scopedAccountId, { id: scopedAccountId });
          const payload = {
            Id: row.id,
            Name: row.name,
            "Account Status": row.status,
            Type: row.type,
            "Main Phone Number": row.mainPhone,
            "Main Email Address": row.mainEmail,
            Address: row.address,
          };
          siebelHealth.resources.account = {
            source: "live",
            endpoint: `/data/Account/Account/${encodeURIComponent(scopedAccountId)}`,
            accountId: scopedAccountId,
          };
          return transformSiebelAccountResponse(payload);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Unknown Siebel integration error";
          siebelHealth.resources.account = {
            source: "fallback",
            endpoint: `/data/Account/Account/${encodeURIComponent(scopedAccountId)}`,
            detail,
            accountId: scopedAccountId,
          };
          return structuredClone(siebelAccountResponse);
        }
      })(),
      fetchOrFallback("assets", assetsEndpoint, transformSiebelAssets, []),
      fetchOrFallback("recentOrders", ordersEndpoint, transformSiebelRecentOrders, []),
    ]);

    let serviceSummary = { open: 0, total: 0 };
    let servicePreview = [];
    let serviceRequests = [];

    try {
      const serviceRequestsPayload = await requestJson(normalizeSiebelUrl(baseUrl, serviceEndpoint), headers);
      serviceSummary = transformSiebelServiceSummary({}, serviceRequestsPayload);
      servicePreview = transformSiebelServicePreview(serviceRequestsPayload);
      serviceRequests = transformSiebelServiceRequests(serviceRequestsPayload);
      siebelHealth.resources.serviceRequests = {
        source: "live",
        endpoint: serviceEndpoint,
        accountId: scopedAccountId,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel integration error";
      siebelHealth.resources.serviceRequests = {
        source: "fallback",
        endpoint: serviceEndpoint,
        detail,
        accountId: scopedAccountId,
      };
    }

    return {
      account,
      serviceSummary,
      servicePreview,
      serviceRequests,
      assets,
      recentOrders,
    };
  }

  async function getLiveDataset(accountId = "") {
    if (String(accountId || "").trim()) {
      const scopedDataset = await getAccountScopedDataset(accountId);
      if (scopedDataset) {
        return scopedDataset;
      }
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();

    const accountEndpoint = env.SIEBEL_ACCOUNT_ENDPOINT || "/data/Account/Account/?PageSize=1&StartRowNum=0";
    const serviceEndpoint = env.SIEBEL_SERVICE_REQUESTS_ENDPOINT || "/data/Service Request/Service Request/?PageSize=25&StartRowNum=0";
    const assetsEndpoint =
      env.SIEBEL_ASSETS_ENDPOINT || "/data/Asset Management/Asset Mgmt - Asset - Header/?PageSize=20&StartRowNum=0";
    const ordersEndpoint = env.SIEBEL_ORDERS_ENDPOINT || "/data/Order Entry/Order Entry - Orders/?PageSize=20&StartRowNum=0";

    async function fetchOrFallback(key, endpoint, transformer, fallbackData) {
      try {
        const payload = await requestJson(normalizeSiebelUrl(baseUrl, endpoint), headers);
        const data = transformer(payload);
        siebelHealth.resources[key] = {
          source: "live",
          endpoint,
        };
        return data;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown Siebel integration error";
        siebelHealth.resources[key] = {
          source: "fallback",
          endpoint,
          detail,
        };
        return structuredClone(fallbackData);
      }
    }

    const [account, assets, recentOrders] = await Promise.all([
      fetchOrFallback("account", accountEndpoint, transformSiebelAccountResponse, siebelAccountResponse),
      fetchOrFallback("assets", assetsEndpoint, transformSiebelAssets, siebelAssetsResponse),
      fetchOrFallback("recentOrders", ordersEndpoint, transformSiebelRecentOrders, siebelRecentOrdersResponse),
    ]);

    let serviceSummary = structuredClone(siebelServiceSummaryResponse);
    let servicePreview = structuredClone(siebelServicePreviewResponse);
    let serviceRequests = structuredClone(siebelServiceRequestRowsResponse);

    try {
      const serviceRequestsPayload = await requestJson(normalizeSiebelUrl(baseUrl, serviceEndpoint), headers);
      serviceSummary = transformSiebelServiceSummary({}, serviceRequestsPayload);
      servicePreview = transformSiebelServicePreview(serviceRequestsPayload);
      serviceRequests = transformSiebelServiceRequests(serviceRequestsPayload);
      siebelHealth.resources.serviceRequests = {
        source: "live",
        endpoint: serviceEndpoint,
      };
    } catch (error) {
      siebelHealth.resources.serviceRequests = {
        source: "fallback",
        endpoint: serviceEndpoint,
        detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
      };
    }

    return {
      account,
      serviceSummary,
      servicePreview,
      serviceRequests,
      assets,
      recentOrders,
    };
  }

  async function fetchSiebelCollection(endpoint) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = await requestJson(normalizeSiebelUrl(baseUrl, endpoint), headers);
    return toSiebelArray(payload);
  }

  async function listCatalogs() {
    const endpoint = env.SIEBEL_PRODUCT_CATALOGS_ENDPOINT || "/data/Catalog Admin/Product Catalog?PageSize=100&StartRowNum=0";
    const rows = await fetchSiebelCollection(endpoint);
    return rows.map((row) => ({
      id: row.Id,
      name: row.Name,
      type: row["Catalog Type"] || row.Type || "",
      active: row.Active || "",
    }));
  }

  async function listPriceLists() {
    const endpoint = env.SIEBEL_PRICE_LISTS_ENDPOINT || "/data/Price List/Price List?PageSize=100&StartRowNum=0";
    const rows = await fetchSiebelCollection(endpoint);
    return rows.map((row) => ({
      id: row.Id,
      name: row.Name,
      type: row.Type || "",
      currency: row["Currency Code"] || "USD",
    }));
  }

  async function fetchCatalogProducts(catalogName, priceListName) {
    const [catalogRows, priceListRows] = await Promise.all([listCatalogs(), listPriceLists()]);
    const resolvedCatalog = findByPreferredName(catalogRows, catalogName);
    const resolvedPriceList = findByPreferredName(priceListRows, priceListName);

    if (!resolvedPriceList) {
      return {
        requestedCatalogName: catalogName,
        requestedPriceListName: priceListName,
        resolvedCatalogName: resolvedCatalog?.name || catalogName,
        resolvedPriceListName: priceListName,
        catalogs: catalogRows,
        priceLists: priceListRows,
        products: [],
      };
    }

    const endpoint = `/data/Price List/Price List/${encodeURIComponent(resolvedPriceList.id)}/Internal Product?PageSize=24&StartRowNum=0`;
    const products = (await fetchSiebelCollection(endpoint)).map((row) => mapLiveProduct(row, resolvedCatalog?.name || catalogName));

    return {
      requestedCatalogName: catalogName,
      requestedPriceListName: priceListName,
      resolvedCatalogName: resolvedCatalog?.name || catalogName,
      resolvedPriceListName: resolvedPriceList.name,
      resolvedPriceListId: resolvedPriceList.id,
      catalogs: catalogRows,
      priceLists: priceListRows,
      products,
    };
  }

  async function fetchCatalogHierarchy(catalogName, priceListName) {
    const catalogProducts = await fetchCatalogProducts(catalogName, priceListName);
    const resolvedCatalog = findByPreferredName(catalogProducts.catalogs, catalogProducts.resolvedCatalogName);

    if (!resolvedCatalog) {
      return {
        ...catalogProducts,
        categories: [],
      };
    }

    const categoryEndpoint = `/data/Catalog Admin/Product Catalog/${encodeURIComponent(resolvedCatalog.id)}/Catalog Category Admin?PageSize=100&StartRowNum=0`;
    const categoryRows = await fetchSiebelCollection(categoryEndpoint);
    const productByName = new Map(
      catalogProducts.products.map((product) => [normalizeLookupName(product.name), product]),
    );

    const categories = await Promise.all(
      categoryRows.map(async (category) => {
        const productEndpoint = `/data/Catalog Admin/Product Catalog/${encodeURIComponent(resolvedCatalog.id)}/Catalog Category Admin/${encodeURIComponent(category.Id)}/Internal Product?PageSize=100&StartRowNum=0`;
        const categoryProducts = await fetchSiebelCollection(productEndpoint);
        const products = categoryProducts.map((row) => {
          const matchedProduct = productByName.get(normalizeLookupName(row.Name));
          const rowMappedProduct = mapLiveProduct(row, category["Display Name"] || category.Name || resolvedCatalog.name);
          const mergedDescription =
            row.Description ||
            row["Full Description"] ||
            row["Marketing Description"] ||
            matchedProduct?.description ||
            rowMappedProduct.description;
          const mergedRecommendation =
            matchedProduct?.recommendation && matchedProduct.recommendation !== `Queried from ${resolvedCatalog?.name || catalogName}.`
              ? matchedProduct.recommendation
              : `Queried from ${category["Display Name"] || category.Name || resolvedCatalog.name}.`;
          return {
            ...(matchedProduct || rowMappedProduct),
            id: matchedProduct?.id || row.Id || slugifyId(row.Name),
            siebelProductId: matchedProduct?.siebelProductId || row.Id || "",
            family: category["Display Name"] || category.Name || resolvedCatalog.name,
            categoryId: category.Id,
            categoryName: category["Display Name"] || category.Name || "",
            description: mergedDescription,
            recommendation: mergedRecommendation,
            productCategory: row["Product Category"] || matchedProduct?.productCategory || "",
            promotionType: row["Promotion Type"] || matchedProduct?.promotionType || "",
            classProductCode: row["Class Product Code"] || matchedProduct?.classProductCode || "",
            isBundledPromotion:
              normalizeLookupName(row["Promotion Type"]).includes("bundled promotion") ||
              normalizeLookupName(row["Product Category"]).includes("promotion") ||
              normalizeLookupName(row["Class Product Code"]).includes("promotion") ||
              Boolean(matchedProduct?.isBundledPromotion),
          };
        });

        return {
          id: category.Id,
          name: category["Display Name"] || category.Name || "Category",
          rawName: category.Name || "",
          productCount: Number(category.Count || products.length || 0),
          products,
        };
      }),
    );

    return {
      ...catalogProducts,
      categories,
    };
  }

  async function updateAccount(accountId, body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = {
      ...(body.name ? { Name: body.name } : {}),
      ...(body.location || body.accountSite ? { Location: body.location || body.accountSite } : {}),
      ...(body.status ? { "Account Status": body.status } : {}),
      ...(body.type ? { Type: body.type } : {}),
      ...(body.primaryContactId ? { "Primary Contact Id": body.primaryContactId } : {}),
      ...(body.mainPhone ? { "Main Phone Number": body.mainPhone } : {}),
      ...(body.mainEmail ? { "Main Email Address": body.mainEmail } : {}),
      ...(body.priceListId ? { "Account Price List Id": body.priceListId } : {}),
      ...(body.priceListName ? { "Price List": body.priceListName } : {}),
      ...(body.description ? { Description: body.description } : {}),
    };

    if (!Object.keys(payload).length && !body.address) {
      return getAccountById(accountId, body);
    }

    let account = null;
    if (Object.keys(payload).length) {
      const response = await requestJson(
        normalizeSiebelUrl(baseUrl, `/data/Account/Account/${encodeURIComponent(accountId)}`),
        headers,
        "PUT",
        payload,
      );
      account = response?.items || response;
    }

    let associatedAddress = body.address || "";
    if (body.address) {
      associatedAddress = await associateAccountAddress(accountId, body.address);
    }

    return mapAccountRecord(account, {
      ...body,
      id: accountId,
      address: associatedAddress,
    });
  }

  function mapAccountRecord(account, fallback = {}) {
    const fallbackAddress = fallback.address || "";
    const fallbackAddressFields = parseAddressFields(fallbackAddress);
    const resolvedAddress = formatAddressFields({
      street: account?.["Primary Account Street Address"] || fallbackAddressFields.street,
      street2: account?.["Primary Account Address Street Address2"] || fallbackAddressFields.street2,
      city: account?.["Primary Account City"] || fallbackAddressFields.city,
      state: account?.["Primary Account State"] || fallbackAddressFields.state,
      postalCode: account?.["Primary Account Postal Code"] || fallbackAddressFields.postalCode,
      country: account?.["Primary Account Country"] || fallbackAddressFields.country,
    });

    return {
      id: account?.Id || fallback.id || "",
      name: account?.Name || fallback.name || "",
      location: account?.Location || fallback.location || fallback.accountSite || "",
      status: account?.["Account Status"] || fallback.status || "Active",
      type: account?.Type || account?.["Account Type Code"] || fallback.type || fallback.accountTypeCode || "",
      primaryContactId: account?.["Primary Contact Id"] || fallback.primaryContactId || "",
      mainPhone: account?.["Main Phone Number"] || fallback.mainPhone || "",
      mainEmail: account?.["Main Email Address"] || fallback.mainEmail || "",
      address: resolvedAddress || fallbackAddress,
    };
  }

  async function findAccountByName(name, fallback = {}) {
    const requestedName = String(name || "").trim();
    if (!requestedName) {
      return null;
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      searchspec: `[Name] = "${escapeSiebelSearchValue(requestedName)}"`,
      PageSize: "5",
      StartRowNum: "0",
      uniformresponse: "Y",
    });
    let lookupPayload;
    try {
      lookupPayload = await requestJson(
        normalizeSiebelUrl(baseUrl, `/data/Account/Account?${params.toString()}`),
        headers,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel account lookup error";
      if (detail.includes("Siebel request failed (404)")) {
        return null;
      }
      throw error;
    }
    const existingRows = toSiebelArray(lookupPayload);
    const existing = findByPreferredName(existingRows, requestedName);
    return existing?.Id ? mapAccountRecord(existing, { ...fallback, name: requestedName }) : null;
  }

  async function getAccountById(accountId, fallback = {}) {
    const requestedId = String(accountId || "").trim();
    if (!requestedId) {
      return null;
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const account = await requestJson(
      normalizeSiebelUrl(baseUrl, `/data/Account/Account/${encodeURIComponent(requestedId)}`),
      headers,
    );
    let address = fallback.address || "";
    try {
      address = (await getAccountPrimaryAddress(requestedId)) || address;
    } catch {
      // Keep the account read resilient when the address child is empty or unavailable.
    }
    return mapAccountRecord(account, { ...fallback, id: requestedId, address });
  }

  async function getAccountPrimaryAddress(accountId) {
    const requestedId = String(accountId || "").trim();
    if (!requestedId) {
      return "";
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = await requestJson(
      normalizeSiebelUrl(
        baseUrl,
        `/data/Account/Account/${encodeURIComponent(requestedId)}/CUT Address?PageSize=1&StartRowNum=0&uniformresponse=Y`,
      ),
      headers,
    );
    const firstAddress = toSiebelArray(payload)[0];
    if (!firstAddress) {
      return "";
    }

    return formatAddressFields({
      street: firstAddress["Street Address"] || "",
      street2: firstAddress["Street Address 2"] || "",
      city: firstAddress.City || "",
      state: firstAddress.State || "",
      postalCode: firstAddress["Postal Code"] || "",
      country: firstAddress.Country || "",
    });
  }

  async function associateAccountAddress(accountId, addressValue) {
    const requestedId = String(accountId || "").trim();
    const address = parseAddressFields(addressValue);
    if (!requestedId || !address.raw) {
      return address.raw;
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = {
      "Address Name": "Primary Address",
      "Street Address": address.street,
      ...(address.street2 ? { "Street Address 2": address.street2 } : {}),
      ...(address.city ? { City: address.city } : {}),
      ...(address.state ? { State: address.state } : {}),
      ...(address.postalCode ? { "Postal Code": address.postalCode } : {}),
      ...(address.country ? { Country: address.country } : {}),
    };

    await requestJson(
      normalizeSiebelUrl(baseUrl, `/data/Account/Account/${encodeURIComponent(requestedId)}/CUT Address/`),
      headers,
      "PUT",
      payload,
    );

    return formatAddressFields(address);
  }

  async function createContact(body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const token = body.externalId || `CODX-CONTACT-${Date.now()}`;
    const payload = {
      Id: token,
      "First Name": body.firstName || "",
      "Last Name": body.lastName || "",
      "Lead Contact Type": body.leadContactType || "",
      "Party Type Code": "Person",
      "Party UId": token,
      "Person UId": token,
      "Privacy Code": body.privacyCode || "Opt-Out: All Parties",
      "Email Address": body.email || "",
      "Work Phone #": body.workPhone || "",
    };

    const response = await requestJson(normalizeSiebelUrl(baseUrl, "/data/Contact/Contact/"), headers, "PUT", payload);
    const contact = response.items || response;

    return {
      id: contact.Id,
      externalId: contact["Party UId"] || token,
      firstName: contact["First Name"] || body.firstName || "",
      lastName: contact["Last Name"] || body.lastName || "",
      name: [contact["First Name"] || body.firstName || "", contact["Last Name"] || body.lastName || ""].filter(Boolean).join(" ").trim(),
      email: contact["Email Address"] || body.email || "",
      workPhone: contact["Work Phone #"] || body.workPhone || "",
      privacyCode: contact["Privacy Code"] || payload["Privacy Code"],
    };
  }

  async function createAccount(body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const requestedName = body.name || "Codex Account";

    if (requestedName) {
      const existing = await findAccountByName(requestedName, body);
      if (existing?.id) {
        return updateAccount(existing.id, {
          ...body,
          name: requestedName,
        });
      }
    }

    const token = body.externalId || `CODX-ACCT-${Date.now()}`;
    const payload = {
      Id: token,
      Name: requestedName,
      Location: body.location || body.accountSite || "",
      "Account Status": body.status || "Active",
      Type: body.type || "Residential",
      ...(body.primaryContactId ? { "Primary Contact Id": body.primaryContactId } : {}),
      ...(body.mainPhone ? { "Main Phone Number": body.mainPhone } : {}),
      ...(body.mainEmail ? { "Main Email Address": body.mainEmail } : {}),
      ...(body.priceListId ? { "Account Price List Id": body.priceListId } : {}),
      ...(body.priceListName ? { "Price List": body.priceListName } : {}),
      ...(body.description ? { Description: body.description } : {}),
    };
    let response;
    try {
      response = await requestJson(normalizeSiebelUrl(baseUrl, "/data/Account/Account/"), headers, "PUT", payload);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel account error";
      if (detail.includes("SBL-EAI-04381") && requestedName) {
        const existing = await findAccountByName(requestedName, body);
        if (existing?.id) {
          return updateAccount(existing.id, {
            ...body,
            name: requestedName,
          });
        }
      }
      throw error;
    }
    const account = response.items || response;
    const associatedAddress = body.address ? await associateAccountAddress(account.Id || token, body.address) : body.address || "";

    return mapAccountRecord(account, {
      id: token,
      name: payload.Name,
      location: payload.Location,
      status: payload["Account Status"],
      type: payload.Type,
      primaryContactId: payload["Primary Contact Id"] || "",
      mainPhone: payload["Main Phone Number"] || "",
      mainEmail: payload["Main Email Address"] || "",
      address: associatedAddress,
    });
  }

  async function createAccountAction(accountId, body) {
    const requestedId = String(accountId || "").trim();
    if (!requestedId) {
      throw new Error("Account id is required to create an account activity.");
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const fullSummary = String(body.description || body.summaryText || "").trim();
    const payload = {
      Id: body.externalId || `CODX-ACTION-${Date.now()}`,
      Type: body.type || "Call",
      Description: truncateSiebelText(fullSummary, 100),
      ...(fullSummary ? { Comment: fullSummary } : {}),
    };

    const response = await requestJson(
      normalizeSiebelUrl(baseUrl, `/data/Account/Account/${encodeURIComponent(requestedId)}/Action/`),
      headers,
      "PUT",
      payload,
    );

    const action = response?.items?.Action || response?.Action || response?.items || response;
    return {
      id: action?.Id || "",
      type: payload.Type,
      description: payload.Description,
      accountId: requestedId,
    };
  }

  function formatOrderPaymentProfileName(body) {
    const digits = String(body.cardNumber || "").replace(/\D/g, "");
    const last4 = digits.slice(-4);
    const parts = [];

    if (body.cardType) {
      parts.push(String(body.cardType).trim());
    }
    if (last4) {
      parts.push(`ending ${last4}`);
    }
    if (body.expiry) {
      parts.push(`exp ${String(body.expiry).trim()}`);
    }

    return truncateSiebelText(parts.join(" "), 100);
  }

  async function listOrderPayments(orderId) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = await requestJson(
      normalizeSiebelUrl(
        baseUrl,
        `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}/Payments (Simple)?PageSize=25&StartRowNum=0&uniformresponse=Y`,
      ),
      headers,
    );
    return toSiebelArray(payload);
  }

  async function upsertOrderPayment(orderId, body) {
    const requestedId = String(orderId || "").trim();
    if (!requestedId) {
      throw new Error("Order id is required to create or update payment details.");
    }

    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const existingPayments = await listOrderPayments(requestedId).catch(() => []);
    const existingPayment =
      existingPayments.find((payment) => normalizeSiebelReferenceValue(payment.Id) === normalizeSiebelReferenceValue(body.paymentId)) ||
      existingPayments[0] ||
      null;
    const paymentId = normalizeSiebelReferenceValue(existingPayment?.Id) || body.externalId || `CODX-PAY-${Date.now()}`;
    const paymentMethod = body.paymentMethod || "Credit Card";
    const paymentType = body.paymentType || body.cardType || "Visa";
    const payload = {
      Id: paymentId,
      "Payment Method": paymentMethod,
      ...(paymentType ? { "Payment Type": paymentType } : {}),
      ...(body.cardholderName ? { "Card Holder": body.cardholderName } : {}),
      ...(formatOrderPaymentProfileName(body) ? { "Payment Profile Name": formatOrderPaymentProfileName(body) } : {}),
    };

    const endpoint = existingPayment
      ? `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(requestedId)}/Payments (Simple)/${encodeURIComponent(paymentId)}`
      : `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(requestedId)}/Payments (Simple)/`;

    const writeResponse = await requestJson(normalizeSiebelUrl(baseUrl, endpoint), headers, "PUT", payload);
    const resolvedPaymentId =
      normalizeSiebelReferenceValue(
        writeResponse?.items?.["Payments (Simple)"]?.Id ||
          writeResponse?.items?.Payments?.Id ||
          writeResponse?.["Payments (Simple)"]?.Id ||
          writeResponse?.Payments?.Id,
      ) || paymentId;

    const payment = await requestJson(
      normalizeSiebelUrl(
        baseUrl,
        `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(requestedId)}/Payments (Simple)/${encodeURIComponent(resolvedPaymentId)}`,
      ),
      headers,
    );

    return {
      id: normalizeSiebelReferenceValue(payment.Id) || resolvedPaymentId,
      orderId: requestedId,
      paymentMethod: normalizeSiebelReferenceValue(payment["Payment Method"]) || paymentMethod,
      paymentType: normalizeSiebelReferenceValue(payment["Payment Type"]) || paymentType,
      cardHolder: normalizeSiebelReferenceValue(payment["Card Holder"]) || body.cardholderName || "",
      paymentProfileName: normalizeSiebelReferenceValue(payment["Payment Profile Name"]) || formatOrderPaymentProfileName(body),
    };
  }

  async function createOrder(body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const token = body.externalId || `CODX-ORDER-${Date.now()}`;
    const orderNumber = body.orderNumber || token;
    const payload = {
      Id: token,
      "Order Number": orderNumber,
      "Order Type Id": body.orderTypeId || "0-D14E",
      "Order Type Code": body.orderTypeCode || "Sales",
      Status: body.status || "Pending",
      "Currency Code": body.currencyCode || "USD",
      ...(body.priceListId ? { "Price List Id": body.priceListId } : {}),
      ...(body.priceListName ? { "Price List": body.priceListName } : {}),
      ...(body.accountId ? { AccountId: body.accountId } : {}),
      ...(body.accountName ? { AccountName: body.accountName } : {}),
    };

    const response = await requestJson(
      normalizeSiebelUrl(baseUrl, "/data/Order Entry/Order Entry - Orders/"),
      headers,
      "PUT",
      payload,
    );
    const orderId = response?.items?.Id || response?.items?.["Order Entry - Orders"]?.Id;
    if (!orderId) {
      throw new Error("Siebel order create returned no order id.");
    }

    let order = {};
    try {
      order = await requestJson(
        normalizeSiebelUrl(baseUrl, `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}`),
        headers,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel order read error";
      if (!detail.includes("Siebel request failed (404)")) {
        throw error;
      }
    }

    const hasReadBack = Object.keys(order).length > 0;

    return {
      id: order.Id || orderId,
      orderNumber: order["Order Number"] || orderNumber,
      orderType: order["Order Type"] || order["Order Type Code"] || payload["Order Type Code"],
      contactId: hasReadBack ? normalizeSiebelReferenceValue(order["Contact Id"]) : "",
      contactName: body.contactName || "",
      accountId: hasReadBack
        ? normalizeSiebelReferenceValue(order.AccountId || order["Account Id"])
        : normalizeSiebelReferenceValue(body.accountId),
      accountName: hasReadBack
        ? normalizeSiebelReferenceValue(order.AccountName || order.Account)
        : normalizeSiebelReferenceValue(body.accountName),
      currencyCode: order["Currency Code"] || payload["Currency Code"],
      status: order.Status || payload.Status,
      priceListId: hasReadBack
        ? normalizeSiebelReferenceValue(order["Price List Id"])
        : normalizeSiebelReferenceValue(payload["Price List Id"]),
      priceListName: hasReadBack
        ? normalizeSiebelReferenceValue(order["Price List"])
        : normalizeSiebelReferenceValue(payload["Price List"]),
    };
  }

  async function updateOrder(orderId, body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = {
      ...(body.accountId ? { AccountId: body.accountId } : {}),
      ...(body.accountName ? { AccountName: body.accountName } : {}),
      ...(body.orderNumber ? { "Order Number": body.orderNumber } : {}),
      ...(body.contactId ? { "Contact Id": body.contactId } : {}),
      ...(body.priceListId ? { "Price List Id": body.priceListId } : {}),
      ...(body.priceListName ? { "Price List": body.priceListName } : {}),
      ...(body.billingAccountId ? { "Billing Account Id": body.billingAccountId } : {}),
      ...(body.billingAccountId ? { "Bill To Account Id": body.billingAccountId } : {}),
      ...(body.serviceAccountId ? { "Ship To Account Id": body.serviceAccountId } : {}),
      ...(body.serviceAccountId ? { "Service Account Id": body.serviceAccountId } : {}),
      ...(body.payToAccountId ? { "Pay To Account Id": body.payToAccountId } : {}),
      ...(body.billToAccountNumber ? { "Bill To Account Number": body.billToAccountNumber } : {}),
    };

    if (!Object.keys(payload).length) {
      throw new Error("No order updates were provided.");
    }

    await requestJson(
      normalizeSiebelUrl(baseUrl, `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}`),
      headers,
      "PUT",
      payload,
    );

    if (body.billingAccountId || body.serviceAccountId) {
      const lineItems = await listOrderItems(orderId).catch(() => []);
      await Promise.all(
        lineItems.map((item) =>
          updateOrderLineItem(orderId, item.id, {
            billingAccountId: body.billingAccountId || "",
            serviceAccountId: body.serviceAccountId || "",
            productId: item.productId || "",
            lineNumber: item.lineNumber ? String(item.lineNumber) : "",
          }, item.selfHref || ""),
        ),
      );
    }

    let order = {};
    try {
      order = await requestJson(
        normalizeSiebelUrl(baseUrl, `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}`),
        headers,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel order read error";
      if (!detail.includes("Siebel request failed (404)")) {
        throw error;
      }
    }

    const hasReadBack = Object.keys(order).length > 0;

    return {
      id: order.Id || orderId,
      orderNumber: order["Order Number"] || body.orderNumber || "",
      contactId: hasReadBack
        ? normalizeSiebelReferenceValue(order["Contact Id"])
        : normalizeSiebelReferenceValue(body.contactId),
      accountId: hasReadBack
        ? normalizeSiebelReferenceValue(order.AccountId || order["Account Id"])
        : normalizeSiebelReferenceValue(body.accountId),
      accountName: hasReadBack
        ? normalizeSiebelReferenceValue(order.AccountName || order.Account)
        : normalizeSiebelReferenceValue(body.accountName),
      billingAccountId: hasReadBack
        ? normalizeSiebelReferenceValue(order["Billing Account Id"] || order["Bill To Account Id"])
        : normalizeSiebelReferenceValue(body.billingAccountId),
      serviceAccountId: hasReadBack
        ? normalizeSiebelReferenceValue(order["Ship To Account Id"] || order["Service Account Id"])
        : normalizeSiebelReferenceValue(body.serviceAccountId),
      payToAccountId: hasReadBack
        ? normalizeSiebelReferenceValue(order["Pay To Account Id"])
        : normalizeSiebelReferenceValue(body.payToAccountId),
      billToAccountNumber: hasReadBack
        ? normalizeSiebelReferenceValue(order["Bill To Account Number"])
        : normalizeSiebelReferenceValue(body.billToAccountNumber),
      priceListId: hasReadBack
        ? normalizeSiebelReferenceValue(order["Price List Id"])
        : normalizeSiebelReferenceValue(body.priceListId),
      priceListName: hasReadBack
        ? normalizeSiebelReferenceValue(order["Price List"])
        : normalizeSiebelReferenceValue(body.priceListName),
    };
  }

  async function updateOrderLineItem(orderId, lineItemId, body, lineItemHref = "") {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const standardUrl = normalizeSiebelUrl(
      baseUrl,
      `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}/Order Entry - Line Items/${encodeURIComponent(lineItemId)}`,
    );
    const simpleUrl = normalizeSiebelUrl(
      baseUrl,
      lineItemHref ||
        `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}/Order Entry - Line Items (Simple)/${encodeURIComponent(lineItemId)}`,
    );
    let currentItem = null;
    try {
      currentItem = await requestJson(standardUrl, headers);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel order line item read error";
      if (!detail.includes("Siebel request failed (404)")) {
        throw error;
      }
      currentItem = await requestJson(simpleUrl, headers);
    }

    const payload = {
      ...(currentItem?.Commodity ? { Commodity: currentItem.Commodity } : {}),
      ...(currentItem?.["Product Id"] || body.productId
        ? { "Product Id": currentItem?.["Product Id"] || body.productId }
        : {}),
      ...(currentItem?.["Line Number"] || body.lineNumber
        ? { "Line Number": currentItem?.["Line Number"] || body.lineNumber }
        : {}),
      ...(body.billingAccountId ? { "Billing Account Id": body.billingAccountId } : {}),
      ...(body.serviceAccountId ? { "Service Account Id": body.serviceAccountId } : {}),
    };

    if (!Object.keys(payload).length) {
      return null;
    }

    let response;
    try {
      response = await requestJson(simpleUrl, headers, "PUT", payload);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel order line item update error";
      if (!detail.includes("Siebel request failed (404)") || lineItemHref) {
        throw error;
      }
      response = await requestJson(standardUrl, headers, "PUT", payload);
    }

    return response?.items || response;
  }

  async function createOrderItem(orderId, body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = {
      Id: body.externalId || `CODX-LI-${Date.now()}`,
      "Line Number": String(body.lineNumber || 1),
      "Quantity Requested": String(body.quantity || 1),
      "Currency Code": body.currencyCode || "USD",
      "Exchange Date": body.exchangeDate || formatSiebelDate(),
      "Product Id": body.productId,
      "Root Product Id": body.rootProductId || body.productId,
      "Root Product Name": body.rootProductName || body.name || "",
    };
    const response = await requestJson(
      normalizeSiebelUrl(baseUrl, `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}/Order Entry - Line Items/`),
      headers,
      "PUT",
      payload,
    );

    const orderItemId = response?.items?.["Order Entry - Line Items"]?.Id;
    if (!orderItemId) {
      throw new Error("Siebel order line item create returned no item id.");
    }

    const item = await requestJson(
      normalizeSiebelUrl(baseUrl, `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}/Order Entry - Line Items/${encodeURIComponent(orderItemId)}`),
      headers,
    );

    return {
      id: item.Id || orderItemId,
      quoteId: orderId,
      productId: item["Product Id"] || payload["Product Id"],
      name: item.Product || item["Root Product Name"] || body.name || "",
      quantity: Number(item["Quantity Requested"] || payload["Quantity Requested"] || 1),
      lineNumber: Number(item["Line Number"] || payload["Line Number"] || 1),
      currencyCode: item["Currency Code"] || payload["Currency Code"],
      exchangeDate: item["Exchange Date"] || payload["Exchange Date"],
      status: item.Status || "",
      netPrice: item["Net Price"] || item["Current Price"] || item["Unit Price"] || item["SAP 4x Unit Net Price"] || "",
      priceType: item["Price Type"] || "",
      productTypeCode: item["Product Type Code"] || "",
      prodPromId: item["Prod Prom Id"] || "",
      parentQuoteItemId: item["Parent Order Item Id"] || "",
      rootQuoteItemId: item["Root Order Item Id"] || "",
      rootProductId: item["Root Product Id"] || "",
    };
  }

  async function applyPromotionToOrder(orderId, body) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const workflowName =
      env.SIEBEL_PROMOTION_WORKFLOWS ||
      "ISS Promotion WS - ApplyProductPromotion - Order";
    const requestedOrderId = ["", "new", "NEW"].includes(String(orderId || "").trim()) ? "" : String(orderId || "").trim();
    const payload = {
      ProcessName: body.processName || workflowName,
      ProdPromId: body.prodPromId || body.productId,
      PricingMode: body.pricingMode || "Y",
      EligibilityMode: body.eligibilityMode || "1",
      Sync: body.sync || "Y",
      ...(body.quantity ? { Quantity: String(body.quantity) } : {}),
      SiebelMessage: {
        MessageId: "",
        MessageType: "Integration Object",
        IntObjectName: "PDS Order",
        IntObjectFormat: "Siebel Hierarchical",
        "ListOfPDS Order": {
          Header: {
            Account: body.accountName || "",
            "Account Id": body.accountId || "",
            "Order Type": body.orderType || "Sales Order",
            "Order Number": body.orderNumber || "",
            ...(body.priceListId ? { "Price List Id": body.priceListId } : {}),
          },
        },
      },
      ...(body.headerId ? { HeaderId: body.headerId } : {}),
      ...(body.lineItemId ? { LineItemId: body.lineItemId } : {}),
      ...(body.pickMode ? { "Pick Mode": body.pickMode } : {}),
      ...(body.prodPromInstanceId ? { ProdPromInstanceId: body.prodPromInstanceId } : {}),
    };
    try {
      const response = await requestJson(
        normalizeSiebelUrl(baseUrl, `/workflow/${encodeSiebelPathSegment(workflowName)}/`),
        headers,
        "POST",
        payload,
      );
      const responseHeader = getPromotionResponseHeader(response);
      let resolvedOrderId = responseHeader?.Id || requestedOrderId;
      const resolvedOrderNumber = responseHeader?.["Order Number"] || body.orderNumber || "";
      if (!resolvedOrderId && resolvedOrderNumber) {
        try {
          const params = new URLSearchParams({
            searchspec: `[Order Number] = "${escapeSiebelSearchValue(resolvedOrderNumber)}"`,
            PageSize: "1",
            StartRowNum: "0",
            uniformresponse: "Y",
          });
          const lookupPayload = await requestJson(
            normalizeSiebelUrl(baseUrl, `/data/Order Entry/Order Entry - Orders?${params.toString()}`),
            headers,
          );
          const existingOrder = toSiebelArray(lookupPayload)[0] || null;
          resolvedOrderId = existingOrder?.Id || "";
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Unknown order lookup error";
          if (!detail.includes("Siebel request failed (404)")) {
            throw error;
          }
        }
      }
      let items = [];
      if (resolvedOrderId) {
        try {
          items = await listOrderItems(resolvedOrderId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Unknown order item read error";
          if (!detail.includes("Siebel request failed (404)")) {
            throw error;
          }
        }
      }
      if (!items.length) {
        items = getPromotionResponseLineItems(response).map((item) => ({
          id: item.Id || "",
          quoteId: resolvedOrderId,
          productId: item["Product Id"] || "",
          name: item.Name || item.Product || item["Root Product Name"] || "",
          quantity: Number(item.Quantity || item["Quantity Requested"] || item["Extended Quantity Requested"] || 1),
          lineNumber: Number(item["Line Number"] || 1),
          currencyCode: item["Currency Code"] || "USD",
          exchangeDate: item["Exchange Date"] || "",
          status: item.Status || "",
          netPrice: item["Net Price"] || item["Current Price"] || item["Unit Price"] || item["SAP 4x Unit Net Price"] || "",
          priceType: item["Price Type"] || "",
          productTypeCode: item["Product Type Code"] || "",
          prodPromId: item["Prod Prom Id"] || "",
          parentQuoteItemId: item["Parent Order Item Id"] || "",
          rootQuoteItemId: item["Root Order Item Id"] || "",
          rootProductId: item["Root Product Id"] || "",
        }));
      }
      return {
        response,
        items,
        executedWorkflow: workflowName,
        orderId: resolvedOrderId,
        orderNumber: resolvedOrderNumber,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Siebel workflow error";
      throw new Error(`Apply promotion workflow failed: ${detail}`);
    }
  }

  async function listOrderItems(orderId) {
    const baseUrl =
      env.SIEBEL_API_BASE_URL ||
      "https://phoenix200484.appsdev1.fusionappsdphx1.oraclevcn.com:16691/siebel/v1.0";
    const headers = await getAuthHeaders();
    const payload = await requestJson(
      normalizeSiebelUrl(
        baseUrl,
        `/data/Order Entry/Order Entry - Orders/${encodeURIComponent(orderId)}/Order Entry - Line Items (Simple)?uniformresponse=Y&PageSize=100&StartRowNum=0`,
      ),
      headers,
    );

    return toSiebelArray(payload).map((item) => ({
      id: item.Id,
      quoteId: orderId,
      selfHref:
        getSiebelLinkHref(item, { rel: "self", name: "Order Entry - Line Items (Simple)" }) ||
        getSiebelLinkHref(item, { rel: "canonical", name: "Order Entry - Line Items (Simple)" }) ||
        "",
      productId: item["Product Id"] || "",
      name: item.Product || item["Root Product Name"] || "",
      quantity: Number(item["Quantity Requested"] || 1),
      lineNumber: Number(item["Line Number"] || 1),
      currencyCode: item["Currency Code"] || "USD",
      exchangeDate: item["Exchange Date"] || "",
      status: item.Status || "",
      netPrice: item["Net Price"] || item["Current Price"] || item["Unit Price"] || item["SAP 4x Unit Net Price"] || "",
      priceType: item["Price Type"] || "",
      productTypeCode: item["Product Type Code"] || "",
      prodPromId: item["Prod Prom Id"] || "",
      parentQuoteItemId: item["Parent Order Item Id"] || "",
      rootQuoteItemId: item["Root Order Item Id"] || "",
      rootProductId: item["Root Product Id"] || "",
    }));
  }

  async function handleSiebel(req, res, url) {
    if (url.pathname === "/api/siebel/health") {
      return sendJson(res, siebelHealth);
    }

    if (env.SIEBEL_USE_REAL_API === "true") {
      const accountId = url.searchParams.get("accountId") || "";
      const dataset = await getLiveDataset(accountId);

      if (url.pathname === "/api/siebel/account") return sendJson(res, dataset.account);
      if (url.pathname === "/api/siebel/service-requests/summary") return sendJson(res, dataset.serviceSummary);
      if (url.pathname === "/api/siebel/service-requests/preview") return sendJson(res, dataset.servicePreview);
      if (url.pathname === "/api/siebel/service-requests") {
        const status = url.searchParams.get("status");
        const rows =
          status && status !== "All" ? dataset.serviceRequests.filter((row) => row.status === status) : dataset.serviceRequests;
        return sendJson(res, rows);
      }
      if (url.pathname === "/api/siebel/assets") return sendJson(res, dataset.assets);
      if (url.pathname === "/api/siebel/orders/recent") return sendJson(res, dataset.recentOrders);
    }

    if (req.method === "GET" && url.pathname === "/api/siebel/catalogs") {
      try {
        return sendJson(
          res,
          env.SIEBEL_USE_REAL_API === "true"
            ? await listCatalogs()
            : [{ id: "fallback-supremo", name: DEFAULT_CATALOG_NAME, type: "Buying", active: "Y" }],
        );
      } catch (error) {
        return sendJson(res, [{ id: "fallback-supremo", name: DEFAULT_CATALOG_NAME, type: "Buying", active: "Y" }]);
      }
    }

    if (req.method === "GET" && url.pathname === "/api/siebel/price-lists") {
      try {
        return sendJson(
          res,
          env.SIEBEL_USE_REAL_API === "true"
            ? await listPriceLists()
            : [{ id: "fallback-dbe-na", name: DEFAULT_PRICE_LIST_NAME, type: "PRICE LIST", currency: "USD" }],
        );
      } catch (error) {
        return sendJson(res, [{ id: "fallback-dbe-na", name: DEFAULT_PRICE_LIST_NAME, type: "PRICE LIST", currency: "USD" }]);
      }
    }

    if (req.method === "GET" && url.pathname === "/api/siebel/catalog-products") {
      const requestedCatalogName = url.searchParams.get("catalogName") || DEFAULT_CATALOG_NAME;
      const requestedPriceListName = url.searchParams.get("priceListName") || DEFAULT_PRICE_LIST_NAME;

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await fetchCatalogProducts(requestedCatalogName, requestedPriceListName));
        } catch (error) {
          return sendJson(res, {
            requestedCatalogName,
            requestedPriceListName,
            resolvedCatalogName: requestedCatalogName,
            resolvedPriceListName: requestedPriceListName,
            products: [],
            catalogs: [{ id: "fallback-supremo", name: DEFAULT_CATALOG_NAME, type: "Buying", active: "Y" }],
            priceLists: [{ id: "fallback-dbe-na", name: DEFAULT_PRICE_LIST_NAME, type: "PRICE LIST", currency: "USD" }],
            detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
          });
        }
      }

      return sendJson(res, {
        requestedCatalogName,
        requestedPriceListName,
        resolvedCatalogName: requestedCatalogName,
        resolvedPriceListName: requestedPriceListName,
        products: structuredClone([]),
        catalogs: [{ id: "fallback-supremo", name: DEFAULT_CATALOG_NAME, type: "Buying", active: "Y" }],
        priceLists: [{ id: "fallback-dbe-na", name: DEFAULT_PRICE_LIST_NAME, type: "PRICE LIST", currency: "USD" }],
      });
    }

    if (req.method === "GET" && url.pathname === "/api/siebel/catalog-hierarchy") {
      const requestedCatalogName = url.searchParams.get("catalogName") || DEFAULT_CATALOG_NAME;
      const requestedPriceListName = url.searchParams.get("priceListName") || DEFAULT_PRICE_LIST_NAME;

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await fetchCatalogHierarchy(requestedCatalogName, requestedPriceListName));
        } catch (error) {
          return sendJson(res, {
            requestedCatalogName,
            requestedPriceListName,
            resolvedCatalogName: requestedCatalogName,
            resolvedPriceListName: requestedPriceListName,
            products: [],
            categories: [],
            detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
          });
        }
      }

      return sendJson(res, {
        requestedCatalogName,
        requestedPriceListName,
        resolvedCatalogName: requestedCatalogName,
        resolvedPriceListName: requestedPriceListName,
        products: structuredClone([]),
        categories: [],
      });
    }

    if (req.method === "POST" && url.pathname === "/api/siebel/contacts") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await createContact(body), 201);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel contact create failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: `MOCK-CONTACT-${Date.now()}`,
          externalId: `MOCK-CONTACT-${Date.now()}`,
          firstName: body.firstName || "James",
          lastName: body.lastName || "Kelly",
          name: [body.firstName || "James", body.lastName || "Kelly"].join(" "),
          email: body.email || "",
          workPhone: body.workPhone || "",
          privacyCode: "Opt-Out: All Parties",
        },
        201,
      );
    }

    if (req.method === "POST" && url.pathname === "/api/siebel/accounts") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await createAccount(body), 201);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel account create failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: `MOCK-ACCOUNT-${Date.now()}`,
          name: body.name || "Mock Account",
          location: body.location || body.accountSite || "",
          status: body.status || "Active",
          type: body.type || "Residential",
          primaryContactId: body.primaryContactId || "",
          mainPhone: body.mainPhone || "",
          mainEmail: body.mainEmail || "",
          address: body.address || "",
        },
        201,
      );
    }

    const accountMatch = url.pathname.match(/^\/api\/siebel\/accounts\/([^/]+)$/);
    if (accountMatch && req.method === "PATCH") {
      const accountId = decodeURIComponent(accountMatch[1]);
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await updateAccount(accountId, body), 200);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel account update failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: accountId,
          name: body.name || "",
          type: body.type || "",
          primaryContactId: body.primaryContactId || "",
          mainPhone: body.mainPhone || "",
          mainEmail: body.mainEmail || "",
          address: body.address || "",
          description: body.description || "",
        },
        200,
      );
    }

    const accountActionMatch = url.pathname.match(/^\/api\/siebel\/accounts\/([^/]+)\/actions$/);
    if (accountActionMatch && req.method === "POST") {
      const accountId = decodeURIComponent(accountActionMatch[1]);
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await createAccountAction(accountId, body), 201);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel account activity create failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: `MOCK-ACTION-${Date.now()}`,
          type: body.type || "Call",
          description: body.description || body.summaryText || "",
          accountId,
        },
        201,
      );
    }

    if (req.method === "POST" && url.pathname === "/api/siebel/orders") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await createOrder(body), 201);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel order create failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: `MOCK-QUOTE-${Date.now()}`,
          name: body.name || "Mock Order",
          currencyCode: body.currencyCode || "USD",
          salesRep: body.salesRep || "SADMIN",
          status: body.status || "Pending",
          orderNumber: body.orderNumber || `MOCK-ORDER-${Date.now()}`,
          orderType: body.orderTypeCode || "Sales",
          contactId: "",
        },
        201,
      );
    }

    const orderMatch = url.pathname.match(/^\/api\/siebel\/orders\/([^/]+)$/);
    if (orderMatch && req.method === "PATCH") {
      const orderId = decodeURIComponent(orderMatch[1]);
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await updateOrder(orderId, body), 200);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel order update failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: orderId,
          contactId: body.contactId || "",
          accountId: body.accountId || "",
          billingAccountId: body.billingAccountId || "",
          serviceAccountId: body.serviceAccountId || "",
          payToAccountId: body.payToAccountId || "",
          billToAccountNumber: body.billToAccountNumber || "",
          priceListId: body.priceListId || "",
          priceListName: body.priceListName || "",
        },
        200,
      );
    }

    const orderPaymentMatch = url.pathname.match(/^\/api\/siebel\/orders\/([^/]+)\/payments$/);
    if (orderPaymentMatch && req.method === "POST") {
      const orderId = decodeURIComponent(orderPaymentMatch[1]);
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          return sendJson(res, await upsertOrderPayment(orderId, body), 201);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel order payment update failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      return sendJson(
        res,
        {
          id: body.paymentId || `MOCK-PAY-${Date.now()}`,
          orderId,
          paymentMethod: body.paymentMethod || "Credit Card",
          paymentType: body.paymentType || body.cardType || "Visa",
          cardHolder: body.cardholderName || "",
          paymentProfileName: formatOrderPaymentProfileName(body),
        },
        201,
      );
    }

    const quoteItemMatch = url.pathname.match(/^\/api\/siebel\/orders\/([^/]+)\/items$/);
    if (quoteItemMatch && req.method === "POST") {
      const quoteId = decodeURIComponent(quoteItemMatch[1]);
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          const item = await createOrderItem(quoteId, body);
          const items = await listOrderItems(quoteId);
          return sendJson(res, { item, items }, 201);
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel order item create failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }
      }

      const item = {
        id: `MOCK-QUOTE-ITEM-${Date.now()}`,
        quoteId,
        productId: body.productId || "",
        name: body.name || "Mock Product",
        quantity: Number(body.quantity || 1),
        lineNumber: Number(body.lineNumber || 1),
        currencyCode: body.currencyCode || "USD",
        exchangeDate: body.exchangeDate || formatSiebelDate(),
        status: "In Progress",
      };
      return sendJson(res, { item, items: [item] }, 201);
    }

    const quotePromotionMatch = url.pathname.match(/^\/api\/siebel\/orders\/([^/]+)\/promotions$/);
    if (quotePromotionMatch && req.method === "POST") {
      const quoteId = decodeURIComponent(quotePromotionMatch[1]);
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};

      if (env.SIEBEL_USE_REAL_API === "true") {
        try {
          const result = await applyPromotionToOrder(quoteId, body);
          return sendJson(res, result, 201);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Unknown Siebel integration error";
          const statusCode = detail.includes("SBL-DAT-00825") ? 403 : 502;
          return sendJson(
            res,
            {
              error: "Siebel order promotion apply failed",
              detail,
            },
            statusCode,
          );
        }
      }

      return sendJson(
        res,
        {
          response: { mock: true },
          items: [],
        },
        201,
      );
    }

    if (url.pathname === "/api/siebel/health") return sendJson(res, siebelHealth);
    if (url.pathname === "/api/siebel/account") return sendJson(res, structuredClone(siebelAccountResponse));
    if (url.pathname === "/api/siebel/service-requests/summary") return sendJson(res, structuredClone(siebelServiceSummaryResponse));
    if (url.pathname === "/api/siebel/service-requests/preview") return sendJson(res, structuredClone(siebelServicePreviewResponse));
    if (url.pathname === "/api/siebel/service-requests") {
      const status = url.searchParams.get("status");
      const rows =
        status && status !== "All"
          ? siebelServiceRequestRowsResponse.filter((row) => row.status === status)
          : siebelServiceRequestRowsResponse;
      return sendJson(res, structuredClone(rows));
    }
    if (url.pathname === "/api/siebel/assets") return sendJson(res, structuredClone(siebelAssetsResponse));
    if (url.pathname === "/api/siebel/orders/recent") return sendJson(res, structuredClone(siebelRecentOrdersResponse));

    return sendJson(res, { error: "Not found" }, 404);
  }

  async function handleApi(req, res, url) {
    if (url.pathname.startsWith("/api/siebel/")) {
      return handleSiebel(req, res, url);
    }

    if (req.method === "GET" && url.pathname === "/api/brm/billing/overview") {
      return sendJson(res, structuredClone(brmBillingOverviewResponse));
    }

    if (req.method === "POST" && url.pathname === "/api/brm/billing/workflow") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
      return sendJson(res, applyBillingWorkflow(body.workflow, body.prompt ?? ""));
    }

    return sendJson(res, { error: "Not found" }, 404);
  }

  return { handleApi };
}

async function buildClient() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  await build({
    entryPoints: [path.join(rootDir, "src/main.jsx")],
    outdir: distDir,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    splitting: false,
    sourcemap: false,
    minify: false,
    entryNames: "app",
    assetNames: "assets/[name]",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
    },
    logLevel: "silent",
  });

  await fs.writeFile(
    path.join(distDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Customer 360 | Telco Contact Center</title>
    <link rel="stylesheet" href="/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`,
    "utf8",
  );
}

async function start() {
  const env = await loadLocalEnv();
  const port = Number(env.PORT || 4173);
  const host = env.HOST || "127.0.0.1";

  await buildClient();
  const apiRuntime = createApiRuntime(env);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname.startsWith("/api/")) {
      return apiRuntime.handleApi(req, res, url);
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(distDir, pathname.replace(/^\/+/, ""));

    try {
      const file = await fs.readFile(filePath);
      res.statusCode = 200;
      res.setHeader("Content-Type", getContentType(filePath));
      res.end(file);
    } catch {
      try {
        const fallback = await fs.readFile(path.join(distDir, "index.html"));
        sendText(res, fallback, 200, "text/html; charset=utf-8");
      } catch {
        sendText(res, "Application build not found", 500);
      }
    }
  });

  server.listen(port, host, () => {
    console.log(`Runtime server ready at http://${host}:${port}/`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
