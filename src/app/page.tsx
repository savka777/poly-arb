"use client"

import { useState, useEffect } from "react"

function GalaxyLoader() {
  const [Scene, setScene] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    import("@/components/galaxy/galaxy-scene")
      .then((mod) => {
        setScene(() => mod.GalaxyScene)
      })
      .catch((err) => {
        console.error("Failed to load GalaxyScene:", err)
        setError(String(err))
      })
  }, [])

  if (error) {
    return (
      <div style={{ color: "#ff4466", padding: 40, fontFamily: "monospace", background: "#050510", minHeight: "100vh" }}>
        <h1>Galaxy failed to load</h1>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{error}</pre>
      </div>
    )
  }

  if (!Scene) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#050510", color: "#556688", fontFamily: "monospace", fontSize: 12 }}>
        Initializing galaxy...
      </div>
    )
  }

  return <Scene />
}

export default function HomePage() {
  return <GalaxyLoader />
}
