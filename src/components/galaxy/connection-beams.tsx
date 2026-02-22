"use client"

import { useRef, useMemo, useEffect } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { extractKeywords, keywordSimilarity } from "@/hooks/use-galaxy-data"
import type { StarData } from "@/hooks/use-galaxy-data"

interface ConnectionBeamsProps {
  selectedStars: StarData[]
  allStars: StarData[]
  center: [number, number, number]
  maxBeams?: number
}

function getWorldPos(star: StarData, center: [number, number, number]): [number, number, number] {
  return [
    center[0] + star.localPosition[0],
    center[1] + star.localPosition[1] * 0.08,
    center[2] + star.localPosition[2],
  ]
}

function findRelatedStars(star: StarData, allStars: StarData[], max: number): StarData[] {
  const starKeywords = extractKeywords(star.market.question)
  return allStars
    .filter((s) => s.market.id !== star.market.id)
    .map((s) => ({
      star: s,
      similarity: keywordSimilarity(starKeywords, extractKeywords(s.market.question)),
    }))
    .filter((x) => x.similarity > 0.15)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max)
    .map((x) => x.star)
}

function Beam({ from, to, strength }: { from: [number, number, number]; to: [number, number, number]; strength: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const lineRef = useRef<THREE.Line | null>(null)
  const age = useRef(0)

  useEffect(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array([...from, ...to])
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color("#66bbff"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const line = new THREE.Line(geometry, material)
    lineRef.current = line
    groupRef.current?.add(line)

    return () => {
      groupRef.current?.remove(line)
      geometry.dispose()
      material.dispose()
    }
  }, [from, to])

  useFrame((_, delta) => {
    age.current += delta
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial
      const fadeIn = Math.min(age.current / 0.3, 1)
      const pulse = 0.85 + 0.15 * Math.sin(age.current * 2.5)
      mat.opacity = fadeIn * pulse * (0.6 + 0.4 * strength)
    }
  })

  return <group ref={groupRef} />
}

export function ConnectionBeams({ selectedStars, allStars, center, maxBeams = 5 }: ConnectionBeamsProps) {
  const beams = useMemo(() => {
    const result: { from: [number, number, number]; to: [number, number, number]; strength: number; key: string }[] = []
    for (const star of selectedStars) {
      const related = findRelatedStars(star, allStars, maxBeams)
      const starKeywords = extractKeywords(star.market.question)
      const fromPos = getWorldPos(star, center)
      for (const neighbor of related) {
        const toPos = getWorldPos(neighbor, center)
        const sim = keywordSimilarity(starKeywords, extractKeywords(neighbor.market.question))
        result.push({ from: fromPos, to: toPos, strength: sim, key: `${star.market.id}-${neighbor.market.id}` })
      }
    }
    return result
  }, [selectedStars, allStars, center, maxBeams])

  return (
    <group>
      {beams.map((b) => (
        <Beam key={b.key} from={b.from} to={b.to} strength={b.strength} />
      ))}
    </group>
  )
}
