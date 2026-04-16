"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type AdminRoomTable = {
  id: number
  x: number // cell X (0-based)
  y: number // cell Y (0-based)
  seats: number // enabled seats inside this table square
}

function excelRowLabel(i: number): string {
  // Excel-like row labels: 0->A, 25->Z, 26->AA, ...
  let n = i
  let label = ""
  while (true) {
    const rem = n % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor(n / 26) - 1
    if (n < 0) break
  }
  return label
}

function tableSideFromSeats(seats: number): number {
  const s = Math.max(0, Number(seats) || 0)
  return Math.max(1, Math.ceil(Math.sqrt(s)))
}

function tableOccupiedCells(table: AdminRoomTable): Set<string> {
  const side = tableSideFromSeats(table.seats)
  const cells = new Set<string>()
  for (let r = 0; r < side; r++) {
    for (let c = 0; c < side; c++) {
      cells.add(`${table.x + c},${table.y + r}`)
    }
  }
  return cells
}

export function buildSeatingSchemaFromTables(tables: AdminRoomTable[]) {
  if (!tables.length) {
    return {
      seating_schema: {
        rows: ["A", "B", "C", "D", "E"],
        columns: 8,
        vip: [],
        disabled: [],
        tables: [],
      },
      capacity: 0,
    }
  }

  let maxX = 0
  let maxY = 0
  for (const t of tables) {
    const side = tableSideFromSeats(t.seats)
    maxX = Math.max(maxX, t.x + side)
    maxY = Math.max(maxY, t.y + side)
  }

  // 2-cell margin so tables aren't glued to the edges visually.
  const margin = 2
  const columns = Math.max(1, maxX + margin)
  const rowsCount = Math.max(1, maxY + margin)
  const rows = Array.from({ length: rowsCount }, (_, i) => excelRowLabel(i))

  const seating_schema = {
    rows,
    columns,
    vip: [],
    disabled: [],
    tables: tables.map((t) => ({
      x: t.x,
      y: t.y,
      seats: t.seats,
      side: tableSideFromSeats(t.seats),
    })),
  }

  const capacity = tables.reduce((sum, t) => sum + Math.max(0, Number(t.seats) || 0), 0)
  return { seating_schema, capacity }
}

function cellsOverlap(cellsA: Set<string>, cellsB: Set<string>): boolean {
  for (const k of cellsA) {
    if (cellsB.has(k)) return true
  }
  return false
}

