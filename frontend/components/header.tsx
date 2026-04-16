"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { User, LogOut, Settings, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  user?: {
    name: string
    role: "admin" | "mentor" | "student"
    avatar?: string
  }
  onLogout?: () => void
  onOpenProfile?: () => void
  onOpenSettings?: () => void
}

const roleLabels = {
  admin: "Администратор",
  mentor: "Ментор", 
  student: "Студент"
}

export function Header({ user, onLogout, onOpenProfile, onOpenSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/brand-icon.png"
              alt="Студент & Т"
              className="w-9 h-9 rounded-xl object-cover"
              draggable={false}
            />
            <span className="text-xl font-semibold tracking-tight">Студент & Т</span>
          </div>

          {/* User section */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-sm text-muted-foreground px-3 py-1.5 bg-secondary rounded-full">
                {roleLabels[user.role]}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary transition-colors">
                    <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm overflow-hidden">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="hidden sm:block font-medium text-sm">{user.name}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="cursor-pointer" onClick={onOpenProfile}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Профиль</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={onOpenSettings}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Настройки</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive" onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
