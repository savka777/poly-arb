"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useScout } from "@/hooks/use-scout"
import { getGlowTexture } from "./glow-texture"
import type { ConstellationData } from "@/hooks/use-galaxy-data"

const HIGH_VALUE_OVERLAP = 0.6
type UfoState = "idle" | "flying" | "arrived"

const lerpF = (speed: number, delta: number) => 1 - Math.exp(-speed * delta)

// Color palette — grey saucer body, blue ring, blue dome, green rim lights
const C_BODY      = new THREE.Color("#28282e")   // neutral dark grey disc body
const C_BODY_RIM  = new THREE.Color("#36363e")   // lighter grey rim band
const C_RING      = new THREE.Color("#1e5599")   // primary blue underring
const C_RING_IN   = new THREE.Color("#0e3366")   // inner detail ring
const C_RING_OUT  = new THREE.Color("#0a2244")   // faint outer halo
const C_DOME      = new THREE.Color("#0d5fbf")   // blue dome surface
const C_DOME_GLOW = new THREE.Color("#3399ff")   // blue dome glow sprite
const C_GREEN     = new THREE.Color("#00ee77")   // pulse rings + constellation ring
const C_RIM       = new THREE.Color("#22cc66")   // rim lights (green, for contrast)
const C_BEAM      = new THREE.Color("#00cc66")   // tractor beam

function findConstellation(
  category: string | undefined,
  constellations: ConstellationData[],
): ConstellationData | null {
  if (!category) return null
  const cat = category.toLowerCase()
  return (
    constellations.find(
      (c) => c.name.toLowerCase().includes(cat) || cat.includes(c.name.toLowerCase()),
    ) ?? null
  )
}

interface UfoProps {
  constellations: ConstellationData[]
  onUfoClick?: () => void
}

