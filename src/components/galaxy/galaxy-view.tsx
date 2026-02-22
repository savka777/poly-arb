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
                  fontSize={1.0}
                  color={dimmed ? "#334455" : c.primaryColor}
                  anchorX="center"
                  anchorY="bottom"
                  letterSpacing={0.12}
                >
                  {c.name.toUpperCase()}
                </Text>
                <Text
                  fontSize={0.5}
                  color={dimmed ? "#223344" : "#667799"}
                  anchorX="center"
                  anchorY="top"
                  position={[0, -0.25, 0]}
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
