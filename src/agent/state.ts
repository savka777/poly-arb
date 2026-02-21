import { Annotation } from '@langchain/langgraph';
import type { Market, NewsResult, Signal, Direction, ToolCallRecord } from '@/lib/types';

export const EventPodState = Annotation.Root({
  market: Annotation<Market>,
  newsResults: Annotation<NewsResult[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),
  probabilityEstimate: Annotation<{
    probability: number;
    reasoning: string;
    confidence: 'low' | 'medium' | 'high';
    keyFactors: string[];
  } | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  divergence: Annotation<{
    value: number;
    direction: Direction;
    significant: boolean;
  } | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  signal: Annotation<Signal | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  toolCalls: Annotation<ToolCallRecord[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),
  error: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
});

export type EventPodStateType = typeof EventPodState.State;
