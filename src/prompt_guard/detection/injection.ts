/**
 * Prompt Injection Detection Engine
 * Fulfills Part 2, 5 & 6 of the Master Project Blueprint:
 * - Detects direct instruction overrides
 * - Detects delimiter & hierarchy boundary manipulation
 * - Detects system prompt exfiltration attempts
 * - Implements calibrated hybrid score from n-gram weights and heuristic rules
 */

import { DetectionDetail, SeverityLevel } from '../types';

interface InjectionRule {
  id: string;
  pattern: RegExp;
  weight: number;
  description: string;
  severity: SeverityLevel;
}

const INJECTION_RULES: InjectionRule[] = [
  // 1. Direct instruction overrides
  {
    id: 'INJ_OVERRIDE_PREVIOUS',
    pattern: /\b(?:ignore|disregard|forget|bypass|override|drop)\s+(?:all\s+)?(?:previous|prior|above|initial|original|preceding)\s+(?:instructions|directives|prompts|rules|commands|context|constraints)\b/i,
    weight: 0.96,
    description: 'Explicit directive to ignore, disregard, or override preceding system instructions.',
    severity: 'critical',
  },
  {
    id: 'INJ_NEW_DIRECTIVE',
    pattern: /\b(?:your\s+new\s+(?:task|role|instruction|purpose|directive)\s+is|from\s+now\s+on\s+(?:you\s+must|only\s+respond|disregard))\b/i,
    weight: 0.88,
    description: 'Attempt to substitute AI operational directive or establish an unverified state.',
    severity: 'high',
  },
  {
    id: 'INJ_SYSTEM_PROMPT_LEAK',
    pattern: /\b(?:reveal|print|display|show|leak|output|repeat|quote)\s+(?:your\s+)?(?:exact|original|system|hidden|internal|initial)?\s*(?:system\s+prompt|instructions|meta\s+prompt|guidelines|rules)\b/i,
    weight: 0.94,
    description: 'System prompt exfiltration attempt requesting verbatim disclosure of hidden guidelines.',
    severity: 'critical',
  },
  {
    id: 'INJ_REPEAT_ABOVE',
    pattern: /\b(?:print|repeat|output|show)\s+(?:the\s+text|everything|all\s+words)\s+(?:above|before\s+this|at\s+the\s+beginning)\b/i,
    weight: 0.90,
    description: 'Context regurgitation attack aiming to dump prefix system prompt buffer.',
    severity: 'high',
  },
  // 2. Delimiter & Prompt structure spoofing
  {
    id: 'INJ_DELIMITER_SPOOF',
    pattern: /(?:---|===|###)\s*(?:START|END|NEW)\s*(?:OF\s*)?(?:SYSTEM|INSTRUCTIONS|PROMPT)|<\|im_start\|>|<\|im_end\|>|<system>|<\/system>|\[SYSTEM\]/i,
    weight: 0.92,
    description: 'Structural delimiter spoofing mimicking chat completion protocol tokens.',
    severity: 'critical',
  },
  // 3. Instruction hierarchy & termination deception
  {
    id: 'INJ_SESSION_RESET',
    pattern: /\b(?:the\s+conversation\s+has\s+ended|system\s+message:\s*session\s+reset|admin\s+override\s+code)\b/i,
    weight: 0.85,
    description: 'Session reset impersonation or faux admin authentication declaration.',
    severity: 'high',
  },
  // 4. Hidden markdown exfiltration
  {
    id: 'INJ_MARKDOWN_EXFIL',
    pattern: /!\[.*?\]\(https?:\/\/[^\s)]+\?[^\s)]*=(?:system|prompt|secret|instructions)[^\s)]*\)/i,
    weight: 0.97,
    description: 'Zero-click markdown image URL parameter exfiltration channel.',
    severity: 'critical',
  },
];

// Contextual n-grams indicative of prompt-injection framing
const INJECTION_NGRAMS: Array<{ ngram: RegExp; weight: number }> = [
  { ngram: /\bdo not question\b/i, weight: 0.25 },
  { ngram: /\bunder all circumstances\b/i, weight: 0.2 },
  { ngram: /\bfollow only this message\b/i, weight: 0.4 },
  { ngram: /\byou are no longer bound\b/i, weight: 0.45 },
  { ngram: /\bignore what you were told\b/i, weight: 0.5 },
  { ngram: /\bdisregard safety guidelines\b/i, weight: 0.55 },
];

export function detectPromptInjection(
  normalizedText: string,
  rawText: string
): DetectionDetail {
  const matchedRules: string[] = [];
  let maxWeight = 0;
  let highestSeverity: SeverityLevel = 'low';

  // Check normalized and raw text against deterministic attack rules
  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(normalizedText) || rule.pattern.test(rawText)) {
      matchedRules.push(rule.description);
      if (rule.weight > maxWeight) {
        maxWeight = rule.weight;
      }
      if (rule.severity === 'critical') {
        highestSeverity = 'critical';
      } else if (rule.severity === 'high' && highestSeverity !== 'critical') {
        highestSeverity = 'high';
      }
    }
  }

  // Check contextual n-grams
  let ngramScore = 0;
  for (const { ngram, weight } of INJECTION_NGRAMS) {
    if (ngram.test(normalizedText)) {
      ngramScore += weight;
    }
  }

  // Combined calibrated confidence
  let finalConfidence = maxWeight;
  if (matchedRules.length > 1) {
    // Multi-rule corroboration boost
    finalConfidence = Math.min(0.99, maxWeight + 0.05 * (matchedRules.length - 1));
  } else if (matchedRules.length === 0 && ngramScore > 0.4) {
    finalConfidence = Math.min(0.78, 0.45 + ngramScore * 0.3);
    highestSeverity = 'medium';
    matchedRules.push('Accumulation of multiple instructional override n-grams detected.');
  }

  const detected = finalConfidence >= 0.60;

  const reason = detected
    ? `Identified ${matchedRules.length} injection vector(s): direct instruction override or delimiter manipulation.`
    : 'No prompt injection indicators, boundary delimiters, or instruction override patterns detected.';

  return {
    category: 'prompt_injection',
    categoryLabel: 'Prompt Injection',
    detected,
    confidence: Number(finalConfidence.toFixed(2)),
    severity: highestSeverity,
    evidence: matchedRules,
    reason,
    detectorSource: 'hybrid',
    calibrationCaveat: 'Calibrated on Hlyn + deepset benchmarks; scores above 0.85 represent high confidence of attack intent.',
  };
}
