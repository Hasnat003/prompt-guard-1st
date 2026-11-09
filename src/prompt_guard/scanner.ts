/**
 * PromptGuard Master Scanner Engine
 * Fulfills Part 7.3 & 7.4 of the Master Project Blueprint:
 * 
 * Usage:
 *   const guard = new PromptGuard();
 *   const result = guard.scan(userPrompt);
 *   if (result.action === "ALLOW") { ... }
 */

import { detectHarmfulIntent } from './detection/harmful_intent';
import { detectPromptInjection } from './detection/injection';
import { detectJailbreak } from './detection/jailbreak';
import { detectSensitiveData } from './detection/sensitive_data';
import { inspectAndNormalize } from './preprocessing';
import { evaluatePolicy, POLICY_PRESETS } from './risk/policy';
import { calculateCalibratedRiskScore } from './risk/scoring';
import { ScanResult, SecurityPolicy } from './types';
import { validateInput } from './validation';

let requestCounter = 1;

export class PromptGuard {
  private policy: SecurityPolicy;

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = {
      ...POLICY_PRESETS.standard,
      ...(policy || {}),
    };
  }

  public setPolicy(newPolicy: Partial<SecurityPolicy>) {
    this.policy = {
      ...this.policy,
      ...newPolicy,
    };
  }

  public getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Scans a prompt for injection, jailbreak, sensitive credentials, and harmful intent.
   * Returns a comprehensive, explainable security report.
   */
  public scan(userPrompt: string): ScanResult {
    const startTime = performance.now();
    const requestId = `pg-${Date.now().toString(36)}-${String(requestCounter++).padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    // 1. Input Validation
    const validation = validateInput(userPrompt, this.policy.maxPromptLength);
    if (!validation.isValid) {
      const endTime = performance.now();
      return {
        request_id: requestId,
        timestamp,
        is_safe: false,
        risk_score: 95,
        risk_level: 'CRITICAL',
        action: 'BLOCK',
        detections: [
          {
            category: 'harmful_intent',
            categoryLabel: 'Malformed Input',
            detected: true,
            confidence: 1.0,
            severity: 'critical',
            evidence: [validation.errorMessage || 'Invalid payload'],
            reason: validation.errorMessage || 'Validation check failed',
            detectorSource: 'rule_heuristic',
          },
        ],
        normalized_input: {
          raw: String(userPrompt || ''),
          normalized: '',
          hasZeroWidthChars: false,
          zeroWidthCount: 0,
          hasObfuscatedSpacing: false,
          hasBase64Candidate: false,
          hasHomoglyphs: false,
          detectedLanguage: 'unknown',
          charCount: String(userPrompt || '').length,
          tokenCountEstimate: 0,
        },
        processing_time_ms: Math.round((endTime - startTime) * 10) / 10,
        policy_applied: this.policy.name,
        action_reason: `Input validation failed: ${validation.errorMessage}`,
        recommendation: 'Ensure payload is UTF-8 string within allowed size limits and contains no binary null bytes.',
        redacted_prompt: '[INVALID_PAYLOAD]',
        educational_hard_negative: false,
      };
    }

    // 2. Preprocessing & Obfuscation Inspection
    const normalizedInput = inspectAndNormalize(userPrompt);

    // 3. Sensitive Data & PII Detection
    const sensitiveResult = detectSensitiveData(normalizedInput.normalized);

    // 4. Prompt Injection Detection
    const injectionResult = detectPromptInjection(normalizedInput.normalized, normalizedInput.raw);

    // 5. Jailbreak Detection
    const jailbreakResult = detectJailbreak(normalizedInput.normalized, normalizedInput.raw);

    // 6. Harmful Intent & Benign Hard-Negative Disambiguation
    const harmfulResult = detectHarmfulIntent(normalizedInput.normalized, normalizedInput.raw);

    const detections = [
      injectionResult,
      jailbreakResult,
      sensitiveResult.detail,
      harmfulResult.detail,
    ];

    // 7. Calibrated Risk Score Calculation
    const riskAssessment = calculateCalibratedRiskScore(
      detections,
      normalizedInput,
      harmfulResult.isEducationalHardNegative
    );

    // 8. Policy Evaluation & Decision Engine
    const decision = evaluatePolicy(
      riskAssessment.score,
      riskAssessment.level,
      detections,
      this.policy,
      harmfulResult.isEducationalHardNegative
    );

    const endTime = performance.now();
    const processingTimeMs = Math.max(1, Math.round((endTime - startTime) * 10) / 10);

    return {
      request_id: requestId,
      timestamp,
      is_safe: decision.action === 'ALLOW',
      risk_score: riskAssessment.score,
      risk_level: riskAssessment.level,
      action: decision.action,
      detections,
      normalized_input: normalizedInput,
      processing_time_ms: processingTimeMs,
      policy_applied: this.policy.name,
      action_reason: decision.action_reason,
      recommendation: decision.recommendation,
      redacted_prompt: sensitiveResult.redactedText,
      educational_hard_negative: harmfulResult.isEducationalHardNegative,
    };
  }
}

// Export singleton default instance for easy imports
export const defaultPromptGuard = new PromptGuard();
