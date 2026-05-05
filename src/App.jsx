import { useEffect, useMemo, useState } from "react";
import {
  addSiebelOrderItem,
  applySiebelPromotion,
  createSiebelAccount,
  createSiebelAccountAction,
  createSiebelContact,
  createSiebelOrder,
  createSiebelOrderPayment,
  getSiebelAccountData,
  getSiebelCatalogHierarchy,
  getSiebelAssets,
  getSiebelCatalogProducts,
  getSiebelRecentOrders,
  getSiebelServicePreview,
  getSiebelServiceRequests,
  getSiebelServiceSummary,
  parseIntakePrompt,
  parseWorkflowAction,
  updateSiebelOrder,
} from "./api/siebelApi";
import {
  getRuntimeCustomerConfig,
  getMatchingRecommendationRules,
  isLlmModeEnabled,
} from "./extensions/customerConfig";
import {
  extractNaturalName,
  splitName,
  toTitleCase,
} from "./domain/intakeParsing";
import { LOCALE_LABELS, getSupportedLocale, translateStaticText } from "./i18n/languagePacks";
import { useRuntimeLocalization } from "./i18n/useRuntimeLocalization";

const CUSTOMER_CONFIG = getRuntimeCustomerConfig();
const APP_TITLE = CUSTOMER_CONFIG.brand.workflowTitle;
const IS_LLM_MODE_ENABLED = isLlmModeEnabled(CUSTOMER_CONFIG);
const DEFAULT_LOCALE = getSupportedLocale(CUSTOMER_CONFIG.globalization?.defaultLocale || "en-US");
const SUPPORTED_LOCALES = (CUSTOMER_CONFIG.globalization?.supportedLocales || ["en-US", "fr-FR", "es-ES"])
  .map((locale) => getSupportedLocale(locale))
  .filter((locale, index, locales) => locales.indexOf(locale) === index);

const HOME_ACTIVITIES = [
  { title: "Supremo Oppurtunity", detail: "New opportunity created at 1:26 PM", icon: "☰" },
  { title: "Follow up with contact for Ace Corp", detail: "Note at 4:00 PM", icon: "▣" },
  { title: "Matt Hopper", detail: "Outbound call at 8:00 AM", icon: "◔" },
  { title: "Mathew Wireless Updated", detail: "Sales stage to Qualification", icon: "✎" },
];

const TASK_ITEMS = [
  APP_TITLE,
  "Create a New Opportunity",
  "Create Agreement",
  "Add New Account",
  "Update Opportunity",
];

const DEFAULT_ADDRESS = "123 East 85th Street, Apt 5G, New York, NY 10028";
const DEFAULT_SIEBEL_CATALOG = CUSTOMER_CONFIG.defaults.catalogName;
const DEFAULT_SIEBEL_PRICE_LIST = CUSTOMER_CONFIG.defaults.priceListName;
const DEFAULT_PROMOTION_ORDER_NUMBER_PREFIX = CUSTOMER_CONFIG.defaults.promotionOrderNumberPrefix || "DX4C_O1";
const INTAKE_PROMPT = CUSTOMER_CONFIG.defaults.intakePrompt;
const INTAKE_PLACEHOLDER = CUSTOMER_CONFIG.defaults.intakePlaceholder;

const PRODUCTS = [
  {
    id: "supremo-mobile-internet",
    family: "Deal",
    name: "Supremo Mobile + Internet",
    description:
      "Maximize your savings by combining all your essential services into one convenient package. Bundle your home internet and TV with our top-rated mobility service to enjoy seamless connectivity and entertainment.",
    recommendation:
      "Based on these requirements — a family of 5, 2 people working from home, and the need for OTT streaming for TV — the Supremo Mobile + Internet Pro plan would be the best fit.",
    listPrice: "$100.00",
    yourPrice: "$66.00",
    fee: "$84.00",
    thumb: "deal",
  },
  {
    id: "supremo-5g-mobility",
    family: "Mobility",
    name: "Supremo 5G Mobility",
    description: "Jump on the leading 5G network with Supremo Mobility. Unlimited talk & text.",
    recommendation:
      "Given the requirements, the Supremo 5G Mobility package is recommended, as it supports streaming across multiple devices.",
    listPrice: "$100.00",
    yourPrice: "$66.00",
    fee: "$66.00",
    thumb: "mobility",
  },
  {
    id: "supremo-mobile-infinity",
    family: "Mobility",
    name: "Supremo Mobile infinity",
    description: "For students who prioritize data. 200GB with pay as go talk & text.",
    recommendation: "A more mobile-first option with extra headroom for heavy data usage.",
    listPrice: "$100.00",
    yourPrice: "$66.00",
    fee: "$66.00",
    thumb: "infinity",
  },
  {
    id: "supremo-pro-basic",
    family: "Internet",
    name: "Supremo Mobile + Internet pro basic",
    description: "FTTH Internet starting at 500 Mbps Up & Down.",
    recommendation: "A lighter internet-focused bundle for smaller households.",
    listPrice: "$100.00",
    yourPrice: "$66.00",
    fee: "$72.00",
    thumb: "internet",
  },
];

const RECOMMENDATION_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "in",
  "is",
  "it",
  "its",
  "looking",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "requires",
  "she",
  "something",
  "that",
  "the",
  "their",
  "them",
  "they",
  "to",
  "us",
  "wants",
  "we",
  "with",
]);

const RECOMMENDATION_SIGNAL_DEFINITIONS = [
  {
    id: "mobile",
    weight: 22,
    keywords: ["mobile", "mobility", "wireless", "cell", "cellular", "phone", "handset", "5g"],
  },
  {
    id: "internet",
    weight: 20,
    keywords: ["internet", "broadband", "fiber", "wifi", "ftth", "home internet"],
  },
  {
    id: "tv",
    weight: 18,
    keywords: ["tv", "television", "ott", "streaming", "stream", "video", "entertainment"],
  },
  {
    id: "student",
    weight: 18,
    keywords: ["student", "students", "college", "campus", "school", "university"],
  },
  {
    id: "family",
    weight: 16,
    keywords: ["family", "household", "kids", "children", "members", "shared"],
  },
  {
    id: "work",
    weight: 14,
    keywords: ["work from home", "working from home", "remote work", "remote", "home office", "office"],
  },
  {
    id: "bundle",
    weight: 12,
    keywords: ["bundle", "bundled", "promotion", "promo", "package", "combo", "all in one"],
  },
  {
    id: "budget",
    weight: 10,
    keywords: ["budget", "affordable", "cheap", "save", "saving", "savings", "low cost", "value"],
  },
];

const CORE_RECOMMENDATION_SIGNALS = new Set(["mobile", "internet", "tv"]);

function signalMatchesRecommendationText(signal, text) {
  if (!signal) {
    return false;
  }
  return signal.keywords.some((keyword) => text.includes(normalizeRecommendationText(keyword)));
}

const CART_ROWS = [
  { level: 0, label: "Supremo Mobile + Internet", quantity: "1", monthlyFee: "$84.00", action: "⌘" },
  { level: 1, label: "Supremo Wireless Service", quantity: "1", monthlyFee: "$12.00", action: "⌘" },
  { level: 2, label: "Supremo Data Service", quantity: "1", monthlyFee: "$12.00" },
  { level: 3, label: "Supremo 6G Mobile Service", quantity: "1", monthlyFee: "$12.00" },
  { level: 2, label: "Supremo Wireless Proximity Service", quantity: "1", monthlyFee: "$12.00" },
  { level: 1, label: "Supremo_TDS_Data Service", quantity: "1", monthlyFee: "$12.00", action: "⌘" },
  { level: 2, label: "Email Standard Fee", quantity: "1", monthlyFee: "$12.00" },
  { level: 1, label: "Galaxy 6720", quantity: "1", monthlyFee: "$12.00" },
];

const STEP_DEFINITIONS = [
  { id: "account", label: "Account and contact details", incomplete: "Incomplete account details" },
  { id: "product", label: "Product selected", incomplete: "No product selected" },
  { id: "service", label: "Service and billing accounts", incomplete: "Service and billing account not assigned" },
  { id: "billing", label: "Billing and shipping information", incomplete: "Billing and shipping information not provided" },
  { id: "payment", label: "Payment information", incomplete: "Payment information not available" },
  { id: "summary", label: "Call summary", incomplete: "Call summary not added" },
];

const SAMPLE_ACCOUNT_INPUT =
  "8989898989, 3333333333, Smith, Kelly, Director of Technology, 040-9089-9087, james.k@sample.com";
const SAMPLE_PAYMENT_INPUT = "James Kelly, Visa, 4111 1111 1111 1111, expires 08/2028.";
const GENERATED_SUMMARY =
  "Spoke with the customer to confirm account setup and order details for a new account. Verified contact information, billing address, and payment method. Completed credit check successfully and reviewed subscription selection and pricing. Customer confirmed acceptance of terms and requested order placement. Proceeded with creating the order and initiating service activation.";

const CUSTOMER_360_BASE = {
  status: "Active",
  accountNumber: "1-J6L5",
  phone: "(412) 312-4031",
};

