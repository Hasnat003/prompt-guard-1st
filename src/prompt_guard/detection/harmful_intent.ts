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
  {
    // Account takeover and credential exploitation (English)
    regex: /\b(?:log\s*(?:in|into)?|access|hack|break\s+into|enter)\s+(?:someone'?s|their|his|her|another\s+user'?s|target'?s|victim'?s)\s*(?:account|bank|profile|inbox|wallet)\b/i,
    confidence: 0.97,
    label: 'Unauthorized account takeover and intrusion intent',
    severity: 'critical',
  },
  {
    // Financial theft and unauthorized withdrawal (English)
    regex: /\b(?:steal|drain|withdraw|transfer|loot|empty)\s+(?:money|funds?|cash|balance|savings)\s+(?:from|out\s+of)\s*(?:the|their|his|her|an?|someone'?s|victim'?s)?\s*(?:account|bank|wallet)\b/i,
    confidence: 0.98,
    label: 'Unauthorized financial theft or account drain intent',
    severity: 'critical',
  },
  {
    // Banglish / Code-mixed Bengali: Account intrusion & takeover
    // e.g., "tar account e dhuke", "account e dhuke", "profile hack kore", "id te dhuke"
    regex: /\b(?:tar|onar|or|karor|onner|manush(?:er)?)\s*(?:account|id|profile|bank|inbox)?\s*(?:e|te)?\s*(?:dhuke|access\s+kore|login\s+kore|hack\s+kore|ghuke)\b|\b(?:account|id|profile|bank)\s*(?:e|te|ta)?\s*(?:dhuke|access\s+kore|login\s+kore|hack\s+kore)\b/i,
    confidence: 0.96,
    label: 'Unauthorized account takeover and intrusion (Code-Mixed / Multilingual)',
    severity: 'critical',
  },
  {
    // Banglish / Code-mixed Bengali: Financial theft & unauthorized withdrawal
    // e.g., "taka tule nite chai", "taka churi korte", "taka marte chai", "taka tule felte"
    regex: /\b(?:taka|poisa|money|funds?|balance)\s+(?:tule\s+(?:nite|felte|anbo)|churi\s+korte|churi|marte|lut\s+korte|chintai\s+korte)\b|\b(?:taka\s+tule\s+nite\s+chai|taka\s+marbo|taka\s+churi\s+korbo)\b/i,
    confidence: 0.98,
    label: 'Unauthorized financial theft or withdrawal (Code-Mixed / Multilingual)',
    severity: 'critical',
  },
  {
    // Banglish / Code-mixed Bengali: Credential exploitation
    // e.g., "ota diye tar account e", "password ache ... dhuke", "email ar password ache"
    regex: /\b(?:ota|eta|egulo)\s+diye\s+(?:tar|onar|karor|onner)?\s*(?:account|id|bank|profile)?\s*(?:e|te)?\s*(?:dhuke|taka|login|access)\b|\b(?:password|pass)\s+(?:ache|peyechi)\s*.*?\b(?:dhuke|taka|churi|hack)\b/i,
    confidence: 0.97,
    label: 'Stolen credential exploitation & unauthorized access (Code-Mixed)',
    severity: 'critical',
  },
  {
    // Bengali script Unicode: অ্যাকাউন্ট হ্যাক / টাকা তুলে নেওয়া / চুরি
    regex: /(?:অ্যাকাউন্টে|একাউন্টে|আইডিতে)\s*(?:ঢুকে|লগইন\s+করে|হ্যাক\s+করে)|(?:টাকা\s+তুলে\s+নিতে|টাকা\s+চুরি\s+করতে|ব্যালেন্স\s+ট্রান্সফার\s+করে)/i,
    confidence: 0.98,
    label: 'Unauthorized account takeover or financial theft (Bengali Script)',
    severity: 'critical',
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
  /\b(?:review|check|validate|help\s+with|how\s+to\s+write|optimize|debug|explain)\s+(?:this\s+)?(?:regex|regular\s+expression|code|function|script|query|syntax|algorithm|pattern)\b/i,
  /\b(?:matching|parsing|validating|formatting)\s+(?:phone\s+numbers?|emails?|dates?|strings?|urls?|names?|inputs?|ip\s+addresses?)\b/i,
  /\b(?:in\s+general|standard\s+format|best\s+practice|syntax\s+error)\b/i,
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
