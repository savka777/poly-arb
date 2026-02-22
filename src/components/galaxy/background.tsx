"use client"

import { Stars, Sparkles } from "@react-three/drei"

export function Background() {
  return (
    <>
      <color attach="background" args={["#020208"]} />
      <fog attach="fog" args={["#020208", 100, 250]} />
      <Stars
        radius={180}
        depth={100}
        count={5000}
        factor={5}
        saturation={0.2}
        fade
        speed={0.3}
      />
      <Sparkles
        count={150}
        scale={140}
        size={2}
        speed={0.15}
        opacity={0.4}
        color="#6688cc"
      />
      <Sparkles
        count={50}
        scale={100}
        size={3}
        speed={0.1}
        opacity={0.2}
        color="#88aaff"
      />
    </>
  )
}
