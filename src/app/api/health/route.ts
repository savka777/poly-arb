import { NextResponse } from "next/server"
import type { HealthResponse } from "@/lib/types"
import { getSignalCount, getLatestSignalTimestamp } from "@/store/signals"
import { startOrchestrator, getOrchestratorStatus } from "@/scanner/orchestrator"

const startTime = Date.now()

export async function GET() {
  // Ensure orchestrator is running on first health check
  startOrchestrator()

  const orchestratorStatus = getOrchestratorStatus()

  const response: HealthResponse = {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    lastScanAt: getLatestSignalTimestamp(),
    signalCount: getSignalCount(),
    scanner: {
      running: orchestratorStatus.running,
      lastScanAt: getLatestSignalTimestamp(),
      marketsScanned: orchestratorStatus.totalAnalyzed,
      signalsGenerated: orchestratorStatus.totalSignals,
      nextScanAt: null,
    },
    orchestrator: orchestratorStatus,
  }
  return NextResponse.json(response)
}
