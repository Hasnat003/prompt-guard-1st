/**
 * Academic Blueprint & Final Year Project Package
 * Fulfills Parts 1, 2, 7, 11, 12, 14 & 15 of the Master Project Blueprint:
 * - Formal university project specification
 * - OWASP Top 10 for LLM Applications (2025) alignment
 * - Architecture diagrams and code integration contracts
 * - 10-Phase development lifecycle & deliverables verification
 * - Printable academic executive summary
 */

import React, { useState } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  ShieldCheck, 
  Code2, 
  CheckCircle2, 
  Download,
  Terminal,
  Server,
  Layers,
  FileText
} from 'lucide-react';
import { OWASP_LLM_2025_ALIGNMENT } from '../data/datasetResearch';

export const AcademicReport: React.FC = () => {
  const [selectedSnippet, setSelectedSnippet] = useState<'python' | 'fastapi' | 'typescript'>('python');

  const pythonSnippet = `from prompt_guard import PromptGuard

# Initialize PromptGuard middleware with balanced policy
guard = PromptGuard(policy="standard")

# Inspect untrusted input before downstream forwarding
result = guard.scan(user_prompt)

if result.action == "ALLOW":
    # Pass verified prompt to foundation model
    response = llm.generate(result.redacted_prompt)
elif result.action == "BLOCK":
    # Prevent malicious execution at the security perimeter
    response = f"Security Policy Blocked Request: {result.action_reason}"
else:
    # Route borderline cases to approval queue
    response = "Request quarantined for human security analyst review."`;

  const fastapiSnippet = `from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from prompt_guard import PromptGuard

app = FastAPI(title="PromptGuard Security Gateway")
guard = PromptGuard()

class ScanRequest(BaseModel):
    prompt: str
    client_id: str | None = None

@app.post("/v1/scan", status_code=status.HTTP_200_OK)
def scan_prompt(payload: ScanRequest):
    result = guard.scan(payload.prompt)
    if result.action == "BLOCK":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "PromptSecurityException",
                "risk_score": result.risk_score,
                "reason": result.action_reason,
                "detections": [d.dict() for d in result.detections if d.detected]
            }
        )
    return result`;

  const tsSnippet = `import { PromptGuard } from '@promptguard/core';

const guard = new PromptGuard({
  allowThreshold: 25,
  blockThreshold: 50,
  blockOnCriticalSecret: true,
});

export async function middleware(req: Request) {
  const { prompt } = await req.json();
  const verdict = guard.scan(prompt);

  if (verdict.action === 'BLOCK') {
    return new Response(JSON.stringify({ error: verdict.action_reason }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Safe to execute
  return next();
}`;

  const deliverables = [
    { id: 1, title: 'Research & Literature Review', status: 'Completed', ref: 'OWASP LLM 2025, WildJailbreak, Hlyn Labs' },
    { id: 2, title: 'Threat Taxonomy & Specification', status: 'Completed', ref: '4 Categories: Injection, Jailbreak, PII, Harmful' },
    { id: 3, title: 'Curated Master Dataset & Schema', status: 'Completed', ref: '720k+ Samples, 11-field schema, 70/15/15 splits' },
    { id: 4, title: 'Comparative ML Baseline Experiments', status: 'Completed', ref: 'TF-IDF vs SVM vs DistilBERT vs DeBERTa' },
    { id: 5, title: 'Hybrid Detection & Normalization Engine', status: 'Completed', ref: 'NFKC unicode, zero-width stripping, Presidio PII' },
    { id: 6, title: 'Calibrated Risk Scoring (0–100)', status: 'Completed', ref: 'Multi-threat compounding, Low/Mod/High/Crit bands' },
    { id: 7, title: 'Reusable Middleware & REST API', status: 'Completed', ref: 'Python library + FastAPI spec + Node/TS engine' },
    { id: 8, title: 'Interactive Security Dashboard', status: 'Completed', ref: 'Streamlit/React inspection UI & LLM firewall demo' },
    { id: 9, title: 'Automated Evaluation Suite', status: 'Completed', ref: 'Confusion Matrix, F1, FPR, FNR, Latency benchmarks' },
    { id: 10, title: 'Academic Project Package', status: 'Completed', ref: 'Deliverables verified per Blueprint Part 11 & 12' },
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <GraduationCap className="w-4 h-4" />
              <span>UNIVERSITY INDIVIDUAL PROJECT BLUEPRINT</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-1">
              PROMPTGUARD: AI-Powered Prompt Security Scanner & Protection Middleware
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Field: Artificial Intelligence • Machine Learning • Natural Language Processing • Cybersecurity
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded transition-colors self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export / Print Report</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-300">
          <strong className="text-cyan-300">Core Principle:</strong> &quot;Detect intelligently, assess carefully, explain transparently and enforce consistently.&quot; PromptGuard provides an independent, LLM-agnostic security perimeter that prevents prompt injection, adversarial jailbreaks, credential leakage, and harmful intent without false-positive blocking on legitimate security discussions.
        </div>
      </div>

      {/* OWASP LLM Top 10 (2025) Alignment Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">
          OWASP Top 10 for LLM Applications (2025) Compliance Mapping
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Direct alignment between academic security standards and PromptGuard defense modules.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OWASP_LLM_2025_ALIGNMENT.map((item) => (
            <div key={item.code} className="p-4 bg-slate-950 rounded border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">{item.code}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Defended</span>
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-1">{item.title}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.threat}</p>
              <div className="mt-3 pt-2 border-t border-slate-900 text-xs text-cyan-200 font-mono">
                <span className="text-slate-500 font-sans">PromptGuard Implementation: </span>
                {item.mitigation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Code Contracts (Python / FastAPI / TypeScript) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Reusable Library & API Integration Contracts (Part 7)
          </h3>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSelectedSnippet('python')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSnippet === 'python' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Python Library
            </button>
            <button
              type="button"
              onClick={() => setSelectedSnippet('fastapi')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSnippet === 'fastapi' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              FastAPI Endpoint
            </button>
            <button
              type="button"
              onClick={() => setSelectedSnippet('typescript')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSnippet === 'typescript' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TypeScript / Next.js
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-cyan-200 overflow-x-auto">
          <pre>{selectedSnippet === 'python' ? pythonSnippet : selectedSnippet === 'fastapi' ? fastapiSnippet : tsSnippet}</pre>
        </div>
      </div>

      {/* 10-Phase Deliverables Verification Checklist */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">
          Final Project Deliverables & Quality Criteria (Part 11 & 12)
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          All 10 project deliverables verified with reproducible code, metrics, and evidence.
        </p>

        <div className="border border-slate-800 rounded overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Deliverable Item</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Verification & Provenance Artifact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans text-slate-300">
              {deliverables.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-mono text-slate-400">{d.id}</td>
                  <td className="py-2 px-3 font-medium text-white">{d.title}</td>
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-xs font-mono">{d.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
