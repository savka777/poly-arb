"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { useMarket } from "@/hooks/use-market"
import { usePrices, useOhlc } from "@/hooks/use-prices"
import { useAnalysis } from "@/hooks/use-analysis"
import { usePanelSettings } from "@/hooks/use-panel-settings"
import { useFairValue } from "@/hooks/use-fair-value"
import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist"
import { LightweightChart } from "@/components/lightweight-chart"
import { ChartToolbar } from "@/components/chart-toolbar"
import { OhlcHeader } from "@/components/ohlc-header"
import { FairValueEditor } from "@/components/fair-value-editor"
import type { ChartDataPoint } from "@/lib/chart-types"
import { ohlcToChartData, ohlcToVolumeData } from "@/lib/ohlc"
import { AlphaBar } from "@/components/alpha-bar"
import { SignalBadge } from "@/components/signal-badge"
import { AnalysisFeed, type FeedEntry } from "@/components/analysis-feed"
import { QueryInterface } from "@/components/query-interface"
import {
  formatProbability,
  formatEV,
  formatVolume,
  formatEndDate,
  relativeTime,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { ChevronLeft, TrendingDown, TrendingUp, PanelRightOpen, PanelRightClose, Plus, Star } from "lucide-react"
import type { UTCTimestamp } from "lightweight-charts"

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, isLoading } = useMarket(id)
  const analysis = useAnalysis()
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([])
  const [showAnalysis, setShowAnalysis] = useState(false)
  const panelControls = usePanelSettings(id)
  const { settings } = panelControls
  const { data: watchlistData } = useWatchlist()
  const toggleWatchlist = useToggleWatchlist()
  const isWatchlisted = watchlistData?.marketIds?.includes(id) ?? false

  const market = data?.market
  const signal = data?.signals?.[0]
  const fv = useFairValue(id, signal?.darwinEstimate)

  const { data: priceData, isLoading: pricesLoading } = usePrices(
    market?.clobTokenId,
    settings.timeFrame
  )

  const { data: ohlcResponse } = useOhlc(
    market?.clobTokenId,
    settings.timeFrame
  )

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!priceData?.prices || priceData.prices.length === 0) return []
    return priceData.prices.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.price,
    }))
  }, [priceData])

  const candleData = useMemo(() => {
    if (!ohlcResponse?.ohlc) return undefined
    return ohlcToChartData(ohlcResponse.ohlc)
  }, [ohlcResponse])

  const volumeData = useMemo(() => {
    if (!ohlcResponse?.ohlc) return undefined
    return ohlcToVolumeData(ohlcResponse.ohlc)
  }, [ohlcResponse])

  const darwinData = useMemo<ChartDataPoint[] | undefined>(() => {
    if (!signal || chartData.length === 0) return undefined
    const startIdx = Math.max(0, Math.floor(chartData.length * 0.8))
    return chartData.slice(startIdx).map((p) => ({
      time: p.time,
      value: signal.darwinEstimate,
    }))
  }, [signal, chartData])

  // OHLC header from latest candle
  const lastOhlc = ohlcResponse?.ohlc?.[ohlcResponse.ohlc.length - 1] ?? null
  const firstOhlc = ohlcResponse?.ohlc?.[0] ?? null
  const change = lastOhlc && firstOhlc ? lastOhlc.close - firstOhlc.open : undefined
  const changePercent =
    change !== undefined && firstOhlc && firstOhlc.open !== 0
      ? (change / firstOhlc.open) * 100
      : undefined

  const initialFeedEntries = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = []
    if (signal) {
      entries.push({ type: "signal", signal })
    }
    return entries
  }, [signal])

  const allEntries = useMemo(() => {
    return [...feedEntries, ...initialFeedEntries]
  }, [feedEntries, initialFeedEntries])

  function handleAnalyze(query: string) {
    const now = new Date().toISOString()
    setFeedEntries((prev) => [
      { type: "user_query", text: query, timestamp: now },
      ...prev,
    ])

    analysis.mutate(id, {
      onSuccess: (result) => {
        const newEntries: FeedEntry[] = []
        for (const tc of result.toolCalls) {
          newEntries.push({ type: "tool_call", toolCall: tc })
        }
        if (result.signal) {
          newEntries.push({ type: "signal", signal: result.signal })
        }
        setFeedEntries((prev) => [...newEntries, ...prev])
      },
      onError: (err) => {
        setFeedEntries((prev) => [
          {
            type: "error",
            message: err.message,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ])
      },
    })
  }

  if (isLoading || !market) {
    return (
      <div className="flex h-screen flex-col bg-darwin-bg">
        <header className="flex h-12 shrink-0 items-center border-b border-darwin-border px-6">
          <div className="h-4 w-48 animate-pulse bg-darwin-border" />
        </header>
        <div className="flex-1 animate-pulse bg-darwin-card" />
      </div>
    )
  }

  const isBullish = signal && signal.ev > 0

  return (
    <div className="flex h-screen flex-col bg-darwin-bg">
      {/* Header bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-darwin-border px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-darwin-text-secondary hover:text-darwin-text transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Markets
          </Link>
          <div className="h-4 w-px bg-darwin-border" />
          <span className="label-caps !text-[10px]">
            {market.category ?? "polymarket"}
          </span>
          <div className="h-4 w-px bg-darwin-border" />
          <Link
            href={`/compare?add=${id}`}
            className="flex items-center gap-1.5 border border-darwin-border px-2.5 py-1 text-xs text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Market
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleWatchlist.mutate({ marketId: id, watchlisted: isWatchlisted })}
            className={cn(
              "flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
              isWatchlisted
                ? "border-yellow-500/50 text-yellow-500"
                : "border-darwin-border text-darwin-text-secondary hover:border-darwin-text-muted hover:text-darwin-text"
            )}
            title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={cn("h-3.5 w-3.5", isWatchlisted && "fill-yellow-500")} />
            {isWatchlisted ? "Watching" : "Watch"}
          </button>
          <button
            onClick={() => setShowAnalysis((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
              showAnalysis
                ? "border-darwin-blue/50 text-darwin-blue"
                : "border-darwin-border text-darwin-text-secondary hover:border-darwin-text-muted hover:text-darwin-text"
            )}
            title={showAnalysis ? "Hide analysis panel" : "Show analysis panel"}
          >
            {showAnalysis ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            Analysis
          </button>
        </div>
      </header>

      {/* Main content: chart left, activity right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Chart area */}
        <div className={cn("flex flex-1 flex-col", showAnalysis && "border-r border-darwin-border")}>
          {/* Market info header */}
          <div className="border-b border-darwin-border px-4 py-3">
            <h1 className="text-base font-semibold text-darwin-text leading-tight">
              {market.question}
            </h1>
            <div className="mt-2 flex items-center gap-4">
              <span className={cn(
                "font-data text-2xl font-semibold",
                signal
                  ? isBullish ? "text-darwin-green" : "text-darwin-red"
                  : "text-darwin-text"
              )}>
                {formatProbability(market.probability)}
              </span>
              {signal && (
                <span className={cn(
                  "flex items-center gap-1 font-data text-sm",
                  isBullish ? "text-darwin-green" : "text-darwin-red"
                )}>
                  {isBullish
                    ? <TrendingUp className="h-3.5 w-3.5" />
                    : <TrendingDown className="h-3.5 w-3.5" />
                  }
                  {formatEV(signal.ev)}
                </span>
              )}
              {signal && <SignalBadge confidence={signal.confidence} />}
            </div>
          </div>

          {/* OHLC header */}
          <OhlcHeader
            currentOhlc={lastOhlc}
            change={change}
            changePercent={changePercent}
          />

          {/* Chart toolbar */}
          <ChartToolbar
            settings={settings}
            controls={panelControls}
          />

          {/* Chart */}
          <div className="relative flex-1 min-h-0">
            {pricesLoading && chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-darwin-text-muted animate-pulse">
                  Loading price data...
                </span>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-darwin-text-muted">
                  No price history available for this market
                </span>
              </div>
            ) : (
              <LightweightChart
                data={chartData}
                ohlcData={candleData}
                volumeData={volumeData}
                darwinData={darwinData}
                chartType={settings.chartType}
                showVolume={settings.showVolume}
                lineColor="#FFFFFF"
                darwinColor={signal?.direction === "no" ? "#FF4444" : "#00D47E"}
                showDarwinEstimate={settings.overlays.darwinEstimate}
                fairValue={fv.fairValue ?? undefined}
                showFairValue={settings.overlays.fairValue}
              />
            )}
          </div>

          {/* Chart footer — stats */}
          <div className="flex items-center justify-between border-t border-darwin-border px-4 py-2">
            <div className="flex items-center gap-6 text-xs">
              <span className="text-darwin-text-secondary">
                {formatVolume(market.volume)} Vol
              </span>
              <span className="text-darwin-text-muted">|</span>
              <span className="text-darwin-text-secondary">
                Ends {formatEndDate(market.endDate)}
              </span>
              {signal && (
                <>
                  <span className="text-darwin-text-muted">|</span>
                  <span className="font-data">
                    <span className="text-darwin-text-muted">Darwin </span>
                    <span className="text-darwin-text">
                      {formatProbability(signal.darwinEstimate)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right — Activity monitor / Chat */}
        {showAnalysis && <div className="flex w-[380px] shrink-0 flex-col">
          {/* Activity header */}
          <div className="border-b border-darwin-border px-4 py-3">
            <h2 className="text-sm font-medium text-darwin-text">
              Darwin Analysis
            </h2>
            <p className="mt-0.5 text-[11px] text-darwin-text-muted">
              AI-powered market intelligence
            </p>
          </div>

          {/* Signal summary card */}
          {signal && (
            <div className="border-b border-darwin-border px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-caps">Signal</span>
                <span className="text-[10px] text-darwin-text-muted">
                  {relativeTime(signal.createdAt)}
                </span>
              </div>
              <AlphaBar
                darwinEstimate={signal.darwinEstimate}
                marketPrice={signal.marketPrice}
                size="md"
              />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="block label-caps !text-[9px]">Market</span>
                  <span className="font-data text-sm text-darwin-text">
                    {formatProbability(signal.marketPrice)}
                  </span>
                </div>
                <div>
                  <span className="block label-caps !text-[9px]">Darwin</span>
                  <span className={cn(
                    "font-data text-sm",
                    isBullish ? "text-darwin-green" : "text-darwin-red"
                  )}>
                    {formatProbability(signal.darwinEstimate)}
                  </span>
                </div>
                <div>
                  <span className="block label-caps !text-[9px]">EV</span>
                  <span className={cn(
                    "font-data text-sm font-medium",
                    isBullish ? "text-darwin-green" : "text-darwin-red"
                  )}>
                    {formatEV(signal.ev)}
                  </span>
                </div>
              </div>
              <div className="border-t border-darwin-border pt-2">
                <FairValueEditor
                  fairValue={fv.fairValue}
                  isCustom={fv.isCustom}
                  onSave={fv.setFairValue}
                  onReset={fv.clearFairValue}
                />
              </div>
            </div>
          )}

          {/* Analysis feed (chat-style) */}
          <div className="flex-1 overflow-y-auto">
            <AnalysisFeed
              entries={allEntries}
              analyzing={analysis.isPending}
            />
            {allEntries.length === 0 && !analysis.isPending && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-darwin-text-muted">
                  Ask Darwin to analyze this market.
                </p>
              </div>
            )}
          </div>

          {/* Query input at bottom */}
          <div className="border-t border-darwin-border p-3">
            <QueryInterface
              onSubmit={handleAnalyze}
              loading={analysis.isPending}
            />
          </div>
        </div>}
      </div>
    </div>
  )
}
