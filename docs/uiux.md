# Darwin Capital — UI/UX Specification

> Design spec for the hackathon frontend. Two pages, dark theme, financial terminal aesthetic.

---

## Design Principles

1. **Dark theme** — financial terminal aesthetic, easy on the eyes during long sessions
2. **Information density** — show as much relevant data as possible without clutter
3. **Color = signal** — green = bullish (underpriced), red = bearish (overpriced)
4. **Desktop-first** — responsive is P2, optimize for 1200px+ screens
5. **Polling, not push** — React Query polls API routes on interval, no WebSocket complexity

---

## Design Tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#0A0A0F` | Page background |
| `bg-card` | `#12121A` | Card / panel background |
| `bg-hover` | `#1A1A26` | Hover state on cards |
| `bg-elevated` | `#222233` | Modal / dropdown background |
| `text-primary` | `#E8E8ED` | Primary text |
| `text-secondary` | `#8888A0` | Secondary / label text |
| `text-muted` | `#555566` | Disabled / placeholder text |
| `green` | `#00D47E` | Bullish / positive EV / underpriced |
| `red` | `#FF4444` | Bearish / negative EV / overpriced |
| `blue` | `#4488FF` | Links / tool call indicators |
| `warning` | `#FFAA00` | Warnings / medium confidence |
| `border` | `#2A2A3A` | Card borders, dividers |

### Typography

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| UI text | Inter | 400/500/600 | 14px base |
| Data / numbers | JetBrains Mono | 400/500 | 14px |
| Headings | Inter | 600 | 18-24px |
| Small labels | Inter | 500 | 12px |

### Spacing Scale

`4px` / `8px` / `12px` / `16px` / `24px` / `32px`

### Border Radius

- Cards: `12px`
- Buttons: `8px`
- Badges: `6px`
- Alpha bar: `4px`

---

## Alpha Bar Component

The signature visual element. Shows the divergence between Darwin's estimate and the market price.

### Logic

```
divergence = darwinEstimate - marketPrice

if divergence > 0  → green bar (bullish, market underpriced)
if divergence < 0  → red bar (bearish, market overpriced)
if |divergence| < 0.02 → hidden (no meaningful signal)

barWidth = min(|divergence| / 0.20, 1.0) × 100%
  → 20% divergence = full bar
  → 5% divergence = 25% bar
```

### Interface

```typescript
interface AlphaBarProps {
  darwinEstimate: number   // 0-1
  marketPrice: number      // 0-1
  showLabel?: boolean      // show "+5.2%" text, default true
  size?: 'sm' | 'md'       // height: sm=4px, md=8px
}
```

### Visual

```
Bullish (darwinEstimate > marketPrice):

  Market: 0.45  Darwin: 0.62  EV: +0.17

  ┌──────────────────────────────────────────────────┐
  │  ████████████████████████████████████░░░░░░░░░░░ │  85% width, green
  │                                     +17.0%       │
  └──────────────────────────────────────────────────┘

Bearish (darwinEstimate < marketPrice):

  Market: 0.72  Darwin: 0.55  EV: -0.17

  ┌──────────────────────────────────────────────────┐
  │  ████████████████████████████████████░░░░░░░░░░░ │  85% width, red
  │                                     -17.0%       │
  └──────────────────────────────────────────────────┘

Neutral (|divergence| < 0.02):

  (hidden — no bar rendered)
```

### States

- **Bullish:** green fill, left-to-right
- **Bearish:** red fill, left-to-right
- **Neutral:** hidden entirely
- **Loading:** gray pulsing bar (skeleton animation)

---

## Page 1: Market Grid

