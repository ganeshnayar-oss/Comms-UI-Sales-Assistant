import { useEffect } from "react";
import {
  getEnglishSourceFromTranslation,
  getSupportedLocale,
  translateStaticText,
} from "./languagePacks";

const TEXT_SOURCE = new WeakMap();
const ATTRIBUTE_SOURCE = "i18nSource";
const LOCALIZED_ATTRIBUTES = ["aria-label", "placeholder", "title"];

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  return Boolean(parent.closest("script, style, code, pre, textarea"));
}

function getOriginalText(node, locale) {
  if (TEXT_SOURCE.has(node)) {
    return TEXT_SOURCE.get(node);
  }

  const source = getEnglishSourceFromTranslation(node.nodeValue || "", locale);
  TEXT_SOURCE.set(node, source);
  return source;
}

function localizeTextNode(node, locale) {
  if (shouldSkipNode(node) || !String(node.nodeValue || "").trim()) {
    return;
  }

  const source = getOriginalText(node, locale);
  const translated = translateStaticText(source, locale);
  if (node.nodeValue !== translated) {
    node.nodeValue = translated;
  }
}

function localizeElement(element, locale) {
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) {
      continue;
    }

    const datasetKey = `${ATTRIBUTE_SOURCE}${attribute.replace(/[^a-z0-9]/gi, "")}`;
    const source = element.dataset[datasetKey] || getEnglishSourceFromTranslation(element.getAttribute(attribute), locale);
    element.dataset[datasetKey] = source;
    const translated = translateStaticText(source, locale);
    if (element.getAttribute(attribute) !== translated) {
      element.setAttribute(attribute, translated);
    }
  }
}

function walkAndLocalize(root, locale) {
  if (!root) {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root, locale);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  localizeElement(root, locale);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      localizeTextNode(node, locale);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      localizeElement(node, locale);
    }
  }
}

export function useRuntimeLocalization(locale) {
  useEffect(() => {
    const activeLocale = getSupportedLocale(locale);
    document.documentElement.lang = activeLocale;
    document.documentElement.dir = "ltr";

    walkAndLocalize(document.body, activeLocale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target, activeLocale);
          continue;
        }

        if (mutation.type === "attributes") {
          localizeElement(mutation.target, activeLocale);
          continue;
        }

        mutation.addedNodes.forEach((node) => walkAndLocalize(node, activeLocale));
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: LOCALIZED_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [locale]);
}
