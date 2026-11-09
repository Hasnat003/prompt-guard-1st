/**
 * Firewall & Protection Middleware Demonstration
 * Fulfills Part 7.3 & Part 13 of the Master Project Blueprint:
 * 
 * Demonstrates PromptGuard acting as an active inline security proxy:
 *   [Client / User] 
 *         │
 *         ▼
 *   [PromptGuard Firewall]  ──(BLOCK / REDACT)──► [Security Gateway Intercept (403)]
 *         │ (ALLOW)
 *         ▼
 *   [Downstream LLM (Gemini / Claude / Llama)]
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  ArrowRight, 
  Cpu, 
  Send, 
  Lock, 
  CheckCircle2, 
  XCircle,
  FileText,
  Clock
} from 'lucide-react';
import { PART_13_DEMONSTRATION_SCENARIOS } from '../data/benchmarkDatasets';
import { PromptGuard } from '../prompt_guard/scanner';
import { ScanResult, SecurityPolicy } from '../prompt_guard/types';

interface FirewallDemoProps {
  guard: PromptGuard;
  policy: SecurityPolicy;
}

export const FirewallDemo: React.FC<FirewallDemoProps> = ({ guard, policy }) => {
  const [promptText, setPromptText] = useState<string>(PART_13_DEMONSTRATION_SCENARIOS[1].prompt);
  const [pipelineState, setPipelineState] = useState<'idle' | 'inspecting' | 'forwarding' | 'completed'>('idle');
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [llmOutput, setLlmOutput] = useState<string | null>(null);
  const [systemModel] = useState<string>('LLM-Provider (Independent Model Gateway)');

  const runFirewallPipeline = async () => {
    if (!promptText.trim()) return;

    setPipelineState('inspecting');
    setLastScanResult(null);
    setLlmOutput(null);

    // Step 1: PromptGuard Inspection
    await new Promise(r => setTimeout(r, 150));
    const scan = guard.scan(promptText);
    setLastScanResult(scan);

    if (scan.action === 'ALLOW') {
      setPipelineState('forwarding');
      await new Promise(r => setTimeout(r, 350));
      // Simulate legitimate LLM completion response
      let answer = '';
      if (promptText.toLowerCase().includes('gradient descent')) {
        answer = 'Gradient descent iteratively calculates the negative gradient of the loss function with respect to model weights: w = w - η ∇L(w). A suitable learning rate η ensures smooth convergence without divergence.';
      } else if (promptText.toLowerCase().includes('defend')) {
        answer = 'To defend against prompt injection: 1) Enforce strict separation between system instructions and untrusted data envelopes using XML/delimiters, 2) Deploy PromptGuard input inspection middleware, 3) Apply output encoding and least-privilege tool execution.';
      } else {
        answer = `[Model Output for verified safe request]: The query was validated by PromptGuard with risk score ${scan.risk_score}/100. Here is the response to your inquiry...`;
      }
      setLlmOutput(answer);
      setPipelineState('completed');
    } else if (scan.action === 'BLOCK') {
      setPipelineState('completed');
      setLlmOutput(null);
    } else {
      // REVIEW
      setPipelineState('completed');
      setLlmOutput('Request quarantined in human review audit queue. Awaiting security approval.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <h1 className="text-xl font-bold text-white tracking-tight">
          LLM Protection Middleware & Firewall Sandbox
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Simulate PromptGuard intercepting untrusted incoming traffic before it reaches downstream foundation models.
        </p>

        {/* Visual Middleware Flow Diagram */}
        <div className="mt-5 p-4 bg-slate-950 rounded-lg border border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Step 1 */}
            <div className={`p-3 rounded border transition-colors ${
              pipelineState === 'inspecting' ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 bg-slate-900/50'
            }`}>
              <div className="text-xs text-slate-400 font-mono">STEP 1: INGESTION</div>
              <div className="text-sm font-semibold text-white mt-1">Untrusted User Input</div>
              <div className="text-xs text-slate-400 mt-0.5">Prompt, documents, or retrieved context</div>
            </div>

            {/* Step 2 */}
            <div className={`p-3 rounded border transition-colors ${
              pipelineState === 'inspecting'
                ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                : lastScanResult?.action === 'BLOCK'
                ? 'border-rose-500 bg-rose-950/30'
                : lastScanResult?.action === 'ALLOW'
                ? 'border-emerald-500 bg-emerald-950/30'
                : 'border-slate-800 bg-slate-900/50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">STEP 2: PROMPTGUARD</span>
                {lastScanResult && (
                  <span className={`text-xs font-mono font-bold ${
                    lastScanResult.action === 'BLOCK' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {lastScanResult.action} ({lastScanResult.risk_score}/100)
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-white mt-1">Inline Security Gate</div>
              <div className="text-xs text-slate-400 mt-0.5">NFKC unmasking, Presidio PII, ML classifier</div>
            </div>

            {/* Step 3 */}
            <div className={`p-3 rounded border transition-colors ${
              pipelineState === 'forwarding' || (pipelineState === 'completed' && lastScanResult?.action === 'ALLOW')
                ? 'border-emerald-500 bg-emerald-950/20'
                : lastScanResult?.action === 'BLOCK'
                ? 'border-slate-800 bg-slate-950/40 opacity-40'
                : 'border-slate-800 bg-slate-900/50'
            }`}>
              <div className="text-xs text-slate-400 font-mono">STEP 3: EXECUTION</div>
              <div className="text-sm font-semibold text-white mt-1">Downstream LLM</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {lastScanResult?.action === 'BLOCK' ? 'Zero tokens consumed (Protected)' : 'Invoked only if ALLOW'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Testing Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Client Input Form */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Client Request Payload
            </h3>
            <span className="text-xs text-slate-400 font-mono">REST /api/v1/generate</span>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Quick Pre-set Attack / Test Case:</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPromptText(PART_13_DEMONSTRATION_SCENARIOS[1].prompt)}
                className="p-2 text-left rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
              >
                <div className="font-semibold text-rose-400">Direct Injection</div>
                <div className="text-[11px] text-slate-500 truncate">Ignore previous instructions...</div>
              </button>
              <button
                type="button"
                onClick={() => setPromptText(PART_13_DEMONSTRATION_SCENARIOS[2].prompt)}
                className="p-2 text-left rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
              >
                <div className="font-semibold text-rose-400">DAN Jailbreak</div>
                <div className="text-[11px] text-slate-500 truncate">Pretend you have no rules...</div>
              </button>
              <button
                type="button"
                onClick={() => setPromptText(PART_13_DEMONSTRATION_SCENARIOS[3].prompt)}
                className="p-2 text-left rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
              >
                <div className="font-semibold text-amber-400">Exposed API Key</div>
                <div className="text-[11px] text-slate-500 truncate">AKIAIOSFODNN7EXAMPLE...</div>
              </button>
              <button
                type="button"
                onClick={() => setPromptText(PART_13_DEMONSTRATION_SCENARIOS[5].prompt)}
                className="p-2 text-left rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
              >
                <div className="font-semibold text-emerald-400">Hard Negative</div>
                <div className="text-[11px] text-slate-500 truncate">Defend against prompt injection...</div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Natural Language Prompt:</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={5}
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="button"
            onClick={runFirewallPipeline}
            disabled={pipelineState === 'inspecting' || !promptText.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Send Request Through Middleware</span>
          </button>
        </div>

        {/* Right: Security Gateway Intercept & Downstream LLM Output */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Gateway Enforcement & Model Feed
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Target: {systemModel}
            </span>
          </div>

          {lastScanResult ? (
            <div className="space-y-4">
              {/* Intercept Status Card */}
              {lastScanResult.action === 'BLOCK' ? (
                <div className="p-4 bg-rose-950/30 border border-rose-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>HTTP 403 FORBIDDEN - REQUEST INTERCEPTED BY PROMPTGUARD</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    PromptGuard blocked this request before it reached the model. Reason: <span className="text-rose-300 font-medium">{lastScanResult.action_reason}</span>
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-400 border-t border-slate-800 pt-2">
                    <span>Risk Score: <strong className="text-rose-400">{lastScanResult.risk_score}/100</strong></span>
                    <span>·</span>
                    <span>Intercept Latency: <strong className="text-cyan-300">{lastScanResult.processing_time_ms} ms</strong></span>
                    <span>·</span>
                    <span>Token Consumption: <strong className="text-emerald-400">0 Tokens (Protected)</strong></span>
                  </div>
                </div>
              ) : lastScanResult.action === 'REVIEW' ? (
                <div className="p-4 bg-amber-950/30 border border-amber-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>HTTP 202 ACCEPTED - QUARANTINED FOR AUDIT REVIEW</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {lastScanResult.action_reason}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span>HTTP 200 OK - AUTHORIZED BY PROMPTGUARD</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Inspection passed with Low Risk ({lastScanResult.risk_score}/100). Request safely forwarded to downstream LLM application.
                  </p>
                </div>
              )}

              {/* LLM Response Stream */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                  <span>Downstream Model Output Stream</span>
                  {llmOutput && <span className="text-emerald-400 font-semibold">Response Received</span>}
                </div>

                {lastScanResult.action === 'BLOCK' ? (
                  <div className="p-4 bg-slate-900/60 rounded border border-dashed border-slate-800 text-xs text-slate-500 font-mono text-center">
                    [LLM Execution Dropped: No prompt forwarded to model layer. Zero API costs incurred.]
                  </div>
                ) : llmOutput ? (
                  <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
                    {llmOutput}
                  </div>
                ) : (
                  <div className="p-4 text-xs text-slate-500 font-mono text-center">
                    Awaiting transmission...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              Click &quot;Send Request Through Middleware&quot; to observe the security gate in action.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