The main dashboard. Shows all markets with active signals.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  DARWIN CAPITAL                              ● Scanning (2m ago)   │
├─────────────────────────────────────────────────────────────────────┤
│  Active Signals: 12    Markets Scanned: 847    High-EV: 3          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────┐│
│  │ Will X win the       │  │ Fed rate cut in      │  │ France PM  ││
│  │ election?            │  │ March?               │  │ resign?    ││
│  │                      │  │                      │  │            ││
│  │ POLYMARKET           │  │ POLYMARKET           │  │ POLYMARKET ││
│  │                      │  │                      │  │            ││
│  │ Market  0.45         │  │ Market  0.72         │  │ Market 0.31││
│  │ Darwin  0.62         │  │ Darwin  0.55         │  │ Darwin 0.48││
│  │ EV     +0.17         │  │ EV     -0.17         │  │ EV   +0.17 ││
│  │                      │  │                      │  │            ││
│  │ ████████████ +17.0%  │  │ ████████████ -17.0%  │  │ ████ +17%  ││
│  │ (green)              │  │ (red)                │  │ (green)    ││
│  │                      │  │                      │  │            ││
│  │ ◉ High   2 min ago   │  │ ◉ Medium  5 min ago  │  │ ◉ High     ││
│  └──────────────────────┘  └──────────────────────┘  └────────────┘│
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────┐│
│  │ ...                  │  │ ...                  │  │ ...        ││
│  └──────────────────────┘  └──────────────────────┘  └────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
MarketGrid (page.tsx)
├── Header
│   └── ScanStatus (last scan time, active/idle indicator)
├── StatsBar
│   ├── StatItem (active signals count)
│   ├── StatItem (markets scanned)
│   └── StatItem (high-EV count)
└── MarketCardGrid
    └── MarketCard (repeated)
        ├── CardHeader (question, platform badge)
        ├── CardBody
        │   ├── PriceRow (market price, darwin estimate, EV)
        │   └── AlphaBar
        └── CardFooter (confidence badge, timestamp)
```

### Card Content

Each `MarketCard` displays:

| Element | Source | Format |
|---------|--------|--------|
| Question | `market.question` | Truncate at 80 chars |
| Platform | `market.platform` | Badge: "POLYMARKET" |
| Market Price | `market.probability` | 2 decimal places, JetBrains Mono |
| Darwin Estimate | `signal.darwinEstimate` | 2 decimal places, JetBrains Mono |
| EV | `signal.ev` | +/- prefix, green/red color |
| Alpha Bar | computed | See Alpha Bar spec above |
| Confidence | `signal.confidence` | Badge: green=high, yellow=medium, gray=low |
| Timestamp | `signal.createdAt` | Relative: "2 min ago" |

### Sorting

Default sort: `|signal.ev|` descending (highest divergence first)

### Responsive Breakpoints (P2)

- `> 1200px`: 3 columns
- `768px - 1200px`: 2 columns
- `< 768px`: 1 column

---

## Page 2: Market Detail

Deep dive into a single market with analysis feed.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Markets                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Will X win the 2026 election?                                      │
│  POLYMARKET  ·  Ends Mar 15, 2026  ·  Vol $2.4M  ·  Liq $890K     │
├────────────────────────────────┬────────────────────────────────────┤
│                                │                                    │
│  MARKET PRICE                  │  ANALYSIS FEED                     │
│  ┌──────────────────────────┐  │                                    │
│  │                          │  │  ┌────────────────────────────────┐│
│  │  0.45                    │  │  │ ● Signal Generated       2m   ││
│  │  Current market price    │  │  │                               ││
│  │                          │  │  │ Darwin estimates 62%          ││
│  └──────────────────────────┘  │  │ probability, market shows     ││
│                                │  │ 45%. EV: +0.17                ││
│  DARWIN ESTIMATE               │  │                               ││
│  ┌──────────────────────────┐  │  │ Key factors:                  ││
│  │                          │  │  │ - Recent poll showing...      ││
│  │  0.62                    │  │  │ - Endorsement from...         ││
│  │  +17.0% divergence       │  │  │                               ││
│  │  ████████████████ green  │  │  │ Confidence: ◉ High            ││
│  │                          │  │  └────────────────────────────────┘│
│  └──────────────────────────┘  │                                    │
│                                │  ┌────────────────────────────────┐│
│  SIGNAL DETAILS                │  │ ▶ fetchRecentNews        2m   ││
│  ┌──────────────────────────┐  │  │   query: "X election 2026"    ││
│  │  Direction: YES          │  │  │   (click to expand)           ││
│  │  EV: +0.17               │  │  └────────────────────────────────┘│
│  │  Confidence: High        │  │                                    │
│  │  News events: 3          │  │  ┌────────────────────────────────┐│
│  │  Created: 2 min ago      │  │  │ ▶ estimateEventProb      2m   ││
│  └──────────────────────────┘  │  │   probability: 0.62           ││
│                                │  │   (click to expand)           ││
│                                │  └────────────────────────────────┘│
│                                │                                    │
├────────────────────────────────┴────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ [Analyze]│
│  │  Ask Darwin about this market...                       │          │
│  └────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
MarketDetail (markets/[id]/page.tsx)
├── BackButton
├── MarketHeader
│   ├── Question (h1)
│   └── MetaRow (platform badge, end date, volume, liquidity)
├── DetailLayout (two-column at lg+, single-column below)
│   ├── LeftPanel
│   │   ├── PriceDisplay (market price, large)
│   │   ├── EstimateDisplay (darwin estimate, alpha bar)
│   │   └── SignalDetails (direction, EV, confidence, news count, timestamp)
│   └── RightPanel
│       └── AnalysisFeed
│           └── FeedEntry (repeated)
│               ├── SignalEntry (green/red left border)
│               └── ToolCallEntry (blue left border, collapsible)
└── QueryInterface
    ├── TextInput
    └── AnalyzeButton
```

