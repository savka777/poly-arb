"use client"

import { useEffect, useState, useRef } from "react"

interface TickerCommitment {
  marketQuestion: string
  direction: "yes" | "no"
  darwinEstimate: number
  marketPriceAtCommit: number
  currentMarketPrice: number | null
  convergence: number | null
  commitTxSignature: string | null
}

// Hardcoded fallback data — real signals committed on Solana
const FALLBACK_ITEMS: TickerCommitment[] = [
  { marketQuestion: "Will the Edmonton Oilers win the 2026 NHL Stanley Cup?", direction: "yes", darwinEstimate: 0.10, marketPriceAtCommit: 0.08, currentMarketPrice: 0.095, convergence: 0.75, commitTxSignature: "hQvdDUNhvZ7U9F52twTnmmi58PRdfuiWdhfCGF5p6NkbhcredwdqA7NA4i8gVD2VoV6Tz9m1Edqo7cPQA4PUPfQ" },
  { marketQuestion: "BitBoy convicted?", direction: "no", darwinEstimate: 0.35, marketPriceAtCommit: 0.561, currentMarketPrice: 0.278, convergence: 0.657, commitTxSignature: "67VZy17BeM6f4wDMvy1H2yRK8fcnkYFrnQid9LmZTq7bLk1S3WtHv4pvv9Qo7fpn9ed5fydk2QcEXZZnkxMaH51m" },
  { marketQuestion: "Will Donald Trump visit Wyoming in 2026?", direction: "yes", darwinEstimate: 0.662, marketPriceAtCommit: 0.51, currentMarketPrice: 0.585, convergence: 0.493, commitTxSignature: "54kmi7F5fPYM3Qng2cv6dYGvznCWEdsoGyUHMhVu7cufHWmuAmXFNT5RVRfMPuerXfPUFjKLCyuu2dK8m8YjUTsH" },
  { marketQuestion: "Will Trump say \"TikTok\" this week? (March 1)", direction: "yes", darwinEstimate: 0.471, marketPriceAtCommit: 0.31, currentMarketPrice: 0.37, convergence: 0.373, commitTxSignature: "3mDD7rsJrwyK7N1M6kZBcrPbzVuX7ypEGNYjnPPPVJXH4D7crxWcR6yeX81FovFJJekKLAG7Zkb8Q5YVeE9ZnXmC" },
  { marketQuestion: "Paramount x Warner Bros. acquisition announced by June 30?", direction: "yes", darwinEstimate: 0.487, marketPriceAtCommit: 0.35, currentMarketPrice: 0.385, convergence: 0.255, commitTxSignature: "61MSX6ku8mDA7FWGmroSR3KDFsLfY4a2W7PqJUbDPx5xLKLtvVG5uNNGtQgXfBrQbvNx5QKQKqTUMdXupYthzzoM" },
  { marketQuestion: "Will Donald Trump visit Indiana in 2026?", direction: "yes", darwinEstimate: 0.784, marketPriceAtCommit: 0.575, currentMarketPrice: 0.625, convergence: 0.239, commitTxSignature: "62Mx497obi2hBcmw3m5t1fMDsqmhm5tc43VcvPeuQXAKCKbKFpu8Bxs7LbmPTJBpkaApeLM9MmouZ7accAugj3Bv" },
  { marketQuestion: "Aston Villa FC vs. Chelsea FC: O/U 1.5", direction: "yes", darwinEstimate: 0.64, marketPriceAtCommit: 0.50, currentMarketPrice: 0.52, convergence: 0.143, commitTxSignature: "5mqUxeaz6Zw9zQmqgp4cQHp8pJizHGKEonFNRQDwyWGRSEZzyWUUyoGQxur9EsDbQX5vWv2ZRxwVwASYAHb3cpYK" },
  { marketQuestion: "US strikes Iran by March 15, 2026?", direction: "yes", darwinEstimate: 0.551, marketPriceAtCommit: 0.455, currentMarketPrice: 0.465, convergence: 0.104, commitTxSignature: "5ztMXd9jTdH9CbPibuQJPZkHcdUPYHHntsEPfJMsvqMEPByDrsVgfuxrUz76TKVsMC7Zo1mWg4vbo9poUMSx47Et" },
  { marketQuestion: "D.C. United SC vs. Inter Miami CF: O/U 1.5", direction: "yes", darwinEstimate: 0.687, marketPriceAtCommit: 0.505, currentMarketPrice: 0.52, convergence: 0.083, commitTxSignature: "cPGcXhoBMadwmGJv7FnEXD93UjwB8GVerLXEzUpBovYbDDkEQr2CAivgdg4k8PhnkDarbS2C7pHXvUUK8H4jA2H" },
  { marketQuestion: "New York City FC vs. Orlando City SC: O/U 1.5", direction: "yes", darwinEstimate: 0.649, marketPriceAtCommit: 0.51, currentMarketPrice: 0.52, convergence: 0.072, commitTxSignature: "619J5Htz7YJUnig9y3uPArFVHZCpJsndSfjiFm8zivHwxWWtcWiTWLyKxg45jAFKjQdU6gtmQp3kWFK3wniKsDss" },
]

