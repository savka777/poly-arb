"use client"

import React, { useState, useCallback, useRef, useEffect, type ReactNode, type MouseEvent } from "react"

export type GridLayout = "auto" | "horizontal" | "vertical"

interface ResizableGridProps {
  children: ReactNode[]
  layout?: GridLayout
}

function getAutoLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 }
  if (count <= 2) return { cols: 2, rows: 1 }
  if (count <= 4) return { cols: 2, rows: 2 }
  if (count <= 6) return { cols: 3, rows: 2 }
  return { cols: 4, rows: 2 }
}

export function ResizableGrid({ children, layout: layoutMode = "auto" }: ResizableGridProps) {
  const flatChildren = React.Children.toArray(children)
  const count = flatChildren.length

  const layout = layoutMode === "horizontal"
    ? { cols: count, rows: 1 }
    : layoutMode === "vertical"
      ? { cols: 1, rows: count }
      : getAutoLayout(count)

  const containerRef = useRef<HTMLDivElement>(null)

  const [colSplits, setColSplits] = useState<number[]>(() =>
    Array(layout.cols).fill(1 / layout.cols)
  )
  const [rowSplits, setRowSplits] = useState<number[]>(() =>
    Array(layout.rows).fill(1 / layout.rows)
  )

  // Reset splits when layout dimensions change and notify charts
  const prevLayoutRef = useRef({ cols: layout.cols, rows: layout.rows })
  useEffect(() => {
    const prev = prevLayoutRef.current
    if (prev.cols !== layout.cols || prev.rows !== layout.rows) {
      prevLayoutRef.current = { cols: layout.cols, rows: layout.rows }
      setColSplits(Array(layout.cols).fill(1 / layout.cols))
      setRowSplits(Array(layout.rows).fill(1 / layout.rows))
    }
  }, [layout.cols, layout.rows])

  const draggingRef = useRef<{
    type: "col" | "row"
    index: number
    startPos: number
    startSplits: number[]
  } | null>(null)

  const handleMouseDown = useCallback(
    (type: "col" | "row", index: number, e: MouseEvent) => {
      e.preventDefault()
      const startPos = type === "col" ? e.clientX : e.clientY
      const startSplits = type === "col" ? [...colSplits] : [...rowSplits]
      draggingRef.current = { type, index, startPos, startSplits }

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const drag = draggingRef.current
        if (!drag || !containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const totalSize = drag.type === "col" ? rect.width : rect.height
        const currentPos = drag.type === "col" ? moveEvent.clientX : moveEvent.clientY
        const delta = (currentPos - drag.startPos) / totalSize

        const newSplits = [...drag.startSplits]
        const minSize = 0.1

        const left = newSplits[drag.index] + delta
        const right = newSplits[drag.index + 1] - delta

        if (left >= minSize && right >= minSize) {
          newSplits[drag.index] = left
          newSplits[drag.index + 1] = right
          if (drag.type === "col") {
            setColSplits(newSplits)
          } else {
            setRowSplits(newSplits)
          }
        }

      }

      const handleMouseUp = () => {
        draggingRef.current = null
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.body.style.cursor = type === "col" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [colSplits, rowSplits]
  )

  const handleDoubleClick = useCallback(
    (type: "col" | "row") => {
      if (type === "col") {
        setColSplits(Array(layout.cols).fill(1 / layout.cols))
      } else {
        setRowSplits(Array(layout.rows).fill(1 / layout.rows))
      }
    },
    [layout.cols, layout.rows]
  )

  const colTemplate = colSplits.map((s) => `${s}fr`).join(" 4px ")
  const rowTemplate = rowSplits.map((s) => `${s}fr`).join(" 4px ")

  const cells: ReactNode[] = []
  const totalCols = layout.cols * 2 - 1
  const totalRows = layout.rows * 2 - 1

  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const isRowDivider = rowIdx % 2 === 1

    for (let colIdx = 0; colIdx < totalCols; colIdx++) {
      const isColDivider = colIdx % 2 === 1
      const gridRow = rowIdx + 1
      const gridCol = colIdx + 1

      if (isRowDivider && isColDivider) {
        cells.push(
          <div
            key={`x-${rowIdx}-${colIdx}`}
            style={{ gridRow, gridColumn: gridCol }}
            className="bg-darwin-border cursor-move"
          />
        )
      } else if (isRowDivider) {
        const dividerIdx = Math.floor(rowIdx / 2)
        cells.push(
          <div
            key={`h-${rowIdx}-${colIdx}`}
            style={{ gridRow, gridColumn: gridCol }}
            className="bg-darwin-border cursor-row-resize hover:bg-darwin-blue/30 transition-colors"
            onMouseDown={(e) => handleMouseDown("row", dividerIdx, e)}
            onDoubleClick={() => handleDoubleClick("row")}
          />
        )
      } else if (isColDivider) {
        const dividerIdx = Math.floor(colIdx / 2)
        cells.push(
          <div
            key={`v-${rowIdx}-${colIdx}`}
            style={{ gridRow, gridColumn: gridCol }}
            className="bg-darwin-border cursor-col-resize hover:bg-darwin-blue/30 transition-colors"
            onMouseDown={(e) => handleMouseDown("col", dividerIdx, e)}
            onDoubleClick={() => handleDoubleClick("col")}
          />
        )
      } else {
        const panelRow = Math.floor(rowIdx / 2)
        const panelCol = Math.floor(colIdx / 2)
        const panelIdx = panelRow * layout.cols + panelCol
        cells.push(
          <div
            key={`p-${panelIdx}`}
            style={{ gridRow, gridColumn: gridCol, minHeight: 0, minWidth: 0 }}
            className="h-full w-full overflow-hidden"
          >
            {flatChildren[panelIdx] ?? null}
          </div>
        )
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden"
      style={{
        display: "grid",
        gridTemplateColumns: colTemplate,
        gridTemplateRows: rowTemplate,
        height: "100%",
        minHeight: 0,
      }}
    >
      {cells}
    </div>
  )
}
