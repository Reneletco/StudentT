"use client"

import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"
import { MapPin, Calendar, Users, ArrowRight } from "lucide-react"

interface EventCardProps {
  title: string
  description?: string
  date: string
  time: string
  location: string
  freeSeats: number
  totalSeats: number
  price?: string
  status?: "open" | "closed"
  onClick?: () => void
  className?: string
}

export function EventCard({
  title,
  description,
  date,
  time,
  location,
  freeSeats,
  totalSeats,
  price,
  status = "open",
  onClick,
  className
}: EventCardProps) {
  const isOpen = freeSeats > 0 && status === "open"
  
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
      <div className="flex items-start justify-between gap-4 mb-4">
        <StatusBadge variant={isOpen ? "open" : "closed"}>
          {isOpen ? "Набор открыт" : "Набор закрыт"}
        </StatusBadge>
        {price && (
          <span className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full">
            {price}
          </span>
        )}
      </div>
      
      <h3 className="text-xl font-semibold mb-2 group-hover:text-foreground transition-colors">
        {title}
      </h3>
      
      {description && (
        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
          {description}
        </p>
      )}
      
      <div className="space-y-2 mt-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{date}, {time}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>Свободно {freeSeats} из {totalSeats} мест</span>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-between">
        <div className="w-full bg-secondary rounded-full h-1.5">
          <div 
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${((totalSeats - freeSeats) / totalSeats) * 100}%` }}
          />
        </div>
        <ArrowRight className="w-5 h-5 ml-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  )
}
