"use client"

import { cn } from "@/lib/utils"
import { DoorOpen, Users, ArrowRight } from "lucide-react"

interface RoomCardProps {
  name: string
  description?: string
  capacity?: number
  onClick?: () => void
  className?: string
}

export function RoomCard({
  name,
  description = "Свободная рассадка и бронирование рабочих мест",
  capacity,
  onClick,
  className
}: RoomCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group bg-card rounded-3xl p-6 border border-border",
        "hover:shadow-lg hover:shadow-black/5 hover:border-transparent",
        "transition-all duration-300 cursor-pointer",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <DoorOpen className="w-7 h-7 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2 group-hover:text-foreground transition-colors">
        {name}
      </h3>
      
      <p className="text-muted-foreground text-sm leading-relaxed mb-4">
        {description}
      </p>
      
      {capacity && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>Вместимость: {capacity} мест</span>
        </div>
      )}
      
      <div className="mt-4 flex items-center text-sm font-medium text-primary">
        <span>Выбрать место</span>
        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  )
}
