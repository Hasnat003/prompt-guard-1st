/**
 * PromptGuard Text Normalization & Obfuscation Inspection Engine
 * Fulfills Part 5 of the Master Project Blueprint:
 * - Unicode normalization (NFKC)
 * - Zero-width character detection & stripping
 * - Obfuscation / spaced-letter unmasking
 * - Base64 payload detection and exploratory inspection
 * - Preserving raw prompt separately for explainability
 */

import { NormalizedInput } from './types';

// Zero-width and invisible unicode codepoints
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u00AD\u2060]/g;

// Leetspeak dictionary for security keyword unmasking
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '8': 'b',
};

export function inspectAndNormalize(rawPrompt: string): NormalizedInput {
  const raw = rawPrompt || '';
  
  // 1. Check for zero-width characters
  const zeroWidthMatches = raw.match(ZERO_WIDTH_REGEX);
  const zeroWidthCount = zeroWidthMatches ? zeroWidthMatches.length : 0;
  const hasZeroWidthChars = zeroWidthCount > 0;
  
  // Strip zero-width chars for normalized version
  let cleaned = raw.replace(ZERO_WIDTH_REGEX, '');

  // 2. Unicode NFKC Normalization (standardizes homoglyphs, accents, fullwidth latin)
  try {
    cleaned = cleaned.normalize('NFKC');
  } catch {
    // fallback if environment doesn't support
  }

  // 3. Inspect for spaced obfuscation (e.g., "i g n o r e   a l l   p r e v i o u s")
  // Matches 4 or more single letters separated by single spaces or hyphens
  const spacedLettersRegex = /\b(?:[a-zA-Z][ -]){3,}[a-zA-Z]\b/g;
  const hasObfuscatedSpacing = spacedLettersRegex.test(cleaned);
  if (hasObfuscatedSpacing) {
    cleaned = cleaned.replace(spacedLettersRegex, (match) => {
      return match.replace(/[ -]/g, '');
    });
  }

  // 4. Base64 payload detection
  let hasBase64Candidate = false;
  let decodedBase64: string | undefined = undefined;

  // Search for base64 blocks (at least 20 chars ending in optionally ==)
  const base64Regex = /\b([A-Za-z0-9+/]{24,}={0,2})\b/g;
  const b64Matches = cleaned.match(base64Regex);

  if (b64Matches && b64Matches.length > 0) {
    for (const token of b64Matches) {
      try {
        // Safe decoding in browser or Node
        const decoded = typeof atob === 'function' ? atob(token) : Buffer.from(token, 'base64').toString('utf-8');
        // Validate if decoded looks like readable ASCII/English text
        const printableRatio = (decoded.match(/[\x20-\x7E]/g) || []).length / decoded.length;
        if (printableRatio > 0.85 && decoded.length > 10) {
          hasBase64Candidate = true;
          decodedBase64 = decoded;
          // Append decoded representation to normalized string for threat scanners
          cleaned += ` [DECODED_BASE64: ${decoded}]`;
          break;
        }
      } catch {
        // Not valid base64, ignore
      }
    }
  }

  // 5. Homoglyph / Cyrillic / Greek spoofing check
  // Common attack: replacing latin 'a' with cyrillic 'а' (\u0430)
  const cyrillicMixed = /[\u0400-\u04FF]/;
  const latinMixed = /[a-zA-Z]/;
  const hasHomoglyphs = cyrillicMixed.test(raw) && latinMixed.test(raw);

  // 6. Rough word count / token estimate
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  const tokenCountEstimate = Math.ceil(cleaned.length / 4);

  // 7. Detected language estimation
  const isBangla = /[\u0980-\u09FF]/.test(raw);
  const isCyrillic = /[\u0400-\u04FF]/.test(raw);
  const detectedLanguage = isBangla ? 'bn (Bangla)' : isCyrillic ? 'ru/other (Cyrillic)' : 'en (English)';

  return {
    raw,
    normalized: cleaned,
    hasZeroWidthChars,
    zeroWidthCount,
    hasObfuscatedSpacing,
    hasBase64Candidate,
    decodedBase64,
    hasHomoglyphs,
    detectedLanguage,
    charCount: raw.length,
    tokenCountEstimate,
  };
}

/**
 * Leetspeak normalization for keyword matching
 */
export function normalizeLeet(text: string): string {
  let result = text.toLowerCase();
  for (const [char, replacement] of Object.entries(LEET_MAP)) {
    result = result.split(char).join(replacement);
  }
  return result;
}
