"use client"

import { useState, useCallback, useRef, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { Background } from "./background"
import { GalaxyView } from "./galaxy-view"
import { CameraController } from "./camera-controller"
import { StarDetailPanel } from "./star-detail-panel"
import { Ufo } from "./ufo"
import { ScoutNotificationPanel } from "./scout-notification-panel"
import { useGalaxyData } from "@/hooks/use-galaxy-data"
import { useSignals } from "@/hooks/use-signals"
import { useHealth } from "@/hooks/use-health"
import { useScout, useScoutConfig, useScoutDismiss } from "@/hooks/use-scout"
import type { ConstellationData, StarData } from "@/hooks/use-galaxy-data"
import type { CameraMode } from "./camera-controller"
import { ArrowLeft, Loader2, X } from "lucide-react"

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

function AgentStatsOverlay({ onOpenConfig }: { onOpenConfig: () => void }) {
  const { data: signalsData } = useSignals()
  const { data: health } = useHealth()
  const { data: scoutData } = useScout(1)

  const signalCount = signalsData?.total ?? 0
  const highEv = signalsData?.signals.filter((s) => s.confidence === "high").length ?? 0
  const totalAlphaPp = signalsData?.signals.reduce((sum, s) => sum + Math.abs(s.ev) * 100, 0) ?? 0

  const latestScout = scoutData?.events[0]
  const scoutLabel = latestScout
    ? latestScout.article.title.slice(0, 32) + (latestScout.article.title.length > 32 ? "…" : "")
    : "Scanning feeds…"

  return (
    <div className="absolute top-4 right-4 z-40 pointer-events-none" style={{ pointerEvents: "none" }}>
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
          <div className="pt-1 mt-1 border-t border-[#1a1a3a]">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-[#44aaff] animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider text-[#44aaff]">Scout</span>
              </div>
              <button
                onClick={onOpenConfig}
                style={{ pointerEvents: "auto" }}
                className="text-[10px] text-[#334455] hover:text-[#44aaff] transition-colors leading-none"
                title="Configure scout keywords"
              >
                👽
              </button>
            </div>
            <p className="text-[10px] text-[#667799] truncate leading-tight">{scoutLabel}</p>
          </div>
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
        className="bg-[#07091a]/95 backdrop-blur border border-[#1a2a44] rounded-2xl p-5 w-[380px] shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Alien header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl select-none leading-none mt-0.5">👽</span>
            <div>
              <p className="text-[13px] font-medium text-[#9bbee0] leading-snug min-h-[2.4rem]">
                {GREETING.slice(0, charIdx)}
                {talking && (
                  <span className="animate-pulse text-[#3399ff]">▋</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#334455] hover:text-[#667799] transition-colors shrink-0 mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-[#1a2a44] mb-3" />

        {/* Label */}
        <p className="text-[9px] uppercase tracking-wider text-[#445566] mb-2">
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
            className="flex-1 bg-[#0d1520] border border-[#1a2a44] rounded-lg px-3 py-1.5 text-[11px] text-[#aabbcc] placeholder-[#2a3a50] outline-none focus:border-[#2255aa] transition-colors"
          />
          <button
            onClick={addKeyword}
            className="px-3 py-1.5 bg-[#132244] hover:bg-[#1a3060] text-[#4488dd] text-[11px] rounded-lg border border-[#1e3a6a] transition-colors"
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
                className="flex items-center gap-1 bg-[#0f1e38] text-[#6699cc] text-[10px] px-2 py-0.5 rounded-full border border-[#1e3054]"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-[#334466] hover:text-[#8899bb] leading-none transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[#2a3a50] italic min-h-[28px] flex items-center">
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
  cameraMode,
  cameraTarget,
  mousePos,
  onConstellationClick,
  onUfoClick,
}: {
  constellations: ConstellationData[]
  focusedConstellation: string | null
  cameraMode: CameraMode
  cameraTarget: [number, number, number]
  mousePos: React.MutableRefObject<THREE.Vector3>
  onConstellationClick: (constellation: ConstellationData) => void
  onUfoClick: () => void
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
        />
      )}
      <Ufo constellations={constellations} onUfoClick={onUfoClick} />
      <CameraController mode={cameraMode} target={cameraTarget} />
    </>
  )
}

export function GalaxyScene() {
  const galaxyData = useGalaxyData()
  const { data: scoutData } = useScout(10)
  const { mutate: dismissEvent } = useScoutDismiss()
  const mousePos = useRef(new THREE.Vector3(9999, 9999, 9999))

  const [cameraMode, setCameraMode] = useState<CameraMode>("galaxy")
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 0, 0])
  const [focusedConstellation, setFocusedConstellation] = useState<string | null>(null)
  const [selectedStar, setSelectedStar] = useState<StarData | null>(null)
  const [scoutConfigOpen, setScoutConfigOpen] = useState(false)

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

  const handleUfoClick = useCallback(() => {
    setScoutConfigOpen(true)
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
            onUfoClick={handleUfoClick}
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
      <AgentStatsOverlay onOpenConfig={handleUfoClick} />

      {/* Market list when zoomed into constellation */}
      {focusedData && (
        <div className="absolute left-4 top-20 bottom-4 w-[280px] z-40 overflow-hidden pointer-events-auto">
          <div className="h-full bg-[#0a0a1a]/80 backdrop-blur border border-[#1a1a3a] rounded-lg overflow-y-auto">
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
                  className="w-full text-left px-3 py-2 border-b border-[#0d0d20] hover:bg-[#111128] transition-colors"
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
        </div>
      )}

      {/* Detail panel */}
      {selectedStar && (
        <StarDetailPanel
          star={selectedStar}
          onClose={() => setSelectedStar(null)}
        />
      )}

      {/* Scout notification panel — bottom-right, hidden when star detail is open */}
      {!selectedStar && scoutData?.events && scoutData.events.length > 0 && (
        <div className="absolute bottom-4 right-4 z-40 pointer-events-auto">
          <ScoutNotificationPanel
            events={scoutData.events}
            onDismiss={dismissEvent}
          />
        </div>
      )}

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 40, pointerEvents: "none" }}>
        <div className="bg-[#0a0a1a]/60 backdrop-blur border border-[#1a1a3a] rounded px-3 py-2">
          <div className="flex items-center gap-4 text-[10px] text-[#556688]">
            <span>Cloud density = market count</span>
            <span>Brightness = signal strength</span>
            <span>Click UFO to configure scout</span>
          </div>
        </div>
      </div>

      {/* Alien scout config panel — opens on UFO click */}
      {scoutConfigOpen && (
        <ScoutConfigPanel onClose={() => setScoutConfigOpen(false)} />
      )}
    </div>
  )
}