export function Ufo({ constellations, onUfoClick }: UfoProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Material refs — mutated in useFrame, never re-created
  const discMatRef       = useRef<THREE.MeshBasicMaterial>(null)
  const rimBandMatRef    = useRef<THREE.MeshBasicMaterial>(null)
  const underMatRef      = useRef<THREE.MeshBasicMaterial>(null)
  const domeMatRef       = useRef<THREE.MeshBasicMaterial>(null)
  const domeSpriteMatRef = useRef<THREE.SpriteMaterial>(null)
  const ring1MatRef      = useRef<THREE.MeshBasicMaterial>(null) // primary
  const ring2MatRef      = useRef<THREE.MeshBasicMaterial>(null) // inner detail
  const ring3MatRef      = useRef<THREE.MeshBasicMaterial>(null) // outer halo

  // Pulse rings
  const pulse1Ref    = useRef<THREE.Mesh>(null)
  const pulse1MatRef = useRef<THREE.MeshBasicMaterial>(null)
  const pulse2Ref    = useRef<THREE.Mesh>(null)
  const pulse2MatRef = useRef<THREE.MeshBasicMaterial>(null)

  // World-space constellation ring
  const constRingRef    = useRef<THREE.Mesh>(null)
  const constRingMatRef = useRef<THREE.MeshBasicMaterial>(null)

  // Pre-allocated scratch — no per-frame allocations
  const _orbitTarget = useRef(new THREE.Vector3())
  const _dir         = useRef(new THREE.Vector3())
  const _col         = useRef(new THREE.Color())

  // State machine
  const state       = useRef<UfoState>("idle")
  const idleAngle   = useRef(0)
  const pos         = useRef(new THREE.Vector3(28, 10, 0))
  const hoverTarget = useRef(new THREE.Vector3(28, 10, 0))
  const constCenter = useRef(new THREE.Vector3())
  const arrivedAt   = useRef<number | null>(null)
  const lastTs      = useRef<string | null>(null)
  const highValue   = useRef(false)
  const clock       = useRef(0)

  // Pulse animation progress (-1 = inactive)
  const p1          = useRef(-1)
  const p2          = useRef(-1)
  const pConst      = useRef(-1)
  const beamOpacity = useRef(0)

  // Shared green rim light material
  const rimMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: new THREE.Color(C_RIM),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  // Tractor beam (world space, high-value only)
  const beamLine = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3))
    const mat = new THREE.LineBasicMaterial({
      color: C_BEAM,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const line = new THREE.Line(geo, mat)
    line.visible = false
    return line
  }, [])

  const glowTex = useMemo(() => getGlowTexture(), [])

  const { data: scoutData } = useScout(5)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    clock.current += delta

    // ── Detect new scout event ──────────────────────────────────────
    const latest = scoutData?.events[0]
    if (latest && latest.timestamp !== lastTs.current && state.current === "idle") {
      lastTs.current = latest.timestamp
      const match = latest.matchedMarkets[0]
      const constellation = findConstellation(match?.category, constellations)
      if (constellation) {
        const [cx, cy, cz] = constellation.position
        constCenter.current.set(cx, cy, cz)
        hoverTarget.current.set(cx, cy + 7, cz)
        highValue.current = (match?.keywordOverlap ?? 0) >= HIGH_VALUE_OVERLAP
        state.current = "flying"
      }
    }

    // ── State machine ───────────────────────────────────────────────
    if (state.current === "idle") {
      idleAngle.current += delta * 0.12
      _orbitTarget.current.set(
        Math.cos(idleAngle.current) * 28,
        10 + Math.sin(idleAngle.current * 0.55) * 2.5,
        Math.sin(idleAngle.current) * 28,
      )
      pos.current.lerp(_orbitTarget.current, lerpF(3, delta))
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, 0, lerpF(3, delta))
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, 0, lerpF(3, delta))
    } else if (state.current === "flying") {
      pos.current.lerp(hoverTarget.current, lerpF(5, delta))
      _dir.current.subVectors(hoverTarget.current, pos.current).normalize()
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x,  _dir.current.z * 0.36, lerpF(5, delta))
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -_dir.current.x * 0.26, lerpF(5, delta))
      if (pos.current.distanceTo(hoverTarget.current) < 1.5) {
        state.current = "arrived"
        arrivedAt.current = Date.now()
        p1.current = 0
        if (highValue.current) {
          p2.current     = 0
          pConst.current = 0
          beamOpacity.current = 0.85
        }
      }
    } else {
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, 0, lerpF(4, delta))
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, 0, lerpF(4, delta))
      if (arrivedAt.current !== null) {
        const elapsed = (Date.now() - arrivedAt.current) / 1000
        pos.current.y = THREE.MathUtils.lerp(
          pos.current.y,
          hoverTarget.current.y + Math.sin(elapsed * 2.5) * 0.5,
          lerpF(6, delta),
        )
        if (elapsed > 4.5) {
          state.current = "idle"
          arrivedAt.current = null
          highValue.current = false
          beamOpacity.current = 0
        }
      }
    }

    group.position.copy(pos.current)
    group.rotation.y += delta * (state.current === "flying" ? 2.2 : 0.5)

    // ── Brightness multiplier ────────────────────────────────────────
    const base =
      state.current === "idle"   ? 0.8 :
      state.current === "flying" ? 1.7 : 1.3
    const breathe    = Math.sin(clock.current * 1.6) * 0.10
    // alert flash: gentler — only on high-value, softer peak
    const alertFlash = highValue.current && state.current === "arrived"
      ? Math.abs(Math.sin(clock.current * 8)) * 1.8
      : 0
    const t = base + breathe + alertFlash

    // Body disc — solid, less transparent
    if (discMatRef.current)
      discMatRef.current.color.copy(_col.current.copy(C_BODY).multiplyScalar(t * 2.2))

    // Rim band — slightly lighter layer at disc edge
    if (rimBandMatRef.current)
      rimBandMatRef.current.color.copy(_col.current.copy(C_BODY_RIM).multiplyScalar(t * 2.0))

    // Undercarriage detail ring
    if (underMatRef.current)
      underMatRef.current.color.copy(_col.current.copy(C_RING_IN).multiplyScalar(t * 1.2))

    // Dome — green, solid presence
    if (domeMatRef.current)
      domeMatRef.current.color.copy(_col.current.copy(C_DOME).multiplyScalar(t * 2.0))

    // Dome glow sprite — blue, toned down
    if (domeSpriteMatRef.current)
      domeSpriteMatRef.current.color.copy(_col.current.copy(C_DOME_GLOW).multiplyScalar(t * 0.85))

    // Primary blue underring
    if (ring1MatRef.current)
      ring1MatRef.current.color.copy(_col.current.copy(C_RING).multiplyScalar(t * 1.8))

    // Inner detail ring
    if (ring2MatRef.current)
      ring2MatRef.current.color.copy(_col.current.copy(C_RING_IN).multiplyScalar(t * 1.5))

    // Outer halo — very faint
    if (ring3MatRef.current)
      ring3MatRef.current.color.copy(_col.current.copy(C_RING_OUT).multiplyScalar(t * 1.2))

    // Rim lights — gentle green throb
    const rimT = 0.4 + Math.abs(Math.sin(clock.current * 4)) * 0.4
    rimMat.color.copy(_col.current.copy(C_RIM).multiplyScalar(rimT * t * 0.9))

    // ── Pulse ring 1 — arrival (small, fast, dim) ───────────────────
    if (p1.current >= 0 && pulse1Ref.current && pulse1MatRef.current) {
      p1.current = Math.min(p1.current + delta / 1.1, 1)
      pulse1Ref.current.scale.setScalar(1 + p1.current * 2.0)
      pulse1MatRef.current.color.copy(
        _col.current.copy(C_GREEN).multiplyScalar((1 - p1.current) * 0.5),
      )
      if (p1.current >= 1) {
        p1.current = -1
        pulse1Ref.current.scale.setScalar(1)
        pulse1MatRef.current.color.setRGB(0, 0, 0)
      }
    }

    // ── Pulse ring 2 — high-value (wider but restrained) ────────────
    if (p2.current >= 0 && pulse2Ref.current && pulse2MatRef.current) {
      p2.current = Math.min(p2.current + delta / 2.0, 1)
      pulse2Ref.current.scale.setScalar(1 + p2.current * 3.0)
      pulse2MatRef.current.color.copy(
        _col.current.copy(C_GREEN).multiplyScalar((1 - p2.current) * 0.35),
      )
      if (p2.current >= 1) {
        p2.current = -1
        pulse2Ref.current.scale.setScalar(1)
        pulse2MatRef.current.color.setRGB(0, 0, 0)
      }
    }

    // ── Galaxy constellation ring (world space) ──────────────────────
    const cr    = constRingRef.current
    const crMat = constRingMatRef.current
    if (pConst.current >= 0 && cr && crMat) {
      pConst.current = Math.min(pConst.current + delta / 3.5, 1)
      cr.position.copy(constCenter.current)
      cr.scale.setScalar(1 + pConst.current * 5)
      crMat.color.copy(
        _col.current.copy(C_GREEN).multiplyScalar((1 - pConst.current) * 0.6),
      )
      cr.visible = true
      if (pConst.current >= 1) {
        pConst.current = -1
        cr.visible = false
      }
    }

    // ── Beam line ───────────────────────────────────────────────────
    const bMat = beamLine.material as THREE.LineBasicMaterial
    if (beamOpacity.current > 0) {
      beamOpacity.current = Math.max(beamOpacity.current - delta * 0.22, 0)
      bMat.opacity = beamOpacity.current * 0.45  // softer beam
      const pts = beamLine.geometry.attributes.position.array as Float32Array
      pts[0] = pos.current.x;         pts[1] = pos.current.y;         pts[2] = pos.current.z
      pts[3] = constCenter.current.x; pts[4] = constCenter.current.y; pts[5] = constCenter.current.z
      beamLine.geometry.attributes.position.needsUpdate = true
      beamLine.visible = true
    } else {
      beamLine.visible = false
    }
  })

  // 10 rim lights at the saucer edge
  const rimPositions: [number, number, number][] = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => [
        Math.cos((i / 10) * Math.PI * 2) * 1.72,
        0.02,
        Math.sin((i / 10) * Math.PI * 2) * 1.72,
      ]),
    [],
  )

  return (
    <>
      {/* ── UFO group ──────────────────────────────────────────────── */}
      <group ref={groupRef} position={[28, 10, 0]} onClick={(e) => { e.stopPropagation(); onUfoClick?.() }}>

        {/* Main saucer disc — tapered profile, more opaque */}
        <mesh>
          <cylinderGeometry args={[1.15, 1.85, 0.28, 64]} />
          <meshBasicMaterial
            ref={discMatRef}
            color={C_BODY}
            transparent
            opacity={0.62}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Rim band — thin equatorial strip, adds edge definition */}
        <mesh>
          <cylinderGeometry args={[1.82, 1.88, 0.06, 64]} />
          <meshBasicMaterial
            ref={rimBandMatRef}
            color={C_BODY_RIM}
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Undercarriage detail ring — sensor array feel */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
          <ringGeometry args={[0.38, 0.72, 48]} />
          <meshBasicMaterial
            ref={underMatRef}
            color={C_RING_IN}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Dome — smooth green hemisphere */}
        <mesh position={[0, 0.20, 0]}>
          <sphereGeometry args={[0.70, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial
            ref={domeMatRef}
            color={C_DOME}
            transparent
            opacity={0.68}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Dome glow — soft blue sprite */}
        <sprite position={[0, 0.46, 0]} scale={[1.6, 1.6, 1]}>
          <spriteMaterial
            ref={domeSpriteMatRef}
            map={glowTex}
            color={C_DOME_GLOW}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>

        {/* Primary blue underring — the classic UFO ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.78, 0.065, 8, 80]} />
          <meshBasicMaterial
            ref={ring1MatRef}
            color={C_RING}
            transparent
            opacity={0.88}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Inner detail ring — close to body edge */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.25, 0.032, 8, 64]} />
          <meshBasicMaterial
            ref={ring2MatRef}
            color={C_RING_IN}
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Outer halo — very faint ambient ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.18, 0.038, 8, 64]} />
          <meshBasicMaterial
            ref={ring3MatRef}
            color={C_RING_OUT}
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* 10 green rim lights */}
        {rimPositions.map((p, i) => (
          <sprite key={i} position={p} scale={[0.38, 0.38, 1]}>
            <primitive object={rimMat} attach="material" />
          </sprite>
        ))}

        {/* Arrival pulse ring — small, dim, fades fast */}
        <mesh ref={pulse1Ref} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.6, 2.0, 64]} />
          <meshBasicMaterial
            ref={pulse1MatRef}
            color={new THREE.Color(0, 0, 0)}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* High-value pulse ring — slightly wider, still restrained */}
        <mesh ref={pulse2Ref} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.6, 2.2, 64]} />
          <meshBasicMaterial
            ref={pulse2MatRef}
            color={new THREE.Color(0, 0, 0)}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ── Galaxy constellation ring (world space) ─────────────────── */}
      <mesh ref={constRingRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.0, 2.0, 64]} />
        <meshBasicMaterial
          ref={constRingMatRef}
          color={new THREE.Color(0, 0, 0)}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Green tractor beam (world space, high-value only) ───────── */}
      <primitive object={beamLine} />
    </>
  )
}
