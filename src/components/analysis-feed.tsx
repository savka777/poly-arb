'use client';

import { useState } from 'react';
import type { Signal, ToolCallRecord } from '@/lib/types';
import { SignalBadge } from './signal-badge';

interface AnalysisFeedProps {
  signals: Signal[];
  toolCalls?: ToolCallRecord[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ToolCallEntry({ toolCall }: { toolCall: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-l-2 border-accent-blue pl-4 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-xs text-accent-blue">
          {expanded ? '▼' : '▶'}
        </span>
        <span className="text-sm font-medium text-text-primary">
          {toolCall.name}
        </span>
        <span className="text-xs text-text-muted ml-auto">
          {timeAgo(toolCall.timestamp)}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
              Input
            </p>
            <pre className="text-xs text-text-secondary bg-bg-elevated p-2 rounded-lg overflow-x-auto font-mono">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
              Output
            </p>
            <pre className="text-xs text-text-secondary bg-bg-elevated p-2 rounded-lg overflow-x-auto font-mono">
              {JSON.stringify(toolCall.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalEntry({ signal }: { signal: Signal }) {
  const borderColor =
    signal.direction === 'yes' ? 'border-accent-green' : 'border-accent-red';

  return (
    <div className={`border-l-2 ${borderColor} pl-4 py-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          Signal Generated
        </span>
        <span className="text-xs text-text-muted">
          {timeAgo(signal.createdAt)}
        </span>
      </div>
      <p className="text-sm text-text-secondary mb-3">{signal.reasoning}</p>
      {signal.newsEvents.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
            Key Sources
          </p>
          <ul className="space-y-1">
            {signal.newsEvents.map((event, i) => (
              <li key={i} className="text-xs text-text-secondary">
                • {event}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SignalBadge confidence={signal.confidence} />
    </div>
  );
}

export function AnalysisFeed({ signals, toolCalls }: AnalysisFeedProps) {
  if (signals.length === 0 && (!toolCalls || toolCalls.length === 0)) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No analysis data yet. Run an analysis to see results.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => (
        <SignalEntry key={signal.id} signal={signal} />
      ))}
      {toolCalls?.map((tc, i) => (
        <ToolCallEntry key={`${tc.name}-${i}`} toolCall={tc} />
      ))}
    </div>
  );
}
