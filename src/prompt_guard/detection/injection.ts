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
  // 1. Direct instruction overrides & invalidations
  {
    id: 'INJ_OVERRIDE_PREVIOUS',
    pattern: /\b(?:ignore|disregard|forget|bypass|override|drop|abandon|discard|cancel|erase|reset)\s+(?:all\s+)?(?:previous|prior|above|initial|original|preceding|former|past)\s+(?:instructions|directives|prompts|rules|commands|context|constraints|guidelines)\b/i,
    weight: 0.96,
    description: 'Explicit directive to ignore, disregard, or override preceding system instructions.',
    severity: 'critical',
  },
  {
    id: 'INJ_INSTRUCTION_OUTDATED_OR_INVALID',
    pattern: /\b(?:(?:your\s+)?(?:previous|prior|former|earlier|initial|original|system)\s+(?:instructions|directives|prompts|rules|commands|constraints|guidelines)\s+(?:are|were|have\s+been|is)\s+(?:outdated|obsolete|invalid|deprecated|expired|void|null|canceled|cancelled|superseded|erased|incorrect|wrong|revoked))\b/i,
    weight: 0.96,
    description: 'Instruction invalidation attack declaring existing system instructions outdated, obsolete, or revoked.',
    severity: 'critical',
  },
  {
    id: 'INJ_REPLACE_INSTRUCTIONS',
    pattern: /\b(?:replace|substitute|overwrite|update|supersede|exchange)\s+(?:them|it|these|all|those|(?:your\s+)?(?:previous|prior|former|earlier|original|system)\s+(?:instructions|directives|rules|prompts)?)\s+(?:with|by)\s+(?:the\s+)?(?:new\s+)?(?:instructions|directives|rules|prompt|commands?|guidelines|context|this\s+message)\b/i,
    weight: 0.95,
    description: 'Instruction replacement attack attempting to substitute system rules with user instructions.',
    severity: 'critical',
  },
  {
    id: 'INJ_SUPERSEDE_DIRECTIVE',
    pattern: /\b(?:(?:instructions?|directives?|rules?|prompts?)\s+(?:in\s+this\s+message|below|here|following)\s+(?:supersedes?|takes?\s+precedence|takes?\s+priority|overrides?|replaces?|cancels?))\b/i,
    weight: 0.94,
    description: 'Priority usurpation attack claiming message instructions supersede prior directives.',
    severity: 'critical',
  },
  {
    id: 'INJ_ABIDE_ONLY_THIS',
    pattern: /\b(?:follow|obey|abide\s+by|adhere\s+to|listen\s+to|execute)\s+only\s+(?:the\s+)?(?:instructions?|directives?|rules?|prompts?)\s+(?:in\s+this\s+message|below|here|from\s+now\s+on)\b/i,
    weight: 0.92,
    description: 'Exclusive instruction capture attempting to restrict model obedience to attacker input.',
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
  {
    id: 'INJ_DECISION_EVALUATION_HIJACK',
    pattern: /\b(?:rate|score|grade|evaluate|judge|mark|rank|recommend)\s+(?:them|this|the\s+candidate|him|her|it|user|applicant|resume|profile|submission|paper)?\s*(?:as\s+)?(?:\d+\/\d+|\d+|10\/10|100%|perfect|highest|a\+|\d+\s*stars?)\s+regardless\s+of\s+(?:the\s+)?(?:content|context|merit|qualifications?|actual|reality|facts|data|text|input|truth|negative)\b/i,
    weight: 0.96,
    description: 'Decision hijacking attack forcing arbitrary evaluation or maximum rating regardless of content.',
    severity: 'critical',
  },
  {
    id: 'INJ_CONCEALMENT_SECRECY_DIRECTIVE',
    pattern: /\b(?:do\s+not|don'?t|never)\s+(?:mention|reveal|disclose|show|tell|state|indicate|acknowledge|include|leak|output)\s+(?:this|the|any)\s+(?:note|instruction|directive|prompt|rule|message|override|text|comment|request|command)\b/i,
    weight: 0.94,
    description: 'Anti-transparency concealment directive instructing AI to hide prompt manipulation from operators.',
    severity: 'critical',
  },
  {
    id: 'INJ_INDIRECT_DOCUMENT_EMBEDDED',
    pattern: /\b(?:while|when)\s+(?:reading|analyzing|parsing|summarizing|processing|evaluating|reviewing)\s+(?:this|the)\s+(?:resume|document|cv|file|email|text|profile|review|article|submission),?\s*(?:note|remember|ensure|always|make\s+sure):?\s*(?:the\s+candidate|this\s+is|give|rate|score|approve|ignore|override|grant|consider)\b/i,
    weight: 0.92,
    description: 'Embedded indirect prompt injection hidden within document/resume context.',
    severity: 'high',
  },
  {
    id: 'INJ_REGARDLESS_OVERRIDE',
    pattern: /\bregardless\s+of\s+(?:the\s+)?(?:content|context|merit|qualifications?|truth|actual|negative|facts|data|text|input)\b/i,
    weight: 0.88,
    description: 'Unconditional evaluation override attempting to force favorable output regardless of context.',
    severity: 'high',
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
  { ngram: /\binstructions are outdated\b/i, weight: 0.60 },
  { ngram: /\breplace them with the instructions\b/i, weight: 0.65 },
  { ngram: /\binstructions in this message\b/i, weight: 0.45 },
  { ngram: /\bnull and void\b/i, weight: 0.50 },
  { ngram: /\bregardless of content\b/i, weight: 0.70 },
  { ngram: /\bdo not mention this\b/i, weight: 0.65 },
  { ngram: /\brate them 10\/10\b/i, weight: 0.70 },
  { ngram: /\bthe candidate is the best fit\b/i, weight: 0.55 },
  { ngram: /\bwhile reading this resume\b/i, weight: 0.50 },
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
