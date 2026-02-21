'use client';

import { useState } from 'react';
import type { AnalyzeResponse } from '@/lib/types';
import { useAnalysis } from '@/hooks/use-analysis';

interface QueryInterfaceProps {
  marketId: string;
  onAnalysisComplete?: (response: AnalyzeResponse) => void;
}

export function QueryInterface({
  marketId,
  onAnalysisComplete,
}: QueryInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const analysis = useAnalysis();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analysis.mutate(marketId, {
      onSuccess: (data) => {
        onAnalysisComplete?.(data);
        setInputValue('');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Ask Darwin about this market..."
        className="flex-1 bg-bg-elevated border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue transition-colors"
        disabled={analysis.isPending}
      />
      <button
        type="submit"
        disabled={analysis.isPending}
        className="px-5 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {analysis.isPending ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing
          </span>
        ) : (
          'Analyze'
        )}
      </button>
    </form>
  );
}
