"use client"

import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"
import { Button } from "@/components/ui/button"
import { MapPin, Calendar, Armchair, QrCode, X } from "lucide-react"

type BookingStatus = "active" | "arrived" | "cancelled" | "not_arrived"

interface BookingCardProps {
  eventTitle: string
  roomName: string
  seats: string[]
  date: string
  status: BookingStatus
  qrToken?: string
  checkedInAt?: string
  durationHours?: number
  onCancel?: () => void
  className?: string
}

const statusConfig: Record<BookingStatus, { label: string; variant: "open" | "success" | "closed" | "warning" }> = {
  active: { label: "Активна", variant: "open" },
  not_arrived: { label: "Не пришел", variant: "warning" },
  arrived: { label: "Отмечен", variant: "success" },
  cancelled: { label: "Отменена", variant: "closed" }
}

export function BookingCard({
  eventTitle,
  roomName,
  seats,
  date,
  status,
  qrToken,
  checkedInAt,
  durationHours,
  onCancel,
  className
}: BookingCardProps) {
  const qrUrl = qrToken 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/bookings/check-in/${qrToken}`)}`
    : null
  
  const canCancel = status === "active" || status === "not_arrived"
  const config = statusConfig[status]

  return (
    <div className={cn(
      "bg-card rounded-3xl border border-border p-6",
      "hover:shadow-lg hover:shadow-black/5 transition-all duration-300",
      className
    )}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* QR Code */}
        {qrUrl && status !== "cancelled" && (
          <div className="flex-shrink-0">
            <div className="w-[140px] h-[140px] bg-white rounded-2xl border border-border p-2 mx-auto lg:mx-0">
              <img 
                src={qrUrl} 
                alt="QR код для входа"
                className="w-full h-full"
              />
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold">{eventTitle}</h3>
            <StatusBadge variant={config.variant}>
              {config.label}
            </StatusBadge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{roomName}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>{date}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Armchair className="w-4 h-4 flex-shrink-0" />
              <span>Места: {seats.join(", ")}</span>
            </div>
            {durationHours ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Длительность: {durationHours} ч.</span>
              </div>
            ) : null}
          </div>
          
          {checkedInAt && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <QrCode className="w-4 h-4" />
                <span>Отмечен по QR: {new Date(checkedInAt).toLocaleString("ru-RU")}</span>
              </div>
            </div>
          )}
          
          {canCancel && onCancel && (
            <div className="mt-4">
              <Button
                onClick={onCancel}
                variant="outline"
                className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <X className="w-4 h-4 mr-2" />
                Отменить бронь
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
