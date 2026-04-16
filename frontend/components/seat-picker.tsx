"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Check } from "lucide-react"

type SeatStatus = "available" | "booked" | "selected" | "vip" | "disabled" | "absent"

interface Seat {
  label: string
  status: SeatStatus
  tableId?: number
}

interface SeatRow {
  row: string
  seats: Seat[]
}

interface SeatPickerProps {
  roomName: string
  eventTitle?: string
  seats: SeatRow[]
  onConfirm: (selectedSeats: string[]) => void
  onBack: () => void
  confirmLabel?: string
  className?: string
}

const seatStyles: Record<SeatStatus, string> = {
  available: "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200 cursor-pointer",
  booked: "bg-rose-100 border-rose-300 text-rose-500 cursor-not-allowed opacity-60",
  selected: "bg-primary border-primary text-primary-foreground scale-105 shadow-md",
  vip: "bg-emerald-100 border-primary ring-2 ring-primary text-emerald-700 hover:bg-emerald-200 cursor-pointer",
  disabled: "bg-muted border-muted text-muted-foreground cursor-not-allowed opacity-50",
  absent: "bg-muted border-muted text-muted-foreground opacity-20 cursor-not-allowed"
}

export function SeatPicker({
  roomName,
  eventTitle,
  seats,
  onConfirm,
  onBack,
  confirmLabel,
  className
}: SeatPickerProps) {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])

  const toggleSeat = (label: string, status: SeatStatus) => {
    if (["booked", "disabled", "absent"].includes(status)) return
    
    setSelectedSeats(prev => 
      prev.includes(label)
        ? prev.filter(s => s !== label)
        : [...prev, label]
    )
  }

  const getSeatStatus = (seat: Seat): SeatStatus => {
    if (selectedSeats.includes(seat.label)) return "selected"
    return seat.status
  }

  const tableRingClasses = [
    "ring-2 ring-indigo-500/30",
    "ring-2 ring-fuchsia-500/30",
    "ring-2 ring-emerald-500/30",
    "ring-2 ring-sky-500/30",
    "ring-2 ring-amber-500/30",
    "ring-2 ring-rose-500/30",
    "ring-2 ring-violet-500/30",
    "ring-2 ring-teal-500/30",
    "ring-2 ring-lime-500/30",
    "ring-2 ring-orange-500/30",
  ]

  const getSeatRing = (seat: Seat) => {
    if (seat.tableId == null) return ""
    if (getSeatStatus(seat) === "absent") return ""
    return tableRingClasses[seat.tableId % tableRingClasses.length]
  }

  const getSeatTableSpacing = (row: SeatRow, idx: number) => {
    if (idx === 0) return ""
    const curr = row.seats[idx]
    const prev = row.seats[idx - 1]
    if (curr.tableId == null || prev.tableId == null) return ""
    return curr.tableId !== prev.tableId ? "ml-3" : ""
  }

  const hasTables = seats.some((r) => r.seats.some((s) => s.tableId != null))

  return (
    <div className={cn("bg-card rounded-3xl border border-border p-6 lg:p-8", className)}>
      {/* Header */}
      <div className="mb-6">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        
        <h2 className="text-2xl font-semibold">
          {eventTitle || "Бронирование места"}
        </h2>
        <p className="text-muted-foreground mt-1">Зал: {roomName}</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-8 p-4 bg-secondary/50 rounded-2xl">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-6 h-5 rounded bg-emerald-100 border border-emerald-300" />
          <span>Свободно</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-6 h-5 rounded bg-rose-100 border border-rose-300 opacity-60" />
          <span>Занято</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-6 h-5 rounded bg-primary border border-primary" />
          <span>Выбрано</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-6 h-5 rounded bg-emerald-100 border border-emerald-300 ring-2 ring-primary" />
          <span>VIP</span>
        </div>
        {hasTables && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-5 rounded bg-violet-100 border border-violet-300 ring-2 ring-violet-500/40" />
            <span>Стол (группа мест)</span>
          </div>
        )}
      </div>

      {/* Scene */}
      

      {/* Seats Grid */}
      <div className="flex flex-col items-center gap-3 overflow-x-auto pb-4">
        {seats.map((row) => (
          <div key={row.row} className="flex items-center gap-2">
            <span className="w-8 text-right text-sm font-medium text-muted-foreground">
              {row.row}
            </span>
            <div className="flex gap-2">
              {row.seats.map((seat, idx) => (
                <div key={seat.label} className={cn("relative", getSeatTableSpacing(row, idx))}>
                  {seat.tableId != null && getSeatStatus(seat) !== "absent" && (
                    <div className="absolute -top-2 -right-1 text-[9px] leading-none px-1 py-0.5 rounded-full bg-background/95 border border-border text-muted-foreground">
                      T{seat.tableId + 1}
                    </div>
                  )}
                  <button
                    onClick={() => toggleSeat(seat.label, seat.status)}
                    className={cn(
                      "w-10 h-9 rounded-lg border text-xs font-semibold transition-all duration-200",
                      seatStyles[getSeatStatus(seat)],
                      getSeatRing(seat)
                    )}
                  >
                    {seat.label}
                  </button>
                </div>
              ))}
            </div>
            <span className="w-8 text-left text-sm font-medium text-muted-foreground">
              {row.row}
            </span>
          </div>
        ))}
      </div>

      {/* Selected Info */}
      <div className="mt-8 pt-6 border-t border-border">
        {selectedSeats.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Выбранные места:</p>
              <p className="font-semibold text-lg mt-1">{selectedSeats.join(", ")}</p>
            </div>
            <Button
              onClick={() => onConfirm(selectedSeats)}
              className="w-full sm:w-auto rounded-full px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Check className="w-4 h-4 mr-2" />
              {confirmLabel || "Подтвердить бронь"}
            </Button>
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            Выберите места для бронирования
          </p>
        )}
      </div>
    </div>
  )
}
