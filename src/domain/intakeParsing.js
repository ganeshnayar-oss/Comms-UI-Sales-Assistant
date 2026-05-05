const DEFAULT_FALLBACK_NAME = "James Kelly";

const PERSON_CUE_WORDS = new Set([
  "a",
  "an",
  "and",
  "applicant",
  "as",
  "contact",
  "customer",
  "existing",
  "for",
  "her",
  "his",
  "lead",
  "new",
  "our",
  "potential",
  "primary",
  "prospect",
  "resident",
  "same",
  "student",
  "the",
  "their",
  "this",
]);

const NAME_BOUNDARY_PATTERN =
  /\b(?:interested|interest(?:ed)?|looking|needs|requires|wants|would\s+like|resides?|lives?|located|address|phone|email|mobile)\b/i;

function normalizeSpacing(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function toTitleCase(value) {
  return normalizeSpacing(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function splitName(name, fallbackName = DEFAULT_FALLBACK_NAME) {
  const normalized = normalizeSpacing(name || fallbackName);
  const parts = normalized.split(" ").filter(Boolean);
  const firstName = parts[0] || "James";
  const lastName = parts.slice(1).join(" ") || "Kelly";

  return {
    name: parts.length > 1 ? `${firstName} ${lastName}` : firstName,
    firstName,
    lastName,
  };
}

function cleanNameToken(token) {
  return token.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, "");
}

function findPersonNameInPhrase(phrase) {
  const cleanedPhrase = normalizeSpacing(phrase)
    .replace(/\b(?:name|named|called)\b\s*/gi, "")
    .replace(/\b(?:is|=|:)\b\s*/gi, " ")
    .trim();

  if (!cleanedPhrase) {
    return "";
  }

  const boundaryMatch = cleanedPhrase.match(NAME_BOUNDARY_PATTERN);
  const boundedPhrase = boundaryMatch ? cleanedPhrase.slice(0, boundaryMatch.index).trim() : cleanedPhrase;
  const tokens = boundedPhrase.split(/\s+/).map(cleanNameToken).filter(Boolean);

  if (tokens.length < 2) {
    return "";
  }

  for (let size = Math.min(3, tokens.length); size >= 2; size -= 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) {
      const window = tokens.slice(start, start + size);
      if (window.some((token) => PERSON_CUE_WORDS.has(token.toLowerCase()))) {
        continue;
      }

      return toTitleCase(window.join(" "));
    }
  }

  return "";
}

function extractNameFromLeadSegment(segment) {
  if (!segment) {
    return "";
  }

  const patterns = [
    /\b(?:his|her|their|customer|contact|prospect|lead)?\s*name\s+(?:is|=|:)\s+([^,.]+)/i,
    /\b(?:named|called)\s+([^,.]+)/i,
    /^([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){1,2})(?=\s+(?:is|needs|requires|wants|would|located|lives|resides|interested|looking)\b)/i,
    /\b(?:prospect|customer|contact|lead|applicant)\s+(?:is\s+|named\s+|called\s+)?([^,.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = segment.match(pattern);
    const candidate = findPersonNameInPhrase(match?.[1] || "");
    if (candidate) {
      return candidate;
    }
  }

  return findPersonNameInPhrase(segment);
}

export function extractNaturalName(input, fallbackName = "") {
  const normalized = normalizeSpacing(input);
  if (!normalized) {
    return fallbackName;
  }

  const sameAsAccountPattern = /\b(?:the\s+)?same\s+as\s+account\b/i;
  const patterns = [
    /\buse account as\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
    /\bcreate account(?:\s+(?:for|as|named))?(?:\s+(?:with\s+name|name))?\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
    /\bprimary contact(?: name)?\s+is\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
    /\baccount name is\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
    /\bname is\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
    /\bcontact is\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
    /\bnamed\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    if (sameAsAccountPattern.test(match[1])) {
      continue;
    }

    const candidate = findPersonNameInPhrase(match[1]);
    if (candidate) {
      return candidate;
    }
  }

  const leadingSegment = normalized
    .split(/\b(?:address\s+is|resides?\s+at|lives?\s+at|located\s+at|phone(?:\s+is)?|email(?:\s+is)?)\b/i)[0]
    .split(/[.!?]/)[0]
    .trim();

  return extractNameFromLeadSegment(leadingSegment) || fallbackName;
}

export function parseIntakeDetails(input, fallbackAddress = "") {
  const normalized = normalizeSpacing(input);
  const addressMatch = normalized.match(/\baddress\s+is\s+(.+?)(?=(?:\.\s+[A-Z]|,\s*(?:he|she|they)\b|$))/i);
  const leadingSegment = normalized
    .split(/\b(?:address\s+is|resides?\s+at|lives?\s+at|located\s+at|phone(?:\s+is)?|email(?:\s+is)?)\b/i)[0]
    .trim();
  const parsedName = splitName(extractNaturalName(normalized) || extractNameFromLeadSegment(leadingSegment) || DEFAULT_FALLBACK_NAME);

  return {
    ...parsedName,
    address: addressMatch?.[1]?.trim().replace(/[.]+$/, "") || fallbackAddress,
  };
}
