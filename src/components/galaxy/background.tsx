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
        count={8000}
        factor={7}
        saturation={0.3}
        fade
        speed={0.3}
      />
      {/* Dense small filler stars in the mid-field between galaxies */}
      <Stars
        radius={60}
        depth={60}
        count={4000}
        factor={3}
        saturation={0.1}
        fade
        speed={0.1}
      />
      <Sparkles
        count={300}
        scale={80}
        size={1.2}
        speed={0.05}
        opacity={0.5}
        color="#8899bb"
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
