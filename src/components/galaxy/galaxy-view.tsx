"use client"

import { useState, useMemo, useRef } from "react"
import * as THREE from "three"
import { Billboard, Text, Html } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { ParticleCloud } from "./particle-cloud"
import { getGlowTexture } from "./glow-texture"
import type { ConstellationData, StarData } from "@/hooks/use-galaxy-data"

interface GalaxyViewProps {
  constellations: ConstellationData[]
  focusedConstellation: string | null
  mousePos: THREE.Vector3
  onConstellationClick: (constellation: ConstellationData) => void
  onStarClick: (star: StarData) => void
}

function StarHoverCard({ star }: { star: StarData }) {
  const yesPct = star.market.probability * 100
  const noPct = (1 - star.market.probability) * 100
  const darwinPct = star.signal ? star.signal.darwinEstimate * 100 : null
  const ev = star.signal?.ev ?? 0

  return (
    <div
      style={{
        width: 320,
        background: "rgba(24, 24, 24, 0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "14px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Category */}
      <div style={{ fontSize: 10, color: "#888888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {star.market.category ?? "uncategorized"}
      </div>

      {/* Question */}
      <div style={{ fontSize: 14, color: "#eeeeee", lineHeight: 1.35, marginBottom: 10, fontWeight: 500 }}>
        {star.market.question}
      </div>

      {/* Yes/No bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: "#00dd66", fontFamily: "monospace", fontWeight: 600 }}>
            Yes {yesPct.toFixed(0)}¢
          </span>
          <span style={{ fontSize: 13, color: "#ee4455", fontFamily: "monospace", fontWeight: 600 }}>
            No {noPct.toFixed(0)}¢
          </span>
        </div>
        <div style={{ position: "relative", height: 8, borderRadius: 4, overflow: "hidden", background: "#2a2a2a" }}>
          {/* Yes bar from left */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${yesPct}%`,
              background: "linear-gradient(90deg, #00dd66, #00dd66aa)",
              borderRadius: 4,
            }}
          />
          {/* No bar from right */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: `${noPct}%`,
              background: "linear-gradient(270deg, #ee4455, #ee4455aa)",
              borderRadius: 4,
            }}
          />
          {/* Yellow overlap where they meet */}
          {yesPct + noPct > 100 && (() => {
            const overlapStart = 100 - noPct
            const overlapWidth = yesPct - overlapStart
            return (
              <div
                style={{
                  position: "absolute",
                  left: `${overlapStart}%`,
                  top: 0,
                  bottom: 0,
                  width: `${overlapWidth}%`,
                  background: "#ffcc00",
                  borderRadius: 2,
                }}
              />
            )
          })()}
          {/* Darwin estimate marker */}
          {darwinPct !== null && (
            <div
              style={{
                position: "absolute",
                left: `${darwinPct}%`,
                top: -2,
                bottom: -2,
                width: 2.5,
                background: "#ffffff",
                borderRadius: 1,
                boxShadow: "0 0 6px rgba(255,255,255,0.7)",
              }}
            />
          )}
        </div>
      </div>

      {/* Gap/overlap indicator */}
      {star.signal && darwinPct !== null && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#999999", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {Math.abs(ev) > 0 ? (ev > 0 ? "Underpriced" : "Overpriced") : "Fair"}
            </span>
            <span
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                fontWeight: 700,
                color: ev > 0 ? "#00ff88" : "#ff4466",
              }}
            >
              {ev > 0 ? "+" : ""}{(ev * 100).toFixed(1)}pp
            </span>
          </div>
          {/* Gap bar */}
          <div style={{ position: "relative", height: 5, borderRadius: 3, background: "#2a2a2a" }}>
            {(() => {
              const marketPct = yesPct
              const left = Math.min(marketPct, darwinPct)
              const width = Math.abs(darwinPct - marketPct)
              return (
                <div
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: 0,
                    bottom: 0,
                    width: `${Math.max(width, 0.5)}%`,
                    background: ev > 0 ? "rgba(0,255,136,0.4)" : "rgba(255,68,102,0.4)",
                    borderRadius: 3,
                  }}
                />
              )
            })()}
          </div>
        </div>
      )}

      {/* Volume */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#777777" }}>
          ${(star.market.volume / 1e6).toFixed(1)}M volume
        </span>
        {star.signal && (
          <span style={{ fontSize: 11, color: "#777777" }}>
            {star.signal.confidence} confidence
          </span>
        )}
      </div>
    </div>
  )
}

function MarketStar({ star, center, onStarClick }: {
  star: StarData
  center: [number, number, number]
  onStarClick: (star: StarData) => void
}) {
  const [hovered, setHovered] = useState(false)
  const pos: [number, number, number] = [
    center[0] + star.localPosition[0],
    center[1] + star.localPosition[1] * 0.08, // squashed Y to match flattened disc
    center[2] + star.localPosition[2],
  ]

  const glowSize = star.size * 1.8 * (hovered ? 1.5 : 1)
  const color = useMemo(() => new THREE.Color(star.color), [star.color])

  return (
    <group position={pos}>
      {/* Bright core glow — billboard */}
      <Billboard>
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            onStarClick(star)
          }}
          onPointerOver={() => {
            setHovered(true)
            document.body.style.cursor = "pointer"
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = "auto"
          }}
        >
          <planeGeometry args={[glowSize, glowSize]} />
          <meshBasicMaterial
            map={getGlowTexture()}
            color={color}
            transparent
            opacity={0.9 + star.emissiveIntensity * 0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
      {/* Wider soft halo */}
      <Billboard>
        <mesh>
          <planeGeometry args={[glowSize * 2, glowSize * 2]} />
          <meshBasicMaterial
            map={getGlowTexture()}
            color={color}
            transparent
            opacity={0.2 + star.emissiveIntensity * 0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
      {/* Hover card */}
      {hovered && (
        <Html
          position={[0, glowSize * 0.3 + 0.1, 0]}
          center
          style={{ pointerEvents: "none", transform: "translateY(-100%)" }}
        >
          <StarHoverCard star={star} />
        </Html>
      )}
    </group>
  )
}

function DistanceLabel({
  position,
  dimmed,
  focused,
  constellation: c,
  onConstellationClick,
}: {
  position: [number, number, number]
  dimmed: boolean
  focused: boolean
  constellation: ConstellationData
  onConstellationClick: (c: ConstellationData) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!groupRef.current) return
    const dist = camera.position.distanceTo(new THREE.Vector3(...position))
    // Scale up with distance so text stays roughly the same screen size
    const scale = Math.max(dist * 0.018, 1)
    groupRef.current.scale.setScalar(scale)
  })

  return (
    <Billboard
      position={position}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group
        ref={groupRef}
        onClick={(e) => {
          if (!focused) {
            e.stopPropagation()
            onConstellationClick(c)
          }
        }}
        onPointerOver={() => { if (!focused) document.body.style.cursor = "pointer" }}
        onPointerOut={() => { document.body.style.cursor = "auto" }}
      >
        <Text
          fontSize={0.9}
          color={dimmed ? "#445566" : "#ffffff"}
          anchorX="center"
          anchorY="bottom"
          letterSpacing={0.12}
          outlineWidth={0.15}
          outlineBlur={0.4}
          outlineColor="#000000"
          outlineOpacity={0.8}
        >
          {c.name.toUpperCase()}
        </Text>
        {focused && (
          <Text
            fontSize={0.45}
            color={dimmed ? "#334455" : "#99aabb"}
            anchorX="center"
            anchorY="top"
            position={[0, -0.3, 0]}
            outlineWidth={0.1}
            outlineBlur={0.3}
            outlineColor="#000000"
            outlineOpacity={0.7}
          >
            {`${c.stars.length} trades`}
          </Text>
        )}
      </group>
    </Billboard>
  )
}

export function GalaxyView({
  constellations,
  focusedConstellation,
  mousePos,
  onConstellationClick,
  onStarClick,
}: GalaxyViewProps) {
  return (
    <group>
      {constellations.map((c) => {
        const dimmed = focusedConstellation !== null && focusedConstellation !== c.name
        const focused = focusedConstellation === c.name
        // When focused, dim the cloud heavily so individual stars pop
        const layers = dimmed
          ? c.layers.map((l) => ({ ...l, opacity: l.opacity * 0.15 }))
          : focused
            ? c.layers.map((l) => ({ ...l, opacity: l.opacity * 0.04 }))
            : c.layers

        return (
          <group key={c.name}>
            <ParticleCloud
              layers={layers}
              center={c.position}
              tilt={c.tilt}
              mousePos={mousePos}
              flatten={focused}
            />

            {/* Individual market stars — only when focused */}
            {focused && c.stars.map((star) => (
              <MarketStar
                key={star.market.id}
                star={star}
                center={c.position}
                onStarClick={onStarClick}
              />
            ))}

            {/* Clickable hit area — only when not focused */}
            {!focused && (
              <mesh
                position={c.position}
                onClick={(e) => {
                  e.stopPropagation()
                  onConstellationClick(c)
                }}
                onPointerOver={() => { document.body.style.cursor = "pointer" }}
                onPointerOut={() => { document.body.style.cursor = "auto" }}
                visible={false}
              >
                <sphereGeometry args={[8, 8, 8]} />
                <meshBasicMaterial />
              </mesh>
            )}

            {/* Label — scales with distance so it stays readable */}
            <DistanceLabel
              position={[c.position[0], c.position[1] + 6, c.position[2]]}
              dimmed={dimmed}
              focused={focused}
              constellation={c}
              onConstellationClick={onConstellationClick}
            />
          </group>
        )
      })}
    </group>
  )
}
