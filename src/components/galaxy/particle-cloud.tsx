"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { vertexShader, fragmentShader } from "./shaders"
import { getGlowTexture } from "./glow-texture"

export interface CloudLayerConfig {
  count: number
  minRadius: number
  maxRadius: number
  baseSize: number
  color: string
  opacity: number
  twistAmp: number
  ySpread: number
}

interface ParticleCloudLayerProps {
  config: CloudLayerConfig
  mousePos: THREE.Vector3
  flatten: boolean
}

// Box-Muller transform for gaussian random
function gaussRandom(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2)
}

function ParticleCloudLayer({ config, mousePos, flatten }: ParticleCloudLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { geometry, uniforms } = useMemo(() => {
    const { count, minRadius, maxRadius, ySpread } = config

    const planeGeo = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", planeGeo.getAttribute("position"))
    geo.setAttribute("uv", planeGeo.getAttribute("uv"))
    geo.setIndex(planeGeo.getIndex())
    geo.instanceCount = count

    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const arms = new Float32Array(count)

    const range = maxRadius - minRadius
    const rng = () => Math.random()

    for (let i = 0; i < count; i++) {
      // Gaussian-weighted radial distribution — dense center, sparse edges
      const g = Math.abs(gaussRandom(rng)) * 0.4 // 0-~1.5, concentrated near 0
      const t = Math.min(g, 1.0) // clamp
      const r = minRadius + t * range

      // Uniform angle
      const angle = rng() * Math.PI * 2

      // Spherical-ish Y: gaussian spread, thinner than XZ
      const yGauss = gaussRandom(rng) * ySpread * (1.0 - t * 0.3) * 0.3

      positions[i * 3 + 0] = r * Math.cos(angle)
      positions[i * 3 + 1] = yGauss
      positions[i * 3 + 2] = r * Math.sin(angle)

      // Size distribution: mostly small, few bright large ones (power law)
      const sizeRoll = rng()
      if (sizeRoll < 0.02) {
        sizes[i] = 1.5 + rng() * 1.5 // rare bright stars
      } else if (sizeRoll < 0.15) {
        sizes[i] = 0.6 + rng() * 0.9 // medium stars
      } else {
        sizes[i] = 0.15 + rng() * 0.45 // majority small
      }

      // Bigger stars closer to center
      sizes[i] *= (1.0 + (1.0 - t) * 0.5)

      phases[i] = rng() * Math.PI * 2
      arms[i] = 0 // no spiral arms for cluster look
    }

    geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(positions, 3))
    geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1))
    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1))
    geo.setAttribute("aArm", new THREE.InstancedBufferAttribute(arms, 1))

    const color = new THREE.Color(config.color)

    const u = {
      uTime: { value: 0 },
      uTwistAmp: { value: config.twistAmp },
      uBaseSize: { value: config.baseSize },
      uColor: { value: color },
      uOpacity: { value: config.opacity },
      uTexture: { value: getGlowTexture() },
      uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
      uMouseRadius: { value: 5.0 },
      uSphereRadius: { value: 2.5 },
      uFlatten: { value: 0.0 },
    }

    return { geometry: geo, uniforms: u }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(config.color)
      materialRef.current.uniforms.uOpacity.value = config.opacity
      materialRef.current.uniforms.uTwistAmp.value = config.twistAmp
      materialRef.current.uniforms.uBaseSize.value = config.baseSize
    }
  }, [config.color, config.opacity, config.twistAmp, config.baseSize])

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uMouse.value.copy(mousePos)
    // Smoothly animate flatten
    const target = flatten ? 1.0 : 0.0
    const current = materialRef.current.uniforms.uFlatten.value
    materialRef.current.uniforms.uFlatten.value += (target - current) * 0.12
  })

  return (
    <mesh ref={meshRef}>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export interface ParticleCloudProps {
  layers: CloudLayerConfig[]
  center: [number, number, number]
  tilt: [number, number, number]
  mousePos: THREE.Vector3
  flatten: boolean
}

export function ParticleCloud({ layers, center, tilt, mousePos, flatten }: ParticleCloudProps) {
  const groupRef = useRef<THREE.Group>(null)

  const targetQuat = useMemo(() => {
    const euler = flatten ? new THREE.Euler(0, 0, 0) : new THREE.Euler(tilt[0], tilt[1], tilt[2])
    return new THREE.Quaternion().setFromEuler(euler)
  }, [flatten, tilt])

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.quaternion.slerp(targetQuat, 0.08)
  })

  // Set initial rotation via quaternion (not euler prop, which fights slerp)
  useEffect(() => {
    if (!groupRef.current) return
    const euler = new THREE.Euler(tilt[0], tilt[1], tilt[2])
    groupRef.current.quaternion.setFromEuler(euler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <group position={center} ref={groupRef}>
      {layers.map((layer, i) => (
        <ParticleCloudLayer
          key={i}
          config={layer}
          mousePos={mousePos}
          flatten={flatten}
        />
      ))}
    </group>
  )
}
