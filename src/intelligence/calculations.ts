import type { Direction, CostBreakdown, EVResult } from '@/lib/types';
import { config } from '@/lib/config';

// ── Math primitives ──────────────────────────────────────────────

const EPS = 1e-6;

function clamp(p: number, eps = EPS): number {
  return Math.min(Math.max(p, eps), 1 - eps);
}

function logit(p: number): number {
  const cp = clamp(p);
  return Math.log(cp / (1 - cp));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ── Feature extraction ───────────────────────────────────────────

/** LLM's shift from market price, measured in log-odds space */
function newsFeature(llmEstimate: number, marketPrice: number): number {
  return logit(llmEstimate) - logit(marketPrice);
}

/** Opposes the news shift, scaled by proximity to expiry.
 *  Near expiry the market has had more time to incorporate info, so our edge shrinks.
 *  Returns -zNews * decay so the pull is always *toward* the market price
 *  regardless of whether the signal is bullish or bearish. */
function timeFeature(endDate: string, zNews: number): number {
  const msLeft = new Date(endDate).getTime() - Date.now();
  const daysLeft = Math.max(msLeft / 86_400_000, 0);
  const decay = 1 / (1 + daysLeft / 30);
  return -zNews * decay;
}

// ── Feature weights (configurable via env) ──────────────────────

const W_NEWS = config.ev.wNews;
const W_TIME = config.ev.wTime;

// ── Cost estimation ──────────────────────────────────────────────

export function estimateCosts(
  liquidity: number,
  endDate: string,
): CostBreakdown {
  const cFee = 0.02; // Polymarket ~2% on winnings

  // Slippage: lower liquidity → higher slippage
  let cSlip: number;
  if (liquidity < 10_000) cSlip = 0.03;
  else if (liquidity < 100_000) cSlip = 0.01;
  else cSlip = 0.005;

  // Resolution risk: closer to expiry → higher risk of early/odd resolution
  const msLeft = new Date(endDate).getTime() - Date.now();
  const daysLeft = Math.max(msLeft / 86_400_000, 0);
  let cRes: number;
  if (daysLeft < 1) cRes = 0.10;
  else if (daysLeft < 7) cRes = 0.03;
  else cRes = 0.01;

  const cLat = 0.005; // fixed latency cost

  return {
    fee: cFee,
    slippage: cSlip,
    latencyDecay: cLat,
    resolutionRisk: cRes,
    total: cFee + cSlip + cRes + cLat,
  };
}

// ── Core EV: logit-space probability construction ────────────────

export function calculateNetEV(params: {
  llmEstimate: number;
  marketPrice: number;
  endDate: string;
  liquidity: number;
}): EVResult {
  const { llmEstimate, marketPrice, endDate, liquidity } = params;

  // 1. Compute features
  const zNews = newsFeature(llmEstimate, marketPrice);
  const zTime = timeFeature(endDate, zNews);

  // 2. Combine in logit space
  const logitMarket = logit(marketPrice);
  const logitPHat = logitMarket + W_NEWS * zNews + W_TIME * zTime;
  const pHat = sigmoid(logitPHat);

  // 3. Confidence bound (conservative: halve the shift)
  const logitLB = logitMarket + 0.5 * (W_NEWS * zNews + W_TIME * zTime);
  const pHatLB = sigmoid(logitLB);

  // 4. Costs
  const costs = estimateCosts(liquidity, endDate);

  // 5. Direction
  const direction: Direction = pHat >= marketPrice ? 'yes' : 'no';

  // 6. Net EV
  const evGross = pHat - marketPrice;
  const evNet = evGross - costs.total;
  const evNetLB = (pHatLB - marketPrice) - costs.total;

  // 7. Tradeable: lower-bound EV positive after costs
  const tradeable = evNetLB > 0;

  return {
    pHat,
    pHatLB,
    evGross,
    evNet,
    evNetLB,
    direction,
    costs,
    features: { zNews, zTime },
    tradeable,
  };
}

export function evToConfidence(ev: number): 'low' | 'medium' | 'high' {
  const absEv = Math.abs(ev);
  if (absEv >= 0.15) return 'high';
  if (absEv >= 0.08) return 'medium';
  return 'low';
}

// ── Kelly sizing (for future use / display) ──────────────────────

export function kellyFraction(
  pHat: number,
  pExecution: number,
  lambda = 0.5,
): number {
  const edge = pHat - pExecution;
  const fullKelly = edge / (1 - pExecution);
  const fraction = lambda * Math.max(fullKelly, 0);
  return Math.min(fraction, 1); // never more than 100%
}
