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
  ySpread: number  // thin vertical spread — keeps it disc-shaped
}

interface ParticleCloudLayerProps {
  config: CloudLayerConfig
  mousePos: THREE.Vector3
}

const NUM_ARMS = 3
const ARM_SPREAD = 0.4 // how wide each arm fans out

function ParticleCloudLayer({ config, mousePos }: ParticleCloudLayerProps) {
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

    for (let i = 0; i < count; i++) {
      // Pick a spiral arm
      const armIndex = i % NUM_ARMS
      const armAngle = (armIndex / NUM_ARMS) * Math.PI * 2

      // Distance from center
      const t = Math.random()
      const r = minRadius + t * (maxRadius - minRadius)

      // Spiral: angle increases with radius (logarithmic spiral)
      const spiralAngle = armAngle + t * 2.5 + (Math.random() - 0.5) * ARM_SPREAD * (1.0 + t)

      positions[i * 3 + 0] = r * Math.cos(spiralAngle)
      positions[i * 3 + 1] = (Math.random() - 0.5) * ySpread
      positions[i * 3 + 2] = r * Math.sin(spiralAngle)

      // Bigger near center, smaller at edges
      sizes[i] = 0.3 + Math.random() * 0.7 * (1.0 - t * 0.4)
      phases[i] = Math.random() * Math.PI * 2
      arms[i] = armIndex / NUM_ARMS
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
  flatten: boolean  // true = zoomed in, rotate to horizontal
}

export function ParticleCloud({ layers, center, tilt, mousePos, flatten }: ParticleCloudProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Target rotation: nebula tilt when galaxy view, flat horizontal when zoomed in
  const targetEuler = useMemo(() => {
    if (flatten) return new THREE.Euler(0, 0, 0)
    return new THREE.Euler(tilt[0], tilt[1], tilt[2])
  }, [flatten, tilt])

  const targetQuat = useMemo(() => new THREE.Quaternion().setFromEuler(targetEuler), [targetEuler])

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.quaternion.slerp(targetQuat, 0.03)
  })

  return (
    <group position={center} ref={groupRef} rotation={tilt}>
      {layers.map((layer, i) => (
        <ParticleCloudLayer
          key={i}
          config={layer}
          mousePos={mousePos}
        />
      ))}
    </group>
  )
}
