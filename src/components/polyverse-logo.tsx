// Inline SVG logo — no external assets
// Mark: 6 orbital dots around a central dot (28×28px)
// Wordmark: "POLYVERSE" bold, white, tracking-widest

const ORBIT_R = 10
const CX = 14
const CY = 14
const ORBIT_ANGLES = [0, 60, 120, 180, 240, 300] // degrees

// Precompute orbital positions to avoid hydration mismatch from
// floating-point differences between server and client Math.cos/sin
const ORBITAL_DOTS = ORBIT_ANGLES.map((deg) => {
  const rad = (deg * Math.PI) / 180
  return {
    deg,
    cx: Math.round((CX + ORBIT_R * Math.cos(rad)) * 1000) / 1000,
    cy: Math.round((CY + ORBIT_R * Math.sin(rad)) * 1000) / 1000,
  }
})

export function PolyverseLogo() {
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Central dot — slightly larger */}
        <circle cx={CX} cy={CY} r={3} fill="white" />
        {/* Orbital dots */}
        {ORBITAL_DOTS.map((dot) => (
          <circle key={dot.deg} cx={dot.cx} cy={dot.cy} r={1.8} fill="white" />
        ))}
      </svg>
      <span
        className="text-base font-bold text-white"
        style={{ letterSpacing: "0.12em" }}
      >
        POLYVERSE
      </span>
    </div>
  )
}
