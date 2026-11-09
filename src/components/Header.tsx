/**
 * Header Component - Conforms to Universal Design Top Bar Contract
 * Zone 1: Single-element brand mark
 * Zone 2: Concise navigation links
 * Zone 3: 1 primary action button
 */

import React from 'react';
import { Shield, Play } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onQuickDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onQuickDemo }) => {
  const navItems = [
    { id: 'colab_submission', label: 'Colab & Submission ZIP' },
    { id: 'presentation_slides', label: 'Presentation Deck (8 Slides)' },
    { id: 'scanner', label: 'Live Scanner' },
    { id: 'firewall', label: 'LLM Middleware' },
    { id: 'python_hub', label: 'Python & AI Integrations' },
    { id: 'dataset_ml', label: 'Dataset & ML Results' },
    { id: 'benchmarks', label: 'Benchmark Suite' },
    { id: 'policy', label: 'Security Policy' },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            PromptGuard
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onQuickDemo}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors shadow-sm whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Load Part 13 Attack</span>
          </button>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="lg:hidden border-t border-slate-800/60 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
              activeTab === item.id
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
