import { StateGraph, END, START } from '@langchain/langgraph';
import type { Market, Signal, ToolCallRecord } from '@/lib/types';
import { EventPodState, type EventPodStateType } from './state';
import {
  fetchNewsNode,
  estimateProbabilityNode,
  calculateDivergenceNode,
  generateSignalNode,
} from './nodes';

function shouldContinueAfterNews(
  state: EventPodStateType,
): 'estimateProbability' | typeof END {
  if (state.error) return END;
  if (state.newsResults.length === 0) return END;
  return 'estimateProbability';
}

function shouldContinueAfterDivergence(
  state: EventPodStateType,
): 'generateSignal' | typeof END {
  if (!state.divergence) return END;
  if (!state.divergence.significant) return END;
  return 'generateSignal';
}

const workflow = new StateGraph(EventPodState)
  .addNode('fetchNews', fetchNewsNode)
  .addNode('estimateProbability', estimateProbabilityNode)
  .addNode('calculateDivergence', calculateDivergenceNode)
  .addNode('generateSignal', generateSignalNode)
  .addEdge(START, 'fetchNews')
  .addConditionalEdges('fetchNews', shouldContinueAfterNews, {
    estimateProbability: 'estimateProbability',
    [END]: END,
  })
  .addEdge('estimateProbability', 'calculateDivergence')
  .addConditionalEdges('calculateDivergence', shouldContinueAfterDivergence, {
    generateSignal: 'generateSignal',
    [END]: END,
  })
  .addEdge('generateSignal', END);

export const eventPodGraph = workflow.compile();

export async function runEventPod(market: Market): Promise<{
  signal: Signal | null;
  reasoning: string;
  toolCalls: ToolCallRecord[];
}> {
  const initialState = {
    market,
    newsResults: [],
    probabilityEstimate: null,
    divergence: null,
    signal: null,
    toolCalls: [],
    error: null,
  };

  const finalState = await eventPodGraph.invoke(initialState);

  const reasoning = finalState.probabilityEstimate?.reasoning
    ?? finalState.error
    ?? 'No analysis produced';

  return {
    signal: finalState.signal,
    reasoning,
    toolCalls: finalState.toolCalls,
  };
}
