"use client"

import { useState, useCallback, useRef, useMemo, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { Background } from "./background"
import { GalaxyView } from "./galaxy-view"
import { CameraController } from "./camera-controller"
import { StarDetailPanel } from "./star-detail-panel"
import { Ufo } from "./ufo"
import { ScoutNotificationPanel } from "./scout-notification-panel"
import { LightweightChart } from "@/components/lightweight-chart"
import { useGalaxyData } from "@/hooks/use-galaxy-data"
import { useSignals } from "@/hooks/use-signals"
import { useHealth } from "@/hooks/use-health"
import { usePrices } from "@/hooks/use-prices"
import { useScout, useScoutConfig, useScoutDismiss } from "@/hooks/use-scout"
import type { ChartDataPoint } from "@/lib/chart-types"
import type { ConstellationData, StarData } from "@/hooks/use-galaxy-data"
import type { CameraMode } from "./camera-controller"
import type { ScoutEvent } from "@/lib/types"
import type { IChartApi, UTCTimestamp, LogicalRange } from "lightweight-charts"
import { ArrowLeft, Loader2, X, Search, Radio } from "lucide-react"
import { useMarkets } from "@/hooks/use-markets"
import { MarketSearchModal } from "@/components/market-search-modal"
import { AlphaTicker } from "@/components/alpha-ticker"

// Invisible plane for raycasting mouse position into 3D space
function MouseTracker({ mousePos }: { mousePos: React.MutableRefObject<THREE.Vector3> }) {
  const planeRef = useRef<THREE.Mesh>(null)
  const { camera, raycaster, pointer } = useThree()

  useFrame(() => {
    if (!planeRef.current) return
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(planeRef.current)
    if (intersects.length > 0) {
      mousePos.current.copy(intersects[0].point)
    }
  })

  return (
    <mesh ref={planeRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} raycast={() => {}}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial />
    </mesh>
  )
}

function AgentNavBar({
  scoutEvents,
  onDismiss,
  onMarketClick,
  expanded,
  onToggle,
}: {
  scoutEvents: ScoutEvent[]
  onDismiss: (id: string) => void
  onMarketClick: (marketId: string) => void
  expanded: boolean
  onToggle: () => void
}) {
  const { data: signalsData } = useSignals()
  const { data: health } = useHealth()

  const signalCount = signalsData?.total ?? 0
  const highEv = signalsData?.signals.filter((s) => s.confidence === "high").length ?? 0
  const isLive = health?.status === "ok"

  return (
    <div
      className="absolute right-4 top-1/2 z-40 pointer-events-auto"
      style={{
        transform: "translateY(-50%)",
        width: expanded ? 340 : 42,
        transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        className="bg-[#181818]/90 backdrop-blur-xl border border-[#333333] overflow-hidden"
        style={{
          borderRadius: expanded ? 10 : 21,
          boxShadow: expanded ? "0 16px 48px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.3)",
          transition: "border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s ease",
        }}
      >
        {/* Collapsed pill — just the icon */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full"
          style={{
            height: 42,
            opacity: expanded ? 0 : 1,
            pointerEvents: expanded ? "none" : "auto",
            position: expanded ? "absolute" : "relative",
            transition: "opacity 0.2s ease",
          }}
        >
          <div className="relative flex items-center justify-center">
            <Radio className="h-4 w-4 text-[#8899aa]" />
            <div className={`absolute h-[5px] w-[5px] rounded-full ${isLive ? "bg-[#00ff88] animate-pulse" : "bg-[#556688]"}`} />
          </div>
        </button>

        {/* Expanded content */}
        <div
          style={{
            opacity: expanded ? 1 : 0,
            maxHeight: expanded ? "70vh" : 0,
            transition: "opacity 0.3s ease 0.1s, max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
          }}
        >
          {/* Stats header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#333333]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-[#00ff88] animate-pulse" : "bg-[#556688]"}`} />
                <span className="text-xs text-[#8899aa]">{isLive ? "LIVE" : "..."}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#99aabb]">Trades</span>
                <span className="text-xs font-mono text-[#ccd0e0]">{signalCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#99aabb]">High</span>
                <span className="text-xs font-mono text-[#00ff88]">{highEv}</span>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="text-[#556688] hover:text-[#ccd0e0] transition-colors p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scout news feed */}
          <div className="max-h-[55vh] overflow-y-auto">
            <ScoutNotificationPanel
              events={scoutEvents}
              onDismiss={onDismiss}
              onMarketClick={onMarketClick}
              embedded
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-2 text-[#8899aa]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs uppercase tracking-wider">Loading markets...</span>
      </div>
    </div>
  )
}

// ── Alien config panel ──────────────────────────────────────────────────────

const GREETING = "yess boss i am ready for your orders on what to focus on!"

function playAlienBlip(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 380 + Math.random() * 480
    osc.type = "sine"
    gain.gain.setValueAtTime(0.035, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  } catch {
    // Ignore — AudioContext may be suspended in some browser configs
  }
}

function ScoutConfigPanel({ onClose }: { onClose: () => void }) {
  const { keywords, setKeywords } = useScoutConfig()
  const [input, setInput] = useState("")
  const [charIdx, setCharIdx] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Create AudioContext once (requires prior user gesture — the UFO click satisfies this)
  useEffect(() => {
    audioCtxRef.current = new AudioContext()
    return () => {
      audioCtxRef.current?.close()
    }
  }, [])

  // Typewriter effect + alien blip per character
  useEffect(() => {
    if (charIdx >= GREETING.length) return
    const timer = setTimeout(() => {
      setCharIdx((i) => i + 1)
      if (audioCtxRef.current) playAlienBlip(audioCtxRef.current)
    }, 38)
    return () => clearTimeout(timer)
  }, [charIdx])

  const talking = charIdx < GREETING.length

  const addKeyword = useCallback(() => {
    const kw = input.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) { setInput(""); return }
    setKeywords([...keywords, kw])
    setInput("")
  }, [input, keywords, setKeywords])

  const removeKeyword = useCallback((kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }, [keywords, setKeywords])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") addKeyword()
  }, [addKeyword])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
      style={{ background: "rgba(2,2,8,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a12]/95 backdrop-blur border border-[#2a2a3a] rounded-2xl p-5 w-[380px] shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Alien header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl select-none leading-none mt-0.5">👽</span>
            <div>
              <p className="text-[13px] font-medium text-[#aabbcc] leading-snug min-h-[2.4rem]">
                {GREETING.slice(0, charIdx)}
                {talking && (
                  <span className="animate-pulse text-[#8899aa]">▋</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#667788] hover:text-[#99aabb] transition-colors shrink-0 mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-[#2a2a3a] mb-3" />

        {/* Label */}
        <p className="text-xs uppercase tracking-wider text-[#778899] mb-2">
          News keyword filter — empty = watch everything
        </p>

        {/* Input row */}
        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. bitcoin, trump, fed..."
            className="flex-1 bg-[#0d0d14] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#ccd0e0] placeholder-[#444455] outline-none focus:border-[#555566] transition-colors"
          />
          <button
            onClick={addKeyword}
            className="px-3 py-1.5 bg-[#1a1a24] hover:bg-[#252530] text-[#aabbcc] text-sm rounded-lg border border-[#2a2a3a] transition-colors"
          >
            + Add
          </button>
        </div>

        {/* Keyword chips */}
        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="flex items-center gap-1 bg-[#151520] text-[#8899aa] text-xs px-2 py-0.5 rounded-full border border-[#2a2a3a]"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-[#667799] hover:text-[#8899bb] leading-none transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#667788] italic min-h-[28px] flex items-center">
            No filter — scanning all news
          </p>
        )}
      </div>
    </div>
  )
}

// ── Scene ────────────────────────────────────────────────────────────────────

function SceneContent({
  constellations,
  focusedConstellation,
  selectedStars,
  cameraMode,
  cameraTarget,
  mousePos,
  onConstellationClick,
  onStarClick,
  onUfoClick,
  focusedStarCount,
}: {
  constellations: ConstellationData[]
  focusedConstellation: string | null
  selectedStars: StarData[]
  cameraMode: CameraMode
  cameraTarget: [number, number, number]
  mousePos: React.MutableRefObject<THREE.Vector3>
  onConstellationClick: (constellation: ConstellationData) => void
  onStarClick: (star: StarData) => void
  onUfoClick: () => void
  focusedStarCount: number
}) {
  return (
    <>
      <ambientLight intensity={0.2} color="#334466" />
      <Background />
      <MouseTracker mousePos={mousePos} />
      {constellations.length > 0 && (
        <GalaxyView
          constellations={constellations}
          focusedConstellation={focusedConstellation}
          selectedStars={selectedStars}
          mousePos={mousePos.current}
          onConstellationClick={onConstellationClick}
          onStarClick={onStarClick}
        />
      )}
      <Ufo constellations={constellations} onUfoClick={onUfoClick} />
      <CameraController mode={cameraMode} target={cameraTarget} starCount={focusedStarCount} />
    </>
  )
}

function MarketChart({
  star,
  onChartReady,
  isLast,
}: {
  star: StarData
  onChartReady?: (id: string, chart: IChartApi) => void
  isLast?: boolean
}) {
  const { data: priceData, isLoading } = usePrices(star.market.clobTokenId, "1w")
  const localChartRef = useRef<IChartApi | null>(null)

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!priceData?.prices || priceData.prices.length === 0) return []
    return priceData.prices.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.price,
    }))
  }, [priceData])

  const darwinData = useMemo<ChartDataPoint[] | undefined>(() => {
    if (!star.signal || chartData.length === 0) return undefined
    const startIdx = Math.max(0, Math.floor(chartData.length * 0.8))
    return chartData.slice(startIdx).map((p) => ({
      time: p.time,
      value: star.signal!.darwinEstimate,
    }))
  }, [star.signal, chartData])

  // Register chart with sync group once ready
  useEffect(() => {
    if (localChartRef.current && onChartReady) {
      onChartReady(star.market.id, localChartRef.current)
    }
  })

  return (
    <div className="flex-1 min-h-[200px] bg-[#181818]/80 backdrop-blur border border-[#333333] rounded-lg overflow-hidden flex flex-col">
      <div className="px-3 py-1.5 border-b border-[#333333]">
        <p className="text-xs text-[#ccd0e0] truncate">{star.market.question}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-[#ccd0e0]">
            {(star.market.probability * 100).toFixed(1)}¢
          </span>
          {star.signal && (
            <span className={`text-xs font-mono ${star.signal.ev > 0 ? "text-[#00ff88]" : "text-[#ff4466]"}`}>
              {star.signal.ev > 0 ? "+" : ""}{(star.signal.ev * 100).toFixed(1)}pp
            </span>
          )}
          <span className="text-[10px] text-[#556688]">
            Vol: ${star.market.volume24hr ? (star.market.volume24hr >= 1e6 ? (star.market.volume24hr / 1e6).toFixed(1) + "M" : (star.market.volume24hr / 1e3).toFixed(0) + "K") : (star.market.volume / 1e6).toFixed(1) + "M"}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {isLoading || chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-[#8899aa] animate-pulse">
              {isLoading ? "Loading..." : "No price data"}
            </span>
          </div>
        ) : (
          <LightweightChart
            data={chartData}
            darwinData={darwinData}
            chartType="area"
            lineColor="#4488cc"
            darwinColor={star.signal?.ev && star.signal.ev > 0 ? "#00ff88" : "#ff4466"}
            showDarwinEstimate={!!star.signal}
            hideTimeScale={!isLast}
            chartRef={localChartRef}
            height={275}
          />
        )}
      </div>
    </div>
  )
}

