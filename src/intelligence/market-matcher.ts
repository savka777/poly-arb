import { z } from 'zod';
import { tracedGenerateObject } from '@/lib/braintrust';
import { model } from '@/lib/model';
import type { NewsResult, Market } from '@/lib/types';

const matchSchema = z.object({
  matches: z.array(
    z.object({
      marketId: z.string(),
      relevance: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    }),
  ),
});

const BATCH_SIZE = 50;

export async function matchNewsToMarkets(
  article: NewsResult,
  markets: Market[],
): Promise<Array<{ marketId: string; relevance: 'high' | 'medium' | 'low'; reasoning: string }>> {
  if (markets.length === 0) return [];

  const batches: Market[][] = [];
  for (let i = 0; i < markets.length; i += BATCH_SIZE) {
    batches.push(markets.slice(i, i + BATCH_SIZE));
  }

  const allMatches: Array<{ marketId: string; relevance: 'high' | 'medium' | 'low'; reasoning: string }> = [];

  for (const batch of batches) {
    const marketList = batch
      .map((m) => `- ${m.id}: ${m.question}`)
      .join('\n');

    const prompt = `You are matching a news article to prediction markets. Determine which markets are directly affected by this news.

NEWS ARTICLE:
Title: ${article.title}
Source: ${article.source}
Content: ${article.content.slice(0, 2000)}

ACTIVE MARKETS:
${marketList}

Return only markets where this news article provides material information that could shift the market probability. Do NOT match markets that are only tangentially related.

For each match, provide:
- marketId: the exact market ID from the list
- relevance: "high" if the news directly determines or strongly influences the outcome, "medium" if it provides useful context
- reasoning: brief explanation of why this news affects this market`;

    try {
      const { object } = await tracedGenerateObject()({
        model,
        schema: matchSchema,
        prompt,
      });

      const filtered = object.matches.filter(
        (m) => m.relevance === 'high' || m.relevance === 'medium',
      );
      allMatches.push(...filtered);
    } catch (e) {
      console.error(
        '[market-matcher] LLM matching failed:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return allMatches;
}
