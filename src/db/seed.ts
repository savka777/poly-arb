import { saveSignal } from '../store/signals';
import type { Signal } from '../lib/types';
import { nanoid } from 'nanoid';

const now = Date.now();

const seedSignals: Signal[] = [
  {
    id: nanoid(),
    marketId: 'mock-fed-rate',
    marketQuestion: 'Will the Fed cut rates in March 2026?',
    darwinEstimate: 0.58,
    marketPrice: 0.42,
    ev: 0.16,
    direction: 'yes',
    reasoning:
      'Multiple Federal Reserve officials have signaled openness to a rate adjustment in upcoming meetings. Recent CPI data showing continued disinflation supports the case for a cut. Markets appear to be underpricing the probability based on the latest FOMC minutes.',
    newsEvents: [
      'Fed officials signal potential rate adjustment - Reuters',
      'CPI data shows continued disinflation trend - Bloomberg',
      'FOMC minutes reveal dovish shift - WSJ',
    ],
    confidence: 'high',
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    expiresAt: '2026-03-19T00:00:00Z',
  },
  {
    id: nanoid(),
    marketId: 'mock-france-pm',
    marketQuestion: 'Will the French PM face a no-confidence vote before April 2026?',
    darwinEstimate: 0.65,
    marketPrice: 0.48,
    ev: 0.17,
    direction: 'yes',
    reasoning:
      'Opposition coalition has publicly committed to filing a no-confidence motion following the controversial pension reform announcement. Three major parties have confirmed they will support the motion, crossing the required threshold.',
    newsEvents: [
      'French opposition coalition announces no-confidence motion plans - Le Monde',
      'Three parties confirm support for no-confidence vote - AFP',
    ],
    confidence: 'high',
    createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    expiresAt: '2026-04-01T00:00:00Z',
  },
  {
    id: nanoid(),
    marketId: 'mock-uk-election',
    marketQuestion: 'Will the UK call a snap election before July 2026?',
    darwinEstimate: 0.22,
    marketPrice: 0.31,
    ev: -0.09,
    direction: 'no',
    reasoning:
      'Despite speculation, the PM has repeatedly ruled out a snap election. Internal polling suggests the governing party would lose seats. No constitutional trigger exists for a forced election at this time.',
    newsEvents: [
      'PM rules out snap election in parliamentary address - BBC',
      'Internal polling shows governing party trailing - The Guardian',
    ],
    confidence: 'medium',
    createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    expiresAt: '2026-07-01T00:00:00Z',
  },
  {
    id: nanoid(),
    marketId: 'mock-ai-regulation',
    marketQuestion: 'Will the EU AI Act enforcement begin before June 2026?',
    darwinEstimate: 0.78,
    marketPrice: 0.65,
    ev: 0.13,
    direction: 'yes',
    reasoning:
      'EU Commission has accelerated the enforcement timeline. Multiple member states have already established their national AI authorities. The regulatory infrastructure appears ready ahead of the original schedule.',
    newsEvents: [
      'EU Commission accelerates AI Act enforcement timeline - Euronews',
      'National AI authorities established in 15 member states - Politico EU',
      'AI Act compliance deadline moved forward - TechCrunch',
    ],
    confidence: 'medium',
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(), // 30 min ago
    expiresAt: '2026-06-01T00:00:00Z',
  },
];

console.log('Seeding database with demo signals...');

for (const signal of seedSignals) {
  saveSignal(signal);
  console.log(`  Saved: ${signal.marketQuestion} (EV: ${signal.ev > 0 ? '+' : ''}${signal.ev.toFixed(2)})`);
}

console.log(`\nSeeded ${seedSignals.length} signals successfully.`);
