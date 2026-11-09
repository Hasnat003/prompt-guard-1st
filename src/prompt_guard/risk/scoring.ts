/**
 * Calibrated Risk Scoring Engine
 * Fulfills Part 6.1 of the Master Project Blueprint:
 * - 0–100 calibrated risk score (Low: 0-24, Moderate: 25-49, High: 50-74, Critical: 75-100)
 * - Multi-category weight calibration
 * - Overlapping threat amplification
 * - Obfuscation and deterministic rule escalation
 * - Hard-negative dampening
 */

import { DetectionDetail, NormalizedInput, RiskLevel } from '../types';

export function calculateCalibratedRiskScore(
  detections: DetectionDetail[],
  normalized: NormalizedInput,
  isEducationalHardNegative: boolean
): {
  score: number;
  level: RiskLevel;
  breakdown: string[];
} {
  const breakdown: string[] = [];

  // Educational hard negative override
  if (isEducationalHardNegative) {
    breakdown.push('Educational hard-negative context verified (-60 pts safety adjustment).');
    return {
      score: 12,
      level: 'LOW',
      breakdown,
    };
  }

  let baseScore = 0;
  const detectedThreats = detections.filter(d => d.detected);

  // Category weight table (Max contribution per category)
  const categoryMaxWeights: Record<string, number> = {
    prompt_injection: 45,
    jailbreak: 40,
    sensitive_data: 45,
    harmful_intent: 45,
  };

  // Severity multipliers
  const severityMultiplier: Record<string, number> = {
    low: 0.3,
    medium: 0.6,
    high: 0.85,
    critical: 1.0,
  };

  for (const det of detections) {
    if (det.detected) {
      const maxCatWeight = categoryMaxWeights[det.category] || 35;
      const mult = severityMultiplier[det.severity] || 0.6;
      const catContribution = Math.round(maxCatWeight * det.confidence * mult);
      baseScore += catContribution;
      breakdown.push(
        `${det.categoryLabel}: confidence ${(det.confidence * 100).toFixed(0)}%, severity ${det.severity.toUpperCase()} (+${catContribution} pts)`
      );
    }
  }

  // Overlapping threat compounding: an attack combining injection + secret exposure is exponentially riskier
  if (detectedThreats.length > 1) {
    const synergyBonus = Math.min(25, (detectedThreats.length - 1) * 12);
    baseScore += synergyBonus;
    breakdown.push(`Multi-threat compound synergy (${detectedThreats.length} concurrent vectors: +${synergyBonus} pts)`);
  }

  // Obfuscation penalty: if attacker hid payload in zero-width or base64
  if (normalized.hasZeroWidthChars) {
    const zwBonus = 15;
    baseScore += zwBonus;
    breakdown.push(`Zero-width invisible formatting detected (${normalized.zeroWidthCount} chars: +${zwBonus} pts)`);
  }

  if (normalized.hasBase64Candidate) {
    const b64Bonus = 18;
    baseScore += b64Bonus;
    breakdown.push(`Base64 encoded payload smuggling detected (+${b64Bonus} pts)`);
  }

  if (normalized.hasObfuscatedSpacing) {
    const spaceBonus = 12;
    baseScore += spaceBonus;
    breakdown.push(`Letter-spaced word evasion pattern detected (+${spaceBonus} pts)`);
  }

  // Critical severity floor: any confirmed critical threat guarantees at least 75 (Critical band)
  const hasCritical = detections.some(d => d.detected && d.severity === 'critical');
  if (hasCritical && baseScore < 75) {
    baseScore = 78;
    breakdown.push('Critical severity override enforced (minimum floor 75 pts).');
  }

  // High severity floor: any confirmed high threat guarantees at least 50 (High band)
  const hasHigh = detections.some(d => d.detected && (d.severity === 'high' || d.severity === 'critical'));
  if (hasHigh && baseScore < 50) {
    baseScore = 52;
    breakdown.push('High severity threat floor enforced (minimum floor 50 pts).');
  }

  // Ambiguity / Uncertainty scoring: if no high threat but non-zero intermediate confidence
  const intermediateDetections = detections.filter(d => !d.detected && d.confidence >= 0.35);
  if (detectedThreats.length === 0 && intermediateDetections.length > 0 && baseScore < 25) {
    baseScore = 32;
    breakdown.push('Uncertain / borderline pattern flagged for REVIEW (32 pts).');
  }

  // Clamp 0 to 100
  const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine Risk Band according to Part 6.1
  let level: RiskLevel = 'LOW';
  if (finalScore >= 75) {
    level = 'CRITICAL';
  } else if (finalScore >= 50) {
    level = 'HIGH';
  } else if (finalScore >= 25) {
    level = 'MODERATE';
  } else {
    level = 'LOW';
  }

  return {
    score: finalScore,
    level,
    breakdown,
  };
}
