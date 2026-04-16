import { cn } from "@/lib/utils"

type BadgeVariant = "open" | "closed" | "pending" | "success" | "warning" | "default"

interface StatusBadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  open: "bg-[#FFDD2D] text-[#1D1D1D]",
  closed: "bg-muted text-muted-foreground",
  pending: "bg-orange-100 text-orange-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  default: "bg-secondary text-secondary-foreground"
}

export function StatusBadge({ variant = "default", children, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium",
      variantStyles[variant],
      className
    )}>
      {children}
    </span>
  )
}
