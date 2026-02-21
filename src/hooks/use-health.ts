import { useQuery } from "@tanstack/react-query"
import type { HealthResponse } from "@/lib/types"

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health")
      if (!res.ok) throw new Error("Health check failed")
      return res.json()
    },
    refetchInterval: 60_000,
  })
}
