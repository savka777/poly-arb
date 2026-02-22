import * as THREE from "three"

// Sharp star-like glow with subtle cross spikes
let cachedTexture: THREE.Texture | null = null

export function getGlowTexture(): THREE.Texture {
  if (cachedTexture) return cachedTexture

  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!

  const cx = size / 2
  const cy = size / 2

  // Clear
  ctx.clearRect(0, 0, size, size)

  // Soft outer glow
  const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx)
  outerGlow.addColorStop(0, "rgba(255, 255, 255, 1.0)")
  outerGlow.addColorStop(0.03, "rgba(255, 255, 255, 0.9)")
  outerGlow.addColorStop(0.08, "rgba(255, 255, 255, 0.5)")
  outerGlow.addColorStop(0.2, "rgba(255, 255, 255, 0.15)")
  outerGlow.addColorStop(0.4, "rgba(255, 255, 255, 0.04)")
  outerGlow.addColorStop(1, "rgba(255, 255, 255, 0.0)")
  ctx.fillStyle = outerGlow
  ctx.fillRect(0, 0, size, size)

  // Subtle cross spikes (diffraction)
  ctx.globalCompositeOperation = "lighter"
  for (const angle of [0, Math.PI / 2]) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    const spikeGrad = ctx.createLinearGradient(-cx, 0, cx, 0)
    spikeGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)")
    spikeGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.03)")
    spikeGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)")
    spikeGrad.addColorStop(0.6, "rgba(255, 255, 255, 0.03)")
    spikeGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)")
    ctx.fillStyle = spikeGrad
    ctx.fillRect(-cx, -1.5, size, 3)
    ctx.restore()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  cachedTexture = texture
  return texture
}
