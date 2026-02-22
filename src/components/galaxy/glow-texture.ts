import * as THREE from "three"

// Procedural radial glow texture — bright hot center, wide soft falloff
let cachedTexture: THREE.Texture | null = null

export function getGlowTexture(): THREE.Texture {
  if (cachedTexture) return cachedTexture

  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!

  // Wide, punchy radial gradient
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  )
  gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)")
  gradient.addColorStop(0.05, "rgba(255, 255, 255, 0.95)")
  gradient.addColorStop(0.15, "rgba(255, 255, 255, 0.7)")
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.35)")
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.12)")
  gradient.addColorStop(0.75, "rgba(255, 255, 255, 0.03)")
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)")

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  cachedTexture = texture
  return texture
}