function TickerItem({ c }: { c: TickerCommitment }) {
  const entry = (c.marketPriceAtCommit * 100).toFixed(1)
  const now = c.currentMarketPrice !== null ? (c.currentMarketPrice * 100).toFixed(1) : "\u2014"
  const moved = c.currentMarketPrice !== null
    ? ((c.currentMarketPrice - c.marketPriceAtCommit) * 100).toFixed(1)
    : "0.0"
  const arrow = Number(moved) >= 0 ? "+" : ""
  const conv = c.convergence !== null ? (c.convergence * 100).toFixed(0) : "\u2014"

  const isCorrect = c.currentMarketPrice !== null &&
    ((c.direction === "yes" && c.currentMarketPrice > c.marketPriceAtCommit) ||
     (c.direction === "no" && c.currentMarketPrice < c.marketPriceAtCommit))

  const moveColor = isCorrect ? "#00ff88" : "#ff4444"

  // Truncate long questions
  const question = c.marketQuestion.length > 45
    ? c.marketQuestion.slice(0, 44) + "\u2026"
    : c.marketQuestion

  return (
    <span className="flex items-center shrink-0 mx-8 gap-2">
      {/* Dot */}
      <span
        className="inline-block h-1 w-1 rounded-full shrink-0"
        style={{ background: moveColor, boxShadow: `0 0 4px ${moveColor}` }}
      />
      {/* Question */}
      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
        {question}
      </span>
      {/* Price movement */}
      <span className="text-[10px] font-mono" style={{ color: moveColor }}>
        {entry}% &rarr; {now}% ({arrow}{moved}%)
      </span>
      {/* Convergence pill */}
      <span
        className="text-[9px] font-mono px-1.5 py-px rounded-full"
        style={{
          background: isCorrect ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)",
          color: isCorrect ? "rgba(0,255,136,0.7)" : "rgba(255,68,68,0.6)",
          border: `1px solid ${isCorrect ? "rgba(0,255,136,0.15)" : "rgba(255,68,68,0.12)"}`,
        }}
      >
        {conv}%
      </span>
      {/* Separator dot */}
      <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.15)" }}>&bull;</span>
    </span>
  )
}

export function AlphaTicker() {
  const [items, setItems] = useState<TickerCommitment[]>(FALLBACK_ITEMS)
  const containerRef = useRef<HTMLDivElement>(null)

  // Try to fetch live data from API
  useEffect(() => {
    async function fetchCommitments() {
      try {
        const res = await fetch("/api/commitments")
        if (!res.ok) return
        const data = await res.json()
        if (data.commitments?.length > 0) {
          const movers = data.commitments.filter((c: TickerCommitment) => {
            if (c.currentMarketPrice === null) return false
            const moved = Math.abs(c.currentMarketPrice - c.marketPriceAtCommit)
            return moved > 0.005
          })
          movers.sort((a: TickerCommitment, b: TickerCommitment) =>
            (b.convergence ?? 0) - (a.convergence ?? 0)
          )
          if (movers.length > 0) {
            setItems(movers.slice(0, 20))
          }
        }
      } catch {
        // Keep fallback data
      }
    }
    fetchCommitments()
    const iv = setInterval(fetchCommitments, 60_000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 z-40 overflow-hidden pointer-events-none"
      style={{
        height: 32,
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.92) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center h-full whitespace-nowrap animate-ticker">
        {/* Two copies for seamless looping */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center shrink-0">
            {items.map((c, i) => (
              <TickerItem key={`${copy}-${i}`} c={c} />
            ))}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker-scroll 90s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
