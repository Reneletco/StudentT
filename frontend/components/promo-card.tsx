"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

interface PromoCardProps {
  title: string
  description: string
  buttonText?: string
  onButtonClick?: () => void
  imageSrc?: string
  className?: string
}

export function PromoCard({
  title,
  description,
  buttonText = "Участвовать",
  onButtonClick,
  imageSrc,
  className
}: PromoCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-3xl border border-border overflow-hidden",
      "hover:shadow-lg hover:shadow-black/5 transition-all duration-300",
      className
    )}>
      <div className="flex flex-col lg:flex-row">
        {/* Content */}
        <div className="flex-1 p-8 lg:p-10 flex flex-col justify-center">
          <h2 className="text-2xl lg:text-3xl font-semibold leading-tight text-balance mb-4">
            {title}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {description}
          </p>
          <div>
            <Button
              onClick={onButtonClick}
              variant="outline"
              className="rounded-full px-6 py-5 border-border hover:bg-secondary group"
            >
              {buttonText}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
        
        {/* Image */}
        {imageSrc && (
          <div className="lg:w-[45%] relative min-h-[240px] lg:min-h-[320px]">
            <img 
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  )
}
