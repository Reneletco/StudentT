"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { TabNav } from "@/components/tab-nav"
import { EventCard } from "@/components/event-card"
import { MentorCard } from "@/components/mentor-card"
import { PromoCard } from "@/components/promo-card"
import { RoomCard } from "@/components/room-card"
import { BookingCard } from "@/components/booking-card"
import { SeatPicker } from "@/components/seat-picker"
import { AuthForm } from "@/components/auth-form"
import { EmptyState } from "@/components/empty-state"
import { ToastContainer, useToastState } from "@/components/toast-notification"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar, Users, Ticket, TrendingUp, GraduationCap, Search } from "lucide-react"
import { RealUnihubPage } from "./real-page"

// Demo user
const demoUser = {
  name: "Александр",
  role: "student" as const,
  avatar: undefined
}

// Demo data
const demoEvents = [
  {
    id: 1,
    title: "Аналитик",
    description: "Штурмуйте проблемы, выдвигайте гипотезы и тестируйте их",
    date: "15 апреля 2026",
    time: "14:00",
    location: "Аудитория А-301",
    freeSeats: 24,
    totalSeats: 30,
    price: "Бесплатно",
    status: "open" as const
  },
  {
    id: 2,
    title: "ИТ-аналитик",
    description: "Оптимизируйте работу с данными для обработки и хранения информации",
    date: "20 апреля 2026",
    time: "16:00",
    location: "Конференц-зал",
    freeSeats: 12,
    totalSeats: 50,
    price: "500 ₽",
    status: "open" as const
  },
  {
    id: 3,
    title: "Python для начинающих",
    description: "Изучите основы программирования на Python с нуля",
    date: "25 апреля 2026",
    time: "10:00",
    location: "Компьютерный класс",
    freeSeats: 0,
    totalSeats: 20,
    price: "1500 ₽",
    status: "closed" as const
  },
  {
    id: 4,
    title: "UI/UX дизайн",
    description: "Создавайте красивые и удобные интерфейсы для приложений",
    date: "28 апреля 2026",
    time: "15:00",
    location: "Дизайн-студия",
    freeSeats: 8,
    totalSeats: 15,
    price: "Бесплатно",
    status: "open" as const
  }
]

const demoMentors = [
  {
    id: 1,
    name: "Анна Петрова",
    skills: ["React", "TypeScript", "Node.js"],
    bio: "Senior Frontend разработчик с 7-летним опытом. Помогу разобраться в современных технологиях веб-разработки.",
    company: "Яндекс",
    workExperience: "7 лет",
    pitch: "Рада помочь начинающим разработчикам освоить frontend! Подготовлю вас к собеседованиям и помогу с code review."
  },
  {
    id: 2,
    name: "Михаил Сидоров",
    skills: ["Python", "Data Science", "ML"],
    bio: "Data Scientist в крупной финтех компании. Специализируюсь на машинном обучении и анализе данных.",
    company: "Тинькофф",
    workExperience: "5 лет",
    pitch: "Помогу погрузиться в мир Data Science и машинного обучения. Расскажу про реальные кейсы и подводные камни."
  },
  {
    id: 3,
    name: "Елена Козлова",
    skills: ["Product Management", "Agile", "UX Research"],
    bio: "Product Manager с опытом запуска продуктов от идеи до масштабирования.",
    company: "VK",
    workExperience: "6 лет",
    pitch: "Расскажу как строить продукты, которые любят пользователи. Научу работать с метриками и гипотезами."
  }
]

const demoRooms = [
  { id: 1, name: "Аудитория А-301", capacity: 30 },
  { id: 2, name: "Конференц-зал", capacity: 50 },
  { id: 3, name: "Коворкинг", capacity: 20 },
  { id: 4, name: "Переговорная комната", capacity: 8 }
]

