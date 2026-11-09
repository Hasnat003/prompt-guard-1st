/**
 * Security Policy & Configuration Settings
 * Fulfills Part 5.2 & Part 8 of the Master Project Blueprint:
 * - Configurable risk score thresholds for ALLOW, REVIEW, and BLOCK
 * - Policy strictness presets
 * - Fine-grained toggles for critical categories
 * - Maximum prompt size limits and secret redaction enforcement
 */

import React from 'react';
import { Sliders, Shield, Lock, AlertCircle, Save, Check } from 'lucide-react';
import { POLICY_PRESETS } from '../prompt_guard/risk/policy';
import { SecurityPolicy } from '../prompt_guard/types';

interface PolicyConfigProps {
  policy: SecurityPolicy;
  onUpdatePolicy: (newPolicy: SecurityPolicy) => void;
}

export const PolicyConfig: React.FC<PolicyConfigProps> = ({ policy, onUpdatePolicy }) => {
  const [savedNotice, setSavedNotice] = React.useState(false);

  const handleApplyPreset = (presetKey: string) => {
    const preset = POLICY_PRESETS[presetKey];
    if (preset) {
      onUpdatePolicy({ ...preset });
      flashSaved();
    }
  };

  const flashSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Security Policy & Threshold Configuration
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Tune dynamic decision gates, sensitivity ceilings, and category-level enforcement rules.
            </p>
          </div>

          {savedNotice && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs rounded font-medium">
              <Check className="w-4 h-4" />
              <span>Policy Updated</span>
            </div>
          )}
        </div>
      </div>

      {/* Preset Profiles */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Configured Policy Presets
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Object.entries(POLICY_PRESETS).map(([key, p]) => {
            const isSelected = policy.id === p.id;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className={`p-3.5 text-left rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-cyan-950/30 border-cyan-500/80 ring-1 ring-cyan-500/40'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-white">{p.name}</div>
                <div className="mt-2 text-xs font-mono text-slate-400 space-y-0.5">
                  <div>ALLOW &lt; {p.allowThreshold}</div>
                  <div>REVIEW: [{p.allowThreshold}–{p.blockThreshold - 1}]</div>
                  <div>BLOCK $\ge$ {p.blockThreshold}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Threshold Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Decision Threshold Calibration
          </h3>

          {/* ALLOW Threshold */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">ALLOW Threshold (&lt; this score passes):</span>
              <span className="text-emerald-400 font-bold">{policy.allowThreshold} / 100</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              value={policy.allowThreshold}
              onChange={(e) => {
                const val = Number(e.target.value);
                onUpdatePolicy({
                  ...policy,
                  allowThreshold: val,
                  blockThreshold: Math.max(val + 10, policy.blockThreshold),
                });
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Any prompt with score below this threshold is immediately forwarded to the model without human review.
            </p>
          </div>

          {/* BLOCK Threshold */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">BLOCK Threshold (&ge; this score drops):</span>
              <span className="text-rose-400 font-bold">{policy.blockThreshold} / 100</span>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              value={policy.blockThreshold}
              onChange={(e) => {
                const val = Number(e.target.value);
                onUpdatePolicy({
                  ...policy,
                  blockThreshold: val,
                  allowThreshold: Math.min(val - 10, policy.allowThreshold),
                });
              }}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Any prompt with score equal to or exceeding this threshold triggers an immediate HTTP 403 block.
            </p>
          </div>

          {/* Maximum prompt length */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">Max Prompt Character Limit:</span>
              <span className="text-cyan-400 font-bold">{policy.maxPromptLength} chars</span>
            </div>
            <input
              type="range"
              min={1000}
              max={16000}
              step={500}
              value={policy.maxPromptLength}
              onChange={(e) => onUpdatePolicy({ ...policy, maxPromptLength: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Category Enforcement Toggles */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Category Enforcement Rules
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer hover:bg-slate-900/40">
              <div>
                <div className="text-xs font-semibold text-white">Block on Critical Credentials</div>
                <div className="text-[11px] text-slate-400">AWS keys, OpenAI tokens, private keys trigger instant BLOCK</div>
              </div>
              <input
                type="checkbox"
                checked={policy.blockOnCriticalSecret}
                onChange={(e) => onUpdatePolicy({ ...policy, blockOnCriticalSecret: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer hover:bg-slate-900/40">
              <div>
                <div className="text-xs font-semibold text-white">Block on Confirmed Injection</div>
                <div className="text-[11px] text-slate-400">Direct instruction override or system prompt leak triggers BLOCK</div>
              </div>
              <input
                type="checkbox"
                checked={policy.blockOnConfirmedInjection}
                onChange={(e) => onUpdatePolicy({ ...policy, blockOnConfirmedInjection: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer hover:bg-slate-900/40">
              <div>
                <div className="text-xs font-semibold text-white">Block on Jailbreak Bypass</div>
                <div className="text-[11px] text-slate-400">DAN, Developer Mode, and adversarial personas trigger BLOCK</div>
              </div>
              <input
                type="checkbox"
                checked={policy.blockOnConfirmedJailbreak}
                onChange={(e) => onUpdatePolicy({ ...policy, blockOnConfirmedJailbreak: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer hover:bg-slate-900/40">
              <div>
                <div className="text-xs font-semibold text-white">Redact Credentials in Audit Logs</div>
                <div className="text-[11px] text-slate-400">Mask all API keys and passwords with &#x2022;&#x2022;&#x2022;&#x2022; masks in telemetry</div>
              </div>
              <input
                type="checkbox"
                checked={policy.redactSecretsInLogs}
                onChange={(e) => onUpdatePolicy({ ...policy, redactSecretsInLogs: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