### Analysis Feed Entry Types

| Type | Border Color | Content | Interaction |
|------|-------------|---------|-------------|
| Signal | green (bullish) / red (bearish) | Reasoning, key factors, confidence | Static |
| Tool Call | blue | Tool name, input summary, output summary | Click to expand/collapse |
| Error | red | Error message | Static |
| User Query | none | Query text | Static |

### Responsive

- `>= 1024px (lg)`: two-column layout (left: prices + signal, right: analysis feed)
- `< 1024px`: single column, signal details above analysis feed

---

## Component States

### MarketCard

| State | Visual |
|-------|--------|
| With signal | Full card: prices, alpha bar, confidence badge |
| No signal | Dimmed: market price only, no alpha bar, "No signal" text |
| Loading | Skeleton: gray pulsing blocks for each content area |
| Error | Red border, error message |

### AlphaBar

| State | Visual |
|-------|--------|
| Bullish | Green fill bar, "+X.X%" label |
| Bearish | Red fill bar, "-X.X%" label |
| Neutral | Hidden entirely (|divergence| < 0.02) |
| Loading | Gray pulsing bar, no label |

### AnalysisFeed Entry

| State | Visual |
|-------|--------|
| Signal (bullish) | Green left border, full reasoning |
| Signal (bearish) | Red left border, full reasoning |
| Tool call (collapsed) | Blue left border, tool name + "click to expand" |
| Tool call (expanded) | Blue left border, full input/output JSON |
| Error | Red left border, red text |
| User query | No border, italic text |

---

## Key Interactions

| Element | Action | Result |
|---------|--------|--------|
| MarketCard | Click | Navigate to `/markets/[id]` |
| MarketCard | Hover | `bg-card` -> `bg-hover`, subtle elevation |
| AlphaBar | Hover | Tooltip: "Darwin: 0.62 / Market: 0.45 / EV: +0.17" |
| ToolCallEntry | Click | Toggle expand/collapse, show full input/output |
| QueryInterface | Enter / click Analyze | POST to `/api/analyze`, show loading, append result to feed |
| BackButton | Click | Navigate to `/` (grid) |
| ConfidenceBadge | — | Static, color-coded (green/yellow/gray) |

---

## Tailwind Configuration

```javascript
// tailwind.config.js (relevant tokens)
{
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0F',
        'bg-card': '#12121A',
        'bg-hover': '#1A1A26',
        'bg-elevated': '#222233',
        'text-primary': '#E8E8ED',
        'text-secondary': '#8888A0',
        'text-muted': '#555566',
        'accent-green': '#00D47E',
        'accent-red': '#FF4444',
        'accent-blue': '#4488FF',
        'accent-warning': '#FFAA00',
        'border-default': '#2A2A3A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
}
```
