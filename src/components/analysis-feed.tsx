"use client"

import { useState } from "react"
import type { Signal, ToolCallRecord } from "@/lib/types"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/format"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"

type FeedEntry =
  | { type: "signal"; signal: Signal }
  | { type: "tool_call"; toolCall: ToolCallRecord }
  | { type: "user_query"; text: string; timestamp: string }
  | { type: "error"; message: string; timestamp: string }

interface AnalysisFeedProps {
  entries: FeedEntry[]
  analyzing?: boolean
}

export function AnalysisFeed({ entries, analyzing }: AnalysisFeedProps) {
  return (
    <div className="space-y-2">
      {analyzing && (
        <div className="flex items-center gap-2 rounded-sm border border-darwin-blue/30 bg-darwin-card p-3">
          <div className="h-2 w-2 rounded-full bg-darwin-blue animate-pulse" />
          <span className="text-sm text-darwin-blue">Analyzing market...</span>
        </div>
      )}
      {entries.map((entry, i) => (
        <FeedEntryItem key={i} entry={entry} />
      ))}
    </div>
  )
}

function FeedEntryItem({ entry }: { entry: FeedEntry }) {
  switch (entry.type) {
    case "signal":
      return <SignalEntry signal={entry.signal} />
    case "tool_call":
      return <ToolCallEntry toolCall={entry.toolCall} />
    case "user_query":
      return <UserQueryEntry text={entry.text} timestamp={entry.timestamp} />
    case "error":
      return <ErrorEntry message={entry.message} timestamp={entry.timestamp} />
  }
}

function SignalEntry({ signal }: { signal: Signal }) {
  const isBullish = signal.ev > 0

  return (
    <div
      className={cn(
        "rounded-sm border bg-darwin-card p-3 border-l-2",
        isBullish
          ? "border-l-darwin-green border-darwin-border"
          : "border-l-darwin-red border-darwin-border"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isBullish ? "bg-darwin-green" : "bg-darwin-red"
            )}
          />
          <span className="text-sm font-medium text-darwin-text">
            Signal Generated
          </span>
        </div>
        <span className="text-[11px] text-darwin-text-muted">
          {relativeTime(signal.createdAt)}
        </span>
      </div>
      <p className="text-sm text-darwin-text-secondary leading-relaxed">
        {signal.reasoning}
      </p>
      {signal.newsEvents.length > 0 && (
        <div className="mt-2 space-y-1">
          <span className="label-caps">Key factors</span>
          <ul className="space-y-0.5">
            {signal.newsEvents.map((event, i) => (
              <li
                key={i}
                className="text-xs text-darwin-text-secondary flex items-start gap-1.5"
              >
                <span className="text-darwin-text-muted mt-0.5">-</span>
                {event}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ToolCallEntry({ toolCall }: { toolCall: ToolCallRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-sm border border-darwin-border border-l-2 border-l-darwin-blue bg-darwin-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-darwin-blue transition-transform",
                open && "rotate-90"
              )}
            />
            <span className="font-data text-sm text-darwin-blue">
              {toolCall.name ?? toolCall.toolName}
            </span>
            {toolCall.durationMs != null && (
              <span className="text-[11px] text-darwin-text-muted">
                {toolCall.durationMs}ms
              </span>
            )}
          </div>
          <span className="text-[11px] text-darwin-text-muted">
            {relativeTime(toolCall.timestamp)}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-darwin-border px-3 py-2 space-y-2">
            <div>
              <span className="label-caps">Input</span>
              <pre className="font-data text-xs text-darwin-text-secondary mt-1 overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
            <div>
              <span className="label-caps">Output</span>
              <pre className="font-data text-xs text-darwin-text-secondary mt-1 overflow-x-auto">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function UserQueryEntry({
  text,
  timestamp,
}: {
  text: string
  timestamp: string
}) {
  return (
    <div className="rounded-sm bg-darwin-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-darwin-text-muted">You asked</span>
        <span className="text-[11px] text-darwin-text-muted">
          {relativeTime(timestamp)}
        </span>
      </div>
      <p className="text-sm text-darwin-text-secondary italic">{text}</p>
    </div>
  )
}

function ErrorEntry({
  message,
  timestamp,
}: {
  message: string
  timestamp: string
}) {
  return (
    <div className="rounded-sm border border-darwin-border border-l-2 border-l-darwin-red bg-darwin-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-darwin-red">Error</span>
        <span className="text-[11px] text-darwin-text-muted">
          {relativeTime(timestamp)}
        </span>
      </div>
      <p className="text-sm text-darwin-red/80">{message}</p>
    </div>
  )
}

export type { FeedEntry }
