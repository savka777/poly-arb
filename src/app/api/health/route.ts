import { NextResponse } from "next/server"
import type { HealthResponse } from "@/lib/types"
import { getSignalCount, getLatestSignalTimestamp } from "@/store/signals"
import { startScanner, getScannerStatus } from "@/scanner"

const startTime = Date.now()

export async function GET() {
  // Ensure scanner is running on first health check
  startScanner()

  const scannerStatus = getScannerStatus()

  const response: HealthResponse = {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    lastScanAt: scannerStatus.lastScanAt ?? getLatestSignalTimestamp(),
    signalCount: getSignalCount(),
    scanner: scannerStatus,
  }
  return NextResponse.json(response)
}
