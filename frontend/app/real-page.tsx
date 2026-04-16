// Real (backend-connected) UI for UniHub.
"use client"

import { useEffect, useMemo, useState } from "react"
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
import { ArrowLeft, Calendar, Users, Ticket, GraduationCap, Search, X } from "lucide-react"
import { AdminRoomCanvas, buildSeatingSchemaFromTables, type AdminRoomTable } from "@/components/admin-room-canvas"

type ApiRole = "admin" | "mentor" | "user"
type UiRole = "admin" | "mentor" | "student"

type SeatStatus = "available" | "booked" | "selected" | "vip" | "disabled" | "absent"

type UserOut = {
  id: number
  username: string
  full_name?: string | null
  avatar_url?: string | null
  role: ApiRole | string
  is_active: boolean
  phone?: string | null
  telegram_id?: string | null
  contact_email?: string | null
  contact_other?: string | null
  preferred_language?: string | null
  city?: string | null
  preferred_office?: string | null
  skills?: string[] | null
  bio?: string | null
  company?: string | null
  github?: string | null
  work_experience?: string | null
  mentor_pitch?: string | null
}

type EventOut = {
  id: number
  title: string
  description: string
  room_id: number
  room_name: string
  start_time: string
  end_time: string
  price: string
  icon: string
  event_type: string
  free_seats: number
  total_seats: number
}

type RoomOut = {
  id: number
  name: string
  capacity: number | null
  seating_schema: any
  is_active: boolean
}

type Seat = { label: string; status: SeatStatus; tableId?: number }
type SeatRow = { row: string; seats: Seat[] }

type BookingOut = {
  id: number
  event_id?: number | null
  room_id?: number | null
  event_title: string
  room_name: string
  seats: string[]
  status: string
  booked_at: string
  booking_start?: string | null
  booking_end?: string | null
  event_date: string
  qr_token?: string | null
  qr_url?: string | null
  checked_in_at?: string | null
}

type MentorOut = {
  id: number
  username: string
  full_name?: string | null
  avatar_url?: string | null
  skills: string[]
  bio?: string | null
  company?: string | null
  github?: string | null
  work_experience?: string | null
  mentor_pitch?: string | null
}

type MentorSentRequestOut = {
  id: number
  mentor_id?: number
  mentor_name?: string
  student_name: string
  student_username: string
  message: string
  requested_slot: string
  status: string
}

type MentorRequestOut = {
  id: number
  mentor_id?: number
  mentor_name?: string
  student_name: string
  student_username: string
  message: string
  requested_slot: string
  status: string
}

type ChatThreadOut = {
  thread_id: string
  chat_type: string
  chat_ref_id: number
  title: string
  avatar_url?: string | null
}

const studentTabs = [
  { id: "events", label: "Мероприятия" },
  { id: "rooms", label: "Помещения" },
  { id: "mentors", label: "Менторы" },
  { id: "forum", label: "Форум" },
  { id: "bookings", label: "Мои брони" },
  { id: "apply", label: "Стать ментором" },
]

const mentorTabs = [
  { id: "events", label: "Мероприятия" },
  { id: "rooms", label: "Помещения" },
  { id: "mentors", label: "Менторы" },
  { id: "forum", label: "Форум" },
  { id: "bookings", label: "Мои брони" },
  { id: "mentor-profile", label: "Моя анкета" },
  { id: "mentor-requests", label: "Заявки ко мне" },
  { id: "mentor-event-proposals", label: "Организация мероприятий" },
]

const skillOptions = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Go",
  "Java",
  "C#",
  "SQL",
  "PostgreSQL",
  "React",
  "Next.js",
  "Docker",
  "Kubernetes",
  "ML",
  "Data Science",
  "System Design",
]

const adminTabs = [
  { id: "admin-dashboard", label: "Админ: панель" },
  { id: "admin-rooms", label: "Админ: помещения" },
  { id: "admin-events", label: "Админ: мероприятия" },
  { id: "admin-event-proposals", label: "Админ: заявки ивентов" },
  { id: "forum", label: "Форум" },
]

function computeRoomCapacity(seating_schema: any): number {
  const schema = seating_schema || {}
  if (Array.isArray(schema.tables) && schema.tables.length > 0) {
    return schema.tables.reduce((sum: number, t: any) => sum + Math.max(0, Number(t?.seats) || 0), 0)
  }
  const rows: string[] = Array.isArray(schema.rows) && schema.rows.length ? schema.rows : ["A", "B", "C", "D", "E"]
  const cols: number = typeof schema.columns === "number" && schema.columns > 0 ? schema.columns : 8
  const disabled = new Set(Array.isArray(schema.disabled) ? schema.disabled : [])
  const presentArr: string[] | null = Array.isArray(schema.present) ? schema.present : null
  const present = presentArr
    ? new Set(presentArr)
    : new Set(Array.from(rows).flatMap((r) => Array.from({ length: cols }, (_, i) => `${r}${i + 1}`)))

  let count = 0
  for (const s of present) if (!disabled.has(s)) count++
  return count
}

function mapApiSeatStatus(status: string): SeatStatus {
  switch (status) {
    case "free":
      return "available"
    case "booked":
      return "booked"
    case "vip":
      return "vip"
    case "disabled":
      return "disabled"
    case "absent":
      return "absent"
    default:
      return "available"
  }
}

