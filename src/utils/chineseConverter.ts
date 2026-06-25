// @ts-ignore
import * as OpenCC from 'opencc-js';
import { Converter as NamedConverter } from 'opencc-js';

let s2tConverter: ((text: string) => string) | null = null;
let t2sConverter: ((text: string) => string) | null = null;

try {
  let activeConverter: any = null;
  if (typeof NamedConverter === 'function') {
    activeConverter = NamedConverter;
  } else if (OpenCC && typeof (OpenCC as any).Converter === 'function') {
    activeConverter = (OpenCC as any).Converter;
  } else if (OpenCC && (OpenCC as any).default && typeof (OpenCC as any).default.Converter === 'function') {
    activeConverter = (OpenCC as any).default.Converter;
  }

  if (activeConverter) {
    s2tConverter = activeConverter({ from: 'cn', to: 'tw' });
    t2sConverter = activeConverter({ from: 'hk', to: 'cn' });
  } else {
    console.warn("Could not find OpenCC Converter constructor on any exports!");
  }
} catch (e) {
  console.error("Failed to initialize OpenCC converters", e);
}

/**
 * Convert Simplified Chinese to Traditional Chinese (Taiwan standard)
 */
export function toTraditional(text: string): string {
  if (!text) return '';
  if (s2tConverter) {
    try {
      return s2tConverter(text);
    } catch (e) {
      console.error(e);
    }
  }
  return text;
}

/**
 * Convert Traditional Chinese to Simplified Chinese
 */
export function toSimplified(text: string): string {
  if (!text) return '';
  if (t2sConverter) {
    try {
      return t2sConverter(text);
    } catch (e) {
      console.error(e);
    }
  }
  return text;
}

/**
 * Performs Simplified & Traditional Chinese inclusive matching.
 * Returns true if the search text contains the query, in either form.
 */
export function searchMatches(queryText: string, targetText: string): boolean {
  if (!queryText) return true;
  if (!targetText) return false;

  const normalizedQuery = queryText.trim().toLowerCase();
  const normalizedTarget = targetText.toLowerCase();

  // Basic check first
  if (normalizedTarget.includes(normalizedQuery)) return true;

  // Option A: Check with everything converted to Simplified
  const simpleQuery = toSimplified(normalizedQuery);
  const simpleTarget = toSimplified(normalizedTarget);
  if (simpleTarget.includes(simpleQuery)) return true;

  // Option B: Check with everything converted to Traditional
  const tradQuery = toTraditional(normalizedQuery);
  const tradTarget = toTraditional(normalizedTarget);
  if (tradTarget.includes(tradQuery)) return true;

  return false;
}
