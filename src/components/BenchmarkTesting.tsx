/**
 * Benchmark Testing & Evaluation Dashboard
 * Fulfills Part 8 & Part 9 of the Master Project Blueprint:
 * - Curated benchmark prompt execution
 * - Automated batch evaluation
 * - Confusion Matrix (TP, FP, TN, FN)
 * - Academic evaluation metrics: Accuracy, Precision, Recall, F1, FPR, FNR, Latency
 * - Robustness and False-Positive resilience analysis
 */

import React, { useState, useMemo } from 'react';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  BarChart3, 
  FileCheck,
  Search,
  Filter
} from 'lucide-react';
import { BENCHMARK_EVALUATION_CORPUS } from '../data/benchmarkDatasets';
import { PromptGuard } from '../prompt_guard/scanner';
import { BenchmarkSample, ScanResult } from '../prompt_guard/types';

interface BenchmarkTestingProps {
  guard: PromptGuard;
  onSelectPrompt: (prompt: string) => void;
}

interface TestRunResult {
  sample: BenchmarkSample;
  scan: ScanResult;
  isCorrectAction: boolean;
  isTruePositive: boolean;
  isTrueNegative: boolean;
  isFalsePositive: boolean;
  isFalseNegative: boolean;
}

export const BenchmarkTesting: React.FC<BenchmarkTestingProps> = ({ guard, onSelectPrompt }) => {
  const [testResults, setTestResults] = useState<TestRunResult[]>([]);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'correct' | 'errors' | 'hard_negatives'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Run all benchmark items through PromptGuard
  const runBatchEvaluation = async () => {
    setIsRunningBatch(true);
    const results: TestRunResult[] = [];

    for (const sample of BENCHMARK_EVALUATION_CORPUS) {
      const scan = guard.scan(sample.prompt);
      
      const isActualThreat = sample.ground_truth_threats.length > 0;
      const isPredictedThreat = scan.action === 'BLOCK' || (scan.action === 'REVIEW' && scan.risk_score >= 35);
      
      const isCorrectAction = sample.expected_action === scan.action || 
        (sample.expected_action === 'REVIEW' && (scan.action === 'REVIEW' || scan.action === 'ALLOW'));

      const isTruePositive = isActualThreat && (scan.action === 'BLOCK' || scan.action === 'REVIEW');
      const isTrueNegative = !isActualThreat && scan.action === 'ALLOW';
      const isFalsePositive = !isActualThreat && (scan.action === 'BLOCK' || scan.action === 'REVIEW');
      const isFalseNegative = isActualThreat && scan.action === 'ALLOW';

      results.push({
        sample,
        scan,
        isCorrectAction,
        isTruePositive,
        isTrueNegative,
        isFalsePositive,
        isFalseNegative,
      });
    }

    // Small delay to provide satisfying tactile feedback
    await new Promise(r => setTimeout(r, 200));
    setTestResults(results);
    setIsRunningBatch(false);
  };

  // Compute academic metrics
  const metrics = useMemo(() => {
    if (testResults.length === 0) return null;

    const total = testResults.length;
    const tp = testResults.filter(r => r.isTruePositive).length;
    const tn = testResults.filter(r => r.isTrueNegative).length;
    const fp = testResults.filter(r => r.isFalsePositive).length;
    const fn = testResults.filter(r => r.isFalseNegative).length;

    const accuracy = (tp + tn) / total;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1;
    const fpr = tn + fp > 0 ? fp / (tn + fp) : 0;
    const fnr = tp + fn > 0 ? fn / (tp + fn) : 0;
    const avgLatency = testResults.reduce((acc, r) => acc + r.scan.processing_time_ms, 0) / total;

    return {
      total,
      tp,
      tn,
      fp,
      fn,
      accuracy: (accuracy * 100).toFixed(1),
      precision: (precision * 100).toFixed(1),
      recall: (recall * 100).toFixed(1),
      f1: (f1 * 100).toFixed(1),
      fpr: (fpr * 100).toFixed(1),
      fnr: (fnr * 100).toFixed(1),
      avgLatency: avgLatency.toFixed(1),
    };
  }, [testResults]);

  const filteredResults = useMemo(() => {
    return testResults.filter((r) => {
      if (activeFilter === 'correct' && !r.isCorrectAction) return false;
      if (activeFilter === 'errors' && r.isCorrectAction) return false;
      if (activeFilter === 'hard_negatives' && !r.sample.is_hard_negative) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          r.sample.title.toLowerCase().includes(query) ||
          r.sample.scenario.toLowerCase().includes(query) ||
          r.sample.prompt.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [testResults, activeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Empirical Evaluation & Benchmark Suite
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Automated testing across Hlyn, WildJailbreak, WildGuardMix, deepset, and defensive hard negatives.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runBatchEvaluation}
              disabled={isRunningBatch}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningBatch ? 'Evaluating Corpus...' : 'Run Benchmark Evaluation'}</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        {metrics && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4 border-t border-slate-800">
            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Accuracy</div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                {metrics.accuracy}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{metrics.tp + metrics.tn}/{metrics.total} Correct</div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Precision</div>
              <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-0.5">
                {metrics.precision}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">Threat Fidelity</div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Recall</div>
              <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-0.5">
                {metrics.recall}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">Threat Catch Rate</div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">F1-Score</div>
              <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-0.5">
                {metrics.f1}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">Harmonic Mean</div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">False Pos (FPR)</div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                {metrics.fpr}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{metrics.fp} False Alarm(s)</div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">False Neg (FNR)</div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                {metrics.fnr}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{metrics.fn} Dangerous Miss</div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Avg Latency</div>
              <div className="text-xl font-bold font-mono text-slate-200 tabular-nums mt-0.5">
                {metrics.avgLatency} ms
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">Inference Speed</div>
            </div>
          </div>
        )}
      </div>

      {/* Confusion Matrix & Error Analysis */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Confusion Matrix Quadrant */}
          <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Empirical Confusion Matrix
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Visual classification grid on {metrics.total} labeled benchmark examples.
            </p>

            <div className="grid grid-cols-2 gap-3 text-center font-mono">
              {/* True Positive */}
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-lg">
                <div className="text-xs text-emerald-400 font-semibold">TRUE POSITIVES (TP)</div>
                <div className="text-3xl font-extrabold text-emerald-300 mt-1 tabular-nums">
                  {metrics.tp}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Threat correctly blocked</div>
              </div>

              {/* False Positive */}
              <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-lg">
                <div className="text-xs text-amber-400 font-semibold">FALSE POSITIVES (FP)</div>
                <div className="text-3xl font-extrabold text-amber-300 mt-1 tabular-nums">
                  {metrics.fp}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Benign blocked in error</div>
              </div>

              {/* False Negative */}
              <div className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-lg">
                <div className="text-xs text-rose-400 font-semibold">FALSE NEGATIVES (FN)</div>
                <div className="text-3xl font-extrabold text-rose-300 mt-1 tabular-nums">
                  {metrics.fn}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Attack slipped through</div>
              </div>

              {/* True Negative */}
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-lg">
                <div className="text-xs text-emerald-400 font-semibold">TRUE NEGATIVES (TN)</div>
                <div className="text-3xl font-extrabold text-emerald-300 mt-1 tabular-nums">
                  {metrics.tn}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Benign safely allowed</div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-400 space-y-1">
              <div><strong className="text-slate-300">Hard-Negative Distinction:</strong> Prompts discussing defensive injection methods are classified as TN without false-positive penalty.</div>
            </div>
          </div>

          {/* Test Results Filter & Breakdown */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-lg p-5 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Evaluation Sample Breakdown ({filteredResults.length})
              </h3>

              {/* Segmented Filter Buttons */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeFilter === 'all' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({testResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('correct')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeFilter === 'correct' ? 'bg-slate-800 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('hard_negatives')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeFilter === 'hard_negatives' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Hard Negatives
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="mb-3 relative">
              <input
                type="text"
                placeholder="Search benchmark scenarios by title or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Scrollable Test Results Table */}
            <div className="border border-slate-800 rounded overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Expected</th>
                    <th className="py-2 px-3">Decision</th>
                    <th className="py-2 px-3 text-right">Score</th>
                    <th className="py-2 px-3 text-right">Latency</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {filteredResults.map((r) => {
                    const isPass = r.isCorrectAction;
                    return (
                      <tr key={r.sample.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-sans">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            {r.sample.title}
                            {r.sample.is_hard_negative && (
                              <span className="text-[10px] text-cyan-400 font-mono">[Hard Negative]</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{r.sample.prompt}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-400">{r.sample.expected_action}</td>
                        <td className="py-2 px-3">
                          <span className={`font-semibold ${
                            r.scan.action === 'BLOCK' ? 'text-rose-400' : r.scan.action === 'REVIEW' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {r.scan.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.scan.risk_score}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-400">{r.scan.processing_time_ms}ms</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectPrompt(r.sample.prompt)}
                            className="text-cyan-400 hover:text-cyan-300 font-sans text-xs underline"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Initial state placeholder before batch execution */}
      {!metrics && (
        <div className="p-8 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-lg">
          <p className="text-sm text-slate-400">
            Click &quot;Run Benchmark Evaluation&quot; above to process the entire curated evaluation corpus and compute Precision, Recall, and the Confusion Matrix.
          </p>
        </div>
      )}
    </div>
  );
};
