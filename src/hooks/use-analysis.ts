import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AnalyzeResponse } from "@/lib/types"

export function useAnalysis() {
  const queryClient = useQueryClient()

  return useMutation<AnalyzeResponse, Error, string>({
    mutationFn: async (marketId: string) => {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId }),
      })
      if (!res.ok) throw new Error("Analysis failed")
      return res.json()
    },
    onSuccess: (_data, marketId) => {
      queryClient.invalidateQueries({ queryKey: ["market", marketId] })
      queryClient.invalidateQueries({ queryKey: ["signals"] })
    },
  })
}
