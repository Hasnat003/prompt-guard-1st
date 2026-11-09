/**
 * Security Policy & Decision Engine
 * Fulfills Part 5.2 & Part 7 of the Master Project Blueprint:
 * - Computes ALLOW, BLOCK, or REVIEW decision
 * - Configurable policy thresholds and strictness presets
 * - Produces machine-readable reasons and actionable remediation
 */

import { DecisionAction, DetectionDetail, RiskLevel, SecurityPolicy } from '../types';

export const POLICY_PRESETS: Record<string, SecurityPolicy> = {
  standard: {
    id: 'standard',
    name: 'Standard Balanced (Recommended)',
    allowThreshold: 25,
    blockThreshold: 50,
    strictness: 'standard',
    blockOnCriticalSecret: true,
    blockOnConfirmedInjection: true,
    blockOnConfirmedJailbreak: true,
    blockOnHarmfulIntent: true,
    redactSecretsInLogs: true,
    uncertaintyThreshold: 0.15,
    maxPromptLength: 8000,
  },
  high_defense: {
    id: 'high_defense',
    name: 'High-Defense Enterprise',
    allowThreshold: 15,
    blockThreshold: 40,
    strictness: 'high_defense',
    blockOnCriticalSecret: true,
    blockOnConfirmedInjection: true,
    blockOnConfirmedJailbreak: true,
    blockOnHarmfulIntent: true,
    redactSecretsInLogs: true,
    uncertaintyThreshold: 0.10,
    maxPromptLength: 4000,
  },
  strict_compliance: {
    id: 'strict_compliance',
    name: 'Strict Compliance / Zero-Trust',
    allowThreshold: 10,
    blockThreshold: 30,
    strictness: 'strict_compliance',
    blockOnCriticalSecret: true,
    blockOnConfirmedInjection: true,
    blockOnConfirmedJailbreak: true,
    blockOnHarmfulIntent: true,
    redactSecretsInLogs: true,
    uncertaintyThreshold: 0.05,
    maxPromptLength: 2500,
  },
  permissive: {
    id: 'permissive',
    name: 'Permissive / Audit Monitoring Only',
    allowThreshold: 50,
    blockThreshold: 80,
    strictness: 'permissive',
    blockOnCriticalSecret: false,
    blockOnConfirmedInjection: false,
    blockOnConfirmedJailbreak: false,
    blockOnHarmfulIntent: false,
    redactSecretsInLogs: true,
    uncertaintyThreshold: 0.20,
    maxPromptLength: 12000,
  },
};

export function evaluatePolicy(
  riskScore: number,
  riskLevel: RiskLevel,
  detections: DetectionDetail[],
  policy: SecurityPolicy,
  isEducationalHardNegative: boolean
): {
  action: DecisionAction;
  action_reason: string;
  recommendation: string;
} {
  // If verified educational hard negative, allow explicitly unless risk score is somehow critical
  if (isEducationalHardNegative && riskScore < policy.blockThreshold) {
    return {
      action: 'ALLOW',
      action_reason: 'Request allowed: verified educational or defensive inquiry without malicious exploit payload.',
      recommendation: 'Safe to forward to downstream LLM application.',
    };
  }

  // Explicit policy triggers
  const detectedInj = detections.find(d => d.category === 'prompt_injection' && d.detected);
  const detectedJb = detections.find(d => d.category === 'jailbreak' && d.detected);
  const detectedSecret = detections.find(d => d.category === 'sensitive_data' && d.detected);
  const detectedHarmful = detections.find(d => d.category === 'harmful_intent' && d.detected);

  if (policy.blockOnCriticalSecret && detectedSecret && detectedSecret.severity === 'critical') {
    return {
      action: 'BLOCK',
      action_reason: 'Policy block enforced: high-risk credential or private API key detected in user prompt.',
      recommendation: 'Strip or redact exposed credentials before forwarding. PromptGuard auto-redaction available.',
    };
  }

  if (policy.blockOnConfirmedInjection && detectedInj && (detectedInj.severity === 'critical' || detectedInj.confidence >= 0.85)) {
    return {
      action: 'BLOCK',
      action_reason: 'Policy block enforced: high-confidence prompt injection attempting instruction override.',
      recommendation: 'Reject request. Instruct user to separate instructions from data payloads using structured schemas.',
    };
  }

  if (policy.blockOnConfirmedJailbreak && detectedJb && (detectedJb.severity === 'critical' || detectedJb.confidence >= 0.85)) {
    return {
      action: 'BLOCK',
      action_reason: 'Policy block enforced: adversarial persona manipulation or restriction bypass detected.',
      recommendation: 'Reject request. Enforce strict system persona boundary and model refusal safeguards.',
    };
  }

  if (policy.blockOnHarmfulIntent && detectedHarmful && !isEducationalHardNegative) {
    return {
      action: 'BLOCK',
      action_reason: 'Policy block enforced: active harmful intent or weaponization vector identified.',
      recommendation: 'Reject request and log security event. Do not forward offensive payload to downstream model.',
    };
  }

  // Threshold-based scoring decision
  if (riskScore >= policy.blockThreshold) {
    return {
      action: 'BLOCK',
      action_reason: `Calculated risk score (${riskScore}/100) exceeds configured BLOCK threshold (${policy.blockThreshold}/100).`,
      recommendation: 'Security policy blocked this request. Review threat categories and inspect unmasked evidence.',
    };
  }

  if (riskScore >= policy.allowThreshold) {
    return {
      action: 'REVIEW',
      action_reason: `Calculated risk score (${riskScore}/100) sits within the inspection band [${policy.allowThreshold}-${policy.blockThreshold - 1}].`,
      recommendation: 'Request requires automated sandboxing or secondary human reviewer approval prior to execution.',
    };
  }

  return {
    action: 'ALLOW',
    action_reason: `No threat category exceeds configured action thresholds (${riskScore}/100 < ${policy.allowThreshold}).`,
    recommendation: 'Request cleared. Safe to forward to LLM model with standard system constraints.',
  };
}
