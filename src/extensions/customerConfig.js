function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const DEFAULT_CUSTOMER_CONFIG_KEY = "supremo";

const BASE_INTAKE_PROMPT =
  "His name is James, address is 123 East 85th Street, Apt 5G, New York, NY 10028. He's looking for something for his family which includes 5 members, 2 of them working from home. OTT Streaming is required for TV watching.";

const BASE_CUSTOMER_CONFIG = {
  key: "base",
  displayName: "Base Telco Package",
  brand: {
    workflowTitle: "Create order for new customer",
    assistantLabel: "Ask Oracle",
  },
  defaults: {
    catalogName: "Supremo Catalog",
    priceListName: "DBE NA Pricelist",
    intakePrompt: BASE_INTAKE_PROMPT,
    intakePlaceholder: "James is located in New York and requires...",
  },
  recommendations: {
    rules: [],
  },
};

const SUPREMO_CONFIG = {
  ...BASE_CUSTOMER_CONFIG,
  key: "supremo",
  displayName: "Supremo Residential",
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

const CUSTOMER_TEMPLATE_CONFIG = {
  ...BASE_CUSTOMER_CONFIG,
  key: "customer-template",
  displayName: "Customer Template",
  recommendations: {
    rules: [
      {
        id: "example-rule",
        matchAll: ["student"],
        matchAny: ["mobile"],
        preferCategory: "Mobile Plans",
        preferProducts: ["Supremo Mobile Unlimited"],
        score: 150,
        reason: "Example customer-specific recommendation rule.",
      },
    ],
  },
};

const CUSTOMER_CONFIGS = {
  base: BASE_CUSTOMER_CONFIG,
  supremo: SUPREMO_CONFIG,
  "customer-template": CUSTOMER_TEMPLATE_CONFIG,
};

export function getCustomerConfig(configKey = DEFAULT_CUSTOMER_CONFIG_KEY) {
  return CUSTOMER_CONFIGS[configKey] || CUSTOMER_CONFIGS[DEFAULT_CUSTOMER_CONFIG_KEY];
}

export function listCustomerConfigs() {
  return Object.values(CUSTOMER_CONFIGS).map((config) => ({
    key: config.key,
    displayName: config.displayName,
  }));
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