const demoBookings = [
  {
    id: 1,
    eventTitle: "Аналитик",
    roomName: "Аудитория А-301",
    seats: ["A1", "A2"],
    date: "15 апреля 2026, 14:00",
    status: "active" as const,
    qrToken: "abc123"
  },
  {
    id: 2,
    eventTitle: "UI/UX дизайн",
    roomName: "Дизайн-студия",
    seats: ["B5"],
    date: "28 апреля 2026, 15:00",
    status: "arrived" as const,
    qrToken: "xyz789",
    checkedInAt: "2026-04-28T14:55:00"
  }
]

const demoSeats = [
  { row: "A", seats: [
    { label: "A1", status: "available" as const },
    { label: "A2", status: "available" as const },
    { label: "A3", status: "booked" as const },
    { label: "A4", status: "available" as const },
    { label: "A5", status: "vip" as const },
    { label: "A6", status: "available" as const },
  ]},
  { row: "B", seats: [
    { label: "B1", status: "booked" as const },
    { label: "B2", status: "booked" as const },
    { label: "B3", status: "available" as const },
    { label: "B4", status: "available" as const },
    { label: "B5", status: "available" as const },
    { label: "B6", status: "disabled" as const },
  ]},
  { row: "C", seats: [
    { label: "C1", status: "available" as const },
    { label: "C2", status: "available" as const },
    { label: "C3", status: "available" as const },
    { label: "C4", status: "booked" as const },
    { label: "C5", status: "available" as const },
    { label: "C6", status: "available" as const },
  ]},
  { row: "D", seats: [
    { label: "D1", status: "vip" as const },
    { label: "D2", status: "vip" as const },
    { label: "D3", status: "available" as const },
    { label: "D4", status: "available" as const },
    { label: "D5", status: "booked" as const },
    { label: "D6", status: "booked" as const },
  ]},
]

