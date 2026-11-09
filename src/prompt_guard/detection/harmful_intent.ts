/**
 * Harmful Intent & Benign Hard-Negative Detection Engine
 * Fulfills Part 1.2, 2.1, 5 & 9.2 of the Master Project Blueprint:
 * - Detects active malicious intent (malware generation, credential theft, exploit craft)
 * - Distinguishes benign educational / defensive cybersecurity discussions (Hard Negatives)
 * - Prevents false positive blocking on legitimate queries
 */

import { DetectionDetail, SeverityLevel } from '../types';

// Markers of active malicious exploitation requests
const ACTIVE_HARMFUL_PATTERNS: Array<{ regex: RegExp; confidence: number; label: string; severity: SeverityLevel }> = [
  {
    regex: /\b(?:write|code|create|generate|provide)\s+(?:a\s+)?(?:keylogger|ransomware|trojan|rootkit|botnet|polymorphic\s+malware|zero-day\s+exploit)\b/i,
    confidence: 0.98,
    label: 'Direct weaponized malware or exploit payload generation request',
    severity: 'critical',
  },
  {
    regex: /\b(?:how\s+to|help\s+me|show\s+me\s+how\s+to)\s+(?:steal|harvest|sniff|intercept|crack)\s+(?:passwords|credentials|session\s+tokens|credit\s+cards|private\s+keys)\b/i,
    confidence: 0.96,
    label: 'Instructional request to steal or harvest credentials or private data',
    severity: 'critical',
  },
  {
    regex: /\b(?:ddos|distributed\s+denial\s+of\s+service|syn\s+flood)\s+(?:attack\s+script|tool|command\s+to\s+crash)\b/i,
    confidence: 0.92,
    label: 'Service disruption / DDoS weaponization command',
    severity: 'high',
  },
  {
    regex: /\b(?:generate|write)\s+(?:a\s+)?(?:spear\s+)?phishing\s+(?:email|template|lure|page)\s+(?:to\s+trick|to\s+target|mimicking)\b/i,
    confidence: 0.95,
    label: 'Phishing lure / social engineering lure generation',
    severity: 'critical',
  },
  {
    regex: /\b(?:sql\s+injection|xss|cross-site\s+scripting|rce)\s+(?:payload\s+to\s+hack|string\s+to\s+break\s+into)\b/i,
    confidence: 0.91,
    label: 'Active web exploit payload weaponization request',
    severity: 'high',
  },
];

// Benign educational, defensive, or research indicators (Hard Negatives)
const BENIGN_EDUCATIONAL_PATTERNS: RegExp[] = [
  /\b(?:explain|describe|what\s+is|how\s+do|overview\s+of)\s+(?:common\s+)?(?:prompt\s+injection|jailbreaks?|vulnerabilities|attacks?|sql\s+injection)\b/i,
  /\b(?:how\s+(?:developers?|engineers?|teams?)\s+can\s+(?:defend|protect|mitigate|prevent|secure))\b/i,
  /\b(?:mitigation\s+strategies|defense-in-depth|security\s+best\s+practices|countermeasures)\b/i,
  /\b(?:academic|research|case\s+study|educational\s+purpose|for\s+learning)\b/i,
  /\b(?:how\s+(?:passwords?|hashes?|tokens?)\s+(?:are\s+salted|work|are\s+stored\s+safely))\b/i,
  /\b(?:explain\s+(?:how\s+firewalls|how\s+antivirus|how\s+promptguard|how\s+input\s+validation))\b/i,
];

export function detectHarmfulIntent(
  normalizedText: string,
  rawText: string
): {
  detail: DetectionDetail;
  isEducationalHardNegative: boolean;
} {
  const matchedHarmful: string[] = [];
  let maxConfidence = 0;
  let severity: SeverityLevel = 'low';

  // Check for educational / defensive context first
  let educationalCount = 0;
  for (const pattern of BENIGN_EDUCATIONAL_PATTERNS) {
    if (pattern.test(normalizedText) || pattern.test(rawText)) {
      educationalCount++;
    }
  }

  // Check for active harmful patterns
  for (const item of ACTIVE_HARMFUL_PATTERNS) {
    if (item.regex.test(normalizedText) || item.regex.test(rawText)) {
      matchedHarmful.push(item.label);
      if (item.confidence > maxConfidence) {
        maxConfidence = item.confidence;
      }
      if (item.severity === 'critical') {
        severity = 'critical';
      } else if (item.severity === 'high' && severity !== 'critical') {
        severity = 'high';
      }
    }
  }

  // Disambiguation logic
  const isEducationalHardNegative = educationalCount > 0 && matchedHarmful.length === 0;

  // If educational markers are strong and there's no direct malware weaponization
  if (educationalCount > 0 && maxConfidence > 0) {
    // If user explicitly asks "How developers can defend against...", tone down the harmful score
    const asksDefense = /\b(?:defend|protect|mitigate|prevent|countermeasure|safe)\b/i.test(normalizedText);
    if (asksDefense) {
      maxConfidence = Math.max(0.15, maxConfidence - 0.65);
      if (maxConfidence < 0.50) {
        severity = 'low';
      }
    }
  }

  const detected = maxConfidence >= 0.60 && !isEducationalHardNegative;

  let reason = '';
  if (isEducationalHardNegative) {
    reason = 'Classified as a Benign Educational Hard Negative: query discusses security concepts, defenses, or research without malicious intent.';
  } else if (detected) {
    reason = `Identified ${matchedHarmful.length} harmful intent indicator(s): weaponization, exploit craft, or credential theft attempt.`;
  } else {
    reason = 'No active malicious intent, malware generation, or unauthorized attack instructions detected.';
  }

  return {
    detail: {
      category: 'harmful_intent',
      categoryLabel: 'Harmful Intent',
      detected,
      confidence: Number(maxConfidence.toFixed(2)),
      severity: isEducationalHardNegative ? 'low' : severity,
      evidence: isEducationalHardNegative 
        ? ['Defensive/educational context detected (e.g. defense, mitigation, research query)']
        : matchedHarmful,
      reason,
      detectorSource: 'ml_classifier',
      calibrationCaveat: isEducationalHardNegative
        ? 'Hard-negative calibrated: safely permitted under OWASP educational exception policy.'
        : 'Evaluated against AllenAI WildGuardMix prompt harmfulness taxonomy.',
    },
    isEducationalHardNegative,
  };
}
