"use client"

import { useState, useMemo, useRef } from "react"
import * as THREE from "three"
import { Billboard, Text } from "@react-three/drei"
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
      {/* Label on hover */}
      {hovered && (
        <Billboard position={[0, glowSize * 0.6 + 0.5, 0]}>
          <Text
            fontSize={0.4}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.08}
            outlineBlur={0.2}
            outlineColor="#000000"
            outlineOpacity={0.9}
            maxWidth={8}
          >
            {star.market.question}
          </Text>
          {star.signal && (
            <Text
              fontSize={0.3}
              color={star.signal.ev > 0 ? "#00ff88" : "#ff4466"}
              anchorX="center"
              anchorY="top"
              position={[0, -0.15, 0]}
              outlineWidth={0.05}
              outlineBlur={0.15}
              outlineColor="#000000"
              outlineOpacity={0.8}
            >
              {`${star.signal.ev > 0 ? "+" : ""}${(star.signal.ev * 100).toFixed(1)}pp EV`}
            </Text>
          )}
        </Billboard>
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
          fontSize={1.4}
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
            fontSize={0.65}
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
            ? c.layers.map((l) => ({ ...l, opacity: l.opacity * 0.12 }))
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
