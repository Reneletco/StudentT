"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff, Loader2 } from "lucide-react"

interface AuthFormProps {
  onLogin?: (username: string, password: string) => Promise<void>
  onRegister?: (data: { username: string; email: string; fullName: string; password: string }) => Promise<void>
  className?: string
}

export function AuthForm({ onLogin, onRegister, className }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  
  // Register form state
  const [regUsername, setRegUsername] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regFullName, setRegFullName] = useState("")
  const [regPassword, setRegPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onLogin) return
    setIsLoading(true)
    try {
      await onLogin(loginUsername, loginPassword)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onRegister) return
    setIsLoading(true)
    try {
      await onRegister({
        username: regUsername,
        email: regEmail,
        fullName: regFullName,
        password: regPassword
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn(
      "w-full max-w-md mx-auto",
      className
    )}>
      <div className="bg-card rounded-3xl border border-border p-8 shadow-xl shadow-black/5">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/brand-icon.png"
            alt="Студент & Т"
            className="w-12 h-12 rounded-xl object-cover"
            draggable={false}
          />
          <span className="text-2xl font-semibold tracking-tight">Студент & Т</span>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-secondary rounded-full p-1 mb-8">
          <button
            onClick={() => setActiveTab("login")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium rounded-full transition-all",
              activeTab === "login"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Вход
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium rounded-full transition-all",
              activeTab === "register"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Регистрация
          </button>
        </div>

        {/* Login Form */}
        {activeTab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-xl font-semibold mb-2">Добро пожаловать</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Войдите в свой аккаунт, чтобы продолжить
            </p>
            
            <div className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Логин"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="h-12 rounded-xl bg-secondary border-0 px-4"
                />
              </div>
              
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Пароль"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-12 rounded-xl bg-secondary border-0 px-4 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Войти"
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              Для тестирования: admin / admin
            </p>
          </form>
        )}

        {/* Register Form */}
        {activeTab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-xl font-semibold mb-2">Создать аккаунт</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Заполните данные для регистрации
            </p>
            
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Логин"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="h-12 rounded-xl bg-secondary border-0 px-4"
              />
              
              <Input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="h-12 rounded-xl bg-secondary border-0 px-4"
              />
              
              <Input
                type="text"
                placeholder="Полное имя"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="h-12 rounded-xl bg-secondary border-0 px-4"
              />
              
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Пароль"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="h-12 rounded-xl bg-secondary border-0 px-4 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Зарегистрироваться"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
