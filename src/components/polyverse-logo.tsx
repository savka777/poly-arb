// Inline SVG logo — no external assets
// Mark: 6 orbital dots around a central dot (28×28px)
// Wordmark: "POLYVERSE" bold, white, tracking-widest

const ORBIT_R = 10
const CX = 14
const CY = 14
const ORBIT_ANGLES = [0, 60, 120, 180, 240, 300] // degrees

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
        {ORBIT_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180
          const ox = CX + ORBIT_R * Math.cos(rad)
          const oy = CY + ORBIT_R * Math.sin(rad)
          return <circle key={deg} cx={ox} cy={oy} r={1.8} fill="white" />
        })}
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
