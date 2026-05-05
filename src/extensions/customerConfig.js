function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BASE_INTAKE_PROMPT =
  "His name is James, address is 123 East 85th Street, Apt 5G, New York, NY 10028. He's looking for something for his family which includes 5 members, 2 of them working from home. OTT Streaming is required for TV watching.";

export const DEFAULT_CUSTOMER_CONFIG = {
  key: "supremo",
  displayName: "Supremo Residential",
  brand: {
    workflowTitle: "Create order for new customer",
    assistantLabel: "Ask Oracle",
  },
  ai: {
    mode: "llm",
  },
  globalization: {
    defaultLocale: "en-US",
    supportedLocales: ["en-US", "fr-FR", "es-ES"],
  },
  defaults: {
    catalogName: "Supremo Catalog",
    priceListName: "DBE NA Pricelist",
    orderNumberPrefix: "CODX-ORDER",
    promotionOrderNumberPrefix: "Ganesh-Codex",
    intakePrompt: BASE_INTAKE_PROMPT,
    intakePlaceholder: "James is located in New York and requires...",
  },
  recommendations: {
    rules: [
      {
        id: "student-mobile-unlimited",
        matchAll: ["student"],
        matchAny: ["mobile", "mobile plan", "mobility", "wireless"],
        preferCategory: "Mobile Plans",
        preferProducts: ["Supremo Mobile Unlimited"],
        score: 220,
        reason: "Student mobile requests should prioritize Supremo Mobile Unlimited in Mobile Plans.",
      },
      {
        id: "family-mobile-family-plan",
        matchAll: ["family"],
        matchAny: ["mobile", "mobile plan", "wireless"],
        preferCategory: "Mobile Plans",
        preferProducts: ["Supremo Mobile Family Plan"],
        score: 180,
        reason: "Family mobile requests should prioritize Supremo Mobile Family Plan.",
      },
      {
        id: "streaming-broadband-bundle",
        matchAny: ["streaming", "ott", "tv", "work from home"],
        preferCategory: "Broadband Plans",
        score: 90,
        reason: "Streaming or work-from-home requests should bias toward broadband bundles.",
      },
    ],
  },
};

export function normalizeCustomerConfig(rawConfig = {}) {
  const requestedAiMode = String(rawConfig.ai?.mode || DEFAULT_CUSTOMER_CONFIG.ai.mode).trim().toLowerCase();
  const aiMode = requestedAiMode === "deterministic" ? "deterministic" : "llm";
  const rawGlobalization = rawConfig.globalization || {};
  const supportedLocales = Array.isArray(rawGlobalization.supportedLocales) && rawGlobalization.supportedLocales.length
    ? rawGlobalization.supportedLocales
    : DEFAULT_CUSTOMER_CONFIG.globalization.supportedLocales;
  const defaultLocale = supportedLocales.includes(rawGlobalization.defaultLocale)
    ? rawGlobalization.defaultLocale
    : DEFAULT_CUSTOMER_CONFIG.globalization.defaultLocale;

  return {
    ...DEFAULT_CUSTOMER_CONFIG,
    ...rawConfig,
    brand: {
      ...DEFAULT_CUSTOMER_CONFIG.brand,
      ...(rawConfig.brand || {}),
    },
    ai: {
      ...DEFAULT_CUSTOMER_CONFIG.ai,
      ...(rawConfig.ai || {}),
      mode: aiMode,
    },
    globalization: {
      ...DEFAULT_CUSTOMER_CONFIG.globalization,
      ...rawGlobalization,
      defaultLocale,
      supportedLocales,
    },
    defaults: {
      ...DEFAULT_CUSTOMER_CONFIG.defaults,
      ...(rawConfig.defaults || {}),
    },
    recommendations: {
      ...DEFAULT_CUSTOMER_CONFIG.recommendations,
      ...(rawConfig.recommendations || {}),
      rules: Array.isArray(rawConfig.recommendations?.rules)
        ? rawConfig.recommendations.rules
        : DEFAULT_CUSTOMER_CONFIG.recommendations.rules,
    },
  };
}

export function getRuntimeCustomerConfig() {
  const runtimeConfig = globalThis.__CUSTOMER_CONFIG__;
  return normalizeCustomerConfig(runtimeConfig || {});
}

export function isLlmModeEnabled(config = {}) {
  return normalizeCustomerConfig(config).ai.mode === "llm";
}

function includesAll(normalizedInput, terms = []) {
  return terms.every((term) => normalizedInput.includes(normalizeText(term)));
}

function includesAny(normalizedInput, terms = []) {
  if (!terms.length) {
    return true;
  }

  return terms.some((term) => normalizedInput.includes(normalizeText(term)));
}

export function getMatchingRecommendationRules(config, input) {
  const normalizedInput = normalizeText(input);
  return (config?.recommendations?.rules || []).filter((rule) => {
    const matchAll = includesAll(normalizedInput, rule.matchAll || []);
    const matchAny = includesAny(normalizedInput, rule.matchAny || []);
    return matchAll && matchAny;
  });
}
