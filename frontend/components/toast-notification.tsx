"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, AlertCircle, Info, X } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastNotificationProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info
}

const styleMap = {
  success: "border-l-emerald-500 bg-emerald-50",
  error: "border-l-red-500 bg-red-50", 
  info: "border-l-blue-500 bg-blue-50"
}

const iconColorMap = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-blue-500"
}

export function ToastNotification({ toast, onDismiss }: ToastNotificationProps) {
  const Icon = iconMap[toast.type]
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={cn(
      "flex items-center gap-3 p-4 rounded-xl border-l-4 shadow-lg",
      "animate-in slide-in-from-right-full duration-300",
      styleMap[toast.type]
    )}>
      <Icon className={cn("w-5 h-5 flex-shrink-0", iconColorMap[toast.type])} />
      <p className="text-sm font-medium text-foreground flex-1">{toast.message}</p>
      <button 
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Toast container and hook
interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

export function useToastState(): ToastState {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const addToast = (message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }
  
  return { toasts, addToast, removeToast }
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[], onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
