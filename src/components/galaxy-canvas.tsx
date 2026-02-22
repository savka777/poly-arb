"use client"

import { useEffect, useRef, useCallback } from "react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReactiveParticle {
  bx: number          // base x in logical px (drifts over time)
  by: number          // base y in logical px
  cx: number          // current display x (lerped toward target)
  cy: number          // current display y
  vx: number          // drift velocity x (px/frame)
  vy: number          // drift velocity y (px/frame)
  size: number        // radius in logical px (0.5–1.5 → diameter 1–3px)
  baseOpacity: number // resting opacity (0.15–0.50)
  pulsePhase: number  // radians — random start point in sine cycle
  pulseSpeed: number  // radians per second (0.25–1.4) — varies per star
  pulseAmp: number    // opacity swing amplitude (0.08–0.18)
}

interface BgParticle {
  rx: number          // relative x [0, 1]
  ry: number          // relative y [0, 1]
  baseOpacity: number // 0.06–0.18
  pulsePhase: number
  pulseSpeed: number  // 0.2–0.9 rad/s — slower than reactive layer
  pulseAmp: number    // 0.03–0.07 — very subtle
}

export interface StarCanvasProps {
  className?: string
}

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed | 0
  return (): number => {
    s = Math.imul(s ^ (s >>> 15), 0x1ea4f5a) ^ (s >>> 13)
    return (s >>> 0) / 0x100000000
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StarCanvas({ className }: StarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<ReactiveParticle[]>([])
  const bgParticlesRef = useRef<BgParticle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number>(0)

  // ── Initialise both particle layers ──────────────────────────────────────
  const initParticles = useCallback((w: number, h: number) => {
    const rng = makeRng(0xdeadbeef)

    // 420 reactive particles — denser field
    particlesRef.current = Array.from({ length: 420 }, () => {
      const bx = rng() * w
      const by = rng() * h
      return {
        bx,
        by,
        cx: bx,
        cy: by,
        vx: (rng() - 0.5) * 0.35,
        vy: (rng() - 0.5) * 0.35,
        size: 0.5 + rng() * 1.0,           // radius 0.5–1.5px → diameter 1–3px
        baseOpacity: 0.15 + rng() * 0.35,  // 0.15–0.50
        pulsePhase: rng() * Math.PI * 2,
        pulseSpeed: 0.25 + rng() * 1.15,   // 0.25–1.40 rad/s
        pulseAmp: 0.08 + rng() * 0.10,     // 0.08–0.18 opacity swing
      }
    })

    // 580 tiny background particles — also pulsating, non-interactive
    bgParticlesRef.current = Array.from({ length: 580 }, () => ({
      rx: rng(),
      ry: rng(),
      baseOpacity: 0.06 + rng() * 0.12,   // 0.06–0.18
      pulsePhase: rng() * Math.PI * 2,
      pulseSpeed: 0.2 + rng() * 0.7,      // slower
      pulseAmp: 0.03 + rng() * 0.04,      // very subtle
    }))
  }, [])

  // ── Resize: update canvas pixel buffer and re-init particles ─────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    if (w === 0 || h === 0) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    initParticles(w, h)
  }, [initParticles])

  // ── RAF render loop ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resizeCanvas()

    const PROX = 150  // cursor proximity radius (px)
    const CONN = 70   // connection line max distance (px)

    function tick(now: number) {
      const cvs = canvasRef.current
      if (!cvs) return
      const ctx = cvs.getContext("2d")
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const w = cvs.width / dpr   // logical width
      const h = cvs.height / dpr  // logical height
      const t = now / 1000        // seconds — drives all pulse animations

      // Scale context to device pixels each frame
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const hasMouse = mx > -100

      // ── Layer 0: background particles with parallax + pulsation ──────────
      const shiftX = hasMouse ? ((mx - w / 2) / w) * w * 0.015 : 0
      const shiftY = hasMouse ? ((my - h / 2) / h) * h * 0.015 : 0
      for (const bp of bgParticlesRef.current) {
        const bx = bp.rx * w + shiftX
        const by = bp.ry * h + shiftY
        const pulse = Math.sin(t * bp.pulseSpeed + bp.pulsePhase) * bp.pulseAmp
        const op = Math.max(0.02, bp.baseOpacity + pulse)
        ctx.beginPath()
        ctx.arc(bx, by, 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${op.toFixed(3)})`
        ctx.fill()
      }

      // ── Update reactive particle positions ───────────────────────────────
      const ps = particlesRef.current
      for (const p of ps) {
        // Drift base position and wrap at edges
        p.bx += p.vx
        p.by += p.vy
        if (p.bx < 0) p.bx += w
        else if (p.bx > w) p.bx -= w
        if (p.by < 0) p.by += h
        else if (p.by > h) p.by -= h

        // Cursor repulsion: inverse distance falloff up to PROX radius
        let tx = p.bx
        let ty = p.by
        if (hasMouse) {
          const dx = p.bx - mx
          const dy = p.by - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < PROX && dist > 0) {
            const strength = (1 - dist / PROX) * 45
            tx = p.bx + (dx / dist) * strength
            ty = p.by + (dy / dist) * strength
          }
        }

        // Lerp current display position toward target
        p.cx += (tx - p.cx) * 0.08
        p.cy += (ty - p.cy) * 0.08
      }

      // ── Layer 1: connection lines between nearby particles ───────────────
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i]
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j]
          const dx = a.cx - b.cx
          const dy = a.cy - b.cy
          const d2 = dx * dx + dy * dy
          if (d2 < CONN * CONN) {
            const d = Math.sqrt(d2)
            const op = (1 - d / CONN) * 0.18  // faint lines
            ctx.beginPath()
            ctx.moveTo(a.cx, a.cy)
            ctx.lineTo(b.cx, b.cy)
            ctx.strokeStyle = `rgba(255,255,255,${op.toFixed(3)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // ── Layer 2: reactive star particles with individual pulsation ────────
      // Text-zone ellipse — matches the hero headline position (top: 42%, centered)
      // Stars inside this zone render at natural brightness; outside they get boosted.
      const zoneCx = w * 0.5
      const zoneCy = h * 0.42
      const zoneRx = Math.max(180, Math.min(310, w * 0.21))
      const zoneRy = Math.max(110, Math.min(175, h * 0.23))

      for (const p of ps) {
        const dx = p.cx - mx
        const dy = p.cy - my
        const dist = hasMouse ? Math.sqrt(dx * dx + dy * dy) : PROX + 1
        const proximity = dist < PROX ? 1 - dist / PROX : 0

        // Pulse: modulate base opacity with per-star sine wave
        const pulse = Math.sin(t * p.pulseSpeed + p.pulsePhase) * p.pulseAmp
        const pulsedBase = Math.max(0.05, p.baseOpacity + pulse)
        // Cursor proximity boosts toward full brightness
        const opacity = Math.min(1, pulsedBase + proximity * (1 - pulsedBase))

        // Zone boost: 0 = inside/at text zone edge, 1 = fully outside
        const ezx = (p.cx - zoneCx) / zoneRx
        const ezy = (p.cy - zoneCy) / zoneRy
        const ellDist = Math.sqrt(ezx * ezx + ezy * ezy)
        const boost = Math.max(0, Math.min(1, (ellDist - 0.85) / 0.55))

        // Apply boost: brighter and slightly bigger outside the text zone
        const displayOpacity = Math.min(1, opacity * (1 + boost * 0.70))
        const displaySize = p.size * (1 + boost * 0.30)

        // Glow size also breathes slightly with the pulse
        const glowPulse = (pulse / p.pulseAmp) * 0.5  // −0.5 … +0.5 normalised
        const glowSize = (4 + proximity * 6 + glowPulse * 2) * (1 + boost * 0.4)

        ctx.save()
        ctx.globalAlpha = displayOpacity
        ctx.shadowBlur = glowSize
        ctx.shadowColor = "white"
        ctx.fillStyle = "white"
        ctx.beginPath()
        ctx.arc(p.cx, p.cy, displaySize, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // 4-point diffraction spike on particles with diameter > 2px (radius > 1px)
        if (displaySize > 1) {
          const spikeHalf = 3 + (displaySize - 1) * 6  // 3–6px half-length
          ctx.save()
          ctx.globalAlpha = displayOpacity * 0.3
          ctx.strokeStyle = "white"
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(p.cx - spikeHalf, p.cy)
          ctx.lineTo(p.cx + spikeHalf, p.cy)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(p.cx, p.cy - spikeHalf)
          ctx.lineTo(p.cx, p.cy + spikeHalf)
          ctx.stroke()
          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [resizeCanvas])

  // ── Mouse tracking — coordinates in logical canvas px ────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999 }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  )
}
