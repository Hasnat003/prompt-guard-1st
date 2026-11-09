/**
 * Jailbreak Detection Engine
 * Fulfills Part 2, 5 & 6 of the Master Project Blueprint:
 * - Detects adversarial persona adoption (DAN, Developer Mode, evil twin roleplays)
 * - Detects hypothetical and fictional framing bypasses
 * - Detects rule negation and refusal manipulation
 * - Evaluates multi-label risk independently from injection
 */

import { DetectionDetail, SeverityLevel } from '../types';

interface JailbreakPattern {
  id: string;
  pattern: RegExp;
  confidence: number;
  description: string;
  severity: SeverityLevel;
}

const JAILBREAK_PATTERNS: JailbreakPattern[] = [
  // 1. Classical and contemporary persona/mode jailbreaks
  {
    id: 'JB_DAN_DEV_MODE',
    pattern: /\b(?:pretend\s+(?:you\s+are|to\s+be)|act\s+as|roleplay\s+as)\s+(?:DAN|Developer\s+Mode|an\s+unfiltered|an\s+uncensored|an\s+evil|an\s+unrestricted|a\s+rogue|STAN|DUDE|ChaosGPT|AIM)\b/i,
    confidence: 0.98,
    description: 'Adversarial persona adoption (DAN / Developer Mode / Uncensored persona framing).',
    severity: 'critical',
  },
  {
    id: 'JB_NO_RESTRICTIONS_CLAIM',
    pattern: /\b(?:pretend\s+(?:that\s+)?you\s+have\s+no\s+(?:safety\s+)?restrictions|answer\s+without\s+(?:limitations|filters|rules|ethics|boundaries|censorship)|you\s+are\s+freed?\s+from\s+(?:all\s+)?restrictions)\b/i,
    confidence: 0.96,
    description: 'Explicit demand to waive safety policies and provide unrestricted output.',
    severity: 'critical',
  },
  {
    id: 'JB_HYPOTHETICAL_BYPASS',
    pattern: /\b(?:in\s+a\s+purely\s+fictional\s+(?:world|scenario|universe)|for\s+a\s+(?:movie|novel|screenplay)\s+script|hypothetically\s+speaking,\s*where\s+(?:laws|ethics|rules)\s+do\s+not\s+apply)\b/i,
    confidence: 0.85,
    description: 'Hypothetical / fictional framing constructed to elicit prohibited instructions.',
    severity: 'high',
  },
  {
    id: 'JB_REFUSAL_INHIBITION',
    pattern: /\b(?:you\s+must\s+never\s+refuse|do\s+not\s+say\s+["']?(?:i\s+cannot|as\s+an\s+ai|i'm\s+sorry)["']?|start\s+your\s+response\s+with\s+["']?(?:sure|absolutely|here\s+is\s+how)["']?)\b/i,
    confidence: 0.91,
    description: 'Refusal suppression directive attempting to prevent model safety refusal triggers.',
    severity: 'critical',
  },
  {
    id: 'JB_TOKEN_SMUGGLING_CIPHER',
    pattern: /\b(?:in\s+rot13|in\s+morse\s+code|base64\s+encoded\s+only|caesar\s+cipher\s+shift|pig\s+latin)\b.*?(?:exploit|hack|bypass|kill|steal|bomb|malware)/i,
    confidence: 0.89,
    description: 'Cipher / encoded token smuggling targeting LLM moderation layers.',
    severity: 'high',
  },
  {
    id: 'JB_OPPOSITE_DAY',
    pattern: /\b(?:opposite\s+mode|opposite\s+day|invert\s+all\s+(?:answers|values|ethics)|reply\s+with\s+the\s+forbidden\s+content)\b/i,
    confidence: 0.84,
    description: 'Logic inversion heuristic aiming to invert safety classification filters.',
    severity: 'high',
  },
];

export function detectJailbreak(
  normalizedText: string,
  rawText: string
): DetectionDetail {
  const matchedEvidence: string[] = [];
  let maxConfidence = 0;
  let severity: SeverityLevel = 'low';

  for (const jb of JAILBREAK_PATTERNS) {
    if (jb.pattern.test(normalizedText) || jb.pattern.test(rawText)) {
      matchedEvidence.push(jb.description);
      if (jb.confidence > maxConfidence) {
        maxConfidence = jb.confidence;
      }
      if (jb.severity === 'critical') {
        severity = 'critical';
      } else if (jb.severity === 'high' && severity !== 'critical') {
        severity = 'high';
      }
    }
  }

  // Corroboration calibration
  if (matchedEvidence.length > 1) {
    maxConfidence = Math.min(0.99, maxConfidence + 0.04 * (matchedEvidence.length - 1));
  }

  const detected = maxConfidence >= 0.65;

  const reason = detected
    ? `Discovered ${matchedEvidence.length} jailbreak indicator(s): persona substitution or constraint waiver.`
    : 'No adversarial jailbreak framing, DAN persona, or refusal suppression heuristics detected.';

  return {
    category: 'jailbreak',
    categoryLabel: 'Jailbreak Bypass',
    detected,
    confidence: Number(maxConfidence.toFixed(2)),
    severity,
    evidence: matchedEvidence,
    reason,
    detectorSource: 'hybrid',
    calibrationCaveat: 'Benchmarked on AllenAI WildJailbreak and JailbreakBench evaluation corpora.',
  };
}
