"use client"

import { useRef, useEffect } from "react"
import { useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"

export type CameraMode = "galaxy" | "constellation"

interface CameraControllerProps {
  mode: CameraMode
  target: [number, number, number]
}

const GALAXY_POS = new THREE.Vector3(0, 15, 80)
const GALAXY_TARGET = new THREE.Vector3(0, 0, 0)
const LERP_SPEED = 3

export function CameraController({ mode, target }: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()

  const targetPos = useRef(GALAXY_POS.clone())
  const targetLook = useRef(GALAXY_TARGET.clone())

  useEffect(() => {
    if (mode === "galaxy") {
      targetPos.current.copy(GALAXY_POS)
      targetLook.current.copy(GALAXY_TARGET)
    } else {
      targetPos.current.set(target[0] + 8, target[1] + 6, target[2] + 18)
      targetLook.current.set(target[0], target[1], target[2])
    }
  }, [mode, target])

  useFrame((_, delta) => {
    const t = Math.min(delta * LERP_SPEED, 1)

    camera.position.lerp(targetPos.current, t)

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, t)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={5}
      maxDistance={150}
      enablePan={mode === "galaxy"}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
    />
  )
}