export function AdminRoomCanvas({
  tables,
  onChangeTables,
}: {
  tables: AdminRoomTable[]
  onChangeTables: (next: AdminRoomTable[]) => void
}) {
  const cellSize = 26
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const [mode, setMode] = useState<"add" | "move">("move")
  const [selectedId, setSelectedId] = useState<number | null>(tables[0]?.id ?? null)

  useEffect(() => {
    if (selectedId == null && tables.length > 0) setSelectedId(tables[0].id)
  }, [tables, selectedId])

  const grid = useMemo(() => {
    if (!tables.length) {
      return { columns: 10, rows: 6 }
    }
    let maxX = 0
    let maxY = 0
    for (const t of tables) {
      const side = tableSideFromSeats(t.seats)
      maxX = Math.max(maxX, t.x + side)
      maxY = Math.max(maxY, t.y + side)
    }
    const margin = 2
    return { columns: maxX + margin, rows: maxY + margin }
  }, [tables])

  const [draggingId, setDraggingId] = useState<number | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)

  const canPlace = (candidate: AdminRoomTable, ignoreId?: number) => {
    const cCells = tableOccupiedCells(candidate)
    for (const t of tables) {
      if (ignoreId != null && t.id === ignoreId) continue
      if (cellsOverlap(cCells, tableOccupiedCells(t))) return false
    }
    return true
  }

  const toCellXY = (clientX: number, clientY: number) => {
    const el = canvasRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const relX = clientX - rect.left
    const relY = clientY - rect.top
    const x = Math.floor(relX / cellSize)
    const y = Math.floor(relY / cellSize)
    return { x: Math.max(0, x), y: Math.max(0, y) }
  }

  useEffect(() => {
    if (draggingId == null) return

    const onMove = (e: MouseEvent) => {
      const id = draggingId
      const t = tables.find((x) => x.id === id)
      if (!t) return
      const { x, y } = toCellXY(e.clientX, e.clientY)

      const candidate: AdminRoomTable = { ...t, x, y }
      if (!canPlace(candidate, id)) return
      onChangeTables(tables.map((tt) => (tt.id === id ? candidate : tt)))
    }

    const onUp = () => {
      setDraggingId(null)
      dragOffsetRef.current = null
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [draggingId, tables, onChangeTables])

  const selectedTable = tables.find((t) => t.id === selectedId) ?? null

  const seatInputValue = selectedTable ? selectedTable.seats : 0

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Конструктор помещений: столы как квадраты</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mode === "add" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setMode(mode === "add" ? "move" : "add")}
          >
            <Plus className="w-4 h-4 mr-2" />
            {mode === "add" ? "Клик: добавить" : "Добавить стол"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              if (!window.confirm("Очистить все столы?")) return
              onChangeTables([])
              setSelectedId(null)
              setMode("move")
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Сброс
          </Button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={cn("relative overflow-auto rounded-2xl border border-border")}
        style={{
          width: "100%",
          height: 420,
          backgroundImage: `
            linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
          `,
          backgroundSize: `${cellSize}px ${cellSize}px`,
          backgroundPosition: "0 0",
        }}
        onMouseDown={(e) => {
          if (mode !== "add") return
          if (e.button !== 0) return
          const { x, y } = toCellXY(e.clientX, e.clientY)
          const newTable: AdminRoomTable = { id: Date.now(), x, y, seats: 4 }
          if (!canPlace(newTable)) return
          onChangeTables([...tables, newTable])
          setSelectedId(newTable.id)
          setMode("move")
        }}
      >
        {tables.map((t) => {
          const side = tableSideFromSeats(t.seats)
          const isSelected = t.id === selectedId
          return (
            <div
              key={t.id}
              className={cn(
                "absolute rounded-xl cursor-grab select-none transition-transform",
                isSelected ? "ring-2 ring-primary/60" : "ring-1 ring-border/80"
              )}
              style={{
                left: t.x * cellSize,
                top: t.y * cellSize,
                width: side * cellSize,
                height: side * cellSize,
                background: isSelected ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.10)",
                border: "1px solid rgba(124,58,237,0.35)",
              }}
              onMouseDown={(e) => {
                if (mode === "add") return
                e.stopPropagation()
                setSelectedId(t.id)
                setDraggingId(t.id)
              }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(t.id)
              }}
              title={`Стол: ${t.seats} мест`}
            >
              <div className="absolute inset-0 flex items-start justify-end p-2 pointer-events-none">
                <div className="text-[10px] bg-background/80 border border-border px-2 py-0.5 rounded-full font-semibold">
                  {t.seats}
                </div>
              </div>
            </div>
          )
        })}
        {/* Canvas area size hint */}
        <div
          style={{
            width: grid.columns * cellSize,
            height: grid.rows * cellSize,
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="bg-secondary/40 rounded-2xl border border-border p-4">
          <div className="text-sm font-semibold mb-2">Параметры выбранного стола</div>
          {selectedTable ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Мест на столе</div>
                <Input
                  type="number"
                  min={1}
                  value={seatInputValue}
                  onChange={(e) => {
                    const nextSeats = Math.max(1, Number(e.target.value) || 1)
                    const side = tableSideFromSeats(nextSeats)
                    const candidate: AdminRoomTable = { ...selectedTable, seats: nextSeats }
                    // Overlap check uses square side, which depends on seats.
                    if (!canPlace(candidate, selectedTable.id)) return
                    onChangeTables(tables.map((tt) => (tt.id === selectedTable.id ? candidate : tt)))
                  }}
                  className="h-12 rounded-xl bg-secondary border-0"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Размер квадрата: {tableSideFromSeats(seatInputValue)}x{tableSideFromSeats(seatInputValue)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    const id = selectedTable.id
                    onChangeTables(tables.filter((tt) => tt.id !== id))
                    setSelectedId(null)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Выберите стол на полотне</p>
          )}
        </div>

        <div className="bg-secondary/40 rounded-2xl border border-border p-4">
          <div className="text-sm font-semibold mb-2">Подсказка</div>
          <p className="text-sm text-muted-foreground">
            Участники будут выбирать места в сетке. У столов есть фиксированный квадрат на полотне; количество мест
            определяет, сколько ячеек внутри квадрата доступно.
          </p>
        </div>
      </div>
    </div>
  )
}

