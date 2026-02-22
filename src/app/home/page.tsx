"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { StarCanvas } from "@/components/galaxy-canvas"
import { PolyverseLogo } from "@/components/polyverse-logo"
import { LightweightChart } from "@/components/lightweight-chart"
import { AlphaBar } from "@/components/alpha-bar"
import { SignalBadge } from "@/components/signal-badge"
import { generateMockTimeSeries } from "@/lib/mock-timeseries"
import { formatProbability, formatEV, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { UTCTimestamp } from "lightweight-charts"
import type { Market, Signal, MarketsResponse, SignalsResponse } from "@/lib/types"

// ─── Mock fallback data (80+ markets across 6 categories) ───────────────────

const MOCK_MARKETS: Market[] = [
  // POLITICS (15)
  { id: "p-01", platform: "polymarket", question: "Will the US president win re-election in 2028?", probability: 0.52, volume: 4_800_000, liquidity: 1_200_000, endDate: "2028-11-05", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-02", platform: "polymarket", question: "Will the UK Labour Party win the next general election?", probability: 0.61, volume: 2_100_000, liquidity: 580_000, endDate: "2029-01-01", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-03", platform: "polymarket", question: "Will France hold a snap election in 2026?", probability: 0.38, volume: 890_000, liquidity: 240_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-04", platform: "polymarket", question: "Will NATO admit a new member before 2027?", probability: 0.29, volume: 450_000, liquidity: 110_000, endDate: "2027-01-01", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-05", platform: "polymarket", question: "Will the German Bundestag call a no-confidence vote in 2026?", probability: 0.45, volume: 710_000, liquidity: 190_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-06", platform: "polymarket", question: "Will any G7 leader resign before mid-2026?", probability: 0.33, volume: 320_000, liquidity: 88_000, endDate: "2026-06-30", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-07", platform: "polymarket", question: "Will there be a presidential referendum in Turkey 2026?", probability: 0.22, volume: 280_000, liquidity: 70_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-08", platform: "polymarket", question: "Will US Congress pass immigration reform in 2026?", probability: 0.18, volume: 1_500_000, liquidity: 420_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-09", platform: "polymarket", question: "Will Donald Trump face new federal charges before 2027?", probability: 0.41, volume: 3_200_000, liquidity: 980_000, endDate: "2027-01-01", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-10", platform: "polymarket", question: "Will Mexico elect a new president in 2027 general election?", probability: 0.91, volume: 180_000, liquidity: 45_000, endDate: "2027-08-01", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-11", platform: "polymarket", question: "Will Brazil hold midterm elections in 2026?", probability: 0.95, volume: 120_000, liquidity: 30_000, endDate: "2026-10-01", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-12", platform: "polymarket", question: "Will there be a peace ceasefire in major European conflict 2026?", probability: 0.27, volume: 5_600_000, liquidity: 1_800_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-13", platform: "polymarket", question: "Will Japan hold snap elections before 2027?", probability: 0.44, volume: 390_000, liquidity: 95_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-14", platform: "polymarket", question: "Will India pass the data privacy amendment bill 2026?", probability: 0.56, volume: 230_000, liquidity: 58_000, endDate: "2026-12-31", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  { id: "p-15", platform: "polymarket", question: "Will Canada call a federal election before October 2025?", probability: 0.72, volume: 880_000, liquidity: 210_000, endDate: "2025-10-01", url: "#", category: "Politics", lastUpdated: new Date().toISOString() },
  // ECONOMICS (15)
  { id: "e-01", platform: "polymarket", question: "Will the Fed cut rates in Q2 2026?", probability: 0.63, volume: 8_400_000, liquidity: 2_100_000, endDate: "2026-06-30", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-02", platform: "polymarket", question: "Will US CPI drop below 2.5% in 2026?", probability: 0.48, volume: 3_700_000, liquidity: 940_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-03", platform: "polymarket", question: "Will Bitcoin hit $150k before end of 2026?", probability: 0.37, volume: 12_000_000, liquidity: 3_400_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-04", platform: "polymarket", question: "Will S&P 500 correct more than 15% in 2026?", probability: 0.28, volume: 6_200_000, liquidity: 1_600_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-05", platform: "polymarket", question: "Will Ethereum surpass $5000 in 2026?", probability: 0.41, volume: 7_800_000, liquidity: 2_000_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-06", platform: "polymarket", question: "Will the ECB raise interest rates in 2026?", probability: 0.19, volume: 2_300_000, liquidity: 590_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-07", platform: "polymarket", question: "Will the US enter recession in H1 2026?", probability: 0.22, volume: 9_100_000, liquidity: 2_400_000, endDate: "2026-06-30", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-08", platform: "polymarket", question: "Will gold hit $3500/oz before mid-2026?", probability: 0.56, volume: 4_500_000, liquidity: 1_100_000, endDate: "2026-06-30", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-09", platform: "polymarket", question: "Will the yuan depreciate below 7.5 vs USD in 2026?", probability: 0.34, volume: 1_800_000, liquidity: 450_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-10", platform: "polymarket", question: "Will Nvidia market cap exceed $5 trillion in 2026?", probability: 0.44, volume: 5_300_000, liquidity: 1_300_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-11", platform: "polymarket", question: "Will a new US tariff on EU goods pass in 2026?", probability: 0.38, volume: 3_100_000, liquidity: 780_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-12", platform: "polymarket", question: "Will oil price exceed $90/barrel in 2026?", probability: 0.31, volume: 4_900_000, liquidity: 1_200_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-13", platform: "polymarket", question: "Will global trade volume grow more than 3% in 2026?", probability: 0.52, volume: 1_200_000, liquidity: 310_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-14", platform: "polymarket", question: "Will a major US bank require federal bailout in 2026?", probability: 0.07, volume: 2_700_000, liquidity: 680_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  { id: "e-15", platform: "polymarket", question: "Will the US national debt exceed $38 trillion in 2026?", probability: 0.81, volume: 980_000, liquidity: 240_000, endDate: "2026-12-31", url: "#", category: "Economics", lastUpdated: new Date().toISOString() },
  // SPORT (15)
  { id: "s-01", platform: "polymarket", question: "Will Brazil win the 2026 FIFA World Cup?", probability: 0.19, volume: 11_000_000, liquidity: 3_200_000, endDate: "2026-07-19", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-02", platform: "polymarket", question: "Will England win the 2026 FIFA World Cup?", probability: 0.14, volume: 8_900_000, liquidity: 2_400_000, endDate: "2026-07-19", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-03", platform: "polymarket", question: "Will France win the 2026 FIFA World Cup?", probability: 0.17, volume: 7_600_000, liquidity: 2_000_000, endDate: "2026-07-19", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-04", platform: "polymarket", question: "Will Italy qualify for the 2026 FIFA World Cup?", probability: 0.64, volume: 1_240_000, liquidity: 320_000, endDate: "2025-11-18", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-05", platform: "polymarket", question: "Will the Kansas City Chiefs win Super Bowl LXI?", probability: 0.18, volume: 14_000_000, liquidity: 4_000_000, endDate: "2027-02-07", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-06", platform: "polymarket", question: "Will Carlos Alcaraz win Wimbledon 2026?", probability: 0.31, volume: 3_400_000, liquidity: 880_000, endDate: "2026-07-13", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-07", platform: "polymarket", question: "Will Novak Djokovic retire from tennis in 2026?", probability: 0.21, volume: 1_900_000, liquidity: 480_000, endDate: "2026-12-31", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-08", platform: "polymarket", question: "Will Real Madrid win the Champions League 2025/26?", probability: 0.22, volume: 6_800_000, liquidity: 1_800_000, endDate: "2026-05-30", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-09", platform: "polymarket", question: "Will the NBA Eastern Conference finals go to 7 games in 2026?", probability: 0.39, volume: 2_100_000, liquidity: 540_000, endDate: "2026-05-31", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-10", platform: "polymarket", question: "Will Argentina qualify for the 2026 FIFA World Cup?", probability: 0.97, volume: 890_000, liquidity: 220_000, endDate: "2025-11-18", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-11", platform: "polymarket", question: "Will Tiger Woods play in any Major tournament in 2026?", probability: 0.29, volume: 2_800_000, liquidity: 720_000, endDate: "2026-12-31", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-12", platform: "polymarket", question: "Will Germany win UEFA Euro 2028?", probability: 0.16, volume: 4_200_000, liquidity: 1_100_000, endDate: "2028-07-15", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-13", platform: "polymarket", question: "Will the Golden State Warriors make the 2026 NBA playoffs?", probability: 0.48, volume: 3_100_000, liquidity: 790_000, endDate: "2026-04-30", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-14", platform: "polymarket", question: "Will the 2026 World Cup final be held in the USA?", probability: 0.88, volume: 680_000, liquidity: 170_000, endDate: "2026-07-19", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  { id: "s-15", platform: "polymarket", question: "Will Switzerland win the 2026 Davis Cup?", probability: 0.12, volume: 480_000, liquidity: 120_000, endDate: "2026-11-30", url: "#", category: "Sports", lastUpdated: new Date().toISOString() },
  // TECHNOLOGY (14)
  { id: "t-01", platform: "polymarket", question: "Will OpenAI release GPT-5 before mid-2026?", probability: 0.67, volume: 9_300_000, liquidity: 2_500_000, endDate: "2026-06-30", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-02", platform: "polymarket", question: "Will Apple launch AI-native iPhone model in 2026?", probability: 0.74, volume: 4_100_000, liquidity: 1_050_000, endDate: "2026-09-30", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-03", platform: "polymarket", question: "Will Google Gemini surpass ChatGPT market share in 2026?", probability: 0.28, volume: 5_700_000, liquidity: 1_450_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-04", platform: "polymarket", question: "Will Tesla achieve full self-driving Level 4 approval in 2026?", probability: 0.19, volume: 7_200_000, liquidity: 1_900_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-05", platform: "polymarket", question: "Will SpaceX Starship complete an orbit in 2026?", probability: 0.81, volume: 3_600_000, liquidity: 920_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-06", platform: "polymarket", question: "Will a quantum computer break RSA-2048 encryption in 2026?", probability: 0.04, volume: 2_800_000, liquidity: 720_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-07", platform: "polymarket", question: "Will Meta release a standalone AI model surpassing GPT-4 in 2026?", probability: 0.55, volume: 4_400_000, liquidity: 1_100_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-08", platform: "polymarket", question: "Will Apple become a $4 trillion company in 2026?", probability: 0.49, volume: 6_100_000, liquidity: 1_550_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-09", platform: "polymarket", question: "Will AI be used in a major geopolitical cyberattack in 2026?", probability: 0.43, volume: 2_200_000, liquidity: 560_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-10", platform: "polymarket", question: "Will Anthropic release Claude 4 in 2026?", probability: 0.71, volume: 3_900_000, liquidity: 990_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-11", platform: "polymarket", question: "Will Microsoft Copilot be used by 100M+ users in 2026?", probability: 0.62, volume: 2_500_000, liquidity: 630_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-12", platform: "polymarket", question: "Will any country ban a major social media platform in 2026?", probability: 0.47, volume: 3_300_000, liquidity: 840_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-13", platform: "polymarket", question: "Will a humanoid robot be deployed commercially at scale in 2026?", probability: 0.36, volume: 4_700_000, liquidity: 1_200_000, endDate: "2026-12-31", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  { id: "t-14", platform: "polymarket", question: "Will the EU AI Act enforcement begin before mid-2026?", probability: 0.78, volume: 1_800_000, liquidity: 460_000, endDate: "2026-06-30", url: "#", category: "Technology", lastUpdated: new Date().toISOString() },
  // SCIENCE (12)
  { id: "sc-01", platform: "polymarket", question: "Will NASA's Artemis land humans on the Moon in 2026?", probability: 0.24, volume: 5_100_000, liquidity: 1_300_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-02", platform: "polymarket", question: "Will a COVID subvariant trigger new travel restrictions in 2026?", probability: 0.16, volume: 3_800_000, liquidity: 960_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-03", platform: "polymarket", question: "Will global average temperature breach 1.6C above pre-industrial in 2026?", probability: 0.38, volume: 2_700_000, liquidity: 690_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-04", platform: "polymarket", question: "Will nuclear fusion energy produce net gain commercially in 2026?", probability: 0.09, volume: 4_200_000, liquidity: 1_070_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-05", platform: "polymarket", question: "Will a new mRNA cancer vaccine receive FDA approval in 2026?", probability: 0.31, volume: 3_500_000, liquidity: 890_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-06", platform: "polymarket", question: "Will a Mars mission launch in 2026?", probability: 0.21, volume: 2_100_000, liquidity: 540_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-07", platform: "polymarket", question: "Will a new antibiotic class be approved in 2026?", probability: 0.17, volume: 1_400_000, liquidity: 360_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-08", platform: "polymarket", question: "Will global renewable energy exceed 50% of generation in 2026?", probability: 0.33, volume: 1_900_000, liquidity: 490_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-09", platform: "polymarket", question: "Will CERN detect new physics beyond the Standard Model in 2026?", probability: 0.08, volume: 1_600_000, liquidity: 410_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-10", platform: "polymarket", question: "Will bird flu H5N1 transmission become human-to-human in 2026?", probability: 0.14, volume: 6_400_000, liquidity: 1_650_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-11", platform: "polymarket", question: "Will a major volcanic eruption affect global air travel in 2026?", probability: 0.12, volume: 2_300_000, liquidity: 590_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  { id: "sc-12", platform: "polymarket", question: "Will the James Webb Space Telescope confirm exoplanet biosignatures in 2026?", probability: 0.11, volume: 3_100_000, liquidity: 790_000, endDate: "2026-12-31", url: "#", category: "Science", lastUpdated: new Date().toISOString() },
  // CULTURE (12)
  { id: "cu-01", platform: "polymarket", question: "Will Beyonce win the Grammy Album of the Year in 2026?", probability: 0.42, volume: 4_700_000, liquidity: 1_200_000, endDate: "2026-02-08", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-02", platform: "polymarket", question: "Will a Taylor Swift movie gross $1B+ in 2026?", probability: 0.29, volume: 3_200_000, liquidity: 820_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-03", platform: "polymarket", question: "Will Eurovision 2026 be held in the UK?", probability: 0.61, volume: 2_100_000, liquidity: 540_000, endDate: "2026-05-01", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-04", platform: "polymarket", question: "Will a non-English language film win Best Picture Oscar 2027?", probability: 0.23, volume: 1_800_000, liquidity: 460_000, endDate: "2027-03-01", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-05", platform: "polymarket", question: "Will the next James Bond be announced before mid-2026?", probability: 0.48, volume: 2_900_000, liquidity: 740_000, endDate: "2026-06-30", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-06", platform: "polymarket", question: "Will a new Adele album release in 2026?", probability: 0.34, volume: 2_400_000, liquidity: 610_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-07", platform: "polymarket", question: "Will Netflix add 30M+ subscribers in 2026?", probability: 0.53, volume: 3_700_000, liquidity: 940_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-08", platform: "polymarket", question: "Will a video game break $2B revenue in first week in 2026?", probability: 0.27, volume: 2_100_000, liquidity: 540_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-09", platform: "polymarket", question: "Will the Met Gala 2026 theme be AI-related?", probability: 0.19, volume: 1_100_000, liquidity: 280_000, endDate: "2026-05-05", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-10", platform: "polymarket", question: "Will a major K-pop act break Billboard Hot 100 No.1 in 2026?", probability: 0.44, volume: 2_600_000, liquidity: 660_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-11", platform: "polymarket", question: "Will an AI-generated film be submitted for Oscar consideration 2027?", probability: 0.38, volume: 3_100_000, liquidity: 790_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
  { id: "cu-12", platform: "polymarket", question: "Will any 2026 music album sell 1M+ physical copies in first week?", probability: 0.22, volume: 1_400_000, liquidity: 360_000, endDate: "2026-12-31", url: "#", category: "Culture", lastUpdated: new Date().toISOString() },
]

const MOCK_SIGNALS: Signal[] = [
  { id: "sig-e01", marketId: "e-01", marketQuestion: "Will the Fed cut rates in Q2 2026?", darwinEstimate: 0.71, marketPrice: 0.63, ev: 0.08, direction: "yes", reasoning: "Recent Fed minutes signal growing consensus toward cuts amid softening labor data.", newsEvents: ["Fed minutes released"], confidence: "high", createdAt: new Date(Date.now() - 8 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 86400_000).toISOString() },
  { id: "sig-e03", marketId: "e-03", marketQuestion: "Will Bitcoin hit $150k before end of 2026?", darwinEstimate: 0.29, marketPrice: 0.37, ev: -0.08, direction: "no", reasoning: "Macro headwinds from dollar strength and ETF outflows suggest market is overpricing rally continuation.", newsEvents: ["ETF outflows surge", "Dollar index rises"], confidence: "medium", createdAt: new Date(Date.now() - 25 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 86400_000).toISOString() },
  { id: "sig-t01", marketId: "t-01", marketQuestion: "Will OpenAI release GPT-5 before mid-2026?", darwinEstimate: 0.76, marketPrice: 0.67, ev: 0.09, direction: "yes", reasoning: "Leaked roadmap documents and Sam Altman comments suggest accelerated timeline.", newsEvents: ["Altman keynote hints", "Compute cluster expansion"], confidence: "high", createdAt: new Date(Date.now() - 3 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 86400_000).toISOString() },
  { id: "sig-p12", marketId: "p-12", marketQuestion: "Will there be a peace ceasefire in major European conflict 2026?", darwinEstimate: 0.34, marketPrice: 0.27, ev: 0.07, direction: "yes", reasoning: "Diplomatic back-channels and US pressure point toward ceasefire talks.", newsEvents: ["Secret talks reported", "US envoy travels"], confidence: "low", createdAt: new Date(Date.now() - 45 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 86400_000).toISOString() },
  { id: "sig-s01", marketId: "s-01", marketQuestion: "Will Brazil win the 2026 FIFA World Cup?", darwinEstimate: 0.14, marketPrice: 0.19, ev: -0.05, direction: "no", reasoning: "Key striker injury and tough draw weaken Brazil's odds more than market reflects.", newsEvents: ["Vinicius injury confirmed", "World Cup draw released"], confidence: "medium", createdAt: new Date(Date.now() - 120 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 86400_000).toISOString() },
  { id: "sig-sc10", marketId: "sc-10", marketQuestion: "Will bird flu H5N1 transmission become human-to-human in 2026?", darwinEstimate: 0.21, marketPrice: 0.14, ev: 0.07, direction: "yes", reasoning: "New cluster reports in Southeast Asia show atypical transmission patterns.", newsEvents: ["WHO alert issued", "New cluster detected"], confidence: "low", createdAt: new Date(Date.now() - 15 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 86400_000).toISOString() },
]

// ─── Sub-components ──────────────────────────────────────────────────────────


// Left pane — mini chart + header for a single market
function MiniChartCard({ market, signal }: { market: Market; signal: Signal | null }) {
  const pts = useMemo(() => generateMockTimeSeries(market, signal), [market, signal])
  const isBullish = signal && signal.ev > 0

  const chartData = useMemo(
    () =>
      pts
        .filter((p) => p.timestamp && Number.isFinite(p.marketPrice))
        .map((p) => ({
          time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
          value: p.marketPrice,
        })),
    [pts]
  )

  const darwinData = useMemo(() => {
    if (!signal) return undefined
    const d = pts
      .filter((p) => p.darwinEstimate !== null)
      .map((p) => ({
        time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
        value: p.darwinEstimate!,
      }))
    return d.length > 0 ? d : undefined
  }, [signal, pts])

  return (
    <div className="flex flex-col border-b border-darwin-border last:border-b-0">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 space-y-1">
        <p className="text-[11px] text-darwin-text leading-tight line-clamp-2">
          {market.question}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 bg-darwin-elevated text-darwin-text-secondary rounded-sm">
            {market.category ?? "\u2014"}
          </span>
          {signal && (
            <span className={cn("font-data text-xs font-medium", isBullish ? "text-darwin-green" : "text-darwin-red")}>
              {formatEV(signal.ev)}
            </span>
          )}
          <span className="ml-auto font-data text-xs text-darwin-text">{formatProbability(market.probability)}</span>
        </div>
        {signal && (
          <AlphaBar darwinEstimate={signal.darwinEstimate} marketPrice={signal.marketPrice} size="sm" />
        )}
      </div>
      {/* Chart */}
      <div className="h-[120px] px-1 pb-1">
        <LightweightChart
          data={chartData}
          darwinData={darwinData}
          chartType="line"
          showVolume={false}
          showDarwinEstimate={!!signal}
          height={120}
        />
      </div>
    </div>
  )
}

// Right pane — signal feed entry
function SignalFeedEntry({ signal }: { signal: Signal }) {
  const isBullish = signal.ev > 0
  const color = isBullish ? "#00D47E" : "#FF4444"
  const label = isBullish ? "BULLISH" : "BEARISH"
  const confidence = signal.confidence

  return (
    <div className="px-4 py-3 border-b border-darwin-border last:border-b-0">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[11px] text-darwin-text leading-tight line-clamp-2 flex-1">
          {signal.marketQuestion.length > 55 ? signal.marketQuestion.slice(0, 54) + "\u2026" : signal.marketQuestion}
        </p>
        <span
          className="shrink-0 text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded-sm"
          style={{ background: `${color}20`, color }}
        >
          {label}
        </span>
      </div>
      <p className="text-[10px] text-darwin-text-muted leading-relaxed mb-2 line-clamp-2">
        {signal.reasoning}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-darwin-text-secondary">
          Polyverse &middot; {relativeTime(signal.createdAt)}
        </span>
        <div className="flex-1">
          <div className="h-0.5 rounded-full bg-darwin-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${confidence === "high" ? 90 : confidence === "medium" ? 60 : 30}%`,
                background: color,
              }}
            />
          </div>
        </div>
        <SignalBadge confidence={confidence} />
      </div>
      {signal.newsEvents.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {signal.newsEvents.slice(0, 2).map((ev, i) => (
            <p key={i} className="text-[10px] text-darwin-text-muted">
              &bull; {ev}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [markets, setMarkets] = useState<Market[]>(MOCK_MARKETS)
  const [signals, setSignals] = useState<Signal[]>(MOCK_SIGNALS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [scrollY, setScrollY] = useState(0)

  const belowFoldRef = useRef<HTMLDivElement>(null)

  // Poll interval from env
  const pollMs = parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "30000", 10)

  // Fetch live data with polling
  useEffect(() => {
    async function fetchData() {
      try {
        const [mRes, sRes] = await Promise.all([fetch("/api/markets"), fetch("/api/signals")])
        if (!mRes.ok || !sRes.ok) return
        const mData = (await mRes.json()) as MarketsResponse
        const sData = (await sRes.json()) as SignalsResponse
        if (mData.markets?.length) setMarkets(mData.markets)
        if (sData.signals) setSignals(sData.signals)
      } catch {
        // keep mock data
      }
    }
    void fetchData()
    const iv = setInterval(() => void fetchData(), pollMs)
    return () => clearInterval(iv)
  }, [pollMs])

  // Track scroll position
  useEffect(() => {
    function onScroll() { setScrollY(window.scrollY) }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Selection logic
  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev
      // Max 4 — drop oldest
      const next = prev.length >= 4 ? [...prev.slice(1), id] : [...prev, id]
      return next
    })
  }, [])

  const handleDeselect = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }, [])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  const panesOpen = selectedIds.length > 0
  const overlayVisible = scrollY < 80

  // Build signal map
  const signalMap = useMemo(() => {
    const m = new Map<string, Signal>()
    for (const s of signals) m.set(s.marketId, s)
    return m
  }, [signals])

  // Selected markets/signals
  const selectedMarkets = useMemo(() =>
    selectedIds.map((id) => markets.find((m) => m.id === id)).filter((m): m is Market => !!m),
    [selectedIds, markets]
  )

  // Tabs for right pane
  const [activeSignalTab, setActiveSignalTab] = useState(0)
  useEffect(() => {
    // Reset to first tab when selection changes
    setActiveSignalTab(0)
  }, [selectedIds.length])

  const activeTabMarket = selectedMarkets[activeSignalTab] ?? selectedMarkets[0]
  const activeTabSignal = activeTabMarket ? signalMap.get(activeTabMarket.id) ?? null : null

  return (
    <div className="relative" style={{ background: "#000000" }}>
      {/* ── FIXED NAVBAR ────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-4"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          background: "rgba(0,0,0,0.35)",
          borderBottom: "1px solid rgba(42,42,58,0.4)",
        }}
      >
        <PolyverseLogo />
      </nav>

      {/* ── LEFT PANE ───────────────────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 h-full z-10 flex flex-col overflow-hidden border-r border-darwin-border transition-transform duration-300 ease-out"
        style={{
          width: "38vw",
          transform: panesOpen ? "translateX(0)" : "translateX(-100%)",
          background: "rgba(10,10,15,0.97)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-darwin-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-darwin-text uppercase">
              Comparison
            </h2>
            <span className="text-[10px] text-darwin-text-muted">
              {selectedIds.length} market{selectedIds.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <button
            onClick={handleDeselectAll}
            className="text-darwin-text-muted hover:text-darwin-text text-xs transition-colors px-2 py-1"
            aria-label="Close pane"
          >
            ✕
          </button>
        </div>

        {/* Charts — tabs if 3–4, stacked if 1–2 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {selectedMarkets.length <= 2 ? (
            // Stacked
            selectedMarkets.map((m) => (
              <MiniChartCard key={m.id} market={m} signal={signalMap.get(m.id) ?? null} />
            ))
          ) : (
            // Tabbed
            <>
              <div className="flex border-b border-darwin-border shrink-0 overflow-x-auto">
                {selectedMarkets.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveSignalTab(i)}
                    className={cn(
                      "px-3 py-2 text-[10px] whitespace-nowrap transition-colors shrink-0",
                      i === activeSignalTab
                        ? "text-darwin-text border-b-2 border-darwin-text"
                        : "text-darwin-text-muted hover:text-darwin-text-secondary"
                    )}
                  >
                    {m.question.slice(0, 22)}&hellip;
                  </button>
                ))}
              </div>
              {selectedMarkets[activeSignalTab] && (
                <MiniChartCard
                  market={selectedMarkets[activeSignalTab]}
                  signal={signalMap.get(selectedMarkets[activeSignalTab].id) ?? null}
                />
              )}
            </>
          )}
          {selectedMarkets.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-darwin-text-muted">Select a star to view chart</p>
            </div>
          )}
        </div>

        {/* Footer link */}
        <div className="px-4 py-3 border-t border-darwin-border shrink-0">
          <Link
            href={`/compare${selectedIds.length > 0 ? `?add=${selectedIds[0]}` : ""}`}
            className="text-[11px] text-darwin-text-secondary hover:text-darwin-text transition-colors"
          >
            Open full comparison view &rarr;
          </Link>
        </div>
      </div>

      {/* ── RIGHT PANE ──────────────────────────────────────────────────── */}
      <div
        className="fixed top-0 right-0 h-full z-10 flex flex-col overflow-hidden border-l border-darwin-border transition-transform duration-300 ease-out"
        style={{
          width: "28vw",
          transform: panesOpen ? "translateX(0)" : "translateX(100%)",
          background: "rgba(10,10,15,0.97)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-darwin-border shrink-0">
          <div className="h-2 w-2 rounded-full bg-darwin-green animate-pulse" />
          <h2 className="text-xs font-semibold tracking-wider text-darwin-text uppercase">
            Signal Feed
          </h2>
        </div>

        {/* Tabs per selected market */}
        {selectedMarkets.length > 1 && (
          <div className="flex border-b border-darwin-border shrink-0 overflow-x-auto">
            {selectedMarkets.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setActiveSignalTab(i)}
                className={cn(
                  "px-3 py-2 text-[10px] whitespace-nowrap transition-colors shrink-0",
                  i === activeSignalTab
                    ? "text-darwin-text border-b-2 border-darwin-text"
                    : "text-darwin-text-muted hover:text-darwin-text-secondary"
                )}
              >
                {m.question.slice(0, 18)}&hellip;
              </button>
            ))}
          </div>
        )}

        {/* Signal entries */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {activeTabSignal ? (
            <SignalFeedEntry signal={activeTabSignal} />
          ) : activeTabMarket ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-darwin-text-muted">No signals detected yet</p>
              <p className="mt-1 text-[10px] text-darwin-text-muted">
                Agents are scanning this market
              </p>
            </div>
          ) : null}

          {/* All signals summary */}
          {signals.length > 0 && (
            <div className="px-4 py-3 border-t border-darwin-border mt-2">
              <p className="label-caps mb-2">Recent signals</p>
              {signals.slice(0, 5).map((sig) => {
                const isBull = sig.ev > 0
                return (
                  <div key={sig.id} className="flex items-center gap-2 py-1.5 border-b border-darwin-border/50 last:border-0">
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: isBull ? "#00D47E" : "#FF4444" }}
                    />
                    <span className="text-[10px] text-darwin-text-secondary flex-1 line-clamp-1">
                      {sig.marketQuestion.slice(0, 40)}&hellip;
                    </span>
                    <span className={cn("font-data text-[10px] font-medium shrink-0", isBull ? "text-darwin-green" : "text-darwin-red")}>
                      {formatEV(sig.ev)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE PAGE CONTENT ─────────────────────────────────────── */}
      <div className="relative pointer-events-none" style={{ minHeight: "100vh" }}>

        {/* Hero section — transparent, 100vh, overlay text only */}
        <section className="relative h-screen flex flex-col pointer-events-none">
          {/* Star canvas — scoped to hero section only */}
          <div
            className="pointer-events-auto absolute inset-0"
            style={{ zIndex: 0 }}
            aria-hidden="true"
          >
            <StarCanvas className="w-full h-full" />
          </div>

          {/* Navbar spacer */}
          <div className="h-16 shrink-0" />

          {/* Radial gradient mask behind text block */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: "50%",
              top: "42%",
              transform: "translate(-50%, -50%)",
              width: "680px",
              height: "440px",
              background: "radial-gradient(ellipse at center, rgba(0,0,0,0.72) 25%, transparent 72%)",
              zIndex: 1,
            }}
            aria-hidden="true"
          />

          {/* Hero text overlay */}
          <div
            className="flex flex-1 flex-col items-center justify-center text-center px-8"
            style={{ zIndex: 2 }}
          >
            <div
              className="space-y-5 transition-all duration-700"
              style={{
                opacity: overlayVisible ? 1 : 0,
                transform: overlayVisible ? "translateY(0)" : "translateY(-16px)",
                pointerEvents: overlayVisible ? "auto" : "none",
              }}
            >
              <p
                className="label-caps label-glow"
                style={{ letterSpacing: "0.18em", opacity: 0.7 }}
              >
                AI-ENABLED POLYMARKET INTELLIGENCE
              </p>

              <h1 className="hero-headline-glow max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight text-darwin-text">
                See Prediction Markets in a New Light.
              </h1>

              <p
                className="mx-auto max-w-lg text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                Every active trade in the Polymarket universe &mdash; live pricing,
                real-time volume, and curated news in one view.
              </p>

              <div className="pt-3">
                <Link
                  href="/"
                  className="btn-glow inline-flex items-center gap-2 bg-darwin-text text-darwin-bg px-8 py-3 text-sm font-semibold tracking-wide"
                >
                  Explore the Universe
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>

          </div>
        </section>
      </div>

      {/* ── BELOW THE FOLD (solid background, covers galaxy) ────────────── */}
      <div ref={belowFoldRef} className="relative z-10 pointer-events-auto" id="below-fold">

        {/* SECTION D — FOOTER */}
        <footer
          className="border-t border-darwin-border px-8 py-5"
          style={{ background: "#0A0A0F" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-darwin-text-muted">
              Polyverse &middot; HackEurope 2026
            </span>
            <Link
              href="/"
              className="text-xs text-darwin-text-secondary transition-colors hover:text-darwin-text"
            >
              Enter Dashboard &rarr;
            </Link>
          </div>
        </footer>
      </div>

      {/* Mobile note (< 768px) */}
      <style>{`
        @media (max-width: 767px) {
          .panes-left, .panes-right { display: none !important; }
        }
        .btn-glow {
          border-radius: 9999px;
          transition: box-shadow 0.25s ease,
                      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .btn-glow:hover {
          box-shadow: 0 0 16px rgba(255,255,255,0.45),
                      0 0 48px rgba(255,255,255,0.14);
        }
        .btn-glow:active {
          transform: scale(0.97);
          transition: transform 0.08s ease, box-shadow 0.1s ease;
          box-shadow: 0 0 8px rgba(255,255,255,0.25);
        }
        @keyframes hero-glow {
          from { text-shadow: 0 0 10px rgba(255,255,255,0.3); }
          to   { text-shadow: 0 0 30px rgba(255,255,255,0.7), 0 0 80px rgba(255,255,255,0.25); }
        }
        @keyframes label-glow {
          from { text-shadow: 0 0 5px rgba(255,255,255,0.15); }
          to   { text-shadow: 0 0 15px rgba(255,255,255,0.4), 0 0 40px rgba(255,255,255,0.15); }
        }
        .hero-headline-glow {
          animation: hero-glow 3.5s ease-in-out infinite alternate;
        }
        .label-glow {
          animation: label-glow 3.5s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  )
}