// Syncs time ranges + crosshairs across multiple LightweightCharts
function SyncedChartStack({ stars }: { stars: StarData[] }) {
  const chartsRef = useRef<Map<string, IChartApi>>(new Map())
  const syncingRef = useRef(false)

  const handleChartReady = useCallback((id: string, chart: IChartApi) => {
    if (chartsRef.current.get(id) === chart) return
    chartsRef.current.set(id, chart)

    // Subscribe to time range changes for sync
    chart.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
      if (syncingRef.current || !range) return
      syncingRef.current = true
      for (const [otherId, otherChart] of chartsRef.current) {
        if (otherId !== id) {
          try {
            otherChart.timeScale().setVisibleLogicalRange(range)
          } catch { /* chart may be disposed */ }
        }
      }
      syncingRef.current = false
    })

    // Subscribe to crosshair moves for sync
    chart.subscribeCrosshairMove((param) => {
      if (syncingRef.current) return
      syncingRef.current = true
      for (const [otherId, otherChart] of chartsRef.current) {
        if (otherId !== id) {
          try {
            if (param.time) {
              otherChart.setCrosshairPosition(NaN, param.time, otherChart.timeScale() as never)
            } else {
              otherChart.clearCrosshairPosition()
            }
          } catch { /* chart may be disposed */ }
        }
      }
      syncingRef.current = false
    })
  }, [])

  // Clean up stale chart refs when stars change
  useEffect(() => {
    const activeIds = new Set(stars.map((s) => s.market.id))
    for (const id of chartsRef.current.keys()) {
      if (!activeIds.has(id)) {
        chartsRef.current.delete(id)
      }
    }
  }, [stars])

  return (
    <>
      {stars.map((s, i) => (
        <MarketChart
          key={s.market.id}
          star={s}
          onChartReady={handleChartReady}
          isLast={i === stars.length - 1}
        />
      ))}
    </>
  )
}

