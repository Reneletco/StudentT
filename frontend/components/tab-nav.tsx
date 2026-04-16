"use client"

import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
}

interface TabNavProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function TabNav({ tabs, activeTab, onChange, className }: TabNavProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="inline-flex items-center bg-card border border-border rounded-full p-1 gap-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200",
              "whitespace-nowrap",
              activeTab === tab.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