export function RealUnihubPage() {
  const { toasts, addToast, removeToast } = useToastState()

  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserOut | null>(null)
  const [activeTab, setActiveTab] = useState("events")

  const [events, setEvents] = useState<EventOut[]>([])
  const [rooms, setRooms] = useState<RoomOut[]>([])
  const [mentors, setMentors] = useState<MentorOut[]>([])
  const [bookings, setBookings] = useState<BookingOut[]>([])
  const [bookedMentorIds, setBookedMentorIds] = useState<Set<number>>(new Set())
  const [mentorRequests, setMentorRequests] = useState<MentorRequestOut[]>([])
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    avatar_url: "",
    phone: "",
    contact_email: "",
    telegram_id: "",
    contact_other: "",
  })

  const [settingsForm, setSettingsForm] = useState({
    preferred_language: "ru",
    city: "",
    preferred_office: "",
  })

  const [mentorProfileForm, setMentorProfileForm] = useState({
    full_name: "",
    bio: "",
    work_experience: "",
    mentor_pitch: "",
    company: "",
    github: "",
    avatar_url: "",
    skills: [] as string[],
    accepting_mentor_requests: true,
  })

  const [applyForm, setApplyForm] = useState({
    bio: "",
    company: "",
    github: "",
    work_experience: "",
    mentor_pitch: "",
    skills: [] as string[],
  })
  const [mentorEventForm, setMentorEventForm] = useState({
    title: "",
    description: "",
    room_id: null as number | null,
    start_time_local: "",
    end_time_local: "",
    price: "Бесплатно",
    icon: "🎉",
    event_type: "lecture",
  })
  const [mentorEventProposals, setMentorEventProposals] = useState<any[]>([])
  const [adminEventProposals, setAdminEventProposals] = useState<any[]>([])

  const [forumTopics, setForumTopics] = useState<any[]>([])
  const [forumTagFilter, setForumTagFilter] = useState("")
  const [forumSearch, setForumSearch] = useState("")
  const [selectedTopic, setSelectedTopic] = useState<any | null>(null)
  const [topicMessages, setTopicMessages] = useState<any[]>([])
  const [forumTopicForm, setForumTopicForm] = useState({ title: "", body: "", image_url: "", tags: [] as string[] })
  const [forumMessageForm, setForumMessageForm] = useState({ body: "", image_url: "" })
  const [forumView, setForumView] = useState<"list" | "create" | "topic">("list")
  const [openedImageUrl, setOpenedImageUrl] = useState<string | null>(null)

  const [supportOpen, setSupportOpen] = useState(false)
  const [supportThreads, setSupportThreads] = useState<ChatThreadOut[]>([])
  const [selectedSupportThread, setSelectedSupportThread] = useState<string>("")
  const [supportMessages, setSupportMessages] = useState<any[]>([])
  const [supportForm, setSupportForm] = useState({ body: "", image_url: "" })
  const [supportView, setSupportView] = useState<"threads" | "chat">("threads")

  const [selectedEvent, setSelectedEvent] = useState<EventOut | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<RoomOut | null>(null)
  const [seatRows, setSeatRows] = useState<SeatRow[]>([])
  const [isLoadingSeats, setIsLoadingSeats] = useState(false)
  const [roomBookingStart, setRoomBookingStart] = useState("")
  const [roomBookingHours, setRoomBookingHours] = useState(1)
  const [pendingRoomSeats, setPendingRoomSeats] = useState<string[]>([])
  const [pendingSeatSchedule, setPendingSeatSchedule] = useState<{ working_hours?: { start: string; end: string }; seats: Array<{ seat: string; booked_intervals: string[]; free_hint: string }> } | null>(null)

  const uiRole: UiRole | null = useMemo(() => {
    if (!user) return null
    const r = String(user.role)
    if (r === "admin") return "admin"
    if (r === "mentor") return "mentor"
    return "student"
  }, [user])

  const isAdmin = uiRole === "admin"
  const isMentor = uiRole === "mentor"

  useEffect(() => {
    if (!user) return
    setProfileForm({
      full_name: user.full_name || "",
      avatar_url: user.avatar_url || "",
      phone: (user as any).phone || "",
      contact_email: (user as any).contact_email || user.email || "",
      telegram_id: (user as any).telegram_id || "",
      contact_other: (user as any).contact_other || "",
    })
    setSettingsForm({
      preferred_language: (user as any).preferred_language || "ru",
      city: (user as any).city || "",
      preferred_office: (user as any).preferred_office || "",
    })
    setMentorProfileForm({
      full_name: user.full_name || "",
      bio: (user as any).bio || "",
      work_experience: (user as any).work_experience || "",
      mentor_pitch: (user as any).mentor_pitch || "",
      company: (user as any).company || "",
      github: (user as any).github || "",
      avatar_url: user.avatar_url || "",
      skills: Array.isArray((user as any).skills) ? (user as any).skills : [],
      accepting_mentor_requests: (user as any).accepting_mentor_requests ?? true,
    })
  }, [user])

  // Admin CRUD state
  const [adminDashboard, setAdminDashboard] = useState<any>(null)
  const [adminRooms, setAdminRooms] = useState<RoomOut[]>([])
  const [adminEvents, setAdminEvents] = useState<EventOut[]>([])

  const [roomForm, setRoomForm] = useState<{
    id: number | null
    name: string
    capacity: number
    is_active: boolean
    working_hours_start: string
    working_hours_end: string
    seating_schema_text: string
  }>({
    id: null,
    name: "",
    capacity: 0,
    is_active: true,
    working_hours_start: "08:00",
    working_hours_end: "22:00",
    seating_schema_text: JSON.stringify(
      { rows: ["A", "B", "C", "D", "E"], columns: 8, vip: [], disabled: [], present: null },
      null,
      2
    ),
  })

  const [roomTables, setRoomTables] = useState<AdminRoomTable[]>([])

  const [eventForm, setEventForm] = useState<{
    id: number | null
    title: string
    description: string
    room_id: number | null
    start_time_local: string
    end_time_local: string
    price: string
    icon: string
    event_type: string
  }>({
    id: null,
    title: "",
    description: "",
    room_id: null,
    start_time_local: "",
    end_time_local: "",
    price: "Бесплатно",
    icon: "🎉",
    event_type: "lecture",
  })

  useEffect(() => {
    if (!uiRole) return
    if (uiRole === "admin") setActiveTab("admin-dashboard")
    else setActiveTab("events")
  }, [uiRole])

  useEffect(() => {
    if (!isAdmin) return
    if (!token) return

    const loadAdmin = async () => {
      try {
        const [dash, roomsRes, eventsRes] = await Promise.all([
          apiFetch(`/api/admin/dashboard`),
          apiFetch(`/api/admin/rooms`),
          apiFetch(`/api/events`),
        ])
        setAdminDashboard(dash)
        setAdminRooms(roomsRes)
        setAdminEvents(eventsRes)
      } catch (e: any) {
        console.error(e)
        addToast("Ошибка загрузки админ-данных", "error")
      }
    }

    loadAdmin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token])

  const apiFetch = async (path: string, options: RequestInit = {}, tokenOverride?: string) => {
    const authToken = tokenOverride ?? token
    if (!authToken) throw new Error("Not authorized")
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    }
    if (options.body && !(headers as any)["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json"
    }
    const resp = await fetch(path, { ...options, headers })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.detail || `HTTP ${resp.status}`)
    }
    return resp.json()
  }

  const loadMe = async (t: string) => {
    setToken(t)
    const me = await apiFetch(`/api/auth/me`, {}, t)
    setUser(me as UserOut)
    return me as UserOut
  }

  const loadEvents = async (tkn?: string) => {
    const data = await apiFetch(`/api/events`, {}, tkn)
    setEvents(data)
  }

  const loadRooms = async (tkn?: string) => {
    const data = await apiFetch(`/api/rooms`, {}, tkn)
    setRooms(
      data.map((r: RoomOut) => ({
        ...r,
        capacity: r.capacity ?? computeRoomCapacity(r.seating_schema),
      }))
    )
  }

  const loadMentors = async (tkn?: string) => {
    const list = await apiFetch(`/api/mentors/list`, {}, tkn)
    setMentors(list)

    try {
      const sent = await apiFetch(`/api/mentors/requests/sent`, {}, tkn)
      const ids = new Set<number>((sent || []).filter((r: MentorSentRequestOut) => r.status === "accepted").map((r: MentorSentRequestOut) => r.mentor_id || -1))
      setBookedMentorIds(ids)
    } catch {
      setBookedMentorIds(new Set())
    }
  }

  const loadBookings = async (tkn?: string) => {
    const data = await apiFetch(`/api/bookings/my`, {}, tkn)
    setBookings(data)
  }

  const loadMentorRequests = async (tkn?: string) => {
    try {
      const data = await apiFetch(`/api/mentors/requests/my`, {}, tkn)
      setMentorRequests(data || [])
    } catch {
      setMentorRequests([])
    }
  }

  const loadMentorEventProposals = async (tkn?: string) => {
    try {
      const data = await apiFetch(`/api/mentors/event-proposals/my`, {}, tkn)
      setMentorEventProposals(data || [])
    } catch {
      setMentorEventProposals([])
    }
  }

  const loadAdminEventProposals = async (tkn?: string) => {
    try {
      const data = await apiFetch(`/api/admin/event-proposals`, {}, tkn)
      setAdminEventProposals(data || [])
    } catch {
      setAdminEventProposals([])
    }
  }

  const loadForumTopics = async (tkn?: string) => {
    const qs = new URLSearchParams()
    if (forumTagFilter) qs.set("tag", forumTagFilter)
    if (forumSearch) qs.set("q", forumSearch)
    const data = await apiFetch(`/api/forum/topics${qs.toString() ? `?${qs.toString()}` : ""}`, {}, tkn)
    setForumTopics(data || [])
  }

  const loadForumTopicDetails = async (topicId: number, tkn?: string) => {
    const data = await apiFetch(`/api/forum/topics/${topicId}`, {}, tkn)
    setSelectedTopic(data.topic)
    setTopicMessages(data.messages || [])
    setForumView("topic")
  }

  const loadSupportThreads = async (tkn?: string) => {
    const data = (await apiFetch(`/api/chat/threads`, {}, tkn)) as ChatThreadOut[]
    setSupportThreads(data || [])
    if (!data?.length) {
      setSelectedSupportThread("")
      setSupportMessages([])
      return
    }
    const exists = data.some((t) => t.thread_id === selectedSupportThread)
    if (!selectedSupportThread || !exists) {
      setSelectedSupportThread(data[0].thread_id)
    }
  }

  const loadSupportMessages = async (threadId?: string, tkn?: string) => {
    const tid = threadId || selectedSupportThread
    if (!tid) {
      setSupportMessages([])
      return
    }
    try {
      const data = await apiFetch(`/api/chat/messages/${encodeURIComponent(tid)}`, {}, tkn)
      setSupportMessages(data || [])
    } catch (e: any) {
      if (String(e?.message || "").includes("403") || String(e?.message || "").toLowerCase().includes("no access")) {
        const available = supportThreads.find((t) => t.thread_id !== tid) || supportThreads[0]
        if (available) {
          setSelectedSupportThread(available.thread_id)
          const retry = await apiFetch(`/api/chat/messages/${encodeURIComponent(available.thread_id)}`, {}, tkn)
          setSupportMessages(retry || [])
          return
        }
      }
      throw e
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("token")
    if (!saved) return
    loadMe(saved)
      .then((me) => Promise.all([
        loadEvents(saved),
        loadRooms(saved),
        loadMentors(saved),
        loadBookings(saved),
        String((me as any)?.role) === "mentor" ? loadMentorRequests(saved) : Promise.resolve(),
        String((me as any)?.role) === "mentor" ? loadMentorEventProposals(saved) : Promise.resolve(),
        String((me as any)?.role) === "admin" ? loadAdminEventProposals(saved) : Promise.resolve(),
        loadForumTopics(saved),
        loadSupportThreads(saved),
      ]))
      .catch((e) => {
        console.error(e)
        addToast("Ошибка авторизации, войдите снова", "error")
        localStorage.removeItem("token")
        setToken(null)
        setUser(null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSeatsForSelection = async (ev: EventOut | null, room: RoomOut | null) => {
    if (!ev && !room) return
    const roomId = (ev ? ev.room_id : room!.id) as number
    const eventId = ev ? ev.id : undefined

    setIsLoadingSeats(true)
    try {
      const path = eventId
        ? `/api/rooms/${roomId}/seats?event_id=${eventId}`
        : `/api/rooms/${roomId}/seats?${new URLSearchParams({
            ...(roomBookingStart ? { start_time: new Date(roomBookingStart).toISOString() } : {}),
            duration_hours: String(roomBookingHours),
          }).toString()}`
      const data = await apiFetch(path, {}, token || undefined)
      const rows: SeatRow[] = (data.seats || []).map((r: any) => ({
        row: r.row,
        seats: (r.seats || []).map((s: any) => ({
          label: s.label,
          status: mapApiSeatStatus(String(s.status)),
          tableId: s.table_id ?? undefined,
        })),
      }))
      setSeatRows(rows)
    } finally {
      setIsLoadingSeats(false)
    }
  }

  const loadSeatSchedule = async (roomId: number, seats: string[]) => {
    if (!seats.length) {
      setPendingSeatSchedule(null)
      return
    }
    const params = new URLSearchParams({
      seats: seats.join(","),
      date: roomBookingStart ? new Date(roomBookingStart).toISOString() : new Date().toISOString(),
    })
    const data = await apiFetch(`/api/rooms/${roomId}/seat-schedule?${params.toString()}`)
    setPendingSeatSchedule(data)
  }

  useEffect(() => {
    if (!selectedEvent && !selectedRoom) return
    loadSeatsForSelection(selectedEvent, selectedRoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, selectedRoom, roomBookingStart, roomBookingHours])

  useEffect(() => {
    if (!token) return
    loadForumTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forumTagFilter, forumSearch, token])

  useEffect(() => {
    if (!supportOpen) return
    loadSupportMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportOpen, selectedSupportThread])

  useEffect(() => {
    if (!selectedRoom || !pendingRoomSeats.length) return
    loadSeatSchedule(selectedRoom.id, pendingRoomSeats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomBookingStart, selectedRoom?.id, pendingRoomSeats.join(",")])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedImageUrl(null)
    }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [])

  const handleLogin = async (username: string, password: string) => {
    const formData = new URLSearchParams()
    formData.append("username", username)
    formData.append("password", password)

    const resp = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.detail || `HTTP ${resp.status}`)
    }
    const data = await resp.json()
    localStorage.setItem("token", data.access_token)
    addToast("Вход выполнен", "success")
    const me = await loadMe(data.access_token)
    const meRole = String(me?.role || "user")
    setActiveTab(meRole === "admin" ? "admin-dashboard" : "events")
    await Promise.all([
      loadEvents(data.access_token),
      loadRooms(data.access_token),
      loadMentors(data.access_token),
      loadBookings(data.access_token),
      meRole === "mentor" ? loadMentorRequests(data.access_token) : Promise.resolve(),
      meRole === "mentor" ? loadMentorEventProposals(data.access_token) : Promise.resolve(),
      meRole === "admin" ? loadAdminEventProposals(data.access_token) : Promise.resolve(),
      loadForumTopics(data.access_token),
      loadSupportThreads(data.access_token),
    ])
  }

  const handleRegister = async (data: { username: string; email: string; fullName: string; password: string }) => {
    const resp = await fetch(`/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        full_name: data.fullName,
        password: data.password,
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.detail || `HTTP ${resp.status}`)
    }
    addToast("Регистрация успешна. Войдите.", "success")
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
    setActiveTab("events")
    setSelectedEvent(null)
    setSelectedRoom(null)
    setSeatRows([])
    setBookings([])
    setEvents([])
    setRooms([])
    setMentors([])
    setMentorRequests([])
    addToast("Вы вышли", "info")
  }

  const handleEventClick = async (event: EventOut) => {
    setSelectedRoom(null)
    setSelectedEvent(event)
    setActiveTab("events")
  }

  const handleRoomClick = async (room: RoomOut) => {
    setSelectedEvent(null)
    setSelectedRoom(room)
    setRoomBookingStart(getNextHourLocalValue())
    setRoomBookingHours(1)
    setPendingRoomSeats([])
    setPendingSeatSchedule(null)
    setActiveTab("rooms")
  }

  const handleBookingConfirm = async (seats: string[]) => {
    if (!selectedEvent && !selectedRoom) return

    if (selectedRoom && !selectedEvent) {
      setPendingRoomSeats(seats)
      await loadSeatSchedule(selectedRoom.id, seats)
      return
    }

    const payload = selectedEvent
      ? { event_id: selectedEvent.id, seats }
      : {
          room_id: selectedRoom!.id,
          seats,
          start_time: new Date(roomBookingStart).toISOString(),
          duration_hours: roomBookingHours,
        }

    if (!selectedEvent && !roomBookingStart) {
      addToast("Выберите дату и время начала", "error")
      return
    }
    if (!selectedEvent) {
      const selectedStart = new Date(roomBookingStart)
      if (selectedStart.getTime() < Date.now()) {
        addToast("Нельзя бронировать время в прошлом", "error")
        setRoomBookingStart(getNextHourLocalValue())
        return
      }
    }

    await apiFetch(`/api/bookings`, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    addToast("Бронь успешно создана", "success")
    setSelectedEvent(null)
    setSelectedRoom(null)
    setPendingRoomSeats([])
    setPendingSeatSchedule(null)
    setActiveTab("bookings")
    await loadBookings()
  }

  const finalizeRoomBooking = async () => {
    if (!selectedRoom || !pendingRoomSeats.length) return
    if (!roomBookingStart) {
      addToast("Выберите дату и время начала", "error")
      return
    }
    const selectedStart = new Date(roomBookingStart)
    if (selectedStart.getTime() < Date.now()) {
      addToast("Нельзя бронировать время в прошлом", "error")
      setRoomBookingStart(getNextHourLocalValue())
      return
    }
    await apiFetch(`/api/bookings`, {
      method: "POST",
      body: JSON.stringify({
        room_id: selectedRoom.id,
        seats: pendingRoomSeats,
        start_time: selectedStart.toISOString(),
        duration_hours: roomBookingHours,
      }),
    })
    addToast("Бронь успешно создана", "success")
    setSelectedRoom(null)
    setPendingRoomSeats([])
    setPendingSeatSchedule(null)
    setActiveTab("bookings")
    await loadBookings()
  }

  const handleCancelBooking = async (id: number) => {
    await apiFetch(`/api/bookings/${id}`, { method: "DELETE" })
    addToast("Бронь отменена", "info")
    await loadBookings()
  }

  const handleTabChange = (tabId: string) => {
    if (selectedEvent || selectedRoom) {
      setSelectedEvent(null)
      setSelectedRoom(null)
      setSeatRows([])
      setPendingRoomSeats([])
      setPendingSeatSchedule(null)
    }
    if (tabId === "forum") setForumView("list")
    setActiveTab(tabId)
  }

  const toggleSkill = (current: string[], skill: string) => {
    return current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]
  }

  const saveProfile = async () => {
    const updated = await apiFetch(`/api/auth/profile`, {
      method: "PUT",
      body: JSON.stringify(profileForm),
    })
    setUser(updated)
    setProfileModalOpen(false)
    addToast("Профиль обновлен", "success")
  }

  const saveSettings = async () => {
    const updated = await apiFetch(`/api/auth/profile`, {
      method: "PUT",
      body: JSON.stringify(settingsForm),
    })
    setUser(updated)
    setSettingsModalOpen(false)
    addToast("Настройки сохранены", "success")
  }

  const saveMentorProfile = async () => {
    const updated = await apiFetch(`/api/mentors/profile`, {
      method: "PUT",
      body: JSON.stringify(mentorProfileForm),
    })
    setUser((prev) => (prev ? { ...prev, ...(updated as any) } : prev))
    addToast("Анкета ментора обновлена", "success")
  }

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("file read error"))
      reader.readAsDataURL(file)
    })

  const formatLocalDateTimeInput = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const hh = String(date.getHours()).padStart(2, "0")
    const mm = String(date.getMinutes()).padStart(2, "0")
    return `${y}-${m}-${d}T${hh}:${mm}`
  }

  const getNextHourLocalValue = () => {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return formatLocalDateTimeInput(d)
  }

  const renderForumSection = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Форум</h2>
        {forumView === "list" ? (
          <Button className="rounded-full" onClick={() => setForumView("create")}>Добавить тему +</Button>
        ) : (
          <Button variant="outline" className="rounded-full" onClick={() => setForumView("list")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Вернуться в меню форума
          </Button>
        )}
      </div>

      {forumView === "list" && (
        <div className="max-w-3xl mx-auto space-y-3">
          <Input value={forumSearch} onChange={(e) => setForumSearch(e.target.value)} placeholder="Поиск по темам" className="h-11 rounded-xl bg-secondary border-0" />
          <select value={forumTagFilter} onChange={(e) => setForumTagFilter(e.target.value)} className="w-full h-11 rounded-xl bg-secondary border-0 px-3 text-sm">
            <option value="">Все теги</option>
            {skillOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="space-y-2">
            {forumTopics.map((t) => (
              <button key={t.id} className="w-full text-left bg-card border border-border rounded-xl p-3 hover:bg-secondary/50" onClick={() => loadForumTopicDetails(t.id)}>
                <div className="font-semibold">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.author_name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {forumView === "create" && (
        <div className="max-w-3xl mx-auto bg-card rounded-2xl border border-border p-4 space-y-2">
          <div className="font-semibold">Новая тема</div>
          <Input value={forumTopicForm.title} onChange={(e) => setForumTopicForm((p) => ({ ...p, title: e.target.value }))} className="h-10 rounded-xl bg-secondary border-0" placeholder="Заголовок" />
          <textarea value={forumTopicForm.body} onChange={(e) => setForumTopicForm((p) => ({ ...p, body: e.target.value }))} rows={4} className="w-full rounded-xl bg-secondary border-0 p-3 text-sm" placeholder="Текст вопроса" />
          <div className="flex items-center gap-2">
            <label className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center cursor-pointer">+
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const dataUrl = await fileToDataUrl(file)
                setForumTopicForm((p) => ({ ...p, image_url: dataUrl }))
              }} />
            </label>
            {forumTopicForm.image_url && <img src={forumTopicForm.image_url} alt="preview" className="h-9 w-9 rounded object-cover cursor-zoom-in" onClick={() => setOpenedImageUrl(forumTopicForm.image_url)} />}
          </div>
          <div className="flex flex-wrap gap-2">
            {skillOptions.map((s) => {
              const selected = forumTopicForm.tags.includes(s)
              return <button key={s} type="button" onClick={() => setForumTopicForm((p) => ({ ...p, tags: toggleSkill(p.tags, s) }))} className={`px-2.5 py-1 rounded-full text-xs border ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>{s}</button>
            })}
          </div>
          <Button className="rounded-full" onClick={async () => {
            await apiFetch(`/api/forum/topics`, { method: "POST", body: JSON.stringify(forumTopicForm) })
            setForumTopicForm({ title: "", body: "", image_url: "", tags: [] })
            await loadForumTopics()
            setForumView("list")
          }}>Создать тему</Button>
        </div>
      )}

      {forumView === "topic" && selectedTopic && (
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="font-semibold text-lg">{selectedTopic.title}</div>
            <div className="text-sm text-muted-foreground mt-2">{selectedTopic.body}</div>
            <div className="text-xs text-muted-foreground mt-2">{selectedTopic.tags?.join(", ")}</div>
            {selectedTopic.image_url && <img src={selectedTopic.image_url} alt="topic" className="mt-2 rounded-xl max-h-60 object-contain cursor-zoom-in" onClick={() => setOpenedImageUrl(selectedTopic.image_url)} />}
            {isAdmin && <div className="mt-3"><Button variant="outline" className="rounded-full" onClick={async () => { await apiFetch(`/api/admin/forum/topics/${selectedTopic.id}`, { method: "DELETE" }); setSelectedTopic(null); setTopicMessages([]); setForumView("list"); await loadForumTopics(); }}>Удалить тему</Button></div>}
          </div>
          <div className="space-y-2">
            {topicMessages.map((m) => (
              <div key={m.id} className="bg-card border border-border rounded-xl p-3 flex gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-[10px]">
                  {m.author_avatar ? <img src={m.author_avatar} alt={m.author_name} className="w-full h-full object-cover" /> : (m.author_name || "?").slice(0,1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.author_name} ({m.author_role})</div>
                  <div className="text-sm mt-1">{m.body}</div>
                  {m.image_url && <img src={m.image_url} alt="msg" className="mt-2 rounded-xl max-h-48 object-contain cursor-zoom-in" onClick={() => setOpenedImageUrl(m.image_url)} />}
                </div>
                {isAdmin && <Button variant="outline" className="rounded-full mt-2" onClick={async () => { await apiFetch(`/api/admin/forum/messages/${m.id}`, { method: "DELETE" }); await loadForumTopicDetails(selectedTopic.id); }}>Удалить сообщение</Button>}
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <textarea value={forumMessageForm.body} onChange={(e) => setForumMessageForm((p) => ({ ...p, body: e.target.value }))} rows={3} className="w-full rounded-xl bg-secondary border-0 p-3 text-sm" placeholder="Ответить..." />
            <div className="flex items-center gap-2">
              <label className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center cursor-pointer">+
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const dataUrl = await fileToDataUrl(file)
                  setForumMessageForm((p) => ({ ...p, image_url: dataUrl }))
                }} />
              </label>
              {forumMessageForm.image_url && <img src={forumMessageForm.image_url} alt="preview" className="h-9 w-9 rounded object-cover cursor-zoom-in" onClick={() => setOpenedImageUrl(forumMessageForm.image_url)} />}
            </div>
            <Button className="rounded-full" onClick={async () => { await apiFetch(`/api/forum/topics/${selectedTopic.id}/messages`, { method: "POST", body: JSON.stringify({ body: forumMessageForm.body, image_url: forumMessageForm.image_url || null }) }); setForumMessageForm({ body: "", image_url: "" }); await loadForumTopicDetails(selectedTopic.id); }}>Отправить</Button>
          </div>
        </div>
      )}
    </div>
  )

  if (!user || !uiRole) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <AuthForm onLogin={handleLogin} onRegister={handleRegister} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden [zoom:0.92]">
      <Header
        user={{ name: user.full_name || user.username, role: uiRole, avatar: user.avatar_url || undefined }}
        onLogout={handleLogout}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <TabNav tabs={isAdmin ? adminTabs : (isMentor ? mentorTabs : studentTabs)} activeTab={activeTab} onChange={handleTabChange} />
        </div>
      </div>

      {isAdmin ? (
        <div className="max-w-7xl mx-auto px-4 py-8">
          {activeTab === "admin-dashboard" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Админ-панель</h2>
              {!adminDashboard ? (
                <p className="text-muted-foreground">Загрузка...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-card rounded-3xl border border-border p-6">
                    <div className="text-sm text-muted-foreground">Пользователи</div>
                    <div className="text-2xl font-semibold mt-2">{adminDashboard.total_users}</div>
                  </div>
                  <div className="bg-card rounded-3xl border border-border p-6">
                    <div className="text-sm text-muted-foreground">Менторы</div>
                    <div className="text-2xl font-semibold mt-2">{adminDashboard.total_mentors}</div>
                  </div>
                  <div className="bg-card rounded-3xl border border-border p-6">
                    <div className="text-sm text-muted-foreground">События</div>
                    <div className="text-2xl font-semibold mt-2">{adminDashboard.total_events}</div>
                  </div>
                  <div className="bg-card rounded-3xl border border-border p-6">
                    <div className="text-sm text-muted-foreground">Бронирования</div>
                    <div className="text-2xl font-semibold mt-2">{adminDashboard.total_bookings}</div>
                  </div>
                </div>
              )}
              {adminDashboard && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card rounded-3xl border border-border p-6">
                    <div className="text-sm text-muted-foreground">Занято мест сейчас</div>
                    <div className="text-2xl font-semibold mt-2">
                      {adminDashboard.occupied_now ?? 0} / {adminDashboard.capacity_now ?? 0}
                    </div>
                  </div>
                  <div className="bg-card rounded-3xl border border-border p-6">
                    <div className="text-sm text-muted-foreground">Самая бронируемая комната</div>
                    <div className="text-xl font-semibold mt-2">
                      {adminDashboard.most_booked_room?.room || "Нет данных"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Бронирований: {adminDashboard.most_booked_room?.bookings || 0}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "admin-rooms" && (
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">Помещения</h2>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setRoomForm({
                      id: null,
                      name: "",
                      capacity: 0,
                      is_active: true,
                      working_hours_start: "08:00",
                      working_hours_end: "22:00",
                      seating_schema_text: JSON.stringify(
                        { rows: ["A", "B", "C", "D", "E"], columns: 8, vip: [], disabled: [], present: null },
                        null,
                        2
                      ),
                    })
                    setRoomTables([])
                  }}
                >
                  Новый
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Название</div>
                    <Input
                      value={roomForm.name}
                      onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))}
                      className="h-12 rounded-xl bg-secondary border-0"
                      placeholder="Например, А-301"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={roomForm.is_active}
                      onChange={(e) => setRoomForm((p) => ({ ...p, is_active: e.target.checked }))}
                      className="accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">Активна</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Открытие</div>
                      <input
                        type="time"
                        value={roomForm.working_hours_start}
                        onChange={(e) => setRoomForm((p) => ({ ...p, working_hours_start: e.target.value }))}
                        className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm"
                      />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Закрытие</div>
                      <input
                        type="time"
                        value={roomForm.working_hours_end}
                        onChange={(e) => setRoomForm((p) => ({ ...p, working_hours_end: e.target.value }))}
                        className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm"
                      />
                    </div>
                  </div>

                  <AdminRoomCanvas tables={roomTables} onChangeTables={setRoomTables} />

                  <Button
                    onClick={async () => {
                      try {
                        if (!roomTables.length) {
                          addToast("Добавьте хотя бы один стол на полотне", "error")
                          return
                        }
                        const { seating_schema, capacity } = buildSeatingSchemaFromTables(roomTables)
                        const seatingWithWorkingHours = {
                          ...seating_schema,
                          working_hours: {
                            start: roomForm.working_hours_start || "08:00",
                            end: roomForm.working_hours_end || "22:00",
                          },
                        }
                        const payload = {
                          name: roomForm.name,
                          capacity,
                          seating_schema: seatingWithWorkingHours,
                          is_active: roomForm.is_active,
                        }

                        if (!roomForm.name.trim()) {
                          addToast("Введите название комнаты", "error")
                          return
                        }
                        if (roomForm.id) {
                          await apiFetch(`/api/admin/rooms/${roomForm.id}`, {
                            method: "PUT",
                            body: JSON.stringify(payload),
                          })
                          addToast("Комната обновлена", "success")
                        } else {
                          await apiFetch(`/api/admin/rooms`, {
                            method: "POST",
                            body: JSON.stringify(payload),
                          })
                          addToast("Комната создана", "success")
                        }

                        const roomsRes = await apiFetch(`/api/admin/rooms`)
                        setAdminRooms(roomsRes)
                      } catch (e: any) {
                        console.error(e)
                        addToast("Ошибка JSON seating_schema (или параметры)", "error")
                      }
                    }}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-2"
                  >
                    {roomForm.id ? "Сохранить изменения" : "Создать комнату"}
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Существующие комнаты</h3>
                  {adminRooms.length ? (
                    <div className="space-y-3">
                      {adminRooms.map((r) => (
                        <div key={r.id} className="bg-card rounded-3xl border border-border p-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold">{r.name}</div>
                            <div className="text-sm text-muted-foreground">ID: {r.id}</div>
                            <div className="text-sm text-muted-foreground">
                              Статус: {r.is_active ? "активна" : "неактивна"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              className="rounded-full"
                              onClick={() => {
                                const seating = r.seating_schema ?? {}
                                const parsedTables = Array.isArray(seating.tables) ? seating.tables : null
                                if (parsedTables) {
                                  setRoomTables(
                                    parsedTables.map((t: any, idx: number) => ({
                                      id: idx + 1,
                                      x: Number(t?.x ?? 0),
                                      y: Number(t?.y ?? 0),
                                      seats: Math.max(1, Number(t?.seats ?? 1)),
                                    }))
                                  )
                                } else {
                                  const present = Array.isArray(seating.present) ? seating.present : []
                                  const disabled = Array.isArray(seating.disabled) ? seating.disabled : []
                                  const disabledSet = new Set(disabled)
                                  const seatsCount = present.filter((p: any) => !disabledSet.has(String(p))).length
                                  setRoomTables([{ id: 1, x: 0, y: 0, seats: Math.max(1, seatsCount) }])
                                }
                                setRoomForm({
                                  id: r.id,
                                  name: r.name,
                                  capacity: r.capacity ?? computeRoomCapacity(r.seating_schema),
                                  is_active: !!r.is_active,
                                  working_hours_start: r.seating_schema?.working_hours?.start || "08:00",
                                  working_hours_end: r.seating_schema?.working_hours?.end || "22:00",
                                  seating_schema_text: JSON.stringify(r.seating_schema ?? {}, null, 2),
                                })
                              }}
                            >
                              Правка
                            </Button>
                            <Button
                              variant="outline"
                              className="rounded-full"
                              onClick={async () => {
                                if (!window.confirm(`Удалить комнату "${r.name}"?`)) return
                                await apiFetch(`/api/admin/rooms/${r.id}`, { method: "DELETE" })
                                addToast("Комната удалена", "info")
                                setAdminRooms(await apiFetch(`/api/admin/rooms`))
                              }}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Комнат нет</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "admin-events" && (
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">Мероприятия</h2>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setEventForm({
                      id: null,
                      title: "",
                      description: "",
                      room_id: adminRooms[0]?.id ?? null,
                      start_time_local: "",
                      end_time_local: "",
                      price: "Бесплатно",
                      icon: "🎉",
                      event_type: "lecture",
                    })
                  }}
                >
                  Новый
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Название</div>
                    <Input
                      value={eventForm.title}
                      onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                      className="h-12 rounded-xl bg-secondary border-0"
                      placeholder="Например, Семинар по аналитике"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Описание</div>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
                      rows={4}
                      className="w-full rounded-xl bg-secondary border-0 p-4 text-sm"
                      placeholder="Коротко о событии"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Комната</div>
                    <select
                      value={eventForm.room_id ?? ""}
                      onChange={(e) => setEventForm((p) => ({ ...p, room_id: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm"
                    >
                      {adminRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Начало</div>
                      <input
                        type="datetime-local"
                        value={eventForm.start_time_local}
                        onChange={(e) => setEventForm((p) => ({ ...p, start_time_local: e.target.value }))}
                        className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm"
                      />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Конец</div>
                      <input
                        type="datetime-local"
                        value={eventForm.end_time_local}
                        onChange={(e) => setEventForm((p) => ({ ...p, end_time_local: e.target.value }))}
                        className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Цена</div>
                    <Input
                      value={eventForm.price}
                      onChange={(e) => setEventForm((p) => ({ ...p, price: e.target.value }))}
                      className="h-12 rounded-xl bg-secondary border-0"
                      placeholder="Бесплатно / 1000"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Иконка</div>
                    <Input
                      value={eventForm.icon}
                      onChange={(e) => setEventForm((p) => ({ ...p, icon: e.target.value }))}
                      className="h-12 rounded-xl bg-secondary border-0"
                      placeholder="🎉"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Тип</div>
                    <Input
                      value={eventForm.event_type}
                      onChange={(e) => setEventForm((p) => ({ ...p, event_type: e.target.value }))}
                      className="h-12 rounded-xl bg-secondary border-0"
                      placeholder="hackathon / lecture / workshop / meetup"
                    />
                  </div>

                  <Button
                    onClick={async () => {
                      try {
                        if (!eventForm.room_id) {
                          addToast("Выберите комнату", "error")
                          return
                        }
                        if (!eventForm.title.trim()) {
                          addToast("Введите название мероприятия", "error")
                          return
                        }
                        if (!eventForm.start_time_local || !eventForm.end_time_local) {
                          addToast("Укажите начало и конец", "error")
                          return
                        }
                        const start = new Date(eventForm.start_time_local)
                        const end = new Date(eventForm.end_time_local)
                        if (end <= start) {
                          addToast("Конец должен быть позже начала", "error")
                          return
                        }

                        const payload = {
                          title: eventForm.title,
                          description: eventForm.description,
                          room_id: eventForm.room_id,
                          start_time: start.toISOString(),
                          end_time: end.toISOString(),
                          price: eventForm.price,
                          icon: eventForm.icon,
                          event_type: eventForm.event_type,
                        }

                        if (eventForm.id) {
                          await apiFetch(`/api/admin/events/${eventForm.id}`, {
                            method: "PUT",
                            body: JSON.stringify(payload),
                          })
                          addToast("Мероприятие обновлено", "success")
                        } else {
                          await apiFetch(`/api/admin/events`, {
                            method: "POST",
                            body: JSON.stringify(payload),
                          })
                          addToast("Мероприятие создано", "success")
                        }

                        const [roomsRes, eventsRes] = await Promise.all([apiFetch(`/api/admin/rooms`), apiFetch(`/api/events`)])
                        setAdminRooms(roomsRes)
                        setAdminEvents(eventsRes)
                      } catch (e: any) {
                        console.error(e)
                        addToast("Ошибка сохранения мероприятия", "error")
                      }
                    }}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-2"
                  >
                    {eventForm.id ? "Сохранить изменения" : "Создать мероприятие"}
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Список мероприятий</h3>
                  {adminEvents.length ? (
                    <div className="space-y-3">
                      {adminEvents.map((ev) => (
                        <div key={ev.id} className="bg-card rounded-3xl border border-border p-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold">{ev.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {ev.room_name} · {new Date(ev.start_time).toLocaleString("ru-RU")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Свободно: {ev.free_seats} / {ev.total_seats}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              className="rounded-full"
                              onClick={() => {
                                setEventForm({
                                  id: ev.id,
                                  title: ev.title,
                                  description: ev.description,
                                  room_id: ev.room_id,
                                  start_time_local: new Date(ev.start_time).toISOString().slice(0, 16),
                                  end_time_local: new Date(ev.end_time).toISOString().slice(0, 16),
                                  price: ev.price,
                                  icon: ev.icon,
                                  event_type: ev.event_type,
                                })
                              }}
                            >
                              Правка
                            </Button>
                            <Button
                              variant="outline"
                              className="rounded-full"
                              onClick={async () => {
                                if (!window.confirm(`Удалить мероприятие "${ev.title}"?`)) return
                                await apiFetch(`/api/admin/events/${ev.id}`, { method: "DELETE" })
                                addToast("Мероприятие удалено", "info")
                                setAdminEvents(await apiFetch(`/api/events`))
                              }}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Мероприятий нет</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "admin-event-proposals" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Заявки менторов на мероприятия</h2>
              {adminEventProposals.length ? adminEventProposals.map((p) => (
                <details key={p.id} className="bg-card rounded-3xl border border-border p-5">
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-sm text-muted-foreground">{p.mentor_name} · {p.room_name}</div>
                      <div className="text-sm text-muted-foreground">{new Date(p.start_time).toLocaleString("ru-RU")} - {new Date(p.end_time).toLocaleString("ru-RU")}</div>
                      <div className="text-xs mt-1">Статус: {p.status}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">Раскрыть</span>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="text-sm"><span className="text-muted-foreground">Описание: </span>{p.description}</div>
                    <div className="text-sm"><span className="text-muted-foreground">Тип: </span>{p.event_type}</div>
                    <div className="text-sm"><span className="text-muted-foreground">Цена: </span>{p.price}</div>
                    <div className="text-sm"><span className="text-muted-foreground">Иконка: </span>{p.icon}</div>
                    {p.status === "pending" && (
                      <div className="flex gap-2">
                        <Button variant="outline" className="rounded-full" onClick={async () => {
                          await apiFetch(`/api/admin/event-proposals/${p.id}/approve`, { method: "PUT" })
                          addToast("Заявка одобрена", "success")
                          await loadAdminEventProposals()
                          await loadEvents()
                        }}>Одобрить</Button>
                        <Button variant="outline" className="rounded-full" onClick={async () => {
                          await apiFetch(`/api/admin/event-proposals/${p.id}/reject`, { method: "PUT" })
                          addToast("Заявка отклонена", "info")
                          await loadAdminEventProposals()
                        }}>Отклонить</Button>
                      </div>
                    )}
                  </div>
                </details>
              )) : <EmptyState icon={Calendar} title="Заявок нет" description="Пока нет заявок от менторов" />}
            </div>
          )}

          {activeTab === "forum" && renderForumSection()}
        </div>
      ) : (
        (selectedEvent || selectedRoom) ? (
          <div className="max-w-4xl mx-auto px-4 py-8">
            {selectedRoom && !selectedEvent && !pendingRoomSeats.length && (
              <div className="mb-4 bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="font-semibold">Параметры бронирования</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Дата и время начала</div>
                    <input
                      type="datetime-local"
                      step={3600}
                      value={roomBookingStart}
                      min={getNextHourLocalValue()}
                      onChange={(e) => {
                        const value = e.target.value
                        if (!value) {
                          setRoomBookingStart(value)
                          return
                        }
                        const picked = new Date(value)
                        if (picked.getTime() < Date.now()) {
                          addToast("Нельзя выбрать время в прошлом", "error")
                          setRoomBookingStart(getNextHourLocalValue())
                          return
                        }
                        setRoomBookingStart(value)
                      }}
                      className="w-full h-11 rounded-xl bg-secondary border-0 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">На сколько часов</div>
                    <select
                      value={roomBookingHours}
                      onChange={(e) => setRoomBookingHours(Number(e.target.value))}
                      className="w-full h-11 rounded-xl bg-secondary border-0 px-3 text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>{h} ч.</option>
                      ))}
                    </select>
                  </div>
                </div>
                {roomBookingStart && (
                  <p className="text-sm text-muted-foreground">
                    Вы бронируете с {new Date(roomBookingStart).toLocaleString("ru-RU")} на {roomBookingHours} ч.
                  </p>
                )}
              </div>
            )}
            <SeatPicker
              roomName={selectedEvent?.room_name || selectedRoom?.name || ""}
              eventTitle={selectedEvent?.title}
              seats={seatRows}
              onConfirm={handleBookingConfirm}
              confirmLabel={selectedRoom && !selectedEvent ? "Далее" : "Подтвердить бронь"}
              onBack={() => {
                setSelectedEvent(null)
                setSelectedRoom(null)
                setPendingRoomSeats([])
                setPendingSeatSchedule(null)
                setActiveTab(selectedEvent ? "events" : "rooms")
              }}
              className={isLoadingSeats ? "opacity-80" : undefined}
            />
            {selectedRoom && !selectedEvent && pendingRoomSeats.length > 0 && (
              <div className="mt-4 bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="font-semibold">Подтверждение брони</div>
                <p className="text-sm text-muted-foreground">Выбраны места: {pendingRoomSeats.join(", ")}</p>
                {pendingSeatSchedule?.working_hours && (
                  <p className="text-sm text-muted-foreground">
                    Часы работы комнаты: {pendingSeatSchedule.working_hours.start} - {pendingSeatSchedule.working_hours.end}
                  </p>
                )}
                <div className="space-y-2">
                  {(pendingSeatSchedule?.seats || []).map((s) => (
                    <div key={s.seat} className="rounded-xl bg-secondary p-3 text-sm">
                      <div className="font-medium">{s.seat}</div>
                      <div className="text-muted-foreground">Занято: {s.booked_intervals.length ? s.booked_intervals.join(", ") : "нет"}</div>
                      <div className="text-muted-foreground">Свободно: {s.free_hint}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Дата и время начала</div>
                    <input
                      type="datetime-local"
                      step={3600}
                      value={roomBookingStart}
                      min={getNextHourLocalValue()}
                      onChange={(e) => setRoomBookingStart(e.target.value)}
                      className="w-full h-11 rounded-xl bg-secondary border-0 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">На сколько часов</div>
                    <select
                      value={roomBookingHours}
                      onChange={(e) => setRoomBookingHours(Number(e.target.value))}
                      className="w-full h-11 rounded-xl bg-secondary border-0 px-3 text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>{h} ч.</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => { setPendingRoomSeats([]); setPendingSeatSchedule(null) }}>
                    Выбрать места заново
                  </Button>
                  <Button className="rounded-full" onClick={finalizeRoomBooking}>
                    Забронировать
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 py-8">
            {activeTab === "events" && (
              <div className="space-y-8">
                <PromoCard
                  title={"Разгоните карьеру на программе «Мини-CEO»"}
                  description={"Задавайте вектор развития продуктов и решайте задачи под наставничеством топ-менеджеров"}
                  buttonText={"Участвовать"}
                  onButtonClick={() => addToast("Скоро будет доступно!", "info")}
                />

                <div>
                  <h2 className="text-2xl font-semibold mb-6">Ближайшие мероприятия</h2>
                  {events.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {events.map((event) => (
                        <EventCard
                          key={event.id}
                          title={event.title}
                          description={event.description}
                          date={new Date(event.start_time).toLocaleDateString("ru-RU")}
                          time={new Date(event.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          location={event.room_name}
                          freeSeats={event.free_seats}
                          totalSeats={event.total_seats}
                          price={event.price}
                          status={event.free_seats > 0 ? "open" : "closed"}
                          onClick={() => handleEventClick(event)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Calendar} title="Нет мероприятий" description="Список пуст." />
                  )}
                </div>
              </div>
            )}

            {activeTab === "rooms" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold mb-2">Помещения</h2>
                <p className="text-muted-foreground mb-6">Выберите комнату для свободного бронирования места</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      name={room.name}
                      capacity={computeRoomCapacity(room.seating_schema)}
                      onClick={() => handleRoomClick(room)}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "mentors" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold mb-2">Менторы</h2>
                <p className="text-muted-foreground mb-6">Получите консультацию от опытных специалистов</p>

                <div className="space-y-4">
                  {mentors.length ? (
                    mentors.map((m) => {
                      const isBooked = bookedMentorIds.has(m.id)
                      return (
                        <MentorCard
                          key={m.id}
                          name={m.full_name || m.username}
                          avatar={m.avatar_url || undefined}
                          skills={m.skills || []}
                          bio={m.bio || undefined}
                          company={m.company || undefined}
                          github={m.github || undefined}
                          workExperience={m.work_experience || undefined}
                          pitch={m.mentor_pitch || undefined}
                          isBooked={isBooked}
                          onBook={async () => {
                            const message = prompt("Опишите, с чем нужна помощь:")
                            if (!message) return
                            const slot = prompt("Желаемое время (например, 2026-04-20T15:00):")
                            if (!slot) return
                            await apiFetch(`/api/mentors/requests`, {
                              method: "POST",
                              body: JSON.stringify({
                                mentor_id: m.id,
                                message,
                                requested_slot: new Date(slot).toISOString(),
                              }),
                            })
                            addToast("Заявка отправлена ментору", "success")
                            await loadMentors()
                          }}
                        />
                      )
                    })
                  ) : (
                    <EmptyState icon={Users} title="Нет менторов" description="Список пуст." />
                  )}
                </div>
              </div>
            )}

            {activeTab === "forum" && renderForumSection()}

            {activeTab === "bookings" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold">Мои бронирования</h2>
                {bookings.length ? (
                  <div className="space-y-4">
                    {bookings.map((b) => (
                      (() => {
                        const startMs = b.booking_start ? new Date(b.booking_start).getTime() : null
                        const endMs = b.booking_end ? new Date(b.booking_end).getTime() : null
                        const durationHours = startMs && endMs && endMs > startMs
                          ? Math.round((endMs - startMs) / (1000 * 60 * 60))
                          : undefined
                        return (
                      <BookingCard
                        key={b.id}
                        eventTitle={b.event_title}
                        roomName={b.room_name}
                        seats={b.seats}
                        date={b.event_date}
                        durationHours={durationHours}
                        status={
                          b.status === "active"
                            ? "active"
                            : b.status === "not_arrived"
                              ? "not_arrived"
                              : (b.status as any)
                        }
                        qrToken={b.qr_token || undefined}
                        checkedInAt={b.checked_in_at || undefined}
                        onCancel={async () => handleCancelBooking(b.id)}
                      />
                        )
                      })()
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Ticket}
                    title="У вас пока нет бронирований"
                    description="Выберите мероприятие или помещение для бронирования"
                    action={
                      <Button onClick={() => setActiveTab("events")} className="rounded-full bg-primary text-primary-foreground">
                        Смотреть мероприятия
                      </Button>
                    }
                  />
                )}
              </div>
            )}

            {activeTab === "apply" && (
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold mb-2">Стать ментором</h2>
                <p className="text-muted-foreground mb-8">Расскажи о себе и отправь заявку администратору</p>

                <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
                  <textarea
                    value={applyForm.bio}
                    onChange={(e) => setApplyForm((p) => ({ ...p, bio: e.target.value }))}
                    rows={4}
                    className="w-full rounded-xl bg-secondary border-0 p-4 text-sm"
                    placeholder="О себе: экспертиза, какие задачи ведешь"
                  />
                  <Input
                    value={applyForm.work_experience}
                    onChange={(e) => setApplyForm((p) => ({ ...p, work_experience: e.target.value }))}
                    className="h-12 rounded-xl bg-secondary border-0"
                    placeholder="Стаж работы (например: 5 лет)"
                  />
                  <Input
                    value={applyForm.company}
                    onChange={(e) => setApplyForm((p) => ({ ...p, company: e.target.value }))}
                    className="h-12 rounded-xl bg-secondary border-0"
                    placeholder="Где работаешь"
                  />
                  <Input
                    value={applyForm.github}
                    onChange={(e) => setApplyForm((p) => ({ ...p, github: e.target.value }))}
                    className="h-12 rounded-xl bg-secondary border-0"
                    placeholder="GitHub / портфолио"
                  />
                  <textarea
                    value={applyForm.mentor_pitch}
                    onChange={(e) => setApplyForm((p) => ({ ...p, mentor_pitch: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl bg-secondary border-0 p-4 text-sm"
                    placeholder="Почему ты хороший ментор"
                  />
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Стек (выбери теги)</div>
                    <div className="flex flex-wrap gap-2">
                      {skillOptions.map((skill) => {
                        const selected = applyForm.skills.includes(skill)
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => setApplyForm((p) => ({ ...p, skills: toggleSkill(p.skills, skill) }))}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                              selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border"
                            }`}
                          >
                            {skill}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!applyForm.bio.trim()) {
                        addToast("Заполни описание о себе", "error")
                        return
                      }
                      if (!applyForm.skills.length) {
                        addToast("Выбери минимум один тег стека", "error")
                        return
                      }
                      await apiFetch(`/api/mentors/apply`, {
                        method: "POST",
                        body: JSON.stringify({
                          skills: applyForm.skills,
                          bio: applyForm.bio,
                          company: applyForm.company || null,
                          github: applyForm.github || null,
                          work_experience: applyForm.work_experience || null,
                          mentor_pitch: applyForm.mentor_pitch || null,
                          phone: profileForm.phone || null,
                          telegram_id: profileForm.telegram_id || null,
                          contact_email: profileForm.contact_email || null,
                          contact_other: profileForm.contact_other || null,
                        }),
                      })
                      addToast("Заявка отправлена администратору", "success")
                    }}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-2"
                  >
                    <GraduationCap className="w-5 h-5 mr-2" />
                    Отправить заявку
                  </Button>
                </div>
              </div>
            )}

            {isMentor && activeTab === "mentor-profile" && (
              <div className="max-w-3xl space-y-4">
                <h2 className="text-2xl font-semibold">Моя анкета ментора</h2>
                <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
                  <Input value={mentorProfileForm.full_name} onChange={(e) => setMentorProfileForm((p) => ({ ...p, full_name: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="ФИО" />
                  <Input value={mentorProfileForm.avatar_url} onChange={(e) => setMentorProfileForm((p) => ({ ...p, avatar_url: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Ссылка на аватар" />
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full h-12 rounded-xl bg-secondary border-0 px-3 py-2 text-sm"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const dataUrl = await fileToDataUrl(file)
                      setMentorProfileForm((p) => ({ ...p, avatar_url: dataUrl }))
                    }}
                  />
                  <textarea value={mentorProfileForm.bio} onChange={(e) => setMentorProfileForm((p) => ({ ...p, bio: e.target.value }))} rows={4} className="w-full rounded-xl bg-secondary border-0 p-4 text-sm" placeholder="О себе" />
                  <Input value={mentorProfileForm.work_experience} onChange={(e) => setMentorProfileForm((p) => ({ ...p, work_experience: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Стаж" />
                  <Input value={mentorProfileForm.company} onChange={(e) => setMentorProfileForm((p) => ({ ...p, company: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Компания" />
                  <Input value={mentorProfileForm.github} onChange={(e) => setMentorProfileForm((p) => ({ ...p, github: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="GitHub" />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={mentorProfileForm.accepting_mentor_requests} onChange={(e) => setMentorProfileForm((p) => ({ ...p, accepting_mentor_requests: e.target.checked }))} className="accent-primary" />
                    Принимать новые заявки студентов
                  </label>
                  <textarea value={mentorProfileForm.mentor_pitch} onChange={(e) => setMentorProfileForm((p) => ({ ...p, mentor_pitch: e.target.value }))} rows={3} className="w-full rounded-xl bg-secondary border-0 p-4 text-sm" placeholder="Питч ментора" />
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Стек</div>
                    <div className="flex flex-wrap gap-2">
                      {skillOptions.map((skill) => {
                        const selected = mentorProfileForm.skills.includes(skill)
                        return (
                          <button key={skill} type="button" onClick={() => setMentorProfileForm((p) => ({ ...p, skills: toggleSkill(p.skills, skill) }))} className={`px-3 py-1.5 rounded-full text-sm border ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {skill}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <Button onClick={saveMentorProfile} className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    Сохранить анкету
                  </Button>
                </div>
              </div>
            )}

            {isMentor && activeTab === "mentor-requests" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Заявки к ментору</h2>
                {mentorRequests.length ? (
                  mentorRequests.map((req) => (
                    <div key={req.id} className="bg-card rounded-3xl border border-border p-5 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{req.student_name} (@{req.student_username})</div>
                        <div className="text-sm text-muted-foreground mt-1">{req.message}</div>
                        <div className="text-sm text-muted-foreground mt-1">Слот: {new Date(req.requested_slot).toLocaleString("ru-RU")}</div>
                        <div className="text-xs mt-2">Статус: {req.status}</div>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={async () => {
                              await apiFetch(`/api/mentors/requests/${req.id}/accept`, { method: "PUT" })
                              addToast("Заявка принята", "success")
                              await loadMentorRequests()
                            }}
                          >
                            Принять
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={async () => {
                              await apiFetch(`/api/mentors/requests/${req.id}/reject`, { method: "PUT" })
                              addToast("Заявка отклонена", "info")
                              await loadMentorRequests()
                            }}
                          >
                            Отклонить
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState icon={Users} title="Заявок нет" description="Новые заявки от студентов появятся здесь" />
                )}
              </div>
            )}

            {isMentor && activeTab === "mentor-event-proposals" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Организация мероприятий</h2>
                <div className="bg-card rounded-3xl border border-border p-6 space-y-3">
                  <Input value={mentorEventForm.title} onChange={(e) => setMentorEventForm((p) => ({ ...p, title: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Название" />
                  <textarea value={mentorEventForm.description} onChange={(e) => setMentorEventForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-xl bg-secondary border-0 p-3 text-sm" placeholder="Описание" />
                  <select value={mentorEventForm.room_id ?? ""} onChange={(e) => setMentorEventForm((p) => ({ ...p, room_id: e.target.value ? Number(e.target.value) : null }))} className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm">
                    <option value="">Выбери комнату</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="datetime-local" value={mentorEventForm.start_time_local} onChange={(e) => setMentorEventForm((p) => ({ ...p, start_time_local: e.target.value }))} className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm" />
                    <input type="datetime-local" value={mentorEventForm.end_time_local} onChange={(e) => setMentorEventForm((p) => ({ ...p, end_time_local: e.target.value }))} className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm" />
                  </div>
                  <Input value={mentorEventForm.price} onChange={(e) => setMentorEventForm((p) => ({ ...p, price: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Цена" />
                  <Input value={mentorEventForm.icon} onChange={(e) => setMentorEventForm((p) => ({ ...p, icon: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Иконка" />
                  <Input value={mentorEventForm.event_type} onChange={(e) => setMentorEventForm((p) => ({ ...p, event_type: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Тип" />
                  <Button className="rounded-full" onClick={async () => {
                    if (!mentorEventForm.room_id) return addToast("Выберите комнату", "error")
                    await apiFetch(`/api/mentors/event-proposals`, { method: "POST", body: JSON.stringify({
                      ...mentorEventForm,
                      room_id: mentorEventForm.room_id,
                      start_time: new Date(mentorEventForm.start_time_local).toISOString(),
                      end_time: new Date(mentorEventForm.end_time_local).toISOString(),
                    }) })
                    addToast("Заявка на мероприятие отправлена", "success")
                    await loadMentorEventProposals()
                  }}>Отправить заявку</Button>
                </div>
                <div className="space-y-2">
                  {mentorEventProposals.map((p) => (
                    <div key={p.id} className="bg-card rounded-2xl border border-border p-4">
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-sm text-muted-foreground">Статус: {p.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {profileModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card rounded-3xl border border-border p-6 space-y-4">
            <h3 className="text-xl font-semibold">Профиль</h3>
            <Input value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="ФИО" />
            <Input value={profileForm.avatar_url} onChange={(e) => setProfileForm((p) => ({ ...p, avatar_url: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Аватар (URL)" />
            <input
              type="file"
              accept="image/*"
              className="w-full h-12 rounded-xl bg-secondary border-0 px-3 py-2 text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const dataUrl = await fileToDataUrl(file)
                setProfileForm((p) => ({ ...p, avatar_url: dataUrl }))
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Телефон" />
              <Input value={profileForm.contact_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_email: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Email для связи" />
              <Input value={profileForm.telegram_id} onChange={(e) => setProfileForm((p) => ({ ...p, telegram_id: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Telegram ID / @username" />
              <Input value={profileForm.contact_other} onChange={(e) => setProfileForm((p) => ({ ...p, contact_other: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Другой способ связи" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setProfileModalOpen(false)}>Отмена</Button>
              <Button className="rounded-full" onClick={saveProfile}>Сохранить</Button>
            </div>
          </div>
        </div>
      )}

      {settingsModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card rounded-3xl border border-border p-6 space-y-4">
            <h3 className="text-xl font-semibold">Настройки</h3>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Язык интерфейса (пока пустышка)</div>
              <select
                value={settingsForm.preferred_language}
                onChange={(e) => setSettingsForm((p) => ({ ...p, preferred_language: e.target.value }))}
                className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-sm"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
            <Input value={settingsForm.city} onChange={(e) => setSettingsForm((p) => ({ ...p, city: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Город" />
            <Input value={settingsForm.preferred_office} onChange={(e) => setSettingsForm((p) => ({ ...p, preferred_office: e.target.value }))} className="h-12 rounded-xl bg-secondary border-0" placeholder="Желаемый офис" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setSettingsModalOpen(false)}>Отмена</Button>
              <Button className="rounded-full" onClick={saveSettings}>Сохранить</Button>
            </div>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-5 right-5 z-[71] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg"
        onClick={async () => {
          setSupportOpen((prev) => !prev)
          if (!supportOpen) {
            setSupportView("threads")
            await loadSupportThreads()
          }
        }}
        title="Чат с администрацией"
      >
        💬
      </button>
      {supportOpen && (
        <div className="fixed bottom-24 right-5 z-[71] w-[460px] max-w-[96vw] bg-card border border-border rounded-2xl shadow-xl">
          <div className="p-3 border-b border-border font-semibold flex items-center justify-between">
            <span>{supportView === "threads" ? "Чаты" : "Основной чат"}</span>
            {supportView === "chat" && (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                onClick={() => setSupportView("threads")}
              >
                <ArrowLeft className="w-4 h-4" /> Назад
              </button>
            )}
          </div>
          {supportView === "threads" ? (
            <div className="p-3 h-[420px] overflow-auto space-y-2">
              {supportThreads.map((t) => (
                <button
                  key={t.thread_id}
                  onClick={async () => {
                    setSelectedSupportThread(t.thread_id)
                    setSupportView("chat")
                    await loadSupportMessages(t.thread_id)
                  }}
                  className="w-full text-left bg-secondary rounded-xl p-3 border border-border hover:bg-secondary/70"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-background flex items-center justify-center text-[10px]">
                      {t.avatar_url ? <img src={t.avatar_url} alt={t.title} className="w-full h-full object-cover" /> : t.title.slice(0, 1)}
                    </div>
                    <div className="font-medium text-sm">{t.title}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="p-3 h-64 overflow-auto space-y-2">
                {supportMessages.map((m) => (
                  <div key={m.id} className="text-sm bg-secondary rounded-xl p-2 flex gap-2">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-background flex items-center justify-center text-[10px]">
                      {m.sender_avatar ? <img src={m.sender_avatar} alt={m.sender_name} className="w-full h-full object-cover" /> : (m.sender_name || "?").slice(0,1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{m.sender_name}</div>
                      <div>{m.body}</div>
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt="support"
                          className="mt-1 max-h-32 rounded cursor-zoom-in"
                          onClick={() => setOpenedImageUrl(m.image_url)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border space-y-2">
                <textarea value={supportForm.body} onChange={(e) => setSupportForm((p) => ({ ...p, body: e.target.value }))} rows={2} className="w-full rounded-xl bg-secondary border-0 p-2 text-sm" placeholder="Ваш вопрос администрации..." />
                <div className="flex items-center gap-2">
                  <label className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center cursor-pointer">+
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const dataUrl = await fileToDataUrl(file)
                        setSupportForm((p) => ({ ...p, image_url: dataUrl }))
                      }}
                    />
                  </label>
                  {supportForm.image_url && (
                    <img
                      src={supportForm.image_url}
                      alt="preview"
                      className="h-9 w-9 rounded object-cover cursor-zoom-in"
                      onClick={() => setOpenedImageUrl(supportForm.image_url)}
                    />
                  )}
                </div>
                <Button className="w-full rounded-full" onClick={async () => {
                  if (!supportForm.body.trim()) return
                  if (!selectedSupportThread) return
                  await apiFetch(`/api/chat/messages`, { method: "POST", body: JSON.stringify({ thread_id: selectedSupportThread, body: supportForm.body, image_url: supportForm.image_url || null }) })
                  setSupportForm({ body: "", image_url: "" })
                  await loadSupportMessages()
                }}>Отправить</Button>
              </div>
            </>
          )}
        </div>
      )}

      {openedImageUrl && (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-6" onClick={() => setOpenedImageUrl(null)}>
          <button
            type="button"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
            onClick={() => setOpenedImageUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={openedImageUrl}
            alt="fullscreen"
            className="max-w-[95vw] max-h-[92vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </main>
  )
}

