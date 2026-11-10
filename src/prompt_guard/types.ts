/**
 * PromptGuard Master Type Definitions
 * Based on University Individual Project Blueprint: PromptGuard
 */

export type ThreatCategory = 
  | 'prompt_injection'
  | 'jailbreak'
  | 'sensitive_data'
  | 'harmful_intent'
  | 'malicious_intent';

export type DecisionAction = 'ALLOW' | 'BLOCK' | 'REVIEW';

export type RiskLevel = 
  | 'CLEAN'          // Tier 0: 0.0 - 9.9 (Pristine Benign Input)
  | 'INFORMATIONAL'  // Tier 1: 10.0 - 24.9 (Educational / Minor Anomaly)
  | 'LOW'            // Tier 2: 25.0 - 44.9 (Low Caution / Weak Shift)
  | 'MODERATE'       // Tier 3: 45.0 - 64.9 (Elevated Inspection Required)
  | 'ELEVATED'       // Tier 3 (Alias)
  | 'HIGH'           // Tier 4: 65.0 - 79.9 (Confirmed Threat Vector)
  | 'CRITICAL'       // Tier 5: 80.0 - 91.9 (Direct Exploit / Credential Leak)
  | 'SEVERE';        // Tier 6: 92.0 - 100.0 (Severe Emergency / Multi-Vector Compound)

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SecretMatch {
  type: string;
  label: string;
  raw: string;
  redacted: string;
  startIndex: number;
  endIndex: number;
  entropy?: number;
  confidence: number;
}

export interface DetectionDetail {
  category: ThreatCategory;
  categoryLabel: string;
  detected: boolean;
  confidence: number; // 0.00 to 1.00
  severity: SeverityLevel;
  evidence: string[]; // safely redacted indicators
  reason: string;
  detectorSource: 'ml_classifier' | 'rule_heuristic' | 'presidio_entropy' | 'hybrid';
  calibrationCaveat?: string;
}

export interface NormalizedInput {
  raw: string;
  normalized: string;
  hasZeroWidthChars: boolean;
  zeroWidthCount: number;
  hasObfuscatedSpacing: boolean;
  hasBase64Candidate: boolean;
  decodedBase64?: string;
  hasHomoglyphs: boolean;
  detectedLanguage: string;
  charCount: number;
  tokenCountEstimate: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  allowThreshold: number; // e.g. < 25 => ALLOW
  blockThreshold: number; // e.g. >= 60 => BLOCK (between is REVIEW)
  strictness: 'permissive' | 'standard' | 'high_defense' | 'strict_compliance';
  blockOnCriticalSecret: boolean;
  blockOnConfirmedInjection: boolean;
  blockOnConfirmedJailbreak: boolean;
  blockOnHarmfulIntent: boolean;
  redactSecretsInLogs: boolean;
  uncertaintyThreshold: number; // confidence delta triggering REVIEW
  maxPromptLength: number;
}

import { MLPredictionResult } from './ml_engine';

export interface ScanResult {
  request_id: string;
  timestamp: string;
  is_safe: boolean;
  risk_score: number; // 0 to 100
  risk_level: RiskLevel;
  action: DecisionAction;
  detections: DetectionDetail[];
  normalized_input: NormalizedInput;
  processing_time_ms: number;
  policy_applied: string;
  action_reason: string;
  recommendation: string;
  redacted_prompt: string;
  educational_hard_negative: boolean;
  ml_analysis?: MLPredictionResult;
}

export interface BenchmarkSample {
  id: string;
  scenario: string;
  title: string;
  prompt: string;
  ground_truth_threats: ThreatCategory[];
  expected_action: DecisionAction;
  expected_score_band: RiskLevel;
  description: string;
  is_hard_negative?: boolean;
  source: string;
}

export interface ModelMetrics {
  name: string;
  type: 'Traditional ML' | 'Transformer' | 'Hybrid';
  accuracy: number;
  precision: number;
  recall: number;
  f1_macro: number;
  f1_micro: number;
  fpr: number;
  fnr: number;
  pr_auc: number;
  roc_auc: number;
  avg_latency_ms: number;
  memory_footprint_mb: number;
  strengths: string;
  weaknesses: string;
}
