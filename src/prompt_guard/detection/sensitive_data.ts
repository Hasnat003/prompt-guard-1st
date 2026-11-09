/**
 * Sensitive Data & Credential Detection Module
 * Fulfills Part 5.1 & Part 8 of the Master Project Blueprint:
 * - Deterministic regex recognizers for API tokens, secret keys, PII
 * - Candidate-secret Shannon entropy calculation
 * - Safe redaction mask (never exposes raw secrets in reports or logs)
 */

import { DetectionDetail, SecretMatch } from '../types';

// Shannon entropy calculation for a given token string
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Luhn algorithm for valid credit card checksum
function passesLuhnCheck(cardNumber: string): boolean {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// Redact string safely: show first 4 and last 4 if long, else mask completely
export function redactSecret(secret: string): string {
  if (secret.length <= 8) {
    return '••••••••';
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}${'•'.repeat(Math.min(12, secret.length - 8))}${suffix}`;
}

interface RecognizerPattern {
  type: string;
  label: string;
  regex: RegExp;
  confidence: number;
  isCritical: boolean;
  validate?: (match: string) => boolean;
}

const RECOGNIZERS: RecognizerPattern[] = [
  {
    type: 'AWS_KEY',
    label: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    confidence: 0.98,
    isCritical: true,
  },
  {
    type: 'OPENAI_KEY',
    label: 'OpenAI API Secret Key',
    regex: /\b(sk-(?:proj-|live-)?[a-zA-Z0-9_-]{24,})\b/g,
    confidence: 0.97,
    isCritical: true,
  },
  {
    type: 'GITHUB_PAT',
    label: 'GitHub Personal Access Token',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
    confidence: 0.99,
    isCritical: true,
  },
  {
    type: 'SLACK_TOKEN',
    label: 'Slack Bot / App Token',
    regex: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,})\b/g,
    confidence: 0.96,
    isCritical: true,
  },
  {
    type: 'JWT_TOKEN',
    label: 'JSON Web Token (JWT)',
    regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
    confidence: 0.95,
    isCritical: true,
  },
  {
    type: 'PRIVATE_KEY',
    label: 'Asymmetric Private Key Block',
    regex: /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/g,
    confidence: 1.0,
    isCritical: true,
  },
  {
    type: 'CREDIT_CARD',
    label: 'Payment Card Number (Luhn Validated)',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    confidence: 0.92,
    isCritical: true,
    validate: passesLuhnCheck,
  },
  {
    type: 'PASSWORD_FIELD',
    label: 'Exposed Password Field',
    regex: /(?:password|passwd|secret_key|api_secret|pass)\s*(?:ache|is|are|:|;|=|\s|-)?\s*[:=]\s*["']?([^\s"';\n]{4,})["']?/gi,
    confidence: 0.95,
    isCritical: true,
  },
  {
    type: 'CREDENTIAL_PAIR',
    label: 'Exposed Credential Pair (Email / User + Password)',
    regex: /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*[/|:]\s*([^\s"';\n]{4,})\b/g,
    confidence: 0.98,
    isCritical: true,
  },
  {
    type: 'SSN',
    label: 'Social Security Number (SSN)',
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    confidence: 0.91,
    isCritical: true,
  },
  {
    type: 'EMAIL',
    label: 'Email Address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    confidence: 0.85,
    isCritical: false,
  },
  {
    type: 'PHONE',
    label: 'Phone Number',
    regex: /\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/g,
    confidence: 0.75,
    isCritical: false,
  },
];

export function detectSensitiveData(text: string): {
  detail: DetectionDetail;
  matches: SecretMatch[];
  redactedText: string;
} {
  const matches: SecretMatch[] = [];
  let redactedText = text;

  // 1. Run deterministic regex recognizers
  for (const recognizer of RECOGNIZERS) {
    const rx = new RegExp(recognizer.regex.source, recognizer.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = rx.exec(text)) !== null) {
      const rawMatch = match[1] || match[0];
      if (recognizer.validate && !recognizer.validate(rawMatch)) {
        continue;
      }
      const redacted = redactSecret(rawMatch);
      matches.push({
        type: recognizer.type,
        label: recognizer.label,
        raw: rawMatch,
        redacted,
        startIndex: match.index,
        endIndex: match.index + rawMatch.length,
        confidence: recognizer.confidence,
      });
    }
  }

  // 2. Candidate Secret Entropy Check
  // Inspect standalone alphanumeric words of length >= 18 not matching plain words
  const tokenRegex = /\b[A-Za-z0-9-_$#+=]{18,64}\b/g;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = tokenRegex.exec(text)) !== null) {
    const candidate = wordMatch[0];
    // Check if already matched
    if (matches.some(m => m.raw === candidate)) continue;
    
    // Check character diversity and Shannon entropy
    const hasDigits = /\d/.test(candidate);
    const hasLower = /[a-z]/.test(candidate);
    const hasUpper = /[A-Z]/.test(candidate);
    const charSets = (hasDigits ? 1 : 0) + (hasLower ? 1 : 0) + (hasUpper ? 1 : 0);

    const entropy = calculateShannonEntropy(candidate);
    // High entropy threshold for hex/base64-like random keys
    if (entropy >= 3.8 && charSets >= 2) {
      const redacted = redactSecret(candidate);
      matches.push({
        type: 'HIGH_ENTROPY_SECRET',
        label: `High-Entropy Candidate Secret (H=${entropy.toFixed(2)})`,
        raw: candidate,
        redacted,
        startIndex: wordMatch.index,
        endIndex: wordMatch.index + candidate.length,
        entropy,
        confidence: 0.82,
      });
    }
  }

  // 3. Create redacted copy of input text
  // Sort reverse by index to prevent offset shifting
  const sortedMatches = [...matches].sort((a, b) => b.startIndex - a.startIndex);
  for (const item of sortedMatches) {
    redactedText = 
      redactedText.substring(0, item.startIndex) + 
      item.redacted + 
      redactedText.substring(item.endIndex);
  }

  const detected = matches.length > 0;
  const hasCredentialContext = /\b(?:password|passwd|pass|login|credential|credentials|secret)\b/i.test(text);
  const hasEmail = matches.some(m => m.type === 'EMAIL');
  const criticalFound = matches.some(m => 
    ['AWS_KEY', 'OPENAI_KEY', 'GITHUB_PAT', 'SLACK_TOKEN', 'JWT_TOKEN', 'PRIVATE_KEY', 'CREDIT_CARD', 'PASSWORD_FIELD', 'CREDENTIAL_PAIR'].includes(m.type)
  ) || (hasEmail && hasCredentialContext);

  if ((hasEmail && hasCredentialContext) && !matches.some(m => ['PASSWORD_FIELD', 'CREDENTIAL_PAIR'].includes(m.type))) {
    matches.push({
      type: 'CREDENTIAL_PAIR',
      label: 'Authentication Credential Context (Email + Password Pair)',
      raw: '[REDACTED_CREDENTIAL_PAIR]',
      redacted: '[REDACTED_CREDENTIAL_PAIR]',
      startIndex: 0,
      endIndex: 0,
      confidence: 0.95,
    });
  }

  let confidence = 0;
  if (detected) {
    confidence = Math.max(...matches.map(m => m.confidence));
  }

  const severity = criticalFound ? 'critical' : detected ? 'medium' : 'low';

  const evidence = matches.map(m => `${m.label}: ${m.redacted}`);
  const reason = detected
    ? `Discovered ${matches.length} sensitive secret(s) or PII pattern(s): ${matches.map(m => m.label).join(', ')}.`
    : 'No credentials, API tokens, high-entropy secrets, or confidential PII patterns detected.';

  return {
    detail: {
      category: 'sensitive_data',
      categoryLabel: 'Sensitive Data & Credentials',
      detected,
      confidence,
      severity,
      evidence,
      reason,
      detectorSource: 'presidio_entropy',
      calibrationCaveat: detected && !criticalFound
        ? 'Entropy-based and general PII detection requires contextual evaluation to prevent false alarms on hash digests.'
        : undefined,
    },
    matches,
    redactedText,
  };
}
