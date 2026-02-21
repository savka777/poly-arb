# Darwin Capital — Development Log

## Frontend Integration Points
<!-- Updated after each phase with new endpoints, types, and function signatures -->
<!-- The Next.js frontend team should reference this section -->

### REST API Endpoints (Phase 6)

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| GET | `/api/health` | `{ status, uptime, lastCycle }` | System health check |
| GET | `/api/pods` | `PodState[]` | All pod configs + run stats |
| GET | `/api/pods/:id/performance` | `PodPerformance` | Win rate, PnL, avg EV for a pod |
| GET | `/api/portfolio` | `PortfolioSnapshot` | Current positions, cash, total value |
| GET | `/api/portfolio/pnl` | `{ realized, unrealized, total, drawdown }` | PnL breakdown |
| GET | `/api/trades` | `TradeProposal[]` | All trade proposals with status |
| GET | `/api/decisions` | `DecisionLogEntry[]` | Full decision audit trail |
| GET | `/api/decisions/:tradeId` | `DecisionLogEntry[]` | Decision lifecycle for one trade |

### Key Types for Frontend

- `Platform`: `'polymarket' | 'kalshi'`
- `Direction`: `'yes' | 'no'`
- `TradeStatus`: `'proposed' | 'approved' | 'rejected' | 'filled' | 'closed'`
- `PodType`: `'event' | 'arbitrage' | 'timeseries'`

## Build Log
<!-- Auto-appended after each phase gate passes -->
