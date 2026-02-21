"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const SPACING = 20
    const RADIUS = 1.5
    const CURSOR_RADIUS = 130
    const LERP = 0.08

    // Capture non-null refs for use inside closures
    const cvs = canvas
    const c = ctx

    let mx = -9999
    let my = -9999
    interface Dot { x: number; y: number; brightness: number }
    let dots: Dot[] = []
    let raf: number

    function resize() {
      cvs.width = window.innerWidth
      cvs.height = window.innerHeight
      buildDots()
    }

    function buildDots() {
      dots = []
      const cols = Math.ceil(cvs.width / SPACING) + 1
      const rows = Math.ceil(cvs.height / SPACING) + 1
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          dots.push({ x: col * SPACING, y: r * SPACING, brightness: 0 })
        }
      }
    }

    function tick() {
      c.clearRect(0, 0, cvs.width, cvs.height)
      for (const d of dots) {
        const dx = d.x - mx
        const dy = d.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        const target = dist < CURSOR_RADIUS ? 1 - dist / CURSOR_RADIUS : 0
        d.brightness += (target - d.brightness) * LERP
        const alpha = 0.1 + d.brightness * 0.55
        c.beginPath()
        c.arc(d.x, d.y, RADIUS, 0, Math.PI * 2)
        c.fillStyle = `rgba(232,232,237,${alpha.toFixed(3)})`
        c.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    function onMouseMove(e: MouseEvent) {
      mx = e.clientX
      my = e.clientY
    }

    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMouseMove)
    resize()
    tick()

    return () => {
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="relative h-screen overflow-hidden bg-darwin-bg">
      {/* Dot-grid canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none"
      />

      {/* Foreground */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Navbar */}
        <nav className="flex shrink-0 items-center justify-between border-b border-darwin-border/40 px-8 py-4">
          <span className="text-sm font-semibold tracking-tight text-darwin-text">
            DARWIN CAPITAL
          </span>
          <Link
            href="/dashboard"
            className="border border-darwin-border px-4 py-1.5 text-xs font-medium text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
          >
            Enter App
          </Link>
        </nav>

        {/* Hero */}
        <div className="flex shrink-0 flex-col items-center px-8 pb-10 pt-16 text-center">
          <h1 className="max-w-xl text-[2.5rem] font-semibold leading-[1.15] tracking-tight text-darwin-text">
            Alpha where<br />news moves first.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-darwin-text-secondary">
            AI agents scan prediction markets for news-to-price lag and surface
            mispricings before they correct.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center border border-darwin-text-secondary px-6 py-2.5 text-sm font-medium text-darwin-text transition-colors hover:border-darwin-text hover:bg-darwin-elevated"
          >
            Launch Dashboard
          </Link>
        </div>

        {/* App preview — cropped at bottom for depth */}
        <div className="relative flex flex-1 justify-center overflow-hidden px-8">
          <div className="w-full max-w-5xl overflow-hidden border border-darwin-border bg-darwin-card">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-darwin-border px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold tracking-tight text-darwin-text">
                  DARWIN CAPITAL
                </span>
                <span className="border border-darwin-border px-2.5 py-1 text-xs text-darwin-text-secondary">
                  Compare
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-darwin-green animate-pulse" />
                <span className="text-xs text-darwin-text-secondary">Scanned 2m ago</span>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-8 border-b border-darwin-border px-6 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-darwin-text-secondary">Active Signals:</span>
                <span className="font-data text-sm font-medium text-darwin-text">12</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-darwin-text-secondary">Markets Scanned:</span>
                <span className="font-data text-sm font-medium text-darwin-text">847</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-darwin-text-secondary">High-EV:</span>
                <span className="font-data text-sm font-medium text-darwin-green">3</span>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3 border-b border-darwin-border px-6 py-3">
              <div className="h-7 w-56 border border-darwin-border bg-darwin-bg" />
              <div className="flex items-center gap-0.5">
                {["Alpha", "Volume", "Newest", "Probability"].map((label, i) => (
                  <div
                    key={label}
                    className={`px-2.5 py-1 text-[11px] font-medium uppercase ${
                      i === 0
                        ? "bg-darwin-elevated text-darwin-text"
                        : "text-darwin-text-muted"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <span className="text-darwin-border">|</span>
              <div className="flex items-center gap-0.5">
                {["All", "Has Signal", "High EV"].map((label, i) => (
                  <div
                    key={label}
                    className={`px-2.5 py-1 text-[11px] font-medium uppercase ${
                      i === 0
                        ? "bg-darwin-elevated text-darwin-text"
                        : "text-darwin-text-muted"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Market cards */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4">
              {MOCK_CARDS.map((card, i) => (
                <MockCard key={i} {...card} />
              ))}
            </div>
          </div>

          {/* Bottom fade — blends preview into page bg */}
          <div
            className="pointer-events-none absolute bottom-0 left-8 right-8"
            style={{
              height: "120px",
              background:
                "linear-gradient(to bottom, transparent, #0A0A0F)",
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mock data for app preview
// ---------------------------------------------------------------------------

interface MockCardData {
  question: string
  market: string
  darwin: string
  ev: string
  bullish: boolean
  confidence: "High" | "Medium"
  age: string
  barWidth: string
}

const MOCK_CARDS: MockCardData[] = [
  {
    question: "Will US CPI drop below 3% by Q2 2026?",
    market: "0.42",
    darwin: "0.61",
    ev: "+19.0%",
    bullish: true,
    confidence: "High",
    age: "2m ago",
    barWidth: "80%",
  },
  {
    question: "Fed rate cut before June 2026?",
    market: "0.71",
    darwin: "0.54",
    ev: "−17.0%",
    bullish: false,
    confidence: "Medium",
    age: "5m ago",
    barWidth: "72%",
  },
  {
    question: "Trump approval above 52% by March 2026?",
    market: "0.38",
    darwin: "0.53",
    ev: "+15.0%",
    bullish: true,
    confidence: "High",
    age: "8m ago",
    barWidth: "65%",
  },
]

function MockCard({
  question,
  market,
  darwin,
  ev,
  bullish,
  confidence,
  age,
  barWidth,
}: MockCardData) {
  const accent = bullish ? "text-darwin-green" : "text-darwin-red"
  const barColor = bullish ? "bg-darwin-green" : "bg-darwin-red"
  const topBorder = bullish ? "border-t-darwin-green" : "border-t-darwin-red"
  const badgeBg = confidence === "High" ? "bg-darwin-green/15 text-darwin-green" : "bg-darwin-warning/15 text-darwin-warning"

  return (
    <div
      className={`border border-darwin-border bg-darwin-bg p-4 space-y-3 border-t-2 ${topBorder}`}
    >
      <div>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-darwin-text">
          {question}
        </p>
        <span className="label-caps mt-1 inline-block">POLYMARKET</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-darwin-text-secondary">Market</span>
          <span className="font-data text-sm text-darwin-text">{market}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-darwin-text-secondary">Darwin</span>
          <span className={`font-data text-sm ${accent}`}>{darwin}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-darwin-text-secondary">EV</span>
          <span className={`font-data text-sm font-medium ${accent}`}>{ev}</span>
        </div>
      </div>

      {/* Alpha bar */}
      <div className="h-1 w-full bg-darwin-border/40 rounded-sm overflow-hidden">
        <div
          className={`h-full ${barColor} opacity-80 rounded-sm`}
          style={{ width: barWidth }}
        />
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeBg}`}>
          {confidence}
        </span>
        <span className="text-[11px] text-darwin-text-muted">{age}</span>
      </div>
    </div>
  )
}
