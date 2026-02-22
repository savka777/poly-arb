import { z } from 'zod';
import { tracedGenerateObject } from '@/lib/braintrust';
import { nanoid } from 'nanoid';
import { model } from '@/lib/model';
import { config } from '@/lib/config';
import { searchNews, buildNewsQuery } from '@/data/valyu';
import { calculateNetEV, evToConfidence } from '@/intelligence/calculations';
import { saveSignal, updateSignalCommitment } from '@/store/signals';
import { commitSignal } from '@/solana/commitment';
import { logActivity } from '@/store/activity-log';
import type { EventPodStateType } from './state';
import type { Signal, ToolCallRecord } from '@/lib/types';

// ---------- Node 1: fetchNewsNode ----------

export async function fetchNewsNode(
  state: EventPodStateType,
): Promise<Partial<EventPodStateType>> {
  const startTime = new Date().toISOString();
  const query = buildNewsQuery(state.market.question);

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
    .map((n) => `[${n.source}] ${n.title}\n${n.content.slice(0, 600)}`)
    .join('\n\n');

  const currentDate = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are a calibrated probability analyst specializing in prediction markets. Your job is to estimate the true probability of events based on recent news evidence.

Calibration rules:
- Your estimates must be well-calibrated: when you say 0.70, the event should resolve YES roughly 70% of the time.
- Base your estimate ONLY on the news evidence provided. Do NOT anchor to any prior expectation.
- Consider the time horizon: news impact decays as the resolution date approaches.
- If the evidence is ambiguous or insufficient, reflect that uncertainty with a probability closer to 0.50.
- Always cite specific news events in your reasoning.
- Distinguish between events that are very likely (>0.85) vs certain (>0.95) — extreme probabilities require extraordinary evidence.`;

  const prompt = `Given the following prediction market question and recent news, estimate the probability that this question resolves YES.

Today's date: ${currentDate}
Question: ${state.market.question}

Market end date: ${state.market.endDate}

Recent News:
${newsContext}

Respond with:
- probability: a number between 0 and 1 representing your best estimate based ONLY on the news evidence
- reasoning: 2-3 sentences explaining your estimate, citing specific news
- confidence: "low", "medium", or "high" based on how much relevant evidence you found
- keyFactors: array of 2-4 key factors influencing your estimate`;

  try {
    const { object } = await tracedGenerateObject()({
      model,
      schema: probabilityEstimateSchema,
      system: systemPrompt,
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

  const evResult = calculateNetEV({
    llmEstimate: state.probabilityEstimate.probability,
    marketPrice: state.market.probability,
    endDate: state.market.endDate,
    liquidity: state.market.liquidity,
  });

  const toolCall: ToolCallRecord = {
    name: 'calculatePriceDivergence',
    input: {
      estimatedProbability: state.probabilityEstimate.probability,
      marketPrice: state.market.probability,
      endDate: state.market.endDate,
      liquidity: state.market.liquidity,
    },
    output: {
      pHat: evResult.pHat,
      evNet: evResult.evNet,
      evNetLB: evResult.evNetLB,
      costs: evResult.costs.total,
      tradeable: evResult.tradeable,
    },
    timestamp: startTime,
  };

  return {
    divergence: evResult,
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

  const evResult = state.divergence;
  const confidence = evToConfidence(evResult.evNet);

  const newsEvents = state.newsResults.map(
    (n) => `[${n.source}] ${n.title}`,
  );

  const signal: Signal = {
    id: nanoid(),
    marketId: state.market.id,
    marketQuestion: state.market.question,
    darwinEstimate: evResult.pHat,
    marketPrice: state.market.probability,
    ev: evResult.evNet,
    direction: evResult.direction,
    reasoning: state.probabilityEstimate.reasoning,
    newsEvents,
    confidence,
    createdAt: new Date().toISOString(),
    expiresAt: state.market.endDate,
    evNet: evResult.evNet,
    costs: evResult.costs,
    features: evResult.features,
    tradeable: evResult.tradeable,
    pHatLB: evResult.pHatLB,
  };

  try {
    saveSignal(signal);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`Failed to persist signal: ${errorMessage}`);
  }

  // Fire-and-forget Solana commitment — never blocks the pipeline
  if (config.solana.enabled) {
    commitSignal(signal).then((commitResult) => {
      if (commitResult.ok) {
        updateSignalCommitment(signal.id, {
          txSignature: commitResult.data.txSignature,
          hash: commitResult.data.hash,
          slot: commitResult.data.slot,
          marketPriceAtCommit: signal.marketPrice,
        });
        logActivity('orchestrator', 'info', `Committed signal ${signal.id} to Solana: ${commitResult.data.txSignature}`);
      } else {
        logActivity('orchestrator', 'error', `Solana commit failed for ${signal.id}: ${commitResult.error}`);
      }
    }).catch(() => {});
  }

  const toolCall: ToolCallRecord = {
    name: 'generateSignal',
    input: {
      marketId: state.market.id,
      evNet: evResult.evNet,
      evNetLB: evResult.evNetLB,
      direction: evResult.direction,
      tradeable: evResult.tradeable,
    },
    output: { signalId: signal.id, confidence, tradeable: evResult.tradeable },
    timestamp: startTime,
  };

  return {
    signal,
    toolCalls: [toolCall],
  };
}
