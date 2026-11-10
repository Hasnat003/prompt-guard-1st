/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AcademicReport } from './components/AcademicReport';
import { BenchmarkTesting } from './components/BenchmarkTesting';
import { ColabSubmissionHub } from './components/ColabSubmissionHub';
import { PresentationSlides } from './components/PresentationSlides';
import { DatasetWorkbench } from './components/DatasetWorkbench';
import { FirewallDemo } from './components/FirewallDemo';
import { Header } from './components/Header';
import { PolicyConfig } from './components/PolicyConfig';
import { PythonPackageHub } from './components/PythonPackageHub';
import { ScannerDashboard } from './components/ScannerDashboard';
import { PART_13_DEMONSTRATION_SCENARIOS } from './data/benchmarkDatasets';
import { POLICY_PRESETS } from './prompt_guard/risk/policy';
import { PromptGuard } from './prompt_guard/scanner';
import { ScanResult, SecurityPolicy } from './prompt_guard/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [policy, setPolicy] = useState<SecurityPolicy>(POLICY_PRESETS.standard);
  const [currentPrompt, setCurrentPrompt] = useState<string>(
    PART_13_DEMONSTRATION_SCENARIOS[1].prompt // Default: Scenario 2 - Direct Injection
  );
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Initialize PromptGuard with configured policy
  const guard = useMemo(() => {
    return new PromptGuard(policy);
  }, [policy]);

  // Execute scan: first tries live Python 3 backend, fallback to client engine
  const handleScan = async () => {
    if (!currentPrompt.trim()) return;
    setIsScanning(true);
    try {
      const response = await fetch('/api/py-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt, policy: policy.id }),
      });
      if (response.ok) {
        const pyResult = await response.json();
        // Map Python keys to frontend ScanResult contract if needed
        const mappedResult: ScanResult = {
          request_id: pyResult.request_id,
          timestamp: pyResult.timestamp,
          is_safe: pyResult.is_safe,
          risk_score: pyResult.risk_score,
          risk_level: pyResult.risk_level,
          action: pyResult.action,
          detections: pyResult.detections.map((d: any) => ({
            category: d.category,
            categoryLabel: d.category_label || d.category,
            detected: d.detected,
            confidence: d.confidence,
            severity: d.severity,
            evidence: d.evidence,
            reason: d.reason,
            detectorSource: d.detector_source,
            calibrationCaveat: d.calibration_caveat,
          })),
          normalized_input: {
            raw: pyResult.normalized_input.raw,
            normalized: pyResult.normalized_input.normalized,
            hasZeroWidthChars: pyResult.normalized_input.has_zero_width_chars,
            zeroWidthCount: pyResult.normalized_input.zero_width_count,
            hasObfuscatedSpacing: pyResult.normalized_input.has_obfuscated_spacing,
            hasBase64Candidate: pyResult.normalized_input.has_base64_candidate,
            decodedBase64: pyResult.normalized_input.decoded_base64,
            hasHomoglyphs: pyResult.normalized_input.has_homoglyphs,
            detectedLanguage: pyResult.normalized_input.detected_language,
            charCount: pyResult.normalized_input.char_count,
            tokenCountEstimate: pyResult.normalized_input.token_count_estimate,
          },
          processing_time_ms: pyResult.processing_time_ms,
          policy_applied: pyResult.policy_applied,
          action_reason: pyResult.action_reason,
          recommendation: pyResult.recommendation,
          redacted_prompt: pyResult.redacted_prompt,
          educational_hard_negative: pyResult.educational_hard_negative,
          ml_analysis: pyResult.ml_analysis ? {
            probabilities: pyResult.ml_analysis.probabilities || {},
            logits: pyResult.ml_analysis.logits || {},
            topFeatures: (pyResult.ml_analysis.top_features || pyResult.ml_analysis.topFeatures || []).map((f: any) => ({
              feature: f.feature,
              weight: f.weight,
              contribution: f.contribution,
              category: f.category,
            })),
            tokenSaliency: (pyResult.ml_analysis.token_saliency || pyResult.ml_analysis.tokenSaliency || []).map((t: any) => ({
              token: t.token,
              weight: t.weight,
              category: t.category,
            })),
            featureCount: pyResult.ml_analysis.feature_count || pyResult.ml_analysis.featureCount || 0,
            modelType: pyResult.ml_analysis.model_type || pyResult.ml_analysis.modelType || 'MultiOutput Logistic Regression',
            macroF1: pyResult.ml_analysis.macro_f1 || pyResult.ml_analysis.macroF1 || 0.989,
          } : undefined,
        };
        setScanResult(mappedResult);
        setIsScanning(false);
        return;
      }
    } catch {
      // Fallback to local engine
    }

    const localResult = guard.scan(currentPrompt);
    setScanResult(localResult);
    setIsScanning(false);
  };


  // Perform initial scan on startup
  useEffect(() => {
    handleScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard]);

  // Quick Action: Cycle through Part 13 attacks
  const handleQuickAttack = () => {
    // Pick Scenario 7 (Mixed threat) or Scenario 3 (Jailbreak)
    const attackScenario = PART_13_DEMONSTRATION_SCENARIOS[6]; // Mixed threat
    setCurrentPrompt(attackScenario.prompt);
    setActiveTab('scanner');
    setTimeout(() => {
      const res = guard.scan(attackScenario.prompt);
      setScanResult(res);
    }, 50);
  };

  const handleSelectPromptFromBenchmark = (prompt: string) => {
    setCurrentPrompt(prompt);
    setActiveTab('scanner');
    setTimeout(() => {
      const res = guard.scan(prompt);
      setScanResult(res);
    }, 50);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header conforming to Top Bar Contract */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickDemo={handleQuickAttack}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'colab_submission' && (
          <ColabSubmissionHub />
        )}

        {activeTab === 'presentation_slides' && (
          <PresentationSlides />
        )}

        {activeTab === 'scanner' && (
          <ScannerDashboard
            currentPrompt={currentPrompt}
            onPromptChange={setCurrentPrompt}
            onScan={handleScan}
            result={scanResult}
            policy={policy}
            isScanning={isScanning}
            onOpenFirewall={() => setActiveTab('firewall')}
          />
        )}

        {activeTab === 'firewall' && (
          <FirewallDemo
            guard={guard}
            policy={policy}
          />
        )}

        {activeTab === 'python_hub' && (
          <PythonPackageHub />
        )}

        {activeTab === 'benchmarks' && (
          <BenchmarkTesting
            guard={guard}
            onSelectPrompt={handleSelectPromptFromBenchmark}
          />
        )}

        {activeTab === 'dataset_ml' && (
          <DatasetWorkbench />
        )}

        {activeTab === 'policy' && (
          <PolicyConfig
            policy={policy}
            onUpdatePolicy={(newPolicy) => setPolicy(newPolicy)}
          />
        )}

        {activeTab === 'fyp_report' && (
          <AcademicReport />
        )}
      </main>

      {/* Academic University Project Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-bold text-white tracking-wide">PromptGuard</span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="text-slate-300 font-medium">AI Prompt Security &amp; LLM Protection Firewall</span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="text-cyan-400 font-semibold">Developed by A. H. M Abdullah</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 text-xs">
            <span className="text-slate-500">Autonomous Offline Engine</span>
            <span className="text-slate-700">·</span>
            <button
              onClick={() => setActiveTab('presentation_slides')}
              className="text-slate-300 hover:text-cyan-300 transition-colors font-medium"
            >
              Slides
            </button>
            <span className="text-slate-700">·</span>
            <button
              onClick={() => setActiveTab('fyp_report')}
              className="text-cyan-400 hover:text-cyan-300 underline font-medium"
            >
              Master Blueprint
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
