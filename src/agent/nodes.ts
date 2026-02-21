import { z } from 'zod';
import { generateObject } from 'ai';
import { nanoid } from 'nanoid';
import { model } from '@/lib/model';
import { config } from '@/lib/config';
import { searchNews } from '@/data/valyu';
import { calculateEV, evToConfidence } from '@/agent/tools';
import { saveSignal } from '@/store/signals';
import type { EventPodStateType } from './state';
import type { Signal, ToolCallRecord } from '@/lib/types';

// ---------- Node 1: fetchNewsNode ----------

export async function fetchNewsNode(
  state: EventPodStateType,
): Promise<Partial<EventPodStateType>> {
  const startTime = new Date().toISOString();
  const query = state.market.question;

  const result = await searchNews(query, 5);

  const toolCall: ToolCallRecord = {
    name: 'fetchRecentNews',
    input: { query, maxResults: 5 },
    output: result.ok ? { count: result.data.length } : { error: result.error },
    timestamp: startTime,
  };

  if (!result.ok) {
    return {
      error: `News fetch failed: ${result.error}`,
      toolCalls: [toolCall],
    };
  }

  if (result.data.length === 0) {
    return {
      error: 'No news results found for this market',
      newsResults: [],
      toolCalls: [toolCall],
    };
  }

  return {
    newsResults: result.data,
    toolCalls: [toolCall],
  };
}

// ---------- Node 2: estimateProbabilityNode ----------

const probabilityEstimateSchema = z.object({
  probability: z.number().min(0).max(1),
  reasoning: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  keyFactors: z.array(z.string()).min(1).max(5),
});

export async function estimateProbabilityNode(
  state: EventPodStateType,
): Promise<Partial<EventPodStateType>> {
  const startTime = new Date().toISOString();

  const newsContext = state.newsResults
    .map((n) => `[${n.source}] ${n.title}\n${n.content}`)
    .join('\n\n');

  const currentDate = new Date().toISOString().split('T')[0];

  const prompt = `Given the following prediction market question and recent news, estimate the probability that this question resolves YES.

Today's date: ${currentDate}
Question: ${state.market.question}

Current market price: ${(state.market.probability * 100).toFixed(1)}%
Market end date: ${state.market.endDate}

Recent News:
${newsContext}

Respond with:
- probability: a number between 0 and 1 representing your best estimate
- reasoning: 2-3 sentences explaining your estimate
- confidence: "low", "medium", or "high" based on how much relevant evidence you found
- keyFactors: array of 2-4 key factors influencing your estimate

Rules:
- Be calibrated: a 0.70 estimate means you'd be wrong 30% of the time
- Consider the market's end date - news impact decays as resolution approaches
- Always cite specific news events in your reasoning
- If news is ambiguous, stay close to the market price`;

  try {
    const { object } = await generateObject({
      model,
      schema: probabilityEstimateSchema,
      prompt,
    });

    const toolCall: ToolCallRecord = {
      name: 'estimateEventProbability',
      input: { question: state.market.question, newsCount: state.newsResults.length },
      output: object,
      timestamp: startTime,
    };

    return {
      probabilityEstimate: object,
      toolCalls: [toolCall],
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);

    const toolCall: ToolCallRecord = {
      name: 'estimateEventProbability',
      input: { question: state.market.question, newsCount: state.newsResults.length },
      output: { error: errorMessage },
      timestamp: startTime,
    };

    return {
      error: `Probability estimation failed: ${errorMessage}`,
      toolCalls: [toolCall],
    };
  }
}

// ---------- Node 3: calculateDivergenceNode ----------

export async function calculateDivergenceNode(
  state: EventPodStateType,
): Promise<Partial<EventPodStateType>> {
  const startTime = new Date().toISOString();

  // Skip EV calculation if the 'ev' strategy is not enabled
  if (!config.strategies.enabled.includes('ev')) {
    return {
      toolCalls: [{
        name: 'calculatePriceDivergence',
        input: { strategy: 'ev', enabled: false },
        output: { skipped: 'ev strategy not enabled' },
        timestamp: startTime,
      }],
    };
  }

  if (!state.probabilityEstimate) {
    return {
      error: 'No probability estimate available for divergence calculation',
      toolCalls: [{
        name: 'calculatePriceDivergence',
        input: { estimatedProbability: null, marketPrice: state.market.probability },
        output: { error: 'No probability estimate' },
        timestamp: startTime,
      }],
    };
  }

  const { ev, direction } = calculateEV(
    state.probabilityEstimate.probability,
    state.market.probability,
  );

  const significant = Math.abs(ev) >= config.evThreshold;

  const divergenceResult = {
    value: ev,
    direction,
    significant,
  };

  const toolCall: ToolCallRecord = {
    name: 'calculatePriceDivergence',
    input: {
      estimatedProbability: state.probabilityEstimate.probability,
      marketPrice: state.market.probability,
    },
    output: divergenceResult,
    timestamp: startTime,
  };

  return {
    divergence: divergenceResult,
    toolCalls: [toolCall],
  };
}

// ---------- Node 4: generateSignalNode ----------

export async function generateSignalNode(
  state: EventPodStateType,
): Promise<Partial<EventPodStateType>> {
  const startTime = new Date().toISOString();

  if (!state.divergence || !state.probabilityEstimate) {
    return {
      error: 'Missing divergence or probability estimate for signal generation',
      toolCalls: [{
        name: 'generateSignal',
        input: { divergence: state.divergence, estimate: state.probabilityEstimate },
        output: { error: 'Missing required data' },
        timestamp: startTime,
      }],
    };
  }

  const confidence = evToConfidence(state.divergence.value);

  const newsEvents = state.newsResults.map(
    (n) => `[${n.source}] ${n.title}`,
  );

  const signal: Signal = {
    id: nanoid(),
    marketId: state.market.id,
    marketQuestion: state.market.question,
    darwinEstimate: state.probabilityEstimate.probability,
    marketPrice: state.market.probability,
    ev: state.divergence.value,
    direction: state.divergence.direction,
    reasoning: state.probabilityEstimate.reasoning,
    newsEvents,
    confidence,
    createdAt: new Date().toISOString(),
    expiresAt: state.market.endDate,
  };

  try {
    saveSignal(signal);
  } catch (e) {
    // Log but don't fail the node if persistence fails
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`Failed to persist signal: ${errorMessage}`);
  }

  const toolCall: ToolCallRecord = {
    name: 'generateSignal',
    input: {
      marketId: state.market.id,
      ev: state.divergence.value,
      direction: state.divergence.direction,
    },
    output: { signalId: signal.id, confidence },
    timestamp: startTime,
  };

  return {
    signal,
    toolCalls: [toolCall],
  };
}