const FILTER_COLORS: Record<string, string> = {
  politics: "#e8a87c",
  crypto: "#7ec8e3",
  sports: "#8b7ec8",
  finance: "#e8d07c",
  science: "#b87ce8",
  entertainment: "#e87cb8",
  technology: "#7ca8e8",
  world: "#7cd0d0",
  culture: "#d0a870",
  esports: "#70c0a8",
  weather: "#90b8d8",
  elections: "#d0907c",
  economy: "#c8b870",
  ai: "#a890d8",
  space: "#80a8c8",
  other: "#a0a0b8",
}

export function GalaxyScene() {
  const galaxyData = useGalaxyData()
  const { data: scoutData } = useScout(10)
  const { mutate: dismissEvent } = useScoutDismiss()
  const { data: marketsData, isLoading: marketsLoading } = useMarkets({ limit: 1000 })
  const mousePos = useRef(new THREE.Vector3(9999, 9999, 9999))

  const [cameraMode, setCameraMode] = useState<CameraMode>("galaxy")
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 0, 0])
  const [focusedConstellation, setFocusedConstellation] = useState<string | null>(null)
  const [selectedStars, setSelectedStars] = useState<StarData[]>([])
  const [scoutConfigOpen, setScoutConfigOpen] = useState(false)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [customColors, setCustomColors] = useState<Record<string, string>>({})
  const [colorPickerTarget, setColorPickerTarget] = useState<{ name: string; x: number; y: number } | null>(null)
  const [navExpanded, setNavExpanded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const toggleCategory = useCallback((name: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const getColor = useCallback((name: string) => {
    return customColors[name] ?? FILTER_COLORS[name] ?? "#9999cc"
  }, [customColors])

  const filteredConstellations = useMemo(
    () => galaxyData.constellations
      .filter((c) => !hiddenCategories.has(c.name))
      .map((c) => {
        const custom = customColors[c.name]
        if (!custom) return c
        // Override constellation colors with custom color
        return {
          ...c,
          primaryColor: custom,
          accentColor: custom,
          layers: c.layers.map((l) => ({ ...l, color: l.color === c.primaryColor || l.color === c.accentColor ? custom : l.color })),
        }
      }),
    [galaxyData.constellations, hiddenCategories, customColors],
  )

  const handleConstellationClick = useCallback((constellation: ConstellationData) => {
    setCameraMode("constellation")
    setCameraTarget(constellation.position)
    setFocusedConstellation(constellation.name)
    setSelectedStars([])
  }, [])

  const handleBackToGalaxy = useCallback(() => {
    setCameraMode("galaxy")
    setFocusedConstellation(null)
    setSelectedStars([])
  }, [])

  const handleStarClick = useCallback((star: StarData) => {
    setSelectedStars((prev) => {
      const exists = prev.find((s) => s.market.id === star.market.id)
      if (exists) return prev.filter((s) => s.market.id !== star.market.id)
      if (prev.length >= 2) return [prev[1], star]
      return [...prev, star]
    })
  }, [])

  const handleUfoClick = useCallback(() => {
    setScoutConfigOpen(true)
  }, [])

  const allMarkets = marketsData?.markets ?? []

  // Navigate to a market by ID — find its constellation, focus it, then select the star
  const handleNavigateToMarket = useCallback((marketId: string) => {
    for (const c of galaxyData.constellations) {
      const star = c.stars.find((s) => s.market.id === marketId)
      if (star) {
        setHiddenCategories((prev) => {
          if (!prev.has(c.name)) return prev
          const next = new Set(prev)
          next.delete(c.name)
          return next
        })
        setCameraMode("constellation")
        setCameraTarget(c.position)
        setFocusedConstellation(c.name)
        setSelectedStars([star])
        return
      }
    }
  }, [galaxyData.constellations])

  // All market IDs in the galaxy
  const galaxyMarketIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of galaxyData.constellations) {
      for (const s of c.stars) ids.add(s.market.id)
    }
    return ids
  }, [galaxyData.constellations])

  // Scout events filtered to only markets that exist in the galaxy
  const visibleScoutEvents = useMemo(() => {
    if (!scoutData?.events) return []
    return scoutData.events
      .map((e) => ({
        ...e,
        matchedMarkets: e.matchedMarkets.filter((m) => galaxyMarketIds.has(m.marketId)),
      }))
      .filter((e) => e.matchedMarkets.length > 0)
  }, [scoutData, galaxyMarketIds])

  // Scout events filtered to selected stars
  const selectedScoutEvents = useMemo(() => {
    if (selectedStars.length === 0) return []
    const ids = new Set(selectedStars.map((s) => s.market.id))
    return visibleScoutEvents.filter((e) =>
      e.matchedMarkets.some((m) => ids.has(m.marketId))
    )
  }, [visibleScoutEvents, selectedStars])

  // Find focused constellation's stars for the side list
  const focusedData = filteredConstellations.find((c) => c.name === focusedConstellation)

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#020208" }}>
      <Canvas
        camera={{ position: [0, 20, 80], fov: 60, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.5]}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <SceneContent
            constellations={filteredConstellations}
            focusedConstellation={focusedConstellation}
            selectedStars={selectedStars}
            cameraMode={cameraMode}
            cameraTarget={cameraTarget}
            mousePos={mousePos}
            onConstellationClick={handleConstellationClick}
            onStarClick={handleStarClick}
            onUfoClick={handleUfoClick}
            focusedStarCount={focusedData?.stars.length ?? 0}
          />
        </Suspense>
      </Canvas>

      {/* Loading overlay */}
      {galaxyData.loading && <LoadingOverlay />}

      {/* Header */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 40, width: cameraMode === "constellation" ? 340 : undefined }}>
        <div className="flex items-center gap-2.5">
          {cameraMode === "constellation" && (
            <button
              onClick={handleBackToGalaxy}
              className="flex items-center gap-1.5 bg-[#181818]/80 backdrop-blur border border-[#333333] rounded px-3 py-1.5 text-xs uppercase tracking-wider text-[#99aabb] hover:text-[#ccd0e0] hover:border-[#334466] transition-colors shrink-0"
            >
              <ArrowLeft className="h-3 w-3" />
              Galaxy
            </button>
          )}
          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className={`flex items-center gap-1.5 bg-[#181818]/80 backdrop-blur border border-[#333333] rounded px-3 py-1.5 text-xs uppercase tracking-wider text-[#99aabb] hover:text-[#ccd0e0] hover:border-[#334466] transition-colors ${cameraMode === "constellation" ? "flex-1" : "shrink-0"}`}
          >
            <Search className="h-3 w-3" />
            Search...
          </button>
        </div>
      </div>

      {/* Agent nav bar — top-right, stats + dropdown scout feed */}
      <AgentNavBar
        scoutEvents={scoutData?.events ?? []}
        onDismiss={dismissEvent}
        onMarketClick={handleNavigateToMarket}
        expanded={navExpanded}
        onToggle={() => setNavExpanded((v) => !v)}
      />

      {/* Chart panel(s) for selected stars — stacked vertically on left, synced */}
      {focusedData && selectedStars.length > 0 && (
        <div className="absolute left-4 top-14 bottom-4 z-40 pointer-events-auto flex flex-col gap-2 overflow-y-auto w-[340px]">
          <SyncedChartStack stars={selectedStars} />
        </div>
      )}

      {/* Detail panel — show for first selected star */}
      {selectedStars.length > 0 && (
        <StarDetailPanel
          star={selectedStars[0]}
          onClose={() => setSelectedStars([])}
          scoutEvents={selectedScoutEvents}
        />
      )}

      {/* Market search modal */}
      <MarketSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(market) => {
          handleNavigateToMarket(market.id)
          setSearchOpen(false)
        }}
        currentMarketIds={selectedStars.map((s) => s.market.id)}
        markets={allMarkets}
        loading={marketsLoading}
      />

      {/* Category filter */}
      {cameraMode === "galaxy" && (
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", maxWidth: "60vw", zIndex: 40 }}>
          <div className="relative bg-[#0d0d10]/60 backdrop-blur-sm border border-[#ffffff10] rounded-full px-4 py-1.5 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitMaskImage: "linear-gradient(90deg, transparent, black 24px, black calc(100% - 24px), transparent)", maskImage: "linear-gradient(90deg, transparent, black 24px, black calc(100% - 24px), transparent)" } as React.CSSProperties}>
            {galaxyData.constellations.map((c) => {
              const hidden = hiddenCategories.has(c.name)
              const color = getColor(c.name)
              return (
                <button
                  key={c.name}
                  onClick={() => toggleCategory(c.name)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setColorPickerTarget({ name: c.name, x: e.clientX, y: e.clientY })
                  }}
                  className="px-2.5 py-0.5 rounded-full transition-all shrink-0"
                  style={{
                    opacity: hidden ? 0.35 : 1,
                    background: hidden ? "transparent" : `${color}18`,
                    border: `1px solid ${hidden ? "#ffffff10" : `${color}35`}`,
                    color: hidden ? "#666666" : color,
                  }}
                >
                  <span className="text-xs uppercase tracking-wider">
                    {c.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Alpha ticker banner */}
      <AlphaTicker />

      {/* Color picker */}
      {colorPickerTarget && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setColorPickerTarget(null)}
        >
          <div
            className="absolute bg-[#181818]/95 backdrop-blur border border-[#333333] rounded-lg p-3"
            style={{ left: colorPickerTarget.x, top: colorPickerTarget.y + 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-[#888888] uppercase tracking-wider mb-2">
              {colorPickerTarget.name} color
            </div>
            <input
              type="color"
              value={getColor(colorPickerTarget.name)}
              onChange={(e) => {
                setCustomColors((prev) => ({ ...prev, [colorPickerTarget.name]: e.target.value }))
              }}
              className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap max-w-[180px]">
              {["#e8a87c", "#7ec8e3", "#8b7ec8", "#e8d07c", "#b87ce8", "#e87cb8", "#7ca8e8", "#7cd0d0", "#d0a870", "#70c0a8", "#a890d8", "#80a8c8"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setCustomColors((prev) => ({ ...prev, [colorPickerTarget.name]: preset }))
                    setColorPickerTarget(null)
                  }}
                  className="w-5 h-5 rounded-full border border-[#444444] hover:scale-125 transition-transform"
                  style={{ background: preset }}
                />
              ))}
            </div>
            {customColors[colorPickerTarget.name] && (
              <button
                onClick={() => {
                  setCustomColors((prev) => {
                    const next = { ...prev }
                    delete next[colorPickerTarget.name]
                    return next
                  })
                  setColorPickerTarget(null)
                }}
                className="text-xs text-[#666666] hover:text-[#aaaaaa] mt-2 transition-colors"
              >
                Reset to default
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alien scout config panel — opens on UFO click */}
      {scoutConfigOpen && (
        <ScoutConfigPanel onClose={() => setScoutConfigOpen(false)} />
      )}
    </div>
  )
}