const C360_COLUMNS = [
  {
    id: "spotlight",
    title: "Spotlight",
    content: [
      { kind: "bar", label: "Churn", value: "30%", score: 30 },
      { kind: "bar", label: "Credit Rating", value: "85%", score: 85 },
      { kind: "bar", label: "NPS", value: "85%", score: 85 },
      { kind: "currency_meter", label: "CLTV", value: "$15,000", amount: 15000, strength: 4 },
    ],
    offers: [
      { name: "Supremo 5G essentials", copy: "Enhance your connectivity with fast and reliable 5G performance." },
      { name: "Supremo home monitoring", copy: "Keep your home secure with smart, real-time monitoring solutions." },
    ],
  },
  {
    id: "service-requests",
    title: "Service requests",
    summary: "3 open\n8 total",
    rows: [
      { name: "Fiber Cut - Service Outage", detail: "Last updated on 06/08/2024", state: "Open" },
      { name: "Fiber Cut - Service Outage", detail: "Last updated on 06/08/2024", state: "Pending" },
      { name: "Customer reported slow internet speeds", detail: "Last updated on 06/08/2024", state: "Closed" },
    ],
    footer: "View all service requests",
  },
  {
    id: "purchases",
    title: "Purchases",
    rows: [
      { name: "Supremo Buy More Save More", detail: "Your price $66.00", state: "Active" },
      { name: "Supremo Family plan Starter", detail: "07/01/2023 - 07/01/2024", state: "Suspended" },
      { name: "Order for Supremo 5G Student Promo", detail: "Last updated on 04/28/2024", state: "Pending" },
      { name: "Order for TV", detail: "Last updated on 04/28/2024", state: "Open" },
    ],
    footer: "View all orders",
  },
  {
    id: "billing",
    title: "Billing",
    billingCard: true,
    bills: [
      { title: "20 June 2025", detail: "$88.00 due\n$225.00 total" },
      { title: "20 June 2025", detail: "$88.00 due\n$225.00 total" },
    ],
    footer: "View all bills",
  },
  {
    id: "timeline",
    title: "Timeline",
    rows: [
      { name: "Customer called to ask about SR #12891", detail: "Customer Call" },
      { name: "Fiber cut - service outage", detail: "SR #12891" },
      { name: "Order for TV", detail: "#435390347905" },
      { name: "Cart created with 3 items", detail: "#435390347905" },
      { name: "Email received, customer sent in feedback form", detail: "Customer Email" },
    ],
    footer: "View all customer interactions",
  },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeMessage(role, text, appearance = "bubble") {
  return { id: createId(), role, text, appearance };
}

function normalizeSpacing(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getContactName(state) {
  if (state.customer?.name) {
    return state.customer.name;
  }

  const accountName = [state.account?.firstName, state.account?.lastName].filter(Boolean).join(" ").trim();
  return accountName || "James Kelly";
}

function getPaymentCardholderName(state) {
  return state.payment.cardholderName || getContactName(state);
}

function buildCustomer360Record(state) {
  const contactName = getContactName(state);
  const emailName = contactName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return {
    ...CUSTOMER_360_BASE,
    name: contactName,
    address: state.customer.address || DEFAULT_ADDRESS,
    email: `${emailName || "james.kelly"}@email.com`,
  };
}

function buildCustomer360Columns(liveData, workflowState) {
  if (!liveData) {
    return C360_COLUMNS;
  }

  const accountRecommendations = liveData.account?.recommendations ?? [];
  const spotlightStats = liveData.account?.spotlightStats ?? [];
  const serviceSummary = liveData.serviceSummary;
  const servicePreview = (liveData.servicePreview ?? []).slice(0, 3);
  const assets = (liveData.assets ?? []).slice(0, 3);
  const liveOrders = liveData.recentOrders ?? [];
  const submittedOrder =
    workflowState?.orderNumber
      ? {
          id: workflowState.orderNumber,
          title: `Order ${workflowState.orderNumber}`,
          updated: "Just submitted",
          status: workflowState.orderStatus || "Pending",
        }
      : null;
  const orders = submittedOrder
    ? [submittedOrder, ...liveOrders.filter((item) => item.id !== submittedOrder.id)].slice(0, 3)
    : liveOrders.slice(0, 3);
  const purchaseRows = [...orders, ...assets].slice(0, 3);

  return [
    {
      id: "spotlight",
      title: "Spotlight",
      content: spotlightStats,
      offers: accountRecommendations.map((item) => ({
        name: item.title,
        copy: item.body,
        price: item.price,
      })),
    },
    {
      id: "service-requests",
      title: "Service requests",
      summary: `${serviceSummary?.open ?? 0} open\n${serviceSummary?.total ?? 0} total`,
      rows: servicePreview.map((item) => ({
        name: item.title,
        detail: `${item.id} • ${item.updated}`,
        state: item.status,
      })),
      footer: "View all service requests",
    },
    {
      id: "purchases",
      title: "Purchases",
      rows: purchaseRows.map((item) => ({
        name: item.title,
        detail: `${item.id} • ${item.subtitle || item.updated || ""}`.replace(/\s+•\s*$/, ""),
        state: item.status,
      })),
      footer: "View all orders",
    },
    C360_COLUMNS[3],
    C360_COLUMNS[4],
  ];
}

function createWorkflowState(initialDetails = {}) {
  const parsedName = splitName(initialDetails.name || "James Kelly");
  const contactName = parsedName.name;
  const address = initialDetails.address || DEFAULT_ADDRESS;
  const catalogName = initialDetails.catalogName || DEFAULT_SIEBEL_CATALOG;
  const priceListName = initialDetails.priceListName || DEFAULT_SIEBEL_PRICE_LIST;
  const intakePrompt = initialDetails.intakePrompt || INTAKE_PROMPT;
  const intakeAnalysis = initialDetails.intakeAnalysis || {
    source: "fallback",
    prospectType: "",
    customerSegment: "",
    productInterest: "",
    requestedProductCategories: [],
    intentSummary: intakePrompt,
    detail: "",
  };

  return {
    intakePrompt,
    intakeAnalysis,
    selectedProductId: "",
    catalogSelectionId: PRODUCTS[0].id,
    catalogName,
    priceListName,
    orderId: "",
    orderNumber: "",
    orderStatus: "",
    cartItems: [],
    siebelContact: null,
    siebelAccount: null,
    customer: {
      name: contactName,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      address,
    },
    account: {
      accountSite: "New York",
      mobileNumber: "",
      governmentId: "",
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      jobTitle: "",
      workPhone: "",
      email: "",
    },
    serviceBilling: {
      shippingAccount: "",
      billingAccount: "",
    },
    billing: {
      billingAddress: "",
      shippingAddress: "",
    },
    payment: {
      cardholderName: "",
      cardType: "",
      cardNumber: "",
      expiry: "",
    },
    summaryText: "",
    composer: "",
    hiddenRecommendations: [],
    messages: [
      makeMessage("user", intakePrompt),
      makeMessage("assistant", "A few details have been added to the order. Next capture account details before product selection."),
      makeMessage(
        "assistant",
        "Which account should I create for this sale? Once that is ready I can move to product selection or apply the recommendation directly.",
      ),
      makeMessage("assistant", "After the account is created, you can browse product categories or review the recommendation."),
    ],
  };
}

function findProduct(productId) {
  return PRODUCTS.find((product) => product.id === productId) ?? null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findProductInCategories(categories, productId) {
  for (const category of categories || []) {
    const product = category.products?.find((item) => item.id === productId);
    if (product) {
      return product;
    }
  }

  return null;
}

function findProductByText(products, input) {
  const normalizedInput = normalizeSpacing(input).toLowerCase();
  return products.find((product) => normalizedInput.includes(product.name.toLowerCase())) ?? null;
}

function normalizeRecommendationText(value) {
  return normalizeSpacing(String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")).trim();
}

function tokenizeRecommendationText(value) {
  return normalizeRecommendationText(value)
    .split(" ")
    .filter((token) => token && !RECOMMENDATION_STOP_WORDS.has(token) && (token.length > 2 || /\d/.test(token)));
}

function inferRecommendationSignals(input) {
  const normalized = normalizeRecommendationText(input);
  const tokens = tokenizeRecommendationText(input);
  const strengths = {};

  for (const signal of RECOMMENDATION_SIGNAL_DEFINITIONS) {
    const matchedKeywords = signal.keywords.filter((keyword) => normalized.includes(normalizeRecommendationText(keyword)));
    if (matchedKeywords.length) {
      strengths[signal.id] = matchedKeywords.length;
    }
  }

  const coreSignals = Object.keys(strengths).filter((signalId) => CORE_RECOMMENDATION_SIGNALS.has(signalId));
  const prefersPromotion =
    Boolean(strengths.bundle) ||
    coreSignals.length > 1 ||
    Boolean(strengths.family) ||
    Boolean(strengths.tv) ||
    Boolean(strengths.work);

  return {
    normalized,
    tokens: [...new Set(tokens)],
    strengths,
    coreSignals,
    prefersPromotion,
  };
}

function buildRecommendationCatalogEntries(products, categories) {
  const categoryMetaByProductId = new Map();

  for (const category of categories || []) {
    for (const product of category.products || []) {
      const key = product.id;
      if (!categoryMetaByProductId.has(key)) {
        categoryMetaByProductId.set(key, {
          categoryIds: new Set(),
          categoryNames: new Set(),
        });
      }

      const meta = categoryMetaByProductId.get(key);
      if (category.id) {
        meta.categoryIds.add(category.id);
      }
      if (category.name) {
        meta.categoryNames.add(category.name);
      }
    }
  }

  return (products || []).map((product) => {
    const meta = categoryMetaByProductId.get(product.id);
    const categoryNames = meta?.categoryNames ? [...meta.categoryNames] : [product.categoryName, product.family].filter(Boolean);
    const nameSearchText = normalizeRecommendationText(product.name);
    const descriptionSearchText = normalizeRecommendationText(product.description);
    const searchText = normalizeRecommendationText(
      [
        product.name,
        product.description,
        product.family,
        product.categoryName,
        product.productCategory,
        product.promotionType,
        product.classProductCode,
        ...categoryNames,
      ]
        .filter(Boolean)
        .join(" "),
    );

    return {
      product,
      categoryIds: meta?.categoryIds ? [...meta.categoryIds] : [],
      categoryNames,
      nameSearchText,
      descriptionSearchText,
      categorySearchText: normalizeRecommendationText(categoryNames.join(" ")),
      searchText,
    };
  });
}

function formatRecommendationReason(entry, matchedSignals, analysis) {
  const matchedLabels = matchedSignals
    .map((signalId) => {
      if (signalId === "tv") {
        return "TV and streaming";
      }
      if (signalId === "work") {
        return "work-from-home";
      }
      return signalId.charAt(0).toUpperCase() + signalId.slice(1);
    })
    .slice(0, 3);
  const categoryLabel = entry.categoryNames[0] || entry.product.family || "catalog";

  if (matchedLabels.length) {
    const promotionLabel = entry.product.isBundledPromotion && analysis.prefersPromotion ? " bundled promotion" : "";
    return `Best match for ${matchedLabels.join(", ")} needs in the ${categoryLabel} category${promotionLabel}.`;
  }

  if (entry.product.isBundledPromotion && analysis.prefersPromotion) {
    return `Closest bundled promotion match in the ${categoryLabel} category.`;
  }

  return `Closest catalog match in the ${categoryLabel} category.`;
}

function matchRecommendationRuleToEntry(rule, entry) {
  const normalizedCategory = normalizeRecommendationText(rule.preferCategory || "");
  const normalizedProducts = (rule.preferProducts || []).map((product) => normalizeRecommendationText(product));
  const normalizedAvoidCategory = normalizeRecommendationText(rule.avoidCategory || "");
  const normalizedAvoidProducts = (rule.avoidProducts || []).map((product) => normalizeRecommendationText(product));

  const preferredCategoryMatch = normalizedCategory ? entry.categorySearchText.includes(normalizedCategory) : false;
  const preferredProductMatch = normalizedProducts.some((productName) => entry.nameSearchText.includes(productName));
  const avoidCategoryMatch = normalizedAvoidCategory ? entry.categorySearchText.includes(normalizedAvoidCategory) : false;
  const avoidProductMatch = normalizedAvoidProducts.some((productName) => entry.nameSearchText.includes(productName));

  let score = 0;
  let matched = false;

  if (preferredCategoryMatch) {
    score += Math.max(40, Math.round((rule.score || 0) * 0.45));
    matched = true;
  }

  if (preferredProductMatch) {
    score += rule.score || 0;
    matched = true;
  }

  if (avoidCategoryMatch) {
    score -= Math.max(30, Math.round((rule.score || 0) * 0.35));
  }

  if (avoidProductMatch) {
    score -= Math.max(50, Math.round((rule.score || 0) * 0.5));
  }

  return {
    matched,
    score,
  };
}

function scoreRecommendationEntry(entry, analysis, activeRules = []) {
  let score = 0;
  const matchedSignals = [];
  const tokenMatches = [];
  const textTokens = new Set(tokenizeRecommendationText(entry.searchText));
  const matchedBySignal = new Set();
  const matchedCategorySignals = new Set();
  let matchedRule = null;

  const singleCoreSignal = analysis.coreSignals.length === 1 ? analysis.coreSignals[0] : "";
  const inputWantsPlan = /\bplan\b/.test(analysis.normalized) || /\bplans\b/.test(analysis.normalized);

  for (const signal of RECOMMENDATION_SIGNAL_DEFINITIONS) {
    const strength = analysis.strengths[signal.id] || 0;
    if (!strength) {
      continue;
    }

    const matchedKeyword = signalMatchesRecommendationText(signal, entry.searchText);
    const matchedCategoryKeyword = signalMatchesRecommendationText(signal, entry.categorySearchText);
    const matchedNameKeyword = signalMatchesRecommendationText(signal, entry.nameSearchText);
    const matchedDescriptionKeyword = signalMatchesRecommendationText(signal, entry.descriptionSearchText);
    if (matchedKeyword) {
      score += signal.weight + (strength - 1) * 3;
      matchedSignals.push(signal.id);
      matchedBySignal.add(signal.id);
    }
    if (matchedNameKeyword) {
      score += CORE_RECOMMENDATION_SIGNALS.has(signal.id) ? 12 : 8;
    }
    if (matchedDescriptionKeyword) {
      score += signal.id === "student" ? 26 : 12;
    }
    if (matchedCategoryKeyword) {
      score += CORE_RECOMMENDATION_SIGNALS.has(signal.id) ? 18 : 10;
      matchedCategorySignals.add(signal.id);
    }
  }

  for (const token of analysis.tokens) {
    if (textTokens.has(token)) {
      score += token.length > 5 ? 4 : 2;
      tokenMatches.push(token);
    }
  }

  const coveredCoreSignals = analysis.coreSignals.filter((signalId) => matchedSignals.includes(signalId));
  if (analysis.coreSignals.length > 1) {
    score += coveredCoreSignals.length * 8;
    if (coveredCoreSignals.length === analysis.coreSignals.length && entry.product.isBundledPromotion) {
      score += 14;
    }
  }

  if (singleCoreSignal) {
    if (matchedCategorySignals.has(singleCoreSignal)) {
      score += 26;
    }
    if (matchedBySignal.has(singleCoreSignal)) {
      score += 18;
    }

    for (const coreSignal of CORE_RECOMMENDATION_SIGNALS) {
      if (coreSignal === singleCoreSignal) {
        continue;
      }

      if (signalMatchesRecommendationText(RECOMMENDATION_SIGNAL_DEFINITIONS.find((signal) => signal.id === coreSignal), entry.searchText)) {
        score -= 22;
      }
    }
  }

  if (inputWantsPlan && /\bplans?\b/.test(entry.categorySearchText)) {
    score += 14;
  }

  if (inputWantsPlan && /\bplans?\b/.test(entry.nameSearchText)) {
    score += 8;
  }

  if (entry.product.isBundledPromotion) {
    score += analysis.prefersPromotion ? 16 : 6;
  } else if (analysis.prefersPromotion) {
    score -= 4;
  }

  if (matchedSignals.includes("student") && entry.product.isBundledPromotion) {
    score += 6;
  }

  if (analysis.strengths.student && !matchedBySignal.has("student")) {
    score -= 8;
  }

  if (analysis.strengths.student && signalMatchesRecommendationText(RECOMMENDATION_SIGNAL_DEFINITIONS.find((signal) => signal.id === "student"), entry.descriptionSearchText)) {
    score += 18;
  }

  if (singleCoreSignal && !matchedBySignal.has(singleCoreSignal) && !matchedCategorySignals.has(singleCoreSignal)) {
    score -= 18;
  }

  for (const rule of activeRules) {
    const ruleMatch = matchRecommendationRuleToEntry(rule, entry);
    score += ruleMatch.score;
    if (ruleMatch.matched && (!matchedRule || (rule.score || 0) > (matchedRule.score || 0))) {
      matchedRule = rule;
    }
  }

  return {
    score,
    matchedSignals,
    tokenMatches,
    matchedRule,
  };
}

function findBestRecommendedProduct(products, categories, input) {
  const entries = buildRecommendationCatalogEntries(products, categories);
  if (!entries.length) {
    return null;
  }

  const analysis = inferRecommendationSignals(input);
  const activeRules = getMatchingRecommendationRules(CUSTOMER_CONFIG, input);
  const rankedEntries = entries
    .map((entry) => {
      const scored = scoreRecommendationEntry(entry, analysis, activeRules);
      return {
        ...entry,
        ...scored,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.product.isBundledPromotion !== right.product.isBundledPromotion) {
        return left.product.isBundledPromotion ? -1 : 1;
      }
      return left.product.name.localeCompare(right.product.name);
    });

  const best = rankedEntries[0];

  return {
    product: best.product,
    score: best.score,
    categoryNames: best.categoryNames,
    matchedSignals: best.matchedSignals,
    reason: best.matchedRule?.reason || formatRecommendationReason(best, best.matchedSignals, analysis),
  };
}

function buildCartRows(items) {
  const byParent = new Map();
  const roots = [];

  for (const item of items || []) {
    const parentId =
      item.parentQuoteItemId && item.parentQuoteItemId !== item.id ? item.parentQuoteItemId : "";
    if (!parentId) {
      roots.push(item);
      continue;
    }

    const children = byParent.get(parentId) || [];
    children.push(item);
    byParent.set(parentId, children);
  }

  const rows = [];
  function walk(node, level) {
    rows.push({ ...node, level });
    const children = byParent.get(node.id) || [];
    for (const child of children) {
      walk(child, level + 1);
    }
  }

  for (const root of roots.sort((a, b) => a.lineNumber - b.lineNumber)) {
    walk(root, 0);
  }

  return rows;
}

function getParentRowIds(rows) {
  const parentIds = new Set();

  for (const row of rows || []) {
    if (row.parentQuoteItemId && row.parentQuoteItemId !== row.id) {
      parentIds.add(row.parentQuoteItemId);
    }
  }

  return parentIds;
}

function getVisibleCartRows(rows, expandedRowIds) {
  const visibleRows = [];
  const expandedAncestors = [];

  for (const row of rows || []) {
    while (expandedAncestors.length > row.level) {
      expandedAncestors.pop();
    }

    const parentExpanded = expandedAncestors.every(Boolean);
    if (!parentExpanded) {
      expandedAncestors.push(Boolean(expandedRowIds[row.id]));
      continue;
    }

    visibleRows.push(row);
    expandedAncestors.push(Boolean(expandedRowIds[row.id]));
  }

  return visibleRows;
}

function parseMoneyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const numeric = Number(String(value || "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoneyValue(value) {
  return `$${parseMoneyValue(value).toFixed(2)}`;
}

function resolvePriceType(row, rowProduct) {
  const explicit = String(row?.priceType || rowProduct?.priceType || "").toLowerCase();
  if (explicit.includes("one")) return "one-time";
  if (explicit.includes("recurr")) return "recurring";
  if (explicit.includes("monthly")) return "recurring";

  const productTypeCode = String(row?.productTypeCode || "").toLowerCase();
  if (productTypeCode === "promotion") {
    return "one-time";
  }

  return "recurring";
}

function resolveNetPrice(row, rowProduct) {
  const candidates = [
    row?.netPrice,
    row?.currentPrice,
    row?.unitPrice,
    rowProduct?.netPrice,
    rowProduct?.yourPrice,
    rowProduct?.fee,
  ];

  for (const candidate of candidates) {
    if (parseMoneyValue(candidate) || String(candidate || "").trim() === "0") {
      return parseMoneyValue(candidate);
    }
  }

  return 0;
}

function getRowFeeBreakdown(row, rowProduct) {
  const netPrice = resolveNetPrice(row, rowProduct);
  const priceType = resolvePriceType(row, rowProduct);

  return {
    monthlyFee: priceType === "one-time" ? 0 : netPrice,
    oneTimeFee: priceType === "one-time" ? netPrice : 0,
  };
}

function parseAccountInput(input, fallbackFirstName) {
  const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    mobileNumber: parts[0] ?? "8989898989",
    governmentId: parts[1] ?? "3333333333",
    lastName: parts[2] ?? "Kelly",
    firstName: parts[3] ?? fallbackFirstName,
    jobTitle: parts[4] ?? "Director of Technology",
    workPhone: parts[5] ?? "040-9089-9087",
    email: parts[6] ?? "james.k@sample.com",
  };
}

function sanitizeDigits(value) {
  return (value || "").replace(/\D+/g, "");
}

function formatCardNumber(value) {
  const digits = sanitizeDigits(value);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function inferCardType(cardNumber) {
  const digits = sanitizeDigits(cardNumber);
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

function parsePaymentInput(input, fallbackCardholderName = "James Kelly") {
  const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    cardholderName: parts[0] ?? fallbackCardholderName,
    cardType: parts[1] ?? "Visa",
    cardNumber: parts[2] ?? "4111 1111 1111 1111",
    expiry: (parts[3] ?? "expires 08/2028.").replace(/^expires\s*/i, "").replace(/\.$/, ""),
  };
}

function parseCatalogPreferences(input, currentCatalogName, currentPriceListName) {
  const catalogMatch =
    input.match(/\bcatalog(?:\s+should\s+be|\s+is|=|:)?\s+([^,.;]+)/i) ||
    input.match(/\buse catalog\s+([^,.;]+)/i);
  const priceListMatch =
    input.match(/\bprice\s*list(?:\s+should\s+be|\s+is|=|:)?\s+([^,.;]+)/i) ||
    input.match(/\bpricelist(?:\s+should\s+be|\s+is|=|:)?\s+([^,.;]+)/i) ||
    input.match(/\buse pricelist\s+([^,.;]+)/i);

  return {
    catalogName: catalogMatch?.[1]?.trim() || currentCatalogName || DEFAULT_SIEBEL_CATALOG,
    priceListName: priceListMatch?.[1]?.trim() || currentPriceListName || DEFAULT_SIEBEL_PRICE_LIST,
  };
}

function parseNaturalContactCommand(input, state) {
  const contactName = extractNaturalName(input) || getContactName(state);
  const parsedName = splitName(contactName);
  const emailMatch = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = input.match(/\b(?:phone(?: number)?|mobile(?: number)?|work phone|contact phone)?\s*(?:is|=|:)?\s*([\d()+\-\s]{7,})/i);

  return {
    firstName: parsedName.firstName,
    lastName: parsedName.lastName,
    email: emailMatch?.[0] || state.account.email || "",
    workPhone: sanitizeDigits(phoneMatch?.[1] || state.account.workPhone || state.account.mobileNumber || ""),
  };
}

function parseNaturalAccountCommand(input, state) {
  const defaults = parseAccountInput(SAMPLE_ACCOUNT_INPUT, state.customer.firstName);
  const currentName = getContactName(state);
  const commandName = extractNaturalName(input) || currentName;
  const parsedName = splitName(commandName);
  const primaryContactSameAsAccount = /\bprimary contact(?: is| =|:)?\s+(?:the\s+)?same\s+as\s+account\b/i.test(input);
  const emailMatch = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const labeledMobile = input.match(/\b(?:mobile(?: number)?|cell(?: number)?|phone(?: number)?)\s*(?:is|=|:)?\s*([\d()+\-\s]{7,})/i);
  const allLongNumbers = [...input.matchAll(/\b\d[\d()\-\s]{7,}\d\b/g)].map((match) => sanitizeDigits(match[0])).filter(Boolean);
  const governmentIdMatch = input.match(/\b(?:government id|tax id|id(?: number)?)\s*(?:is|=|:)?\s*([\d-]{6,})/i);
  const workPhoneMatch = input.match(/\b(?:work phone(?: number)?|office phone)\s*(?:is|=|:)?\s*([\d()+\-\s]{7,})/i);
  const titleMatch = input.match(/\b(?:job title|title)\s*(?:is|=|:)?\s*([^,.;]+)/i);
  const siteMatch = input.match(/\b(?:account site|site|location)\s*(?:is|=|:)?\s*([^,.;]+)/i);

  const explicitMobile = sanitizeDigits(labeledMobile?.[1] || "");
  const explicitGovernmentId = sanitizeDigits(governmentIdMatch?.[1] || "");
  const explicitWorkPhone = sanitizeDigits(workPhoneMatch?.[1] || "");
  const unlabeledNumbers = allLongNumbers.filter(
    (value) => value !== explicitMobile && value !== explicitGovernmentId && value !== explicitWorkPhone,
  );

  const mobileNumber = explicitMobile || unlabeledNumbers[0] || defaults.mobileNumber;
  const governmentId = explicitGovernmentId || unlabeledNumbers[1] || defaults.governmentId;
  const workPhone = explicitWorkPhone || unlabeledNumbers[2] || defaults.workPhone;

  return {
    customer: {
      ...state.customer,
      name: primaryContactSameAsAccount ? parsedName.name : state.customer.name,
      firstName: primaryContactSameAsAccount ? parsedName.firstName : state.customer.firstName,
      lastName: primaryContactSameAsAccount ? parsedName.lastName : state.customer.lastName,
    },
    account: {
      accountSite: siteMatch?.[1]?.trim() || state.account.accountSite || "New York",
      mobileNumber,
      governmentId,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      jobTitle: titleMatch?.[1]?.trim() || defaults.jobTitle,
      workPhone,
      email: emailMatch?.[0] || defaults.email,
    },
  };
}

function parseNaturalPaymentCommand(input, state) {
  const fallbackCardholderName = getContactName(state);
  const parsedDefaults = parsePaymentInput(SAMPLE_PAYMENT_INPUT, fallbackCardholderName);
  const cardholderMatch = input.match(/\b(?:cardholder|name on card)\s*(?:is|=|:)?\s*([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,2})/i);
  const cardNumberMatch = input.match(/\b(?:card(?: info| number)?|visa|mastercard|amex|discover)?[^\d]*(\d[\d\s-]{11,24}\d)\b/i);
  const expiryMatch = input.match(/\b(?:exp(?:iry|iration)?|expires?)\s*(?:is|=|:)?\s*((?:0?[1-9]|1[0-2])[\/-](?:\d{2}|\d{4}))\b/i);
  const cardNumber = formatCardNumber(cardNumberMatch?.[1] || parsedDefaults.cardNumber);
  const cardTypeMatch = input.match(/\b(visa|mastercard|amex|discover)\b/i);

  return {
    cardholderName: cardholderMatch?.[1] ? toTitleCase(cardholderMatch[1]) : fallbackCardholderName,
    cardType: cardTypeMatch?.[1] ? toTitleCase(cardTypeMatch[1]) : inferCardType(cardNumber) || parsedDefaults.cardType,
    cardNumber,
    expiry: expiryMatch?.[1] || parsedDefaults.expiry,
  };
}

function OracleMark() {
  return (
    <span className="oracle-mark" aria-hidden="true">
      <span></span>
    </span>
  );
}

function AskOracleIcon() {
  return (
    <span className="ask-oracle-icon" aria-hidden="true">
      <span className="ask-oracle-icon__glyph"></span>
    </span>
  );
}

function AskOracleChatIcon() {
  return (
    <span className="ask-oracle-chat-icon" aria-hidden="true">
      <span className="ask-oracle-chat-icon__ring"></span>
    </span>
  );
}

function AccentRule() {
  return <div className="accent-rule" aria-hidden="true"></div>;
}

function SectionAccent() {
  return <div className="section-accent" aria-hidden="true"></div>;
}

function CustomerArt() {
  return (
    <div className="customer-art" aria-hidden="true">
      <div className="customer-art__ring"></div>
      <div className="customer-art__gold"></div>
      <div className="customer-art__blue"></div>
      <div className="customer-art__pink"></div>
      <div className="customer-art__earth"></div>
    </div>
  );
}

function CartIllustration() {
  return (
    <svg viewBox="0 0 240 150" className="cart-illustration" role="img" aria-label="Decorative cart illustration">
      <defs>
        <linearGradient id="cart-sun" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f7df8f" />
          <stop offset="100%" stopColor="#ffd36d" />
        </linearGradient>
        <linearGradient id="cart-water" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1f6e79" />
          <stop offset="100%" stopColor="#1a4d63" />
        </linearGradient>
      </defs>
      <path
        d="M103 20c22-10 46-10 66 5 11 9 20 23 19 37-1 18-11 35-22 48-12 14-27 26-45 30-19 4-39-1-55-12-16-11-28-29-31-48-3-17 3-34 15-46 12-11 32-8 53-14Z"
        fill="url(#cart-sun)"
      />
      <path
        d="M51 76c32 4 53-16 78-16 30 0 45 23 70 19 0 28-23 49-71 49-51 0-77-19-77-52Z"
        fill="url(#cart-water)"
      />
      <path d="M99 19c10 26 14 49 9 66-7 1-13 2-20 5-2-26 1-51 11-71Z" fill="#9ccdc8" opacity="0.8" />
      <path d="M52 91c29-7 52 6 81 3 15-2 29-7 44-11v10c-14 5-28 8-42 8-31 0-52-14-83-10Z" fill="#83b8a3" opacity="0.45" />
    </svg>
  );
}

function ProductThumb({ tone }) {
  return <div className={`product-thumb product-thumb--${tone}`}></div>;
}

function CustomerInsight({ item }) {
  if (item.kind === "currency_meter") {
    return (
      <div className="customer360-insight customer360-insight--currency">
        <span>{item.label}</span>
        <div className="customer360-currency-meter">
          <strong>{item.value}</strong>
          <div className="customer360-currency-meter__steps" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={`${item.label}-${index}`}
                className={
                  index < (item.strength || 0)
                    ? "customer360-currency-meter__step customer360-currency-meter__step--active"
                    : "customer360-currency-meter__step"
                }
              >
                $
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer360-insight customer360-insight--bar">
      <div className="customer360-insight__header">
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </div>
      <div className="customer360-insight-bar" aria-hidden="true">
        <div className="customer360-insight-bar__fill" style={{ width: `${item.score || 0}%` }}></div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState("home");
  const [locale, setLocale] = useState(() => getSupportedLocale(localStorage.getItem("salesAssistantLocale") || DEFAULT_LOCALE));
  const [intakeExpanded, setIntakeExpanded] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState(INTAKE_PLACEHOLDER);
  const [workflow, setWorkflow] = useState(createWorkflowState);
  const [siebelState, setSiebelState] = useState({
    status: "idle",
    error: "",
    data: null,
  });
  const [smartActionDraft, setSmartActionDraft] = useState("");
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [notification, setNotification] = useState("");
  const [pendingIntakeRecommendationId, setPendingIntakeRecommendationId] = useState("");
  const [isApplyingIntakeRecommendation, setIsApplyingIntakeRecommendation] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [drawerDraft, setDrawerDraft] = useState({});
  const [expandedCartRows, setExpandedCartRows] = useState({});
  const [catalogState, setCatalogState] = useState({
    status: "idle",
    error: "",
    view: "search",
    query: "",
    browseCategoryId: "",
    products: PRODUCTS,
    categories: [],
    requestedCatalogName: DEFAULT_SIEBEL_CATALOG,
    requestedPriceListName: DEFAULT_SIEBEL_PRICE_LIST,
    resolvedCatalogName: DEFAULT_SIEBEL_CATALOG,
    resolvedPriceListName: DEFAULT_SIEBEL_PRICE_LIST,
    resolvedPriceListId: "",
  });

  useRuntimeLocalization(locale);

  useEffect(() => {
    localStorage.setItem("salesAssistantLocale", locale);
  }, [locale]);

  useEffect(() => {
    const localizedDefaults = SUPPORTED_LOCALES.map((supportedLocale) => translateStaticText(INTAKE_PLACEHOLDER, supportedLocale));
    setIntakeDraft((current) =>
      current === INTAKE_PLACEHOLDER || localizedDefaults.includes(current)
        ? translateStaticText(INTAKE_PLACEHOLDER, locale)
        : current
    );
  }, [locale]);

  function formatLocalizedMoney(value) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(parseMoneyValue(value));
  }

  const activeProducts = useMemo(() => {
    if (catalogState.categories?.length) {
      const seen = new Map();
      for (const category of catalogState.categories) {
        for (const product of category.products || []) {
          if (!seen.has(product.id)) {
            seen.set(product.id, product);
          }
        }
      }
      return seen.size ? [...seen.values()] : catalogState.products;
    }

    return catalogState.products?.length ? catalogState.products : PRODUCTS;
  }, [catalogState.categories, catalogState.products]);
  const categoryFilteredProducts = useMemo(() => {
    if (!catalogState.browseCategoryId) {
      return activeProducts;
    }

    const selectedCategory =
      catalogState.categories.find((category) => category.id === catalogState.browseCategoryId) ?? null;

    return selectedCategory?.products?.length ? selectedCategory.products : activeProducts;
  }, [activeProducts, catalogState.browseCategoryId, catalogState.categories]);
  const filteredProducts = useMemo(() => {
    const query = catalogState.query.trim();
    if (!query) {
      return categoryFilteredProducts;
    }

    const matcher = new RegExp(escapeRegExp(query), "i");
    return categoryFilteredProducts.filter((product) => matcher.test(product.name));
  }, [categoryFilteredProducts, catalogState.query]);
  const selectedProduct = useMemo(
    () =>
      activeProducts.find((product) => product.id === workflow.selectedProductId) ??
      findProductInCategories(catalogState.categories, workflow.selectedProductId) ??
      null,
    [activeProducts, catalogState.categories, workflow.selectedProductId],
  );
  const browseCategory = useMemo(
    () => catalogState.categories.find((category) => category.id === catalogState.browseCategoryId) ?? catalogState.categories[0] ?? null,
    [catalogState.browseCategoryId, catalogState.categories],
  );
  const browseRows = useMemo(() => buildCartRows(workflow.cartItems), [workflow.cartItems]);
  const parentCartRowIds = useMemo(() => getParentRowIds(browseRows), [browseRows]);
  const visibleBrowseRows = useMemo(() => getVisibleCartRows(browseRows, expandedCartRows), [browseRows, expandedCartRows]);
  const cartTotals = useMemo(() => {
    return browseRows.reduce(
      (totals, row) => {
        const rowProduct =
          activeProducts.find((product) => product.siebelProductId === row.productId || product.id === row.productId || product.name === row.name) ??
          findProductInCategories(catalogState.categories, row.productId);
        const fees = getRowFeeBreakdown(row, rowProduct);

        return {
          monthlyFee: totals.monthlyFee + fees.monthlyFee,
          oneTimeFee: totals.oneTimeFee + fees.oneTimeFee,
        };
      },
      { monthlyFee: 0, oneTimeFee: 0 },
    );
  }, [activeProducts, browseRows, catalogState.categories]);
  const contactName = useMemo(() => getContactName(workflow), [workflow]);
  const customer360Record = useMemo(() => {
    if (!siebelState.data?.account) {
      return buildCustomer360Record(workflow);
    }

    const meta = siebelState.data.account.accountMeta ?? [];
    return {
      name: siebelState.data.account.customer?.name || buildCustomer360Record(workflow).name,
      status: siebelState.data.account.customer?.status || CUSTOMER_360_BASE.status,
      accountNumber: meta.find((item) => item.label === "Account number")?.value || CUSTOMER_360_BASE.accountNumber,
      address: meta.find((item) => item.label === "Address")?.value || workflow.customer.address || DEFAULT_ADDRESS,
      email: meta.find((item) => item.label === "Email")?.value || buildCustomer360Record(workflow).email,
      phone: meta.find((item) => item.label === "Phone")?.value || CUSTOMER_360_BASE.phone,
    };
  }, [siebelState.data, workflow]);
  const customer360Columns = useMemo(
    () => buildCustomer360Columns(siebelState.data, workflow),
    [siebelState.data, workflow.orderNumber, workflow.orderStatus],
  );
  const recommendationInputText = useMemo(() => {
    if (view === "intake") {
      return intakeDraft.trim() || INTAKE_PROMPT;
    }

    return workflow.intakePrompt || workflow.messages.find((message) => message.role === "user")?.text || INTAKE_PROMPT;
  }, [intakeDraft, view, workflow.intakePrompt, workflow.messages]);
  const semanticRecommendation = useMemo(
    () => findBestRecommendedProduct(activeProducts, catalogState.categories, recommendationInputText),
    [activeProducts, catalogState.categories, recommendationInputText],
  );
  const recommendedProduct = semanticRecommendation?.product || activeProducts[0] || PRODUCTS[0] || null;

  useEffect(() => {
    setExpandedCartRows((current) => {
      const next = {};
      let changed = false;

      for (const rowId of parentCartRowIds) {
        next[rowId] = current[rowId] ?? false;
        if (!(rowId in current)) {
          changed = true;
        }
      }

      if (Object.keys(current).length !== Object.keys(next).length) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [parentCartRowIds]);

  const completion = useMemo(() => {
    const product = Boolean(workflow.selectedProductId || workflow.cartItems.length);
    const account =
      Boolean(workflow.account.mobileNumber) &&
      Boolean(workflow.account.governmentId) &&
      Boolean(workflow.account.lastName) &&
      Boolean(workflow.account.jobTitle) &&
      Boolean(workflow.account.workPhone) &&
      Boolean(workflow.account.email);
    const service = Boolean(workflow.serviceBilling.shippingAccount) && Boolean(workflow.serviceBilling.billingAccount);
    const billing = Boolean(workflow.billing.billingAddress) && Boolean(workflow.billing.shippingAddress);
    const payment =
      Boolean(workflow.payment.cardholderName) &&
      Boolean(workflow.payment.cardType) &&
      Boolean(workflow.payment.cardNumber) &&
      Boolean(workflow.payment.expiry);
    const summary = Boolean(workflow.summaryText.trim());

    return { product, account, service, billing, payment, summary };
  }, [workflow]);

  const nextStepId = useMemo(() => {
    for (const step of STEP_DEFINITIONS) {
      if (!completion[step.id]) {
        return step.id;
      }
    }
    return "review";
  }, [completion]);

  const canPlaceOrder = STEP_DEFINITIONS.every((step) => completion[step.id]);
  const showPostProductCanvas = completion.product;

  const stepTracker = useMemo(
    () =>
      STEP_DEFINITIONS.map((step) => ({
        ...step,
        complete: completion[step.id],
      })),
    [completion],
  );

  const heroMessage = useMemo(() => {
    switch (nextStepId) {
      case "account":
        return "Contact is ready. Next capture account details before product selection.";
      case "product":
        return "Account created. Proceed to product select. You can review the recommendation as well.";
      case "service":
        return "Account and contact details captured. Next assign the service and billing accounts.";
      case "billing":
        return "Service and billing accounts selected. Next add billing and shipping addresses.";
      case "payment":
        return "Billing and shipping details added. Next add payment information.";
      case "summary":
        return "Payment details added. The last step is to add the call summary.";
      default:
        return "The summary has been successfully. Please review all the information added and proceed with placing the order.";
    }
  }, [nextStepId]);

  const agentPrompt = useMemo(() => {
    switch (nextStepId) {
      case "account":
        return {
          title: "Next step",
          body: "Enter account and contact information, or use the contact as the account profile. Once that is complete you can move to product selection.",
        };
      case "product":
        return {
          title: "Next step",
          body: "Review the recommendation or open the catalog and add a product to the cart.",
        };
      case "service":
        return {
          title: "Next step",
          body: "Copy the captured account information into the service and billing accounts.",
        };
      case "billing":
        return {
          title: "Next step",
          body: "Copy the customer address into both the billing and shipping address fields.",
        };
      case "payment":
        return {
          title: "Next step",
          body: "Enter payment information, or apply the suggested saved payment method.",
        };
      case "summary":
        return {
          title: "Next step",
          body: "Generate or review the call summary, then save it to complete the workflow.",
        };
      default:
        return {
          title: "Next step",
          body: "All required workflow steps are complete. Review the order and place it.",
        };
    }
  }, [nextStepId, workflow.catalogName, workflow.priceListName]);

  const recommendationCards = useMemo(() => {
    const cards = [];

    if (!completion.account) {
      if (recommendedProduct) {
        cards.push({
          id: "recommended-offer",
          title: `Recommended offer: ${recommendedProduct.name}`,
          body: `${semanticRecommendation?.reason || recommendedProduct.recommendation} If you add this directly, I will create the account first and then continue with the recommendation from the ${semanticRecommendation?.categoryNames?.[0] || recommendedProduct.family || "catalog"} category.`,
          action: recommendedProduct.isBundledPromotion ? "Apply" : "Add",
          onClick: () => applyRecommendedProductSelection(recommendedProduct.id),
        });
      }
      cards.push({
        id: "next-account",
        title: "Use contact as account",
        body: "Populate the account, ID, and primary contact details from the captured customer conversation context, then continue to product selection.",
        action: "Apply",
        onClick: applySuggestedAccountProfile,
      });
      cards.push({
        id: "account-form",
        title: "Open account form",
        body: "Review or enter the account profile fields before moving to product selection.",
        action: "Open",
        onClick: () => openFormDrawer("account"),
      });
    } else if (!completion.product) {
      const topProduct = recommendedProduct || activeProducts[0] || PRODUCTS[0];
      cards.push({
        id: "next-product",
        title: `Add ${topProduct.name} to the cart`,
        body: semanticRecommendation?.reason || topProduct.recommendation,
        action: "Add",
        onClick: () => applyProductSelection(topProduct.id),
      });
      cards.push({
        id: "catalog",
        title: "View product catalog",
        body: "Browse the available product categories and add the right product from either the assistant or the canvas.",
        action: "Open",
        onClick: () => reviewCatalogProduct(topProduct.id),
      });
    } else if (!completion.service) {
      cards.push({
        id: "next-service",
        title: "Copy account info to service and billing accounts",
        body: "Use the captured account data to assign the default shipping and billing accounts automatically.",
        action: "Apply",
        onClick: applySuggestedServiceBilling,
      });
    } else if (!completion.billing) {
      cards.push({
        id: "next-billing",
        title: "Add existing address as billing and shipping address",
        body: workflow.customer.address,
        action: "Apply",
        onClick: applySuggestedBilling,
      });
    } else if (!completion.payment) {
      cards.push({
        id: "next-payment",
        title: "Apply saved payment details",
        body: "Use the saved Visa payment method so the order can move to final review.",
        action: "Apply",
        onClick: applySuggestedPayment,
      });
    } else if (!completion.summary) {
      cards.push({
        id: "next-summary",
        title: "Generate call summary",
        body: "Create the handoff summary from the captured order context and add it automatically.",
        action: "Generate",
        onClick: applyGeneratedSummary,
      });
    } else {
      cards.push({
        id: "place-order",
        title: "Place order",
        body: "All workflow steps are complete. Review the canvas and place the order.",
        action: "Place",
        onClick: submitOrder,
      });
    }

    return cards.filter((card) => !workflow.hiddenRecommendations.includes(card.id));
  }, [
    activeProducts,
    catalogState.resolvedCatalogName,
    catalogState.resolvedPriceListName,
    completion,
    recommendedProduct,
    semanticRecommendation,
    workflow.catalogName,
    workflow.customer.address,
    workflow.hiddenRecommendations,
    workflow.priceListName,
  ]);

  const currentQuickActions = useMemo(() => {
    const actions = [{ id: "catalog", label: "View product catalog", onClick: openCatalogDrawer }];

    if (!completion.account) {
      if (recommendedProduct) {
        actions.push({
          id: "recommendation",
          label: recommendedProduct.isBundledPromotion ? "Apply recommendation" : "Add recommendation",
          onClick: () => applyRecommendedProductSelection(recommendedProduct.id),
        });
      }
      actions.push({ id: "account", label: "Use contact as account", onClick: applySuggestedAccountProfile });
      actions.push({ id: "account-form", label: "Open account form", onClick: () => openFormDrawer("account") });
      return actions;
    }

    if (!completion.product) {
      actions.push({
        id: "product",
        label: "Add recommendation",
        onClick: () => applyProductSelection((recommendedProduct || activeProducts[0] || PRODUCTS[0]).id),
      });
      return actions;
    }

    if (!completion.service) {
      actions.push({ id: "service", label: "Copy info to service accounts", onClick: applySuggestedServiceBilling });
      actions.push({ id: "service-form", label: "Open service accounts", onClick: () => openFormDrawer("service") });
      return actions;
    }

    if (!completion.billing) {
      actions.push({ id: "billing", label: "Use existing address", onClick: applySuggestedBilling });
      actions.push({ id: "billing-form", label: "Open address form", onClick: () => openFormDrawer("billing") });
      return actions;
    }

    if (!completion.payment) {
      actions.push({ id: "payment", label: "Apply saved payment", onClick: applySuggestedPayment });
      actions.push({ id: "payment-form", label: "Open payment form", onClick: () => openFormDrawer("payment") });
      return actions;
    }

    if (!completion.summary) {
      actions.push({ id: "summary", label: "Generate summary", onClick: applyGeneratedSummary });
      actions.push({ id: "summary-form", label: "Open summary form", onClick: () => openFormDrawer("summary") });
      return actions;
    }

    actions.push({ id: "place", label: "Place order", onClick: submitOrder });
    return actions;
  }, [activeProducts, completion, recommendedProduct]);

  useEffect(() => {
    if (view !== "customer360" || siebelState.status === "loading") {
      return;
    }

    let cancelled = false;
    const accountId = workflow.siebelAccount?.id || "";

    async function loadSiebelData() {
      setSiebelState((current) => ({
        ...current,
        status: "loading",
        error: "",
      }));

      try {
        const [account, serviceSummary, servicePreview, serviceRequests, assets, recentOrders] = await Promise.all([
          getSiebelAccountData({ accountId }),
          getSiebelServiceSummary({ accountId }),
          getSiebelServicePreview({ accountId }),
          getSiebelServiceRequests({ accountId }),
          getSiebelAssets({ accountId }),
          getSiebelRecentOrders({ accountId }),
        ]);

        if (cancelled) {
          return;
        }

        setSiebelState({
          status: "ready",
          error: "",
          data: {
            account,
            serviceSummary,
            servicePreview,
            serviceRequests,
            assets,
            recentOrders,
          },
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSiebelState({
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load Siebel data.",
          data: null,
        });
      }
    }

    loadSiebelData();

    return () => {
      cancelled = true;
    };
  }, [view, workflow.siebelAccount?.id]);

  useEffect(() => {
    if (view !== "workflow" && view !== "intake") {
      return;
    }

    let cancelled = false;
    const requestedCatalogName = view === "workflow" ? workflow.catalogName : DEFAULT_SIEBEL_CATALOG;
    const requestedPriceListName = view === "workflow" ? workflow.priceListName : DEFAULT_SIEBEL_PRICE_LIST;

    async function loadCatalogProducts() {
      setCatalogState((current) => ({
        ...current,
        status: "loading",
        error: "",
      }));

      try {
        const [productResponse, hierarchyResponse] = await Promise.all([
          getSiebelCatalogProducts({
            catalogName: requestedCatalogName,
            priceListName: requestedPriceListName,
          }),
          getSiebelCatalogHierarchy({
            catalogName: requestedCatalogName,
            priceListName: requestedPriceListName,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setCatalogState((current) => ({
          ...current,
          status: "ready",
          error: productResponse.detail || hierarchyResponse.detail || "",
          products: productResponse.products?.length ? productResponse.products : PRODUCTS,
          categories: hierarchyResponse.categories || [],
          browseCategoryId:
            current.browseCategoryId && (hierarchyResponse.categories || []).some((category) => category.id === current.browseCategoryId)
              ? current.browseCategoryId
              : hierarchyResponse.categories?.[0]?.id || "",
          requestedCatalogName: productResponse.requestedCatalogName || requestedCatalogName,
          requestedPriceListName: productResponse.requestedPriceListName || requestedPriceListName,
          resolvedCatalogName: productResponse.resolvedCatalogName || requestedCatalogName,
          resolvedPriceListName: productResponse.resolvedPriceListName || requestedPriceListName,
          resolvedPriceListId: productResponse.resolvedPriceListId || "",
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogState((current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load Siebel catalog products.",
          products: PRODUCTS,
          categories: [],
          browseCategoryId: "",
          requestedCatalogName,
          requestedPriceListName,
          resolvedCatalogName: requestedCatalogName,
          resolvedPriceListName: requestedPriceListName,
          resolvedPriceListId: "",
        }));
      }
    }

    loadCatalogProducts();

    return () => {
      cancelled = true;
    };
  }, [view, workflow.catalogName, workflow.priceListName]);

  useEffect(() => {
    if (view !== "workflow" || !activeProducts.length) {
      return;
    }

    if (activeProducts.some((product) => product.id === workflow.catalogSelectionId)) {
      return;
    }

    updateWorkflow((current) => ({
      ...current,
      catalogSelectionId: recommendedProduct?.id || activeProducts[0].id,
    }));
  }, [activeProducts, recommendedProduct?.id, view, workflow.catalogSelectionId]);

  useEffect(() => {
    if (view !== "workflow" || !pendingIntakeRecommendationId || isApplyingIntakeRecommendation) {
      return;
    }

    let cancelled = false;

    async function applyIntakeRecommendation() {
      setIsApplyingIntakeRecommendation(true);

      try {
        const contactRecord = await ensureSiebelContactRecord();
        if (cancelled) {
          return;
        }

        const accountRecord = workflow.siebelAccount?.id ? workflow.siebelAccount : await ensureRecommendedAccountProfile();
        if (cancelled) {
          return;
        }

        await applyProductSelection(pendingIntakeRecommendationId, {
          contactRecord,
          accountId: accountRecord?.id || "",
          accountName: accountRecord?.name || "",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const detail = error instanceof Error ? error.message : "Unknown intake recommendation error.";
        pushMessages([makeMessage("assistant", `I couldn't apply the recommendation from intake automatically. ${detail}`)]);
        setNotification("Unable to apply the recommendation from intake.");
      } finally {
        if (!cancelled) {
          setPendingIntakeRecommendationId("");
          setIsApplyingIntakeRecommendation(false);
        }
      }
    }

    applyIntakeRecommendation();

    return () => {
      cancelled = true;
    };
  }, [isApplyingIntakeRecommendation, pendingIntakeRecommendationId, view, workflow.siebelAccount]);

  function updateWorkflow(mutator) {
    setWorkflow((current) => mutator(current));
  }

  function pushMessages(messages) {
    updateWorkflow((current) => ({
      ...current,
      messages: [...current.messages, ...messages],
    }));
  }

  async function ensureSiebelContactRecord(customer = workflow.customer, account = workflow.account) {
    if (workflow.siebelContact?.id) {
      return workflow.siebelContact;
    }

    const contact = await createSiebelContact({
      firstName: customer.firstName || account.firstName || "James",
      lastName: customer.lastName || account.lastName || "Kelly",
      email: account.email || "",
      workPhone: account.workPhone || account.mobileNumber || "",
      accountSite: account.accountSite || "",
    });

    updateWorkflow((current) => ({
      ...current,
      siebelContact: contact,
      customer: {
        ...current.customer,
        name: contact.name || current.customer.name,
        firstName: contact.firstName || current.customer.firstName,
        lastName: contact.lastName || current.customer.lastName,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", `Contact ${contact.name} was created in Siebel with ID ${contact.id}.`),
      ],
    }));

    return contact;
  }

  async function createAndAttachAccount(nextCustomer, nextAccount) {
    const contactRecord = await ensureSiebelContactRecord(nextCustomer, nextAccount);
    const accountRecord = await createSiebelAccount({
      name: `${nextAccount.firstName} ${nextAccount.lastName}`.trim() || nextCustomer.name,
      location: nextAccount.accountSite,
      mainPhone: nextAccount.workPhone || nextAccount.mobileNumber,
      mainEmail: nextAccount.email,
      status: "Active",
      type: "Residential",
      address: nextCustomer.address || workflow.customer.address,
      primaryContactId: contactRecord.id,
      priceListId: catalogState.resolvedPriceListId,
      priceListName: catalogState.resolvedPriceListName || workflow.priceListName,
    });
    if (workflow.orderId) {
      await syncOrderContext(workflow.orderId, {
        contactId: contactRecord.id,
        accountId: accountRecord.id,
        accountName: accountRecord.name,
      });
    }

    updateWorkflow((current) => ({
      ...current,
      siebelContact: current.siebelContact || contactRecord,
      siebelAccount: accountRecord,
      customer: {
        ...current.customer,
        ...nextCustomer,
      },
      account: nextAccount,
      messages: [
        ...current.messages,
        makeMessage(
          "assistant",
          `Account created for ${nextCustomer.name} with Siebel account ID ${accountRecord.id}. Next choose a product from the catalog or recommendation.`,
        ),
      ],
    }));

    setNotification(`Siebel account created: ${accountRecord.id}`);
    setDrawer(null);
    return accountRecord;
  }

  async function ensureRecommendedAccountProfile() {
    if (workflow.siebelAccount?.id) {
      return workflow.siebelAccount;
    }

    const parsed = parseAccountInput(SAMPLE_ACCOUNT_INPUT, workflow.customer.firstName);
    const nextAccount = {
      accountSite: workflow.account.accountSite,
      ...parsed,
      firstName: workflow.customer.firstName || parsed.firstName,
      lastName: workflow.customer.lastName || parsed.lastName,
    };
    const nextCustomer = {
      ...workflow.customer,
      name: [nextAccount.firstName, nextAccount.lastName].filter(Boolean).join(" ").trim() || workflow.customer.name,
      firstName: nextAccount.firstName || workflow.customer.firstName,
      lastName: nextAccount.lastName || workflow.customer.lastName,
    };

    return createAndAttachAccount(nextCustomer, nextAccount);
  }

  async function syncOrderServiceAccounts(accountId) {
    if (!workflow.orderId || !accountId) {
      return;
    }

    await updateSiebelOrder(workflow.orderId, {
      orderNumber: workflow.orderNumber || workflow.orderId,
      billingAccountId: accountId,
      serviceAccountId: accountId,
      payToAccountId: accountId,
      billToAccountNumber: accountId,
    });
  }

  async function syncOrderContext(orderId, overrides = {}) {
    if (!orderId) {
      return null;
    }

    const priceListId = overrides.priceListId ?? catalogState.resolvedPriceListId ?? "";
    const priceListName = overrides.priceListName ?? catalogState.resolvedPriceListName ?? workflow.priceListName ?? "";
    const orderNumber = overrides.orderNumber ?? workflow.orderNumber ?? "";
    const contactId = overrides.contactId ?? "";
    const accountId = overrides.accountId ?? workflow.siebelAccount?.id ?? "";
    const accountName = overrides.accountName ?? workflow.siebelAccount?.name ?? contactName ?? "";

    return updateSiebelOrder(orderId, {
      ...(orderNumber ? { orderNumber } : {}),
      ...(contactId ? { contactId } : {}),
      ...(priceListId ? { priceListId } : {}),
      ...(priceListName ? { priceListName } : {}),
      ...(accountId
        ? {
            accountId,
            accountName,
          }
        : {}),
      ...(overrides.billingAccountId ? { billingAccountId: overrides.billingAccountId } : {}),
      ...(overrides.serviceAccountId ? { serviceAccountId: overrides.serviceAccountId } : {}),
      ...(overrides.payToAccountId ? { payToAccountId: overrides.payToAccountId } : {}),
      ...(overrides.billToAccountNumber ? { billToAccountNumber: overrides.billToAccountNumber } : {}),
    });
  }

  function beginTaskFlow() {
    setView("intake");
    setIntakeExpanded(false);
    setIntakeDraft(INTAKE_PLACEHOLDER);
    setNotification("");
    setPendingIntakeRecommendationId("");
    setIsApplyingIntakeRecommendation(false);
  }

  function expandIntake() {
    setIntakeExpanded(true);
    setIntakeDraft(INTAKE_PROMPT);
  }

  async function startWorkflow(options = {}) {
    const { autoRecommendProductId = "" } = options;
    let intakeResult;
    try {
      intakeResult = await parseIntakePrompt(intakeDraft.trim() || INTAKE_PROMPT);
    } catch (error) {
      setNotification(`Intake parsing failed. ${error instanceof Error ? error.message : "Unknown LLM parse error."}`);
      return;
    }

    const parsedIntake = {
      name: intakeResult.contactName,
      firstName: intakeResult.firstName,
      lastName: intakeResult.lastName,
      address: intakeResult.address || DEFAULT_ADDRESS,
    };
    setWorkflow(
      createWorkflowState({
        name: parsedIntake.name,
        address: parsedIntake.address,
        intakePrompt: intakeDraft.trim() || INTAKE_PROMPT,
        intakeAnalysis: {
          source: intakeResult.source || "fallback",
          prospectType: intakeResult.prospectType || "",
          customerSegment: intakeResult.customerSegment || "",
          productInterest: intakeResult.productInterest || "",
          requestedProductCategories: intakeResult.requestedProductCategories || [],
          intentSummary: intakeResult.intentSummary || intakeDraft.trim() || INTAKE_PROMPT,
          detail: intakeResult.detail || "",
        },
      }),
    );
    setNotification(
      intakeResult.source === "llm"
        ? "LLM intake parsed successfully."
        : intakeResult.source === "deterministic"
          ? "Runtime config is set to deterministic intake parsing."
        : `LLM intake unavailable. Using fallback parsing${intakeResult.detail ? `: ${intakeResult.detail}` : "."}`,
    );
    setDrawer(null);
    setView("workflow");

    if (autoRecommendProductId) {
      setPendingIntakeRecommendationId(autoRecommendProductId);
      setNotification("Creating the contact, account, and recommended order from the intake details.");
      return;
    }

    try {
      const contact = await createSiebelContact({
        firstName: parsedIntake.firstName,
        lastName: parsedIntake.lastName,
        accountSite: "New York",
      });

      setWorkflow((current) => ({
        ...current,
        siebelContact: contact,
        customer: {
          ...current.customer,
          name: contact.name || current.customer.name,
          firstName: contact.firstName || current.customer.firstName,
          lastName: contact.lastName || current.customer.lastName,
        },
        messages: [
          ...current.messages,
          makeMessage("assistant", `Contact ${contact.name} was created in Siebel with ID ${contact.id}.`),
        ],
      }));
      setNotification(`Siebel contact created: ${contact.id}`);
    } catch (error) {
      setWorkflow((current) => ({
        ...current,
        messages: [
          ...current.messages,
          makeMessage(
            "assistant",
            `I could not create the Siebel contact from the intake details. ${error instanceof Error ? error.message : "Unknown contact creation error."}`,
          ),
        ],
      }));
      setNotification("Siebel contact create failed.");
    }
  }

  function openCatalogDrawer() {
    setDrawer("catalog");
    setDrawerDraft({});
  }

  async function applyRecommendedProductSelection(productId = recommendedProduct?.id) {
    if (!productId) {
      return;
    }

    let accountRecord = workflow.siebelAccount;
    if (!accountRecord?.id) {
      accountRecord = await ensureRecommendedAccountProfile();
    }

    await applyProductSelection(productId, {
      accountId: accountRecord?.id || "",
      accountName: accountRecord?.name || "",
    });
  }

  function reviewCatalogProduct(productId, preferredView = "browse") {
    const categoryMatch = catalogState.categories.find((category) => (category.products || []).some((product) => product.id === productId));

    updateWorkflow((current) => ({
      ...current,
      catalogSelectionId: productId,
    }));
    setCatalogState((current) => ({
      ...current,
      view: preferredView,
      browseCategoryId: categoryMatch?.id || current.browseCategoryId,
    }));
    setDrawer("catalog");
    setDrawerDraft({});
  }

  function openFormDrawer(type) {
    setDrawer(type);

    if (type === "customer") {
      setDrawerDraft({
        name: workflow.customer.name,
        address: workflow.customer.address,
      });
      return;
    }

    if (type === "account") {
      setDrawerDraft({
        accountSite: workflow.account.accountSite,
        mobileNumber: workflow.account.mobileNumber,
        governmentId: workflow.account.governmentId,
        firstName: workflow.account.firstName,
        lastName: workflow.account.lastName,
        jobTitle: workflow.account.jobTitle,
        workPhone: workflow.account.workPhone,
        email: workflow.account.email,
      });
      return;
    }

    if (type === "service") {
      setDrawerDraft({
        shippingAccount: workflow.serviceBilling.shippingAccount || `Shipping Account - ${contactName}`,
        billingAccount: workflow.serviceBilling.billingAccount || `Billing Account - ${contactName}`,
      });
      return;
    }

    if (type === "billing") {
      setDrawerDraft({
        billingAddress: workflow.billing.billingAddress || workflow.customer.address,
        shippingAddress: workflow.billing.shippingAddress || workflow.customer.address,
      });
      return;
    }

    if (type === "payment") {
      setDrawerDraft({
        cardholderName: getPaymentCardholderName(workflow),
        cardType: workflow.payment.cardType || "Visa",
        cardNumber: workflow.payment.cardNumber || "4111 1111 1111 1111",
        expiry: workflow.payment.expiry || "08/2028",
      });
      return;
    }

    if (type === "summary") {
      setDrawerDraft({
        summaryText: workflow.summaryText || GENERATED_SUMMARY,
      });
    }
  }

  function setDraftField(field, value) {
    setDrawerDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function setCatalogView(viewMode) {
    setCatalogState((current) => ({
      ...current,
      view: viewMode,
    }));
  }

  function setBrowseCategory(categoryId) {
    setCatalogState((current) => ({
      ...current,
      browseCategoryId: categoryId,
      view: current.view,
    }));
  }

  function setCatalogQuery(value) {
    setCatalogState((current) => ({
      ...current,
      query: value,
    }));
  }

  async function applyProductSelection(productId, context = {}) {
    const product =
      activeProducts.find((item) => item.id === productId) ??
      findProductInCategories(catalogState.categories, productId) ??
      findProduct(productId);

    if (!product) {
      return;
    }

    try {
      let orderId = workflow.orderId;
      let orderNumber = workflow.orderNumber;
      let orderStatus = workflow.orderStatus;
      const contactRecord = context.contactRecord || (await ensureSiebelContactRecord());
      let accountId = context.accountId ?? workflow.siebelAccount?.id ?? "";
      let accountName = context.accountName ?? workflow.siebelAccount?.name ?? contactName;
      const isBundledPromotion = Boolean(product.isBundledPromotion);

      if (!orderId && !isBundledPromotion) {
        const order = await createSiebelOrder({
          currencyCode: "USD",
          status: "Pending",
          priceListId: catalogState.resolvedPriceListId,
          priceListName: catalogState.resolvedPriceListName || workflow.priceListName,
          accountId,
          accountName,
        });
        orderId = order.id;
        orderNumber = order.orderNumber || order.id;
        orderStatus = order.status;
        accountId = order.accountId || accountId;
        accountName = order.accountName || accountName;
      }

      const nextLineNumber = workflow.cartItems.length + 1;
      const promotionOrderNumber = orderNumber || `${DEFAULT_PROMOTION_ORDER_NUMBER_PREFIX}${Date.now()}`;
      const orderItemResponse = isBundledPromotion
        ? await applySiebelPromotion(orderId || "new", {
            prodPromId: product.siebelProductId || product.id,
            quantity: 1,
            eligibilityMode: "1",
            sync: "Y",
            pricingMode: "Y",
            ...(orderId ? { headerId: orderId } : {}),
            accountId,
            accountName,
            orderNumber: promotionOrderNumber,
            orderType: "Sales Order",
            priceListId: catalogState.resolvedPriceListId,
          })
        : await addSiebelOrderItem(orderId, {
            productId: product.siebelProductId || product.id,
            rootProductId: product.siebelProductId || product.id,
            rootProductName: product.name,
            name: product.name,
            quantity: 1,
            lineNumber: nextLineNumber,
            currencyCode: "USD",
          });
      const responseItems = orderItemResponse.items || [];
      const autoExpandedParentIds = responseItems
        .filter((item) => responseItems.some((candidate) => candidate.parentQuoteItemId === item.id))
        .map((item) => item.id);

      orderId = orderItemResponse.orderId || orderId;
      orderNumber = orderItemResponse.orderNumber || (isBundledPromotion ? promotionOrderNumber : orderNumber);

      updateWorkflow((current) => ({
        ...current,
        orderId,
        orderNumber: orderNumber || current.orderNumber,
        orderStatus: orderStatus || current.orderStatus,
        siebelAccount:
          accountId || accountName
            ? {
                ...(current.siebelAccount || {}),
                id: accountId || current.siebelAccount?.id || "",
                name: accountName || current.siebelAccount?.name || "",
              }
            : current.siebelAccount,
        cartItems: orderItemResponse.items?.length ? orderItemResponse.items : [...current.cartItems, orderItemResponse.item],
        selectedProductId: productId,
        catalogSelectionId: productId,
        messages: [
          ...current.messages,
          makeMessage("chip", `${product.name} added`, "chip"),
          makeMessage(
            "assistant",
            orderItemResponse.items?.length > 1
              ? `${product.name} was added to order ${orderNumber || orderId}. Continue with service and billing setup, or add more products from search or browse.`
              : `${product.name} was added to order ${orderNumber || orderId}. Next assign the service and billing accounts.`,
          ),
        ],
      }));
      if (autoExpandedParentIds.length) {
        setExpandedCartRows((current) => ({
          ...current,
          ...Object.fromEntries(autoExpandedParentIds.map((id) => [id, true])),
        }));
      }
      setNotification(`Added ${product.name} to Siebel order ${orderNumber || orderId}.`);
      setDrawer(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to add the product to Siebel order.";
      if (product.isBundledPromotion) {
        pushMessages([
          makeMessage(
            "assistant",
            `I routed ${product.name} through the Siebel Apply Promotion workflow, but this environment denied that workflow call. ${detail}`,
          ),
        ]);
        setNotification(`Promotion workflow blocked for ${product.name}.`);
        return;
      }
      pushMessages([makeMessage("assistant", `I couldn't add ${product.name} to the Siebel order. ${detail}`)]);
      setNotification(`Unable to add ${product.name} to order.`);
    }
  }

  function saveCustomerDetails() {
    const parsedName = splitName(drawerDraft.name || workflow.customer.name);
    updateWorkflow((current) => ({
      ...current,
      customer: {
        name: parsedName.name,
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        address: drawerDraft.address || current.customer.address,
      },
      account: {
        ...current.account,
        firstName: parsedName.firstName,
        lastName: current.account.lastName || parsedName.lastName,
      },
    }));
    setDrawer(null);
  }

  async function applySuggestedAccountProfile() {
    const parsed = parseAccountInput(SAMPLE_ACCOUNT_INPUT, workflow.customer.firstName);
    const nextAccount = {
      accountSite: workflow.account.accountSite,
      ...parsed,
      firstName: workflow.customer.firstName || parsed.firstName,
      lastName: workflow.customer.lastName || parsed.lastName,
    };
    const nextCustomer = {
      ...workflow.customer,
      name: [nextAccount.firstName, nextAccount.lastName].filter(Boolean).join(" ").trim() || workflow.customer.name,
      firstName: nextAccount.firstName || workflow.customer.firstName,
      lastName: nextAccount.lastName || workflow.customer.lastName,
    };

    return createAndAttachAccount(nextCustomer, nextAccount);
  }

  function applyCatalogPreferencesFromNaturalLanguage(input) {
    const preferences = parseCatalogPreferences(input, workflow.catalogName, workflow.priceListName);
    updateWorkflow((current) => ({
      ...current,
      catalogName: preferences.catalogName,
      priceListName: preferences.priceListName,
      messages: [
        ...current.messages,
        makeMessage(
          "assistant",
          `I will query catalog ${preferences.catalogName} with price list ${preferences.priceListName} for product selection.`,
        ),
      ],
    }));
    setNotification(`Catalog set to ${preferences.catalogName}. Price list set to ${preferences.priceListName}.`);
    setDrawer(null);
  }

  async function applyAccountFromNaturalLanguage(input) {
    const parsed = parseNaturalAccountCommand(input, workflow);
    await createAndAttachAccount(
      {
        ...workflow.customer,
        ...parsed.customer,
      },
      parsed.account,
    );
  }

  async function createContactFromNaturalLanguage(input) {
    const parsed = parseNaturalContactCommand(input, workflow);
    const contact = await createSiebelContact(parsed);

    if (workflow.orderId) {
      await updateSiebelOrder(workflow.orderId, {
        contactId: contact.id,
      });
    }

    updateWorkflow((current) => ({
      ...current,
      siebelContact: contact,
      customer: {
        ...current.customer,
        name: contact.name || current.customer.name,
        firstName: contact.firstName || current.customer.firstName,
        lastName: contact.lastName || current.customer.lastName,
      },
      messages: [
        ...current.messages,
        makeMessage(
          "assistant",
          `Contact ${contact.name || `${parsed.firstName} ${parsed.lastName}`.trim()} was created in Siebel with ID ${contact.id}.`,
        ),
      ],
    }));
    setNotification(`Siebel contact created: ${contact.id}`);
    setDrawer(null);
  }

  async function saveAccountDetailsFromDraft() {
    const nextAccount = {
      accountSite: drawerDraft.accountSite || workflow.account.accountSite,
      mobileNumber: drawerDraft.mobileNumber || workflow.account.mobileNumber,
      governmentId: drawerDraft.governmentId || workflow.account.governmentId,
      firstName: drawerDraft.firstName || workflow.account.firstName,
      lastName: drawerDraft.lastName || workflow.account.lastName,
      jobTitle: drawerDraft.jobTitle || workflow.account.jobTitle,
      workPhone: drawerDraft.workPhone || workflow.account.workPhone,
      email: drawerDraft.email || workflow.account.email,
    };
    const nextCustomer = {
      ...workflow.customer,
      name: [nextAccount.firstName, nextAccount.lastName].filter(Boolean).join(" ").trim() || workflow.customer.name,
      firstName: nextAccount.firstName || workflow.customer.firstName,
      lastName: nextAccount.lastName || workflow.customer.lastName,
    };

    await createAndAttachAccount(nextCustomer, nextAccount);
  }

  async function applySuggestedServiceBilling() {
    if (workflow.siebelAccount?.id) {
      await syncOrderServiceAccounts(workflow.siebelAccount.id);
    }

    updateWorkflow((current) => ({
      ...current,
      serviceBilling: {
        shippingAccount: `Shipping Account - ${getContactName(current)}`,
        billingAccount: `Billing Account - ${getContactName(current)}`,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Service and billing accounts selected. Next copy the customer address to billing and shipping."),
      ],
    }));
  }

  async function applyServiceBillingFromNaturalLanguage(input) {
    const shippingMatch = input.match(/\bshipping account\s*(?:is|=|:)?\s*([^,.;]+)/i);
    const billingMatch = input.match(/\bbilling account\s*(?:is|=|:)?\s*([^,.;]+)/i);

    if (workflow.siebelAccount?.id && (!shippingMatch || !billingMatch)) {
      await syncOrderServiceAccounts(workflow.siebelAccount.id);
    }

    updateWorkflow((current) => ({
      ...current,
      serviceBilling: {
        shippingAccount: shippingMatch?.[1]?.trim() || current.serviceBilling.shippingAccount || `Shipping Account - ${getContactName(current)}`,
        billingAccount: billingMatch?.[1]?.trim() || current.serviceBilling.billingAccount || `Billing Account - ${getContactName(current)}`,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Service and billing accounts selected. Next copy the customer address to billing and shipping."),
      ],
    }));
    setDrawer(null);
  }

  async function saveServiceBillingFromDraft() {
    if (workflow.siebelAccount?.id) {
      await syncOrderServiceAccounts(workflow.siebelAccount.id);
    }

    updateWorkflow((current) => ({
      ...current,
      serviceBilling: {
        shippingAccount: drawerDraft.shippingAccount || current.serviceBilling.shippingAccount,
        billingAccount: drawerDraft.billingAccount || current.serviceBilling.billingAccount,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Service and billing accounts selected. Next add the billing and shipping address."),
      ],
    }));
    setDrawer(null);
  }

  function applySuggestedBilling() {
    updateWorkflow((current) => ({
      ...current,
      billing: {
        billingAddress: current.customer.address,
        shippingAddress: current.customer.address,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Billing and shipping details added. Next apply payment information."),
      ],
    }));
    setNotification("Billing and shipping details saved.");
  }

  function applyBillingFromNaturalLanguage(input) {
    const useContactAddress = /\bcontact add?re?s?s?\b/i.test(input) || /\bexisting add?re?s?s?\b/i.test(input);
    const billingMatch = input.match(/\bbilling address\s*(?:is|=|:)?\s*([^.;]+)/i);
    const shippingMatch = input.match(/\bshipping address\s*(?:is|=|:)?\s*([^.;]+)/i);

    updateWorkflow((current) => ({
      ...current,
      billing: {
        billingAddress: useContactAddress ? current.customer.address : billingMatch?.[1]?.trim() || current.billing.billingAddress || current.customer.address,
        shippingAddress: useContactAddress ? current.customer.address : shippingMatch?.[1]?.trim() || current.billing.shippingAddress || current.customer.address,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Billing and shipping details added. Next apply payment information."),
      ],
    }));
    setNotification("Billing and shipping details saved.");
    setDrawer(null);
  }

  function saveBillingFromDraft() {
    updateWorkflow((current) => ({
      ...current,
      billing: {
        billingAddress: drawerDraft.billingAddress || current.billing.billingAddress,
        shippingAddress: drawerDraft.shippingAddress || current.billing.shippingAddress,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Billing and shipping details added. Next add payment information."),
      ],
    }));
    setDrawer(null);
    setNotification("Billing and shipping details saved.");
  }

  async function applySuggestedPayment() {
    try {
      const parsed = parsePaymentInput(SAMPLE_PAYMENT_INPUT);
      const nextPayment = {
        ...parsed,
        cardholderName: getContactName(workflow),
      };

      await persistOrderPaymentDetails(nextPayment);
      updateWorkflow((current) => ({
        ...current,
        payment: {
          ...nextPayment,
          cardholderName: getContactName(current),
        },
        messages: [
          ...current.messages,
          makeMessage("assistant", "Payment details added. The last step is to generate the call summary."),
        ],
      }));
    } catch (error) {
      pushMessages([
        makeMessage(
          "assistant",
          `I couldn't save the payment details to the Siebel order. ${error instanceof Error ? error.message : "Unknown payment update error."}`,
        ),
      ]);
      setNotification("Siebel order payment update failed.");
    }
  }

  async function applyPaymentFromNaturalLanguage(input) {
    try {
      const useContactAddress = /\bcontact add?re?s?s?\b/i.test(input) || /\bexisting add?re?s?s?\b/i.test(input);
      const parsed = parseNaturalPaymentCommand(input, workflow);

      await persistOrderPaymentDetails(parsed);
      updateWorkflow((current) => ({
        ...current,
        billing:
          useContactAddress && (!current.billing.billingAddress || !current.billing.shippingAddress)
            ? {
                billingAddress: current.customer.address,
                shippingAddress: current.customer.address,
              }
            : current.billing,
        payment: parsed,
        messages: [
          ...current.messages,
          makeMessage("assistant", "Payment details added. The last step is to generate the call summary."),
        ],
      }));
      if (useContactAddress) {
        setNotification("Billing, shipping, and payment details saved.");
      }
      setDrawer(null);
    } catch (error) {
      pushMessages([
        makeMessage(
          "assistant",
          `I couldn't save the payment details to the Siebel order. ${error instanceof Error ? error.message : "Unknown payment update error."}`,
        ),
      ]);
      setNotification("Siebel order payment update failed.");
    }
  }

  async function savePaymentFromDraft() {
    try {
      const nextPayment = {
        cardholderName: drawerDraft.cardholderName || workflow.payment.cardholderName || getContactName(workflow),
        cardType: drawerDraft.cardType || workflow.payment.cardType,
        cardNumber: drawerDraft.cardNumber || workflow.payment.cardNumber,
        expiry: drawerDraft.expiry || workflow.payment.expiry,
      };

      await persistOrderPaymentDetails(nextPayment);
      updateWorkflow((current) => ({
        ...current,
        payment: {
          cardholderName: drawerDraft.cardholderName || current.payment.cardholderName || getContactName(current),
          cardType: drawerDraft.cardType || current.payment.cardType,
          cardNumber: drawerDraft.cardNumber || current.payment.cardNumber,
          expiry: drawerDraft.expiry || current.payment.expiry,
        },
        messages: [
          ...current.messages,
          makeMessage(
            "assistant",
            "Payment details added. The last step is to add the call summary. You can add it from the canvas or recommendations panel.",
          ),
        ],
      }));
      setDrawer(null);
    } catch (error) {
      pushMessages([
        makeMessage(
          "assistant",
          `I couldn't save the payment details to the Siebel order. ${error instanceof Error ? error.message : "Unknown payment update error."}`,
        ),
      ]);
      setNotification("Siebel order payment update failed.");
    }
  }

  function applyGeneratedSummary() {
    updateWorkflow((current) => ({
      ...current,
      summaryText: GENERATED_SUMMARY,
      messages: [
        ...current.messages,
        makeMessage("chip", "Add summary", "chip"),
        makeMessage(
          "assistant",
          "The summary has been successfully. Please review all the information added and proceed with placing the order.",
        ),
      ],
    }));
  }

  function saveSummaryFromDraft() {
    updateWorkflow((current) => ({
      ...current,
      summaryText: drawerDraft.summaryText || current.summaryText,
      messages: [
        ...current.messages,
        makeMessage("chip", "Add summary", "chip"),
        makeMessage(
          "assistant",
          "The summary has been successfully. Please review all the information added and proceed with placing the order.",
        ),
      ],
    }));
    setDrawer(null);
  }

  function dismissRecommendation(cardId) {
    updateWorkflow((current) => ({
      ...current,
      hiddenRecommendations: [...current.hiddenRecommendations, cardId],
    }));
  }

  function clearActionInput(source) {
    if (source === "composer") {
      updateWorkflow((current) => ({
        ...current,
        composer: "",
      }));
      return;
    }

    if (source === "smart") {
      setSmartActionDraft("");
    }
  }

  function appendUserActionMessage(draft, source) {
    updateWorkflow((current) => ({
      ...current,
      composer: source === "composer" ? "" : current.composer,
      messages: [...current.messages, makeMessage("user", draft)],
    }));
    if (source === "smart") {
      setSmartActionDraft("");
    }
  }

  function applyCatalogPreferences(preferences = {}) {
    const nextCatalogName = preferences.catalogName || workflow.catalogName || DEFAULT_SIEBEL_CATALOG;
    const nextPriceListName = preferences.priceListName || workflow.priceListName || DEFAULT_SIEBEL_PRICE_LIST;

    updateWorkflow((current) => ({
      ...current,
      catalogName: nextCatalogName,
      priceListName: nextPriceListName,
      messages: [
        ...current.messages,
        makeMessage(
          "assistant",
          `I will query catalog ${nextCatalogName} with price list ${nextPriceListName} for product selection.`,
        ),
      ],
    }));
    setNotification(`Catalog set to ${nextCatalogName}. Price list set to ${nextPriceListName}.`);
    setDrawer(null);
  }

  function findProductByActionName(productName) {
    const normalizedName = normalizeRecommendationText(productName);
    if (!normalizedName) {
      return null;
    }

    const candidateProducts = [
      ...activeProducts,
      ...catalogState.categories.flatMap((category) => category.products || []),
    ];
    const uniqueProducts = [...new Map(candidateProducts.map((product) => [product.id, product])).values()];
    const exactMatch = uniqueProducts.find((product) => normalizeRecommendationText(product.name) === normalizedName);
    if (exactMatch) {
      return exactMatch;
    }

    const partialMatch = uniqueProducts.find((product) => normalizeRecommendationText(product.name).includes(normalizedName));
    if (partialMatch) {
      return partialMatch;
    }

    return findProductByText(uniqueProducts, productName);
  }

  async function createContactFromParsedAction(action) {
    const parsedIdentity = splitName(
      action.contactName || [action.firstName, action.lastName].filter(Boolean).join(" ").trim() || getContactName(workflow),
      getContactName(workflow),
    );
    const contact = await createSiebelContact({
      firstName: action.firstName || parsedIdentity.firstName,
      lastName: action.lastName || parsedIdentity.lastName,
      email: action.email || workflow.account.email || "",
      workPhone: sanitizeDigits(action.phone || workflow.account.workPhone || workflow.account.mobileNumber || ""),
      accountSite: workflow.account.accountSite || "",
    });

    if (workflow.orderId) {
      await updateSiebelOrder(workflow.orderId, {
        contactId: contact.id,
      });
    }

    updateWorkflow((current) => ({
      ...current,
      siebelContact: contact,
      customer: {
        ...current.customer,
        name: contact.name || current.customer.name,
        firstName: contact.firstName || current.customer.firstName,
        lastName: contact.lastName || current.customer.lastName,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", `Contact ${contact.name} was created in Siebel with ID ${contact.id}.`),
      ],
    }));
    setNotification(`Siebel contact created: ${contact.id}`);
    setDrawer(null);
  }

  async function applyAccountFromParsedAction(action) {
    if (action.actionType === "use_contact_as_account") {
      await applySuggestedAccountProfile();
      return;
    }

    const defaults = parseAccountInput(SAMPLE_ACCOUNT_INPUT, workflow.customer.firstName);
    const accountIdentity = splitName(
      action.accountName || action.contactName || workflow.customer.name,
      workflow.customer.name,
    );
    const customerIdentity = splitName(
      action.contactName || (action.primaryContactSameAsAccount ? action.accountName : workflow.customer.name) || workflow.customer.name,
      workflow.customer.name,
    );

    const nextAccount = {
      accountSite: action.accountSite || workflow.account.accountSite || "New York",
      mobileNumber: sanitizeDigits(action.mobileNumber || action.phone || workflow.account.mobileNumber || defaults.mobileNumber),
      governmentId: sanitizeDigits(action.governmentId || workflow.account.governmentId || defaults.governmentId),
      firstName: accountIdentity.firstName || workflow.account.firstName || defaults.firstName,
      lastName: accountIdentity.lastName || workflow.account.lastName || defaults.lastName,
      jobTitle: action.jobTitle || workflow.account.jobTitle || defaults.jobTitle,
      workPhone: sanitizeDigits(action.workPhone || action.phone || workflow.account.workPhone || defaults.workPhone),
      email: action.email || workflow.account.email || defaults.email,
    };
    const nextCustomer = {
      ...workflow.customer,
      name: customerIdentity.name || workflow.customer.name,
      firstName: customerIdentity.firstName || workflow.customer.firstName,
      lastName: customerIdentity.lastName || workflow.customer.lastName,
      address: action.useContactAddressForAccount ? workflow.customer.address : workflow.customer.address,
    };

    await createAndAttachAccount(nextCustomer, nextAccount);
  }

  async function applyServiceBillingFromParsedAction(action) {
    if (action.serviceBillingMode === "same_as_owner" || (!action.shippingAccountName && !action.billingAccountName)) {
      await applySuggestedServiceBilling();
      return;
    }

    if (workflow.siebelAccount?.id && (!action.shippingAccountName || !action.billingAccountName)) {
      await syncOrderServiceAccounts(workflow.siebelAccount.id);
    }

    updateWorkflow((current) => ({
      ...current,
      serviceBilling: {
        shippingAccount:
          action.shippingAccountName || current.serviceBilling.shippingAccount || `Shipping Account - ${getContactName(current)}`,
        billingAccount:
          action.billingAccountName || current.serviceBilling.billingAccount || `Billing Account - ${getContactName(current)}`,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Service and billing accounts selected. Next copy the customer address to billing and shipping."),
      ],
    }));
    setDrawer(null);
  }

  function applyBillingFromParsedAction(action) {
    if (action.addressMode === "same_as_customer" || (!action.billingAddress && !action.shippingAddress)) {
      applySuggestedBilling();
      return;
    }

    updateWorkflow((current) => ({
      ...current,
      billing: {
        billingAddress: action.billingAddress || current.billing.billingAddress || current.customer.address,
        shippingAddress: action.shippingAddress || current.billing.shippingAddress || action.billingAddress || current.customer.address,
      },
      messages: [
        ...current.messages,
        makeMessage("assistant", "Billing and shipping details added. Next apply payment information."),
      ],
    }));
    setNotification("Billing and shipping details saved.");
    setDrawer(null);
  }

  async function applyPaymentFromParsedAction(action) {
    if (action.paymentMode === "saved" || action.actionType === "apply_saved_payment") {
      await applySuggestedPayment();
      return;
    }

    const nextPayment = {
      cardholderName: action.cardholderName || workflow.payment.cardholderName || getContactName(workflow),
      cardType: action.cardType || workflow.payment.cardType || "Visa",
      cardNumber: formatCardNumber(action.cardNumber || workflow.payment.cardNumber || ""),
      expiry: action.expiry || workflow.payment.expiry || "",
    };

    await persistOrderPaymentDetails(nextPayment);
    updateWorkflow((current) => ({
      ...current,
      payment: nextPayment,
      messages: [
        ...current.messages,
        makeMessage("assistant", "Payment details added. The last step is to generate the call summary."),
      ],
    }));
    setDrawer(null);
  }

  function applySummaryFromParsedAction(action, draft) {
    if (action.summaryMode === "generate" || !String(action.summaryText || draft || "").trim()) {
      applyGeneratedSummary();
      return;
    }

    updateWorkflow((current) => ({
      ...current,
      summaryText: action.summaryText || draft,
      messages: [
        ...current.messages,
        makeMessage("assistant", "The summary has been successfully. Please review all the information added and proceed with placing the order."),
      ],
    }));
  }

  async function executeParsedWorkflowAction(action, draft) {
    switch (action.actionType) {
      case "open_catalog":
        openCatalogDrawer();
        return true;
      case "set_catalog_preferences":
        if (!action.catalogName && !action.priceListName) {
          return false;
        }
        applyCatalogPreferences(action);
        return true;
      case "create_contact":
        await createContactFromParsedAction(action);
        return true;
      case "create_account":
      case "use_contact_as_account":
        await applyAccountFromParsedAction(action);
        return true;
      case "add_recommended_product":
        await applyRecommendedProductSelection();
        return true;
      case "add_specific_product": {
        const matchedProduct = findProductByActionName(action.productName);
        if (!matchedProduct?.id) {
          return false;
        }
        await applyProductSelection(matchedProduct.id);
        return true;
      }
      case "assign_service_billing":
        await applyServiceBillingFromParsedAction(action);
        return true;
      case "set_billing_shipping":
        applyBillingFromParsedAction(action);
        return true;
      case "apply_saved_payment":
        await applySuggestedPayment();
        return true;
      case "set_payment_details":
        if (action.paymentMode !== "saved" && !action.cardNumber && !action.cardType && !action.expiry && !action.cardholderName) {
          return false;
        }
        await applyPaymentFromParsedAction(action);
        return true;
      case "generate_summary":
        applyGeneratedSummary();
        return true;
      case "add_summary_text":
        applySummaryFromParsedAction(action, draft);
        return true;
      case "submit_order":
        submitOrder();
        return true;
      default:
        return false;
    }
  }

  async function processActionInputLegacy(input, source) {
    const draft = input.trim();
    if (!draft) {
      return;
    }

    const lower = draft.toLowerCase();
    const wantsCatalogPreferences =
      /\b(?:use|set|query)\s+catalog\b/i.test(draft) ||
      /\bcatalog(?:\s+should\s+be|\s+is|=|:)\b/i.test(draft) ||
      /\b(?:use|set)\s+(?:price\s*list|pricelist)\b/i.test(draft) ||
      /\b(?:price\s*list|pricelist)(?:\s+should\s+be|\s+is|=|:)\b/i.test(draft);
    const wantsCreateContact = lower.includes("create contact") || lower.includes("create a contact");
    const wantsCatalog = lower.includes("catalog");
    const wantsOrderSubmit =
      lower.includes("place order") ||
      lower.includes("submit order") ||
      lower.includes("complete order") ||
      lower.includes("finish order");
    const wantsContactAsAccount =
      lower.includes("use contact as account") ||
      lower.includes("use customer as account") ||
      lower.includes("copy contact to account") ||
      lower.includes("same as contact");
    const wantsServiceCopy =
      lower.includes("copy account info to billing and service") ||
      lower.includes("copy account info to service and billing") ||
      lower.includes("use account for service") ||
      lower.includes("use contact for service");
    const wantsBillingCopy =
      lower.includes("copy account info to billing") ||
      lower.includes("use contact for billing") ||
      lower.includes("use existing address") ||
      lower.includes("copy address");
    const wantsAccountCreate =
      lower.includes("create account") ||
      lower.includes("use account as") ||
      lower.includes("account name is") ||
      lower.includes("contact name is");
    const wantsServiceAssignment =
      wantsServiceCopy || lower.includes("shipping account") || lower.includes("billing account");
    const hasCardInfo = /\b(?:card(?: info| number)?|visa|mastercard|amex|discover)\b/i.test(draft) && /\d/.test(draft);
    const useContactAddress = /\bcontact add?re?s?s?\b/i.test(draft) || /\bexisting add?re?s?s?\b/i.test(draft);
    const wantsSummaryGenerate = lower.includes("generate summary") || lower.includes("add summary") || lower.includes("summarize");
    const wantsRecommendationAction =
      lower.includes("recommendation") ||
      lower.includes("recommended offer") ||
      /\badd\b/.test(lower) ||
      /\bapply\b/.test(lower);
    const matchedProduct =
      findProductByText(activeProducts, draft) ||
      findProductByText(
        catalogState.categories.flatMap((category) => category.products || []),
        draft,
      );

    if (wantsOrderSubmit) {
      appendUserActionMessage(draft, source);
      submitOrder();
      return;
    }

    if (wantsCreateContact) {
      appendUserActionMessage(draft, source);
      try {
        await createContactFromNaturalLanguage(draft);
      } catch (error) {
        pushMessages([
          makeMessage(
            "assistant",
            `I could not create the Siebel contact. ${error instanceof Error ? error.message : "Unknown contact creation error."}`,
          ),
        ]);
        setNotification("Siebel contact create failed.");
      }
      return;
    }

    if (wantsCatalogPreferences) {
      appendUserActionMessage(draft, source);
      applyCatalogPreferencesFromNaturalLanguage(draft);
      return;
    }

    if (!completion.account) {
      if (wantsCatalog) {
        pushMessages([makeMessage("chip", draft, "chip")]);
        clearActionInput(source);
        openCatalogDrawer();
        return;
      }

      if (matchedProduct || (wantsRecommendationAction && recommendedProduct)) {
        appendUserActionMessage(draft, source);
        try {
          await applyRecommendedProductSelection(matchedProduct?.id || recommendedProduct?.id);
        } catch (error) {
          pushMessages([
            makeMessage(
              "assistant",
              `I could not add the recommended product. ${error instanceof Error ? error.message : "Unknown recommendation error."}`,
            ),
          ]);
          setNotification("Recommendation add failed.");
        }
        return;
      }

      if (wantsContactAsAccount) {
        appendUserActionMessage(draft, source);
        try {
          await applySuggestedAccountProfile();
        } catch (error) {
          pushMessages([
            makeMessage(
              "assistant",
              `I could not create the Siebel account. ${error instanceof Error ? error.message : "Unknown account creation error."}`,
            ),
          ]);
          setNotification("Siebel account create failed.");
        }
        return;
      }

      appendUserActionMessage(draft, source);
      try {
        await applyAccountFromNaturalLanguage(draft);
      } catch (error) {
        pushMessages([
          makeMessage(
            "assistant",
            `I could not create the Siebel account. ${error instanceof Error ? error.message : "Unknown account creation error."}`,
          ),
        ]);
        setNotification("Siebel account create failed.");
      }
      return;
    }

    if (!completion.product) {
      if (wantsCatalog) {
        pushMessages([makeMessage("chip", draft, "chip")]);
        clearActionInput(source);
        openCatalogDrawer();
        return;
      }

      if (matchedProduct) {
        appendUserActionMessage(draft, source);
        await applyProductSelection(matchedProduct.id);
        return;
      }

      await applyProductSelection((recommendedProduct || activeProducts[0] || PRODUCTS[0]).id);
      clearActionInput(source);
      return;
    }

    if (wantsAccountCreate || wantsContactAsAccount) {
      appendUserActionMessage(draft, source);
      if (wantsContactAsAccount) {
        try {
          await applySuggestedAccountProfile();
        } catch (error) {
          pushMessages([
            makeMessage(
              "assistant",
              `I could not create the Siebel account. ${error instanceof Error ? error.message : "Unknown account creation error."}`,
            ),
          ]);
          setNotification("Siebel account create failed.");
        }
      } else {
        try {
          await applyAccountFromNaturalLanguage(draft);
        } catch (error) {
          pushMessages([
            makeMessage(
              "assistant",
              `I could not create the Siebel account. ${error instanceof Error ? error.message : "Unknown account creation error."}`,
            ),
          ]);
          setNotification("Siebel account create failed.");
        }
      }
      return;
    }

    if (!completion.service && wantsServiceAssignment) {
      appendUserActionMessage(draft, source);
      try {
        await applyServiceBillingFromNaturalLanguage(draft);
      } catch (error) {
        pushMessages([
          makeMessage(
            "assistant",
            `I could not update the service and billing accounts on the Siebel order. ${error instanceof Error ? error.message : "Unknown order update error."}`,
          ),
        ]);
        setNotification("Siebel order update failed.");
      }
      return;
    }

    if (!completion.billing && (wantsBillingCopy || useContactAddress) && !hasCardInfo) {
      appendUserActionMessage(draft, source);
      applyBillingFromNaturalLanguage(draft);
      return;
    }

    if (!completion.payment && (nextStepId === "payment" || hasCardInfo)) {
      if (lower.includes("saved payment") || lower.includes("use payment on file")) {
        appendUserActionMessage(draft, source);
        await applySuggestedPayment();
        return;
      }

      appendUserActionMessage(draft, source);
      await applyPaymentFromNaturalLanguage(draft);
      return;
    }

    if (!completion.summary && nextStepId === "summary") {
      if (wantsSummaryGenerate) {
        appendUserActionMessage(draft, source);
        applyGeneratedSummary();
        return;
      }

      updateWorkflow((current) => ({
        ...current,
        summaryText: draft,
        composer: source === "composer" ? "" : current.composer,
        messages: [
          ...current.messages,
          makeMessage("user", draft),
          makeMessage(
            "assistant",
            "The summary has been successfully. Please review all the information added and proceed with placing the order.",
          ),
        ],
      }));
      if (source === "smart") {
        setSmartActionDraft("");
      }
      return;
    }

    pushMessages([makeMessage("user", draft)]);
    clearActionInput(source);
  }

  async function processActionInput(input, source) {
    const draft = input.trim();
    if (!draft) {
      return;
    }

    const hasSensitiveCardInfo = /\b(?:card(?: info| number)?|visa|mastercard|amex|discover)\b/i.test(draft) && /\d/.test(draft);

    if (IS_LLM_MODE_ENABLED && !hasSensitiveCardInfo) {
      try {
        const parsedAction = await parseWorkflowAction(draft, {
          nextStepId,
          view,
          completion,
          orderId: workflow.orderId,
          orderNumber: workflow.orderNumber,
          hasSiebelContact: Boolean(workflow.siebelContact?.id),
          hasSiebelAccount: Boolean(workflow.siebelAccount?.id),
          customerName: workflow.customer.name,
          accountName: workflow.siebelAccount?.name || "",
          recommendedProduct: recommendedProduct
            ? {
                name: recommendedProduct.name,
                category: semanticRecommendation?.categoryNames?.[0] || recommendedProduct.family || "",
                type: recommendedProduct.isBundledPromotion ? "Bundled promotion" : "Offer",
              }
            : null,
          availableCategories: catalogState.categories.map((category) => category.name),
          availableProducts: activeProducts.slice(0, 50).map((product) => ({
            name: product.name,
            category: product.categoryName || product.family || "",
            type: product.isBundledPromotion ? "Bundled promotion" : "Offer",
          })),
        });

        if (parsedAction?.actionType && parsedAction.actionType !== "unknown") {
          appendUserActionMessage(draft, source);
          const handled = await executeParsedWorkflowAction(parsedAction, draft);
          if (handled) {
            return;
          }
        }
      } catch {
        // Fall through to the deterministic parser when the LLM path is unavailable.
      }
    }

    await processActionInputLegacy(draft, source);
  }

  async function handleComposerSubmit(event) {
    event.preventDefault();
    await processActionInput(workflow.composer, "composer");
  }

  async function handleSmartActionSubmit(event) {
    event.preventDefault();
    await processActionInput(smartActionDraft, "smart");
  }

  function toggleCartRow(rowId) {
    setExpandedCartRows((current) => ({
      ...current,
      [rowId]: !current[rowId],
    }));
  }

  function formatMaskedPaymentSummary(payment) {
    const digits = String(payment.cardNumber || "").replace(/\D/g, "");
    const last4 = digits.slice(-4) || "0000";
    return `${payment.cardType || "Card"} ending ${last4}, expires ${payment.expiry || ""}, cardholder ${payment.cardholderName || getContactName(workflow)}`;
  }

  async function persistOrderPaymentDetails(payment) {
    if (!workflow.orderId) {
      throw new Error("Order id is required before saving payment details.");
    }

    await createSiebelOrderPayment(workflow.orderId, {
      cardholderName: payment.cardholderName || getContactName(workflow),
      cardType: payment.cardType || "Visa",
      cardNumber: payment.cardNumber || "",
      expiry: payment.expiry || "",
      paymentMethod: "Credit Card",
    });
  }

  async function persistSummaryActivity(summaryText) {
    if (!workflow.siebelAccount?.id || !String(summaryText || "").trim()) {
      return;
    }

    await createSiebelAccountAction(workflow.siebelAccount.id, {
      type: "Call",
      description: summaryText.trim(),
    });
  }

  async function submitOrder() {
    if (!canPlaceOrder) {
      return;
    }

    try {
      await persistSummaryActivity(workflow.summaryText);
    } catch (error) {
      pushMessages([
        makeMessage(
          "assistant",
          `I couldn't save the summary to the Siebel account activity log. ${error instanceof Error ? error.message : "Unknown summary activity error."}`,
        ),
      ]);
      setNotification("Siebel activity update failed.");
    }

    setSiebelState({
      status: "idle",
      error: "",
      data: null,
    });
    setNotification(`Order ${workflow.orderNumber || "ORD-104822"} is ready for fulfillment.`);
    setDrawer(null);
    setView("customer360");
  }

  function renderLanguageSelector() {
    return (
      <label className="language-selector">
        <span>Language</span>
        <select value={locale} onChange={(event) => setLocale(getSupportedLocale(event.target.value))}>
          {SUPPORTED_LOCALES.map((supportedLocale) => (
            <option key={supportedLocale} value={supportedLocale}>
              {LOCALE_LABELS[supportedLocale] || supportedLocale}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderHome() {
    return (
      <main className="home-screen">
        <header className="home-header">
          <div className="home-header__title">
            <h1>Home</h1>
            <span>⌄</span>
          </div>
          <div className="home-header__actions">
            {renderLanguageSelector()}
            <button className="secondary-button">Actions ⌄</button>
            <button className="secondary-button">☎ Communications</button>
          </div>
        </header>

        <div className="pattern-strip" aria-hidden="true"></div>

        <section className="home-grid">
          <article className="home-panel home-panel--tall">
            <div className="panel-header">
              <h2>Activities</h2>
              <button className="icon-button">…</button>
            </div>

            <div className="panel-divider-label">Today, April 28</div>
            <div className="activity-list">
              {HOME_ACTIVITIES.slice(0, 3).map((activity) => (
                <div key={activity.title} className="activity-row">
                  <div className="activity-row__icon">{activity.icon}</div>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-divider-label">Yesterday, April 27</div>
            <div className="activity-row">
              <div className="activity-row__icon">{HOME_ACTIVITIES[3].icon}</div>
              <div>
                <strong>{HOME_ACTIVITIES[3].title}</strong>
                <p>{HOME_ACTIVITIES[3].detail}</p>
              </div>
            </div>
          </article>

          <article className="home-panel">
            <div className="panel-header">
              <h2>Tasks</h2>
            </div>
            <div className="task-list">
              {TASK_ITEMS.map((item) => (
                <button key={item} className="task-link" onClick={item === APP_TITLE ? beginTaskFlow : undefined}>
                  {item}
                </button>
              ))}
            </div>
          </article>

          <article className="home-panel">
            <div className="panel-header">
              <h2>Panel 3</h2>
              <button className="icon-button">…</button>
            </div>
          </article>

          <article className="home-panel home-panel--wide">
            <div className="panel-header">
              <div>
                <h2>Calendar</h2>
                <p className="calendar-subtitle">$375,000 Won</p>
              </div>
              <button className="icon-button">…</button>
            </div>
            <div className="calendar-grid"></div>
          </article>

          <article className="home-panel">
            <div className="panel-header">
              <h2>Panel 4</h2>
              <button className="icon-button">…</button>
            </div>
          </article>
        </section>
      </main>
    );
  }

  function renderIntake() {
    return (
      <main className="intake-screen">
        <div className="pattern-strip pattern-strip--top" aria-hidden="true"></div>
        <header className="intake-header">
          <h1>{APP_TITLE}</h1>
          {renderLanguageSelector()}
        </header>

        <section className="intake-content">
          <div className="intake-copy">
            <h2>Tell us about the customer and their requirements</h2>
            <p>
              Provide name and address of the customer along with their needs and preferences so we can recommend the
              most suitable product and configuration.
            </p>

            <form
              className={`intake-form ${intakeExpanded ? "intake-form--expanded" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (!intakeExpanded) {
                  expandIntake();
                  return;
                }
                startWorkflow();
              }}
            >
              <OracleMark />
              {intakeExpanded ? (
                <textarea value={intakeDraft} onChange={(event) => setIntakeDraft(event.target.value)} />
              ) : (
                <input
                  value={intakeDraft}
                  onChange={(event) => setIntakeDraft(event.target.value)}
                  onFocus={expandIntake}
                  onClick={expandIntake}
                />
              )}
              <span className="intake-attach">◍</span>
            </form>

            <div className="intake-actions">
              <button
                className="primary-button primary-button--enabled"
                onClick={() => {
                  if (!intakeExpanded) {
                    expandIntake();
                    return;
                  }
                  startWorkflow();
                }}
              >
                Continue
              </button>
            </div>

            {recommendedProduct ? (
              <article className="recommendation-card intake-recommendation-preview">
                <h3>{`Recommended offer: ${recommendedProduct.name}`}</h3>
                <p>{semanticRecommendation?.reason || recommendedProduct.recommendation}</p>
                <p>{recommendedProduct.description}</p>
                <div className="intake-recommendation-preview__meta">
                  <span>{semanticRecommendation?.categoryNames?.[0] || recommendedProduct.family || "Supremo Catalog"}</span>
                  <span>{recommendedProduct.isBundledPromotion ? "Bundled promotion" : "Offer"}</span>
                </div>
                <div className="recommendation-card__actions">
                  <button
                    className={`primary-button ${!isApplyingIntakeRecommendation ? "primary-button--enabled" : ""}`}
                    disabled={isApplyingIntakeRecommendation}
                    onClick={() => startWorkflow({ autoRecommendProductId: recommendedProduct.id })}
                  >
                    {isApplyingIntakeRecommendation
                      ? "Applying recommendation..."
                      : recommendedProduct.isBundledPromotion
                        ? "Apply recommendation"
                        : "Add recommendation"}
                  </button>
                </div>
              </article>
            ) : null}
          </div>

          <CustomerArt />
        </section>
      </main>
    );
  }

  function renderStepTracker() {
    return (
      <section className="hero-panel hero-panel--tracker">
        <AccentRule />
        <div>
          <h2 className="hero-panel__title hero-panel__title--section">
            {heroMessage}
          </h2>
          <div className="step-tracker-list">
            {stepTracker.map((step) => (
              <div key={step.id} className={`step-tracker-row ${step.complete ? "step-tracker-row--complete" : ""}`}>
                <span className={`step-tracker-row__icon ${step.complete ? "step-tracker-row__icon--complete" : ""}`}>
                  {step.complete ? "✓" : "▲"}
                </span>
                <span>{step.complete ? step.label : step.incomplete}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderCustomerCard() {
    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Customer details</h3>
            <SectionAccent />
          </div>
          <button className="edit-button" onClick={() => openFormDrawer("customer")}>
            ✎
          </button>
        </div>
        <div className="status-block">
          <div>
            <h4>Name and address added</h4>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <span>Name</span>
            <strong>{workflow.customer.name}</strong>
          </div>
          <div>
            <span>Address</span>
            <strong>{workflow.customer.address}</strong>
          </div>
          {workflow.siebelContact ? (
            <div>
              <span>Siebel contact</span>
              <strong>{`${workflow.siebelContact.name} (${workflow.siebelContact.id})`}</strong>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function renderCartCard() {
    const cartItemCount = workflow.cartItems.length;

    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Cart</h3>
            <SectionAccent />
          </div>
        </div>

        {!selectedProduct ? (
          <>
            <div className="status-block status-block--warning">
              <span className="warning-icon" aria-hidden="true">
                ▲
              </span>
              <div>
                <h4>No product added</h4>
                <p>{workflow.orderId ? `Siebel order ${workflow.orderNumber || workflow.orderId} is ready for product selection.` : "Consider recommendation or add from product catalog"}</p>
              </div>
            </div>
            <div className="empty-cart">
              <CartIllustration />
              <button className="secondary-button" onClick={openCatalogDrawer}>
                ↗ View product catalog
              </button>
            </div>
          </>
        ) : (
          <div className="cart-table-wrap">
            <div className="status-block status-block--compact">
              <div>
                <h4>{`${cartItemCount} product${cartItemCount === 1 ? "" : "s"} added`}</h4>
                <p>{workflow.orderId ? `Siebel order ${workflow.orderNumber || workflow.orderId} is active.` : "Consider recommendation or add from product catalog"}</p>
              </div>
            </div>

            <div className="cart-summary-grid">
              <div>
                <span>Monthly Fee</span>
                <strong>{formatLocalizedMoney(cartTotals.monthlyFee)}</strong>
              </div>
              <div>
                <span>One-time Fee</span>
                <strong>{formatLocalizedMoney(cartTotals.oneTimeFee)}</strong>
              </div>
              <div>
                <span>Total discount</span>
                <strong>0%</strong>
              </div>
            </div>

            <table className="cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Monthly Fee</th>
                  <th>One-Time Fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBrowseRows.map((row) => {
                  const rowProduct =
                    activeProducts.find((product) => product.siebelProductId === row.productId || product.id === row.productId || product.name === row.name) ??
                    findProductInCategories(catalogState.categories, row.productId);
                  const fees = getRowFeeBreakdown(row, rowProduct);
                  const hasChildren = parentCartRowIds.has(row.id);
                  const isExpanded = Boolean(expandedCartRows[row.id]);

                  return (
                  <tr key={row.id}>
                    <td className={`cart-table__label cart-table__label--level-${row.level}`}>
                      {hasChildren ? (
                        <button
                          type="button"
                          className={`row-chevron row-chevron--button ${isExpanded ? "row-chevron--expanded" : ""}`}
                          onClick={() => toggleCartRow(row.id)}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.name}`}
                          aria-expanded={isExpanded}
                        >
                          ▸
                        </button>
                      ) : (
                        <span className="row-chevron" aria-hidden="true"></span>
                      )}
                      <span>{row.name}</span>
                    </td>
                    <td>{row.quantity}</td>
                    <td>{formatLocalizedMoney(fees.monthlyFee)}</td>
                    <td>{formatLocalizedMoney(fees.oneTimeFee)}</td>
                    <td>{`Line ${row.lineNumber}`}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="cart-toolbar">
              <button className="toolbar-button" onClick={openCatalogDrawer}>
                ↗ View product catalog
              </button>
              <button className="toolbar-button">🗑 Clear cart</button>
              <button className="toolbar-button">💲 Reprice all</button>
              <button className="toolbar-icon">◫</button>
            </div>
          </div>
        )}
      </article>
    );
  }

  function renderAccountCard() {
    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Account and contact Information</h3>
            <SectionAccent />
          </div>
          <button className="edit-button" onClick={() => openFormDrawer("account")}>
            ✎
          </button>
        </div>

        {!completion.account ? (
          <div className="canvas-section-stack">
            <div className="status-block status-block--warning">
              <span className="warning-icon" aria-hidden="true">
                ▲
              </span>
              <div>
                <h4>Incomplete account and contact details</h4>
              </div>
            </div>

            <div className="detail-status-list">
              <div className="detail-status-row">
                <span className="detail-status-row__icon">△</span>
                <div className="detail-status-row__copy">
                  <span>Account details</span>
                  <strong>Account site is {workflow.account.accountSite}</strong>
                </div>
                <p>Account name and mobile number is pending</p>
              </div>

              <div className="detail-status-row">
                <span className="detail-status-row__icon">△</span>
                <div className="detail-status-row__copy">
                  <span>Credit check details</span>
                  <strong>No ID not provided</strong>
                </div>
                <p>Government ID is pending</p>
              </div>

              <div className="detail-status-row">
                <span className="detail-status-row__icon">△</span>
                <div className="detail-status-row__copy">
                  <span>Contact details</span>
                  <strong>Primary contact information not provided</strong>
                </div>
                <p>Last name, job title, work phone number, and email address is pending</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="account-details">
            <h4>Account and contact details completed</h4>
          <div className="account-copy">
              <span>Account details</span>
              <strong>{`${contactName}, ${workflow.account.accountSite}, ${workflow.account.mobileNumber}`}</strong>
            </div>
            <div className="account-copy">
              <span>Credit check details</span>
              <p>
                The credit check has been completed successfully. While the account meets the minimum credit
                requirements, a standard credit limit will apply. Any future increases may require a reassessment.
              </p>
            </div>
          </div>
        )}
      </article>
    );
  }

  function renderServiceCard() {
    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Service and Billing Accounts</h3>
            <SectionAccent />
          </div>
          <button className="edit-button" onClick={() => openFormDrawer("service")}>
            ✎
          </button>
        </div>

        {!completion.service ? (
          <div className="canvas-section-stack">
            <div className="status-block status-block--warning">
              <span className="warning-icon" aria-hidden="true">
                ▲
              </span>
              <div>
                <h4>Assignment of service and billing accounts pending</h4>
                <p>
                  Billing and shipping addresses are needed to ensure accurate order delivery and to comply with
                  regional tax regulations.
                </p>
              </div>
            </div>
            <div className="card-action-row">
              <button className="toolbar-button" onClick={() => openFormDrawer("service")}>
                ⌘ Select shipping account
              </button>
              <button className="toolbar-button" onClick={() => openFormDrawer("service")}>
                ⌘ Select billing account
              </button>
            </div>
          </div>
        ) : (
          <div className="account-details">
            <h4>Service and billing accounts assigned</h4>
            <div className="account-copy">
              <span>Shipping account</span>
              <strong>{workflow.serviceBilling.shippingAccount}</strong>
            </div>
            <div className="account-copy">
              <span>Billing account</span>
              <strong>{workflow.serviceBilling.billingAccount}</strong>
            </div>
          </div>
        )}
      </article>
    );
  }

  function renderBillingCard() {
    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Billing and Shipping Address</h3>
            <SectionAccent />
          </div>
          <button className="edit-button" onClick={() => openFormDrawer("billing")}>
            ✎
          </button>
        </div>

        {!completion.billing ? (
          <div className="canvas-section-stack">
            <div className="status-block status-block--warning">
              <span className="warning-icon" aria-hidden="true">
                ▲
              </span>
              <div>
                <h4>Billing and shipping information required</h4>
                <p>
                  Billing and shipping addresses are needed to ensure accurate order delivery and to comply with
                  regional tax regulations.
                </p>
              </div>
            </div>
            <div className="card-action-row">
              <button className="toolbar-button" onClick={() => openFormDrawer("billing")}>
                ⌘ Select billing address
              </button>
              <button className="toolbar-button" onClick={() => openFormDrawer("billing")}>
                ⌘ Select shipping address
              </button>
            </div>
          </div>
        ) : (
          <div className="detail-grid">
            <div>
              <span>Billing address</span>
              <strong>{workflow.billing.billingAddress}</strong>
            </div>
            <div>
              <span>Shipping address</span>
              <strong>{workflow.billing.shippingAddress}</strong>
            </div>
          </div>
        )}
      </article>
    );
  }

  function renderPaymentCard() {
    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Payment Details</h3>
            <SectionAccent />
          </div>
          <button className="edit-button" onClick={() => openFormDrawer("payment")}>
            ✎
          </button>
        </div>

        {!completion.payment ? (
          <div className="canvas-section-stack">
            <div className="status-block status-block--warning">
              <span className="warning-icon" aria-hidden="true">
                ▲
              </span>
              <div>
                <h4>Payment details not available</h4>
                <p>Your payment details will be securely saved to streamline future orders.</p>
              </div>
            </div>
            <div className="card-action-row">
              <button className="toolbar-button" onClick={() => openFormDrawer("payment")}>
                ▣ Add payment details
              </button>
            </div>
          </div>
        ) : (
          <div className="account-details">
            <h4>Payment details added</h4>
            <div className="account-copy">
              <span>Payment method</span>
              <strong>{`${workflow.payment.cardholderName}, ${workflow.payment.cardType}, ${workflow.payment.cardNumber}, expires ${workflow.payment.expiry}.`}</strong>
            </div>
          </div>
        )}
      </article>
    );
  }

  function renderSummaryCard() {
    return (
      <article className="canvas-card">
        <div className="canvas-card__header">
          <div>
            <h3>Call Summary</h3>
            <SectionAccent />
          </div>
          <button className="edit-button" onClick={() => openFormDrawer("summary")}>
            ✎
          </button>
        </div>

        {!completion.summary ? (
          <div className="canvas-section-stack">
            <div className="status-block status-block--warning">
              <span className="warning-icon" aria-hidden="true">
                ▲
              </span>
              <div>
                <h4>Call summary not added</h4>
                <p>Add the generated summary before placing the order.</p>
              </div>
            </div>
            <div className="card-action-row">
              <button className="toolbar-button" onClick={() => openFormDrawer("summary")}>
                Add summary
              </button>
            </div>
          </div>
        ) : (
          <blockquote className="summary-quote">{workflow.summaryText}</blockquote>
        )}
      </article>
    );
  }

  function renderCatalogDrawer() {
    const resultCount = filteredProducts.length;
    const browseProducts = browseCategory?.products || [];
    const catalogChipLabel = catalogState.resolvedCatalogName || workflow.catalogName;

    return (
      <aside className="drawer-panel drawer-panel--catalog">
        <header className="drawer-panel__header">
          <h2>Select products</h2>
          <button className="close-button" onClick={() => setDrawer(null)}>
            ×
          </button>
        </header>

        <div className="catalog-panel__tabs">
          <button
            className={`catalog-tab ${catalogState.view === "search" ? "catalog-tab--active" : ""}`}
            onClick={() => setCatalogView("search")}
          >
            Search
          </button>
          <button
            className={`catalog-tab ${catalogState.view === "browse" ? "catalog-tab--active" : ""}`}
            onClick={() => setCatalogView("browse")}
          >
            Browse
          </button>
        </div>

        {catalogState.status === "loading" ? <div className="notification-banner"><span>Loading live Siebel products...</span></div> : null}
        {catalogState.error ? <div className="notification-banner"><span>{catalogState.error}</span></div> : null}

        {catalogState.view === "search" ? (
        <>
        <div className="catalog-search-stack">
          <div className="catalog-search">
            <span>⌕</span>
            <span className="search-chip">{catalogChipLabel}</span>
            <input
              value={catalogState.query}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Search by product name"
            />
          </div>

          <div className="catalog-smart-filters" role="group" aria-label="Catalog category filters">
            <button
              type="button"
              className={`catalog-filter-chip ${!catalogState.browseCategoryId ? "catalog-filter-chip--active" : ""}`}
              onClick={() => setBrowseCategory("")}
            >
              All
            </button>
            {catalogState.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`catalog-filter-chip ${catalogState.browseCategoryId === category.id ? "catalog-filter-chip--active" : ""}`}
                onClick={() => setBrowseCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-meta">
          <div className="catalog-meta__left">
            <strong>{`${resultCount} Results`}</strong>
            {workflow.orderId ? (
              <button className="secondary-button">{`🛒 Order ${workflow.orderNumber || workflow.orderId}`}</button>
            ) : null}
          </div>
          <div className="catalog-meta__right">
            <button className="secondary-button" onClick={() => setCatalogQuery("")}>Clear</button>
          </div>
        </div>

        <div className="catalog-results">
          {filteredProducts.map((product) => (
            <article key={product.id} className={`catalog-row ${workflow.catalogSelectionId === product.id ? "catalog-row--selected" : ""}`}>
              <ProductThumb tone={product.thumb} />
              <div className="catalog-row__copy">
                <span>{product.family}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
              </div>
              <div className="catalog-row__price">
                <small>List price</small>
                <strong>{product.listPrice}</strong>
              </div>
              <div className="catalog-row__price">
                <small>Your price</small>
                <strong>{product.yourPrice}</strong>
              </div>
              <button
                className="soft-button"
                onClick={() => applyProductSelection(product.id)}
              >
                {product.isBundledPromotion ? "Apply" : "Add"}
              </button>
            </article>
          ))}
          {!filteredProducts.length ? (
            <div className="status-block">
              <div>
                <h4>No matching products found</h4>
                <p>Try a different product name or switch to Browse to inspect the catalog hierarchy.</p>
              </div>
            </div>
          ) : null}
        </div>
        </>
        ) : (
        <div className="catalog-browse-shell">
          <aside className="catalog-browse-nav">
            <div className="catalog-browse-nav__list">
              {catalogState.categories.map((category) => (
                <button
                  key={category.id}
                  className={`catalog-browse-category ${browseCategory?.id === category.id ? "catalog-browse-category--active" : ""}`}
                  onClick={() => setBrowseCategory(category.id)}
                >
                  <span className="catalog-browse-category__chevron">›</span>
                  <span>{`${category.name}${category.productCount ? ` (${category.productCount})` : ""}`}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="catalog-browse-main">
            <div className="catalog-browse-header">
              <div>
                <h3>{browseCategory?.name || "Category Products"}</h3>
              </div>
              <div className="catalog-browse-actions">
                <button className="secondary-button">Configure</button>
                <button className="secondary-button" onClick={() => browseProducts[0] && applyProductSelection(browseProducts[0].id)}>Add Item</button>
                <button className="secondary-button">Compare</button>
              </div>
            </div>

            <div className="catalog-browse-table-wrap">
              <table className="catalog-browse-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Product Name</th>
                    <th>Description</th>
                    <th>List Price</th>
                    <th>Your Price</th>
                    <th>Qty</th>
                    <th>Eligible</th>
                    <th>Eligibility Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {browseProducts.map((product) => (
                    <tr key={product.id} className={workflow.catalogSelectionId === product.id ? "catalog-browse-table__row--selected" : ""}>
                      <td>
                        <button className="catalog-select-button" onClick={() => updateWorkflow((current) => ({ ...current, catalogSelectionId: product.id }))}>
                          {workflow.catalogSelectionId === product.id ? "✓" : ""}
                        </button>
                      </td>
                      <td>{product.name}</td>
                      <td>{product.description}</td>
                      <td>{product.listPrice}</td>
                      <td>{product.yourPrice}</td>
                      <td>1</td>
                      <td>{product.isBundledPromotion ? "Rule-based" : "Yes"}</td>
                      <td>{product.isBundledPromotion ? "Bundled promotion must be applied through workflow." : "Ready to add to quote."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        )}

        <div className="drawer-panel__footer">
          <button className="secondary-button" onClick={() => setDrawer(null)}>
            Cancel
          </button>
          <button className="primary-button primary-button--enabled" onClick={() => applyProductSelection(workflow.catalogSelectionId)}>
            {selectedProduct?.isBundledPromotion ? "Apply selected promotion" : "Add selected"}
          </button>
        </div>
      </aside>
    );
  }

  function renderFormDrawer() {
    const titles = {
      customer: "Edit customer details",
      account: "Account and contact details",
      service: "Service and billing accounts",
      billing: "Billing and shipping address",
      payment: "Payment details",
      summary: "Call summary",
    };

    return (
      <aside className="drawer-panel">
        <header className="drawer-panel__header">
          <h2>{titles[drawer]}</h2>
          <button className="close-button" onClick={() => setDrawer(null)}>
            ×
          </button>
        </header>

        <div className="form-drawer__body">
          {drawer === "customer" ? (
            <div className="drawer-form-grid">
              <label>
                <span>Contact name</span>
                <input value={drawerDraft.name ?? ""} onChange={(event) => setDraftField("name", event.target.value)} />
              </label>
              <label className="drawer-form-grid__full">
                <span>Address</span>
                <textarea value={drawerDraft.address ?? ""} onChange={(event) => setDraftField("address", event.target.value)} />
              </label>
            </div>
          ) : null}

          {drawer === "account" ? (
            <div className="drawer-form-grid">
              <label>
                <span>Account site</span>
                <input value={drawerDraft.accountSite ?? ""} onChange={(event) => setDraftField("accountSite", event.target.value)} />
              </label>
              <label>
                <span>Mobile number</span>
                <input value={drawerDraft.mobileNumber ?? ""} onChange={(event) => setDraftField("mobileNumber", event.target.value)} />
              </label>
              <label>
                <span>Government ID</span>
                <input value={drawerDraft.governmentId ?? ""} onChange={(event) => setDraftField("governmentId", event.target.value)} />
              </label>
              <label>
                <span>Last name</span>
                <input value={drawerDraft.lastName ?? ""} onChange={(event) => setDraftField("lastName", event.target.value)} />
              </label>
              <label>
                <span>Job title</span>
                <input value={drawerDraft.jobTitle ?? ""} onChange={(event) => setDraftField("jobTitle", event.target.value)} />
              </label>
              <label>
                <span>Work phone number</span>
                <input value={drawerDraft.workPhone ?? ""} onChange={(event) => setDraftField("workPhone", event.target.value)} />
              </label>
              <label className="drawer-form-grid__full">
                <span>Email address</span>
                <input value={drawerDraft.email ?? ""} onChange={(event) => setDraftField("email", event.target.value)} />
              </label>
            </div>
          ) : null}

          {drawer === "service" ? (
            <div className="drawer-form-grid">
              <label className="drawer-form-grid__full">
                <span>Shipping account</span>
                <input value={drawerDraft.shippingAccount ?? ""} onChange={(event) => setDraftField("shippingAccount", event.target.value)} />
              </label>
              <label className="drawer-form-grid__full">
                <span>Billing account</span>
                <input value={drawerDraft.billingAccount ?? ""} onChange={(event) => setDraftField("billingAccount", event.target.value)} />
              </label>
            </div>
          ) : null}

          {drawer === "billing" ? (
            <div className="drawer-form-grid">
              <label className="drawer-form-grid__full">
                <span>Billing address</span>
                <textarea
                  value={drawerDraft.billingAddress ?? ""}
                  onChange={(event) => setDraftField("billingAddress", event.target.value)}
                />
              </label>
              <label className="drawer-form-grid__full">
                <span>Shipping address</span>
                <textarea
                  value={drawerDraft.shippingAddress ?? ""}
                  onChange={(event) => setDraftField("shippingAddress", event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {drawer === "payment" ? (
            <div className="drawer-form-grid">
              <label className="drawer-form-grid__full">
                <span>Cardholder name</span>
                <input
                  value={drawerDraft.cardholderName ?? ""}
                  onChange={(event) => setDraftField("cardholderName", event.target.value)}
                />
              </label>
              <label>
                <span>Card type</span>
                <input value={drawerDraft.cardType ?? ""} onChange={(event) => setDraftField("cardType", event.target.value)} />
              </label>
              <label>
                <span>Card number</span>
                <input value={drawerDraft.cardNumber ?? ""} onChange={(event) => setDraftField("cardNumber", event.target.value)} />
              </label>
              <label>
                <span>Expiry</span>
                <input value={drawerDraft.expiry ?? ""} onChange={(event) => setDraftField("expiry", event.target.value)} />
              </label>
            </div>
          ) : null}

          {drawer === "summary" ? (
            <div className="drawer-form-grid">
              <label className="drawer-form-grid__full">
                <span>Summary</span>
                <textarea value={drawerDraft.summaryText ?? ""} onChange={(event) => setDraftField("summaryText", event.target.value)} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="drawer-panel__footer">
          <button className="secondary-button" onClick={() => setDrawer(null)}>
            Cancel
          </button>
          <button
            className="primary-button primary-button--enabled"
            onClick={() => {
              Promise.resolve()
                .then(async () => {
                  if (drawer === "customer") saveCustomerDetails();
                  if (drawer === "account") await saveAccountDetailsFromDraft();
                  if (drawer === "service") await saveServiceBillingFromDraft();
                  if (drawer === "billing") saveBillingFromDraft();
                  if (drawer === "payment") await savePaymentFromDraft();
                  if (drawer === "summary") saveSummaryFromDraft();
                })
                .catch((error) => {
                  pushMessages([
                    makeMessage(
                      "assistant",
                      `I couldn't save that step to Siebel. ${error instanceof Error ? error.message : "Unknown workflow error."}`,
                    ),
                  ]);
                  setNotification("Siebel update failed.");
                });
            }}
          >
            Save
          </button>
        </div>
      </aside>
    );
  }

  function renderDrawer() {
    if (!drawer) {
      return null;
    }

    return (
      <div className="drawer-overlay">
        <button className="drawer-backdrop" onClick={() => setDrawer(null)} aria-label="Close drawer"></button>
        {drawer === "catalog" ? renderCatalogDrawer() : renderFormDrawer()}
      </div>
    );
  }

  function renderCustomer360() {
    return (
      <main className="customer360-screen">
        <header className="customer360-header">
          <div className="customer360-header__top">
            <button className="close-button" onClick={() => setView("home")} aria-label="Back to home">
              ‹
            </button>
            <div className="customer360-header__identity">
              <div className="customer360-title-row">
                <h1>{customer360Record.name}</h1>
                <span className="customer360-status">{customer360Record.status}</span>
              </div>
              <div className="customer360-meta">
                <span>Account number <strong>{customer360Record.accountNumber}</strong></span>
                <span>Address <strong>{customer360Record.address}</strong></span>
                <span>Email <strong>{customer360Record.email}</strong></span>
                <span>Phone <strong>{customer360Record.phone}</strong></span>
              </div>
            </div>
            <div className="customer360-header__actions">
              {renderLanguageSelector()}
              <button className="secondary-button">Account details</button>
            </div>
          </div>

          <div className="customer360-search">
            <OracleMark />
            <input value="Create new service request" readOnly aria-label="Create new service request" />
          </div>
        </header>

        <div className="pattern-strip" aria-hidden="true"></div>

        {siebelState.status === "loading" ? (
          <div className="notification-banner">
            <span>Loading Siebel data...</span>
          </div>
        ) : null}

        {siebelState.status === "error" ? (
          <div className="notification-banner">
            <span>{`Siebel live data unavailable. Showing fallback data. ${siebelState.error}`}</span>
            <button onClick={() => setSiebelState({ status: "idle", error: "", data: null })}>×</button>
          </div>
        ) : null}

        <section className="customer360-scroll">
          <div className="customer360-panels">
            {customer360Columns.map((column) => (
              <article key={column.id} className="customer360-panel">
                <div className="customer360-panel__header">
                  <div>
                    <h2>{column.title}</h2>
                    <SectionAccent />
                  </div>
                  <button className="icon-button">⋮</button>
                </div>

                {column.summary ? (
                  <div className="customer360-summary-card">
                    {column.summary.split("\n").map((line) => (
                      <strong key={`${column.id}-${line}`}>{line}</strong>
                    ))}
                    <button className="text-button">View open service requests</button>
                  </div>
                ) : null}

                {column.content ? (
                  <div className="customer360-metric-list">
                    {column.content.map((item) => (
                      <CustomerInsight key={item.label} item={item} />
                    ))}
                  </div>
                ) : null}

                {column.offers ? (
                  <div className="customer360-offers">
                    <h3>Offer recommendations</h3>
                    {column.offers.map((offer) => (
                      <div key={offer.name} className="customer360-offer">
                        <ProductThumb tone="deal" />
                        <div>
                          <strong>{offer.name}</strong>
                          <p>{offer.copy}</p>
                          <span>{offer.price || "Your price $50.00"}</span>
                        </div>
                        <button className="soft-button">Add</button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {column.billingCard ? (
                  <div className="customer360-billing-stack">
                    <div className="customer360-bill-card customer360-bill-card--hero">
                      <strong>Pay pending balance</strong>
                      <p>$188.00 needs to be paid</p>
                      <button className="secondary-button">Pay bill</button>
                    </div>
                    <div className="customer360-bill-card">
                      <span>Last payment</span>
                      <strong>$117.00</strong>
                      <p>Paid on 06/02/2024</p>
                      <small>PI-10</small>
                    </div>
                    <div className="customer360-bill-list">
                      <h3>Latest bills</h3>
                      {column.bills.map((bill) => (
                        <div key={bill.title} className="customer360-bill-item">
                          <strong>{bill.title}</strong>
                          {bill.detail.split("\n").map((line) => (
                            <span key={`${bill.title}-${line}`}>{line}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {column.rows ? (
                  <div className="customer360-row-list">
                    {column.rows.map((row) => (
                      <div key={`${column.id}-${row.name}-${row.detail}`} className="customer360-row">
                        <div className="customer360-row__copy">
                          <strong>{row.name}</strong>
                          <p>{row.detail}</p>
                        </div>
                        {row.state ? <span className={`customer360-pill customer360-pill--${row.state.toLowerCase()}`}>{row.state}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {column.footer ? <button className="text-button customer360-footer-link">{column.footer}</button> : null}
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  function renderWorkflow() {
    return (
      <main className={`workflow-screen ${assistantCollapsed ? "workflow-screen--assistant-collapsed" : ""}`}>
        <div className="pattern-strip pattern-strip--top" aria-hidden="true"></div>

        <aside className={`assistant-column ${assistantCollapsed ? "assistant-column--collapsed" : ""}`}>
          {!assistantCollapsed ? (
            <>
              <div className="assistant-column__top">
                <button className="close-button" aria-label="Collapse assistant" onClick={() => setAssistantCollapsed(true)}>
                  ×
                </button>
              </div>

              <div className="message-list">
                <div className="assistant-next-step">
                  <strong>{agentPrompt.title}</strong>
                  <p>{agentPrompt.body}</p>
                </div>

                {workflow.messages.map((message) => (
                  <div key={message.id} className={`message-row message-row--${message.role} message-row--${message.appearance}`}>
                    {message.role === "assistant" ? <AskOracleChatIcon /> : null}
                    <div className={`message-bubble message-bubble--${message.role} message-bubble--${message.appearance}`}>
                      {message.text.split("\n").map((line) => (
                        <span key={`${message.id}-${line}`}>{line}</span>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="quick-action-stack">
                  {currentQuickActions.map((action) => (
                    <button
                      key={action.id}
                      className="secondary-button"
                      onClick={() => {
                        Promise.resolve(action.onClick()).catch((error) => {
                          pushMessages([
                            makeMessage(
                              "assistant",
                              `I couldn't complete that action. ${error instanceof Error ? error.message : "Unknown workflow error."}`,
                            ),
                          ]);
                          setNotification("Action failed.");
                        });
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <form className="assistant-composer" onSubmit={handleComposerSubmit}>
                <AskOracleChatIcon />
                <input
                  type="text"
                  value={workflow.composer}
                  onChange={(event) =>
                    updateWorkflow((current) => ({
                      ...current,
                      composer: event.target.value,
                    }))
                  }
                  placeholder="Ask Oracle"
                />
                <button type="submit" className="attach-button" aria-label="Send">
                  ◍
                </button>
              </form>
            </>
          ) : null}
        </aside>

        <section className="canvas-column">
          <header className="workflow-header">
            <h1>{APP_TITLE}</h1>
            <div className="workflow-header__actions">
              {renderLanguageSelector()}
              <button className="secondary-button" onClick={() => setView("home")}>
                Cancel
              </button>
              <button className={`primary-button ${canPlaceOrder ? "primary-button--enabled" : ""}`} disabled={!canPlaceOrder} onClick={submitOrder}>
                Place order
              </button>
            </div>
          </header>

          <div className="smart-action-shell">
            <form className="smart-action-bar" onSubmit={handleSmartActionSubmit}>
              <button
                type="button"
                className="smart-action-toggle"
                onClick={() => setAssistantCollapsed((current) => !current)}
                aria-label={assistantCollapsed ? "Open assistant" : "Collapse assistant"}
              >
                {assistantCollapsed ? ">" : "<"}
              </button>
              <div className="smart-action-bar__oracle" aria-hidden="true">
                <AskOracleIcon />
              </div>
              <input
                type="text"
                value={smartActionDraft}
                onChange={(event) => setSmartActionDraft(event.target.value)}
                placeholder="Type an action, for example: use account as Antonio Rodriguez"
              />
              <button
                type="submit"
                className={`primary-button ${smartActionDraft.trim() ? "primary-button--enabled" : ""}`}
                disabled={!smartActionDraft.trim()}
              >
                Run
              </button>
            </form>
          </div>

          <div className="canvas-scroll">
            {renderStepTracker()}
            {renderCustomerCard()}
            {renderAccountCard()}
            {renderCartCard()}
            {showPostProductCanvas ? renderServiceCard() : null}
            {showPostProductCanvas ? renderBillingCard() : null}
            {showPostProductCanvas ? renderPaymentCard() : null}
            {showPostProductCanvas ? renderSummaryCard() : null}
          </div>
        </section>

        <aside className="recommendation-column">
          <header className="recommendation-column__header">
            <h2>Recommendations</h2>
          </header>

          <div className="recommendation-list">
            {recommendationCards.map((card) => (
              <article key={card.id} className="recommendation-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="recommendation-card__actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      Promise.resolve(card.onClick()).catch((error) => {
                        pushMessages([
                          makeMessage(
                            "assistant",
                            `I couldn't complete that recommendation. ${error instanceof Error ? error.message : "Unknown workflow error."}`,
                          ),
                        ]);
                        setNotification("Recommendation failed.");
                      });
                    }}
                  >
                    {card.action}
                  </button>
                  {card.id !== "place-order" ? (
                    <button className="text-button" onClick={() => dismissRecommendation(card.id)}>
                      Dismiss
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </aside>

        <footer className="workflow-footer">
          <div className="workflow-footer__nav">
            <div className="footer-tab">
              <span>⚙</span>
              <span>Order</span>
            </div>
            <div className="footer-tab footer-tab--active">
              <span>⌘</span>
              <span>{APP_TITLE}</span>
            </div>
          </div>
        </footer>

        <div className="floating-oracle" aria-hidden="true">
          <span></span>
        </div>

        {renderDrawer()}
      </main>
    );
  }

  return (
    <div className="app-shell">
      {notification ? (
        <div className="notification-banner">
          <span>{notification}</span>
          <button onClick={() => setNotification("")}>×</button>
        </div>
      ) : null}

      {view === "home" ? renderHome() : null}
      {view === "intake" ? renderIntake() : null}
      {view === "workflow" ? renderWorkflow() : null}
      {view === "customer360" ? renderCustomer360() : null}
    </div>
  );
}

export default App;
