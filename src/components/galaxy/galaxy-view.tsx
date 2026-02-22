"use client"

import * as THREE from "three"
import { Billboard, Text } from "@react-three/drei"
import { ParticleCloud } from "./particle-cloud"
import type { ConstellationData, StarData } from "@/hooks/use-galaxy-data"

interface GalaxyViewProps {
  constellations: ConstellationData[]
  focusedConstellation: string | null
  mousePos: THREE.Vector3
  onConstellationClick: (constellation: ConstellationData) => void
}

export function GalaxyView({
  constellations,
  focusedConstellation,
  mousePos,
  onConstellationClick,
}: GalaxyViewProps) {
  return (
    <group>
      {constellations.map((c) => {
        const dimmed = focusedConstellation !== null && focusedConstellation !== c.name
        const focused = focusedConstellation === c.name
        const layers = dimmed
          ? c.layers.map((l) => ({ ...l, opacity: l.opacity * 0.15 }))
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

            {/* Clickable hit area */}
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

            {/* Label */}
            <Billboard
              position={[
                c.position[0],
                c.position[1] + 6,
                c.position[2],
              ]}
              follow
              lockX={false}
              lockY={false}
              lockZ={false}
            >
              <group
                onClick={(e) => {
                  e.stopPropagation()
                  onConstellationClick(c)
                }}
                onPointerOver={() => { document.body.style.cursor = "pointer" }}
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
                  {`${c.stars.length} markets${c.signalCount > 0 ? ` · ${c.signalCount} signals` : ""}`}
                </Text>
              </group>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}