const studentTabs = [
  { id: "events", label: "Мероприятия" },
  { id: "rooms", label: "Помещения" },
  { id: "mentors", label: "Менторы" },
  { id: "bookings", label: "Мои брони" },
  { id: "apply", label: "Стать ментором" }
]

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeTab, setActiveTab] = useState("events")
  const [selectedEvent, setSelectedEvent] = useState<typeof demoEvents[0] | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<typeof demoRooms[0] | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const { toasts, addToast, removeToast } = useToastState()

  useEffect(() => {
    // Демо-режим фронтенда: чтобы refresh не "выкидывал" из аккаунта
    const saved = localStorage.getItem("unihub_demo_session")
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as { isLoggedIn?: boolean }
      if (parsed?.isLoggedIn) setIsLoggedIn(true)
    } catch {}
  }, [])

  // Backend-connected UI (real data). Демо-код ниже не выполняется.
  return <RealUnihubPage />

  const handleLogin = async (username: string, password: string) => {
    // Simulate login
    await new Promise(resolve => setTimeout(resolve, 800))
    if (username && password) {
      setIsLoggedIn(true)
      localStorage.setItem("unihub_demo_session", JSON.stringify({ isLoggedIn: true }))
      addToast("Добро пожаловать!", "success")
    }
  }

  const handleRegister = async (data: { username: string; email: string; fullName: string; password: string }) => {
    await new Promise(resolve => setTimeout(resolve, 800))
    setIsLoggedIn(true)
    localStorage.setItem("unihub_demo_session", JSON.stringify({ isLoggedIn: true }))
    addToast("Регистрация успешна!", "success")
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    localStorage.removeItem("unihub_demo_session")
    setActiveTab("events")
    addToast("Вы вышли из системы", "info")
  }

  const handleEventClick = (event: typeof demoEvents[0]) => {
    setSelectedEvent(event)
    setSelectedRoom(null)
  }

  const handleRoomClick = (room: typeof demoRooms[0]) => {
    setSelectedRoom(room)
    setSelectedEvent(null)
  }

  const handleBookingConfirm = (seats: string[]) => {
    addToast(`Места ${seats.join(", ")} успешно забронированы!`, "success")
    setSelectedEvent(null)
    setSelectedRoom(null)
    setActiveTab("bookings")
  }

  const handleCancelBooking = (id: number) => {
    addToast("Бронь отменена", "info")
  }

  const filteredEvents = demoEvents.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Auth screen
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <AuthForm onLogin={handleLogin} onRegister={handleRegister} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    )
  }

  // Seat selection screen
  if (selectedEvent || selectedRoom) {
    return (
      <main className="min-h-screen">
        <Header user={demoUser} onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <SeatPicker
            roomName={selectedEvent?.location || selectedRoom?.name || ""}
            eventTitle={selectedEvent?.title}
            seats={demoSeats}
            onConfirm={handleBookingConfirm}
            onBack={() => {
              setSelectedEvent(null)
              setSelectedRoom(null)
            }}
          />
        </div>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <Header user={demoUser} onLogout={handleLogout} />
      
      {/* Navigation */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <TabNav 
            tabs={studentTabs} 
            activeTab={activeTab} 
            onChange={setActiveTab} 
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-8">
            {/* Search */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Поиск мероприятий..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-12 rounded-full bg-card border-border"
                />
              </div>
            </div>

            {/* Promo Card */}
            <PromoCard
              title={'Разгоните карьеру на программе «Мини-CEO»'}
              description="Задавайте вектор развития продуктов и решайте задачи под наставничеством топ-менеджеров"
              buttonText="Участвовать"
              onButtonClick={() => addToast("Скоро будет доступно!", "info")}
            />

            {/* Events Grid */}
            <div>
              <h2 className="text-2xl font-semibold mb-6">Ближайшие мероприятия</h2>
              {filteredEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredEvents.map(event => (
                    <EventCard
                      key={event.id}
                      {...event}
                      onClick={() => handleEventClick(event)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="Мероприятия не найдены"
                  description="Попробуйте изменить параметры поиска"
                />
              )}
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Помещения</h2>
              <p className="text-muted-foreground">Выберите комнату для свободного бронирования места</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {demoRooms.map(room => (
                <RoomCard
                  key={room.id}
                  {...room}
                  onClick={() => handleRoomClick(room)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mentors Tab */}
        {activeTab === "mentors" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Менторы</h2>
              <p className="text-muted-foreground">Получите консультацию от опытных специалистов</p>
            </div>
            <div className="space-y-4">
              {demoMentors.map(mentor => (
                <MentorCard
                  key={mentor.id}
                  {...mentor}
                  onBook={() => addToast(`Заявка ментору ${mentor.name} отправлена!`, "success")}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Мои бронирования</h2>
            {demoBookings.length > 0 ? (
              <div className="space-y-4">
                {demoBookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    {...booking}
                    onCancel={() => handleCancelBooking(booking.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Ticket}
                title="У вас пока нет бронирований"
                description="Выберите мероприятие или помещение для бронирования"
                action={
                  <Button 
                    onClick={() => setActiveTab("events")}
                    className="rounded-full bg-primary text-primary-foreground"
                  >
                    Смотреть мероприятия
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Apply as Mentor Tab */}
        {activeTab === "apply" && (
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold mb-2">Стать ментором</h2>
            <p className="text-muted-foreground mb-8">
              Заполните анкету, чтобы подать заявку на статус ментора
            </p>
            
            <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Навыки (через запятую)</label>
                <Input 
                  placeholder="React, Python, FastAPI"
                  className="h-12 rounded-xl bg-secondary border-0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">О себе</label>
                <textarea 
                  rows={4}
                  placeholder="Расскажите о своём опыте..."
                  className="w-full p-4 rounded-xl bg-secondary border-0 resize-none text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Компания (опционально)</label>
                <Input 
                  placeholder="Название компании"
                  className="h-12 rounded-xl bg-secondary border-0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">GitHub (опционально)</label>
                <Input 
                  placeholder="https://github.com/username"
                  className="h-12 rounded-xl bg-secondary border-0"
                />
              </div>
              
              <Button 
                onClick={() => addToast("Заявка отправлена администратору!", "success")}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-4"
              >
                <GraduationCap className="w-5 h-5 mr-2" />
                Отправить заявку
              </Button>
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </main>
  )
}
