"use client"

import { useState, useCallback, useRef, useMemo, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { Background } from "./background"
import { GalaxyView } from "./galaxy-view"
import { CameraController } from "./camera-controller"
import { StarDetailPanel } from "./star-detail-panel"
import { LightweightChart } from "@/components/lightweight-chart"
import { useGalaxyData } from "@/hooks/use-galaxy-data"
import { useSignals } from "@/hooks/use-signals"
import { useHealth } from "@/hooks/use-health"
import { usePrices } from "@/hooks/use-prices"
import type { ChartDataPoint } from "@/lib/chart-types"
import type { ConstellationData, StarData } from "@/hooks/use-galaxy-data"
import type { CameraMode } from "./camera-controller"
import type { UTCTimestamp } from "lightweight-charts"
import { ArrowLeft, Loader2 } from "lucide-react"

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

function AgentStatsOverlay() {
  const { data: signalsData } = useSignals()
  const { data: health } = useHealth()

  const signalCount = signalsData?.total ?? 0
  const highEv = signalsData?.signals.filter((s) => s.confidence === "high").length ?? 0
  const totalAlphaPp = signalsData?.signals.reduce((sum, s) => sum + Math.abs(s.ev) * 100, 0) ?? 0

  return (
    <div className="absolute top-4 right-4 z-40 pointer-events-none">
      <div className="bg-[#0a0a1a]/80 backdrop-blur border border-[#1a1a3a] rounded-lg px-4 py-3 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-[#556688]">
            Agent Status
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                health?.status === "ok" ? "bg-[#00ff88] animate-pulse" : "bg-[#556688]"
              }`}
            />
            <span className="text-[10px] text-[#556688]">
              {health?.status === "ok" ? "LIVE" : "..."}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <StatRow label="Signals generated" value={signalCount} />
          <StatRow label="High-EV" value={highEv} highlight />
          <StatRow label="Alpha found" value={`+${totalAlphaPp.toFixed(0)}pp`} />
          <StatRow label="Markets tracked" value={health?.signalCount ?? 0} />
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[#667799]">{label}</span>
      <span className={`text-xs font-mono ${highlight ? "text-[#00ff88]" : "text-[#ccd0e0]"}`}>
        {value}
      </span>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-2 text-[#556688]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs uppercase tracking-wider">Loading markets...</span>
      </div>
    </div>
  )
}

function SceneContent({
  constellations,
  focusedConstellation,
  cameraMode,
  cameraTarget,
  mousePos,
  onConstellationClick,
  onStarClick,
}: {
  constellations: ConstellationData[]
  focusedConstellation: string | null
  cameraMode: CameraMode
  cameraTarget: [number, number, number]
  mousePos: React.MutableRefObject<THREE.Vector3>
  onConstellationClick: (constellation: ConstellationData) => void
  onStarClick: (star: StarData) => void
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
          mousePos={mousePos.current}
          onConstellationClick={onConstellationClick}
          onStarClick={onStarClick}
        />
      )}
      <CameraController mode={cameraMode} target={cameraTarget} />
    </>
  )
}

function MarketChart({ star }: { star: StarData }) {
  const { data: priceData, isLoading } = usePrices(star.market.clobTokenId, "1w")

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

  return (
    <div className="h-[320px] shrink-0 bg-[#0a0a1a]/80 backdrop-blur border border-[#1a1a3a] rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[#1a1a3a]">
        <p className="text-[10px] text-[#aabbcc] truncate">{star.market.question}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[#556688]">
            {(star.market.probability * 100).toFixed(1)}%
          </span>
          {star.signal && (
            <span className={`text-[10px] font-mono ${star.signal.ev > 0 ? "text-[#00ff88]" : "text-[#ff4466]"}`}>
              {star.signal.ev > 0 ? "+" : ""}{(star.signal.ev * 100).toFixed(1)}pp
            </span>
          )}
        </div>
      </div>
      <div className="h-[275px]">
        {isLoading || chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] text-[#556688] animate-pulse">
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
            hideTimeScale
            height={275}
          />
        )}
      </div>
    </div>
  )
}

export function GalaxyScene() {
  const galaxyData = useGalaxyData()
  const mousePos = useRef(new THREE.Vector3(9999, 9999, 9999))

  const [cameraMode, setCameraMode] = useState<CameraMode>("galaxy")
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 0, 0])
  const [focusedConstellation, setFocusedConstellation] = useState<string | null>(null)
  const [selectedStar, setSelectedStar] = useState<StarData | null>(null)

  const handleConstellationClick = useCallback((constellation: ConstellationData) => {
    setCameraMode("constellation")
    setCameraTarget(constellation.position)
    setFocusedConstellation(constellation.name)
    setSelectedStar(null)
  }, [])

  const handleBackToGalaxy = useCallback(() => {
    setCameraMode("galaxy")
    setFocusedConstellation(null)
    setSelectedStar(null)
  }, [])

  const handleStarClick = useCallback((star: StarData) => {
    setSelectedStar(star)
  }, [])

  // Find focused constellation's stars for the side list
  const focusedData = galaxyData.constellations.find((c) => c.name === focusedConstellation)

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
            constellations={galaxyData.constellations}
            focusedConstellation={focusedConstellation}
            cameraMode={cameraMode}
            cameraTarget={cameraTarget}
            mousePos={mousePos}
            onConstellationClick={handleConstellationClick}
            onStarClick={handleStarClick}
          />
        </Suspense>
      </Canvas>

      {/* Loading overlay */}
      {galaxyData.loading && <LoadingOverlay />}

      {/* Header */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 40 }}>
        <div className="flex items-center gap-3">
          {cameraMode === "constellation" && (
            <button
              onClick={handleBackToGalaxy}
              className="flex items-center gap-1.5 bg-[#0a0a1a]/80 backdrop-blur border border-[#1a1a3a] rounded px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#667799] hover:text-[#ccd0e0] hover:border-[#334466] transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Galaxy
            </button>
          )}
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#ccd0e0]">
              DARWIN CAPITAL
            </h1>
            {focusedConstellation && (
              <span className="text-[10px] uppercase tracking-wider text-[#556688]">
                {focusedConstellation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Agent stats */}
      <AgentStatsOverlay />

      {/* Market list + chart when zoomed into constellation */}
      {focusedData && (
        <div className="absolute left-4 top-20 bottom-4 w-[380px] z-40 flex flex-col gap-2 pointer-events-auto">
          {/* Market list */}
          <div className={`bg-[#0a0a1a]/80 backdrop-blur border border-[#1a1a3a] rounded-lg overflow-y-auto ${selectedStar ? "flex-1 min-h-0" : "h-full"}`}>
            <div className="px-3 py-2 border-b border-[#1a1a3a] sticky top-0 bg-[#0a0a1a]/95">
              <span className="text-[10px] uppercase tracking-wider text-[#556688]">
                {focusedData.stars.length} Markets
              </span>
            </div>
            {focusedData.stars
              .sort((a, b) => Math.abs(b.signal?.ev ?? 0) - Math.abs(a.signal?.ev ?? 0))
              .map((star) => (
                <button
                  key={star.market.id}
                  onClick={() => setSelectedStar(star)}
                  className={`w-full text-left px-3 py-2 border-b border-[#0d0d20] hover:bg-[#111128] transition-colors ${
                    selectedStar?.market.id === star.market.id ? "bg-[#111128]" : ""
                  }`}
                >
                  <p className="text-[11px] text-[#aabbcc] leading-tight truncate">
                    {star.market.question}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#556688]">
                      {(star.market.probability * 100).toFixed(0)}%
                    </span>
                    {star.signal && (
                      <span
                        className={`text-[10px] font-mono ${
                          star.signal.ev > 0 ? "text-[#00ff88]" : "text-[#ff4466]"
                        }`}
                      >
                        {star.signal.ev > 0 ? "+" : ""}{(star.signal.ev * 100).toFixed(1)}pp
                      </span>
                    )}
                  </div>
                </button>
              ))}
          </div>

          {/* Chart panel */}
          {selectedStar && <MarketChart star={selectedStar} />}
        </div>
      )}

      {/* Detail panel */}
      {selectedStar && (
        <StarDetailPanel
          star={selectedStar}
          onClose={() => setSelectedStar(null)}
        />
      )}

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 40, pointerEvents: "none" }}>
        <div className="bg-[#0a0a1a]/60 backdrop-blur border border-[#1a1a3a] rounded px-3 py-2">
          <div className="flex items-center gap-4 text-[10px] text-[#556688]">
            <span>Cloud density = market count</span>
            <span>Brightness = signal strength</span>
            <span>Click constellation to explore</span>
          </div>
        </div>
      </div>
    </div>
  )
}
