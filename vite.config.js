import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { brmBillingOverviewResponse } from "./src/mocks/brmMockData";
import {
  siebelAccountResponse,
  siebelAssetsResponse,
  siebelRecentOrdersResponse,
  siebelServicePreviewResponse,
  siebelServiceRequestRowsResponse,
  siebelServiceSummaryResponse,
} from "./src/mocks/siebelMockData";
import {
  transformSiebelAccountResponse,
  transformSiebelAssets,
  transformSiebelRecentOrders,
  transformSiebelServicePreview,
  transformSiebelServiceRequests,
  transformSiebelServiceSummary,
} from "./src/domain/siebelTransformers";
import { applyBillingWorkflow } from "./src/domain/billingWorkflow";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SIEBEL_ENDPOINTS = {
  account: "/data/Account/Account/?PageSize=1&StartRowNum=0",
  serviceRequests: "/data/Service Request/Service Request/?PageSize=25&StartRowNum=0",
  assets: "/data/Asset Management - Asset/Asset Mgmt - Asset?limit=20",
  orders: "/data/Order Entry - Orders/Order Entry - Orders?limit=20",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function buildAuthHeaders(env) {
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

function normalizeSiebelUrl(baseUrl, endpoint) {
  return new URL(endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`);
}

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
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
            resolve(raw ? JSON.parse(raw) : {});
          } catch (error) {
            reject(new Error(`Failed to parse Siebel response from ${url.pathname}: ${error.message}`));
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

function loadSiebelConfig(env) {
  const configPath = path.resolve(__dirname, env.SIEBEL_CONFIG_PATH || "./config/siebel.config.json");
  const baseConfig = {
    useRealApi: false,
    apiBaseUrl: "",
    endpoints: { ...DEFAULT_SIEBEL_ENDPOINTS },
  };

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...baseConfig,
      ...parsed,
      endpoints: {
        ...DEFAULT_SIEBEL_ENDPOINTS,
        ...(parsed.endpoints || {}),
      },
    };
  } catch {
    return baseConfig;
  }
}

function createLiveSiebelProxy(env) {
  const siebelConfig = loadSiebelConfig(env);
  const baseUrl = siebelConfig.apiBaseUrl;
  const authHeaders = buildAuthHeaders(env);

  async function getLiveDataset() {
    if (!baseUrl) {
      throw new Error("Missing Siebel API base URL. Update config/siebel.config.json.");
    }

    const accountPayload = await requestJson(normalizeSiebelUrl(baseUrl, siebelConfig.endpoints.account), authHeaders);
    const serviceRequestsPayload = await requestJson(
      normalizeSiebelUrl(baseUrl, siebelConfig.endpoints.serviceRequests),
      authHeaders,
    );
    const assetsPayload = await requestJson(
      normalizeSiebelUrl(baseUrl, siebelConfig.endpoints.assets),
      authHeaders,
    );
    const ordersPayload = await requestJson(
      normalizeSiebelUrl(baseUrl, siebelConfig.endpoints.orders),
      authHeaders,
    );

    const serviceRequests = transformSiebelServiceRequests(serviceRequestsPayload);

    return {
      account: transformSiebelAccountResponse(accountPayload),
      serviceSummary: transformSiebelServiceSummary({}, serviceRequestsPayload),
      servicePreview: transformSiebelServicePreview(serviceRequestsPayload),
      serviceRequests,
      assets: transformSiebelAssets(assetsPayload),
      recentOrders: transformSiebelRecentOrders(ordersPayload),
    };
  }

  return {
    async handle(req, res, url) {
      const dataset = await getLiveDataset();

      if (req.method === "GET" && url.pathname === "/api/siebel/account") {
        return sendJson(res, dataset.account);
      }

      if (req.method === "GET" && url.pathname === "/api/siebel/service-requests/summary") {
        return sendJson(res, dataset.serviceSummary);
      }

      if (req.method === "GET" && url.pathname === "/api/siebel/service-requests/preview") {
        return sendJson(res, dataset.servicePreview);
      }

      if (req.method === "GET" && url.pathname === "/api/siebel/service-requests") {
        const status = url.searchParams.get("status");
        const rows =
          status && status !== "All" ? dataset.serviceRequests.filter((row) => row.status === status) : dataset.serviceRequests;
        return sendJson(res, rows);
      }

      if (req.method === "GET" && url.pathname === "/api/siebel/assets") {
        return sendJson(res, dataset.assets);
      }

      if (req.method === "GET" && url.pathname === "/api/siebel/orders/recent") {
        return sendJson(res, dataset.recentOrders);
      }

      return false;
    },
  };
}

function createMockApiPlugin(env) {
  const siebelConfig = loadSiebelConfig(env);
  const liveProxy = siebelConfig.useRealApi ? createLiveSiebelProxy(env) : null;

  return {
    name: "enterprise-api-layer",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? new URL(req.url, "http://localhost") : null;
        if (!url || !url.pathname.startsWith("/api/")) {
          return next();
        }

        await delay(180);

        try {
          if (liveProxy && url.pathname.startsWith("/api/siebel/")) {
            const handled = await liveProxy.handle(req, res, url);
            if (handled !== false) {
              return;
            }
          }
        } catch (error) {
          return sendJson(
            res,
            {
              error: "Siebel live API request failed",
              detail: error instanceof Error ? error.message : "Unknown Siebel integration error",
            },
            502,
          );
        }

        if (req.method === "GET" && url.pathname === "/api/siebel/account") {
          return sendJson(res, structuredClone(siebelAccountResponse));
        }

        if (req.method === "GET" && url.pathname === "/api/siebel/service-requests/summary") {
          return sendJson(res, structuredClone(siebelServiceSummaryResponse));
        }

        if (req.method === "GET" && url.pathname === "/api/siebel/service-requests/preview") {
          return sendJson(res, structuredClone(siebelServicePreviewResponse));
        }

        if (req.method === "GET" && url.pathname === "/api/siebel/service-requests") {
          const status = url.searchParams.get("status");
          const rows =
            status && status !== "All"
              ? siebelServiceRequestRowsResponse.filter((row) => row.status === status)
              : siebelServiceRequestRowsResponse;
          return sendJson(res, structuredClone(rows));
        }

        if (req.method === "GET" && url.pathname === "/api/siebel/assets") {
          return sendJson(res, structuredClone(siebelAssetsResponse));
        }

        if (req.method === "GET" && url.pathname === "/api/siebel/orders/recent") {
          return sendJson(res, structuredClone(siebelRecentOrdersResponse));
        }

        if (req.method === "GET" && url.pathname === "/api/brm/billing/overview") {
          return sendJson(res, structuredClone(brmBillingOverviewResponse));
        }

        if (req.method === "POST" && url.pathname === "/api/brm/billing/workflow") {
          const body = await readJsonBody(req);
          const result = applyBillingWorkflow(body.workflow, body.prompt ?? "");
          return sendJson(res, result);
        }

        return sendJson(res, { error: "Not found" }, 404);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), createMockApiPlugin(env)],
  };
});
