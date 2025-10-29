import { useEffect, useMemo, useState } from "react"
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
} from "react-big-calendar"
import type { View, SlotInfo } from "react-big-calendar"
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "react-big-calendar/lib/addons/dragAndDrop/styles.css"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { format, parse, startOfWeek, getDay } from "date-fns"

import "./rbc-dark.css"
import "./App.css"

import LoginModal, { type AuthResult } from "./LoginModal"
import AddFriendForm from "./AddFriendForm"
import { api, setToken as apiSetToken } from "./api"

type User = { id: string; email: string; name: string; admin?: boolean }
type Friend = { _id: string; name: string; email: string }

type EventItem = {
  id: string
  ownerId?: string
  title: string
  start: Date
  end: Date
  description?: string
}

const locales = { "en-US": {} as any }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })
const DnDCalendar = withDragAndDrop(RBCalendar as any)

const FRIEND_COLORS = [
  "#60a5fa", "#34d399", "#f472b6", "#f59e0b", "#a78bfa", "#ef4444", "#22d3ee"
]

export default function App() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState<Date>(new Date())

  const [selected, setSelected] = useState<EventItem | null>(null)
  const [pendingAddDay, setPendingAddDay] = useState<null | "today" | "tomorrow">(null)

  const [me, setMe] = useState<User | null>(null)
  const [showLogin, setShowLogin] = useState<boolean>(false)

  const [friends, setFriends] = useState<Friend[]>([])
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [enabledFriends, setEnabledFriends] = useState<Record<string, boolean>>({})
  const [ownerColor, setOwnerColor] = useState<Record<string, string>>({})

  // Add a local sample event when not logged in (for first run UX)
  useEffect(() => {
    if (localStorage.getItem("ss_token")) return
    const now = new Date()
    const s = new Date(now); s.setHours(10, 0, 0, 0)
    const e = new Date(now); e.setHours(12, 0, 0, 0)
    setEvents([{ id: cryptoId(), title: "Sample Event", start: s, end: e }])
  }, [])

  // Auto-login from stored token if present
  useEffect(() => {
    const t = localStorage.getItem("ss_token")
    if (!t) return
    apiSetToken(t)
    initAfterLogin().catch(() => { apiSetToken(null); setMe(null) })
  }, [])

  function cryptoId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  async function onAuthed(res: AuthResult) {
    apiSetToken(res.token)
    setMe(res.user)
    setShowLogin(false)
    await initAfterLogin()
  }

  async function initAfterLogin() {
    setOwnerColor(c => ({ ...c, me: "#93c5fd" }))
    await Promise.all([loadMyEvents(), loadFriends(), loadMe()])
  }

  async function loadMe() {
    // if you have a /auth/me endpoint, you can refresh the 'admin' flag reliably here:
    try {
      const data = await api.get("/auth/me")
      if (data?.user) setMe(data.user)
    } catch {
      /* ignore */
    }
  }

  function logout() {
    apiSetToken(null)
    setMe(null)
    setFriends([])
    setEnabledFriends({})
    setBusy({})
    setOwnerColor({})
    setEvents([])
  }

  async function loadMyEvents() {
    const list = await api.get("/events")
    const mapped = (list as any[]).map(e => ({
      id: e._id,
      ownerId: "me",
      title: e.title,
      description: e.description,
      start: new Date(e.start),
      end: new Date(e.end),
    }))
    setEvents(prev => [...prev.filter(ev => ev.ownerId !== "me"), ...mapped])
  }

  async function loadFriends() {
    const data = await api.get("/friends")
    const arr = data.friends as Friend[]
    setFriends(arr)
    setOwnerColor(c => {
      const copy = { ...c }
      arr.forEach((f, idx) => {
        if (!copy[f._id]) copy[f._id] = FRIEND_COLORS[idx % FRIEND_COLORS.length]
      })
      return copy
    })
    setEnabledFriends(e => {
      const copy = { ...e }
      arr.forEach(f => { if (copy[f._id] === undefined) copy[f._id] = false })
      return copy
    })
  }

  async function loadFriendEvents(fid: string, enable: boolean) {
    if (!enable) {
      setEvents(prev => prev.filter(e => e.ownerId !== fid))
      return
    }
    const list = await api.get(`/events?ownerId=${encodeURIComponent(fid)}`)
    const mapped = (list as any[]).map(e => ({
      id: e._id,
      ownerId: fid,
      title: e.title,
      description: e.description,
      start: new Date(e.start),
      end: new Date(e.end),
    }))
    setEvents(prev => [...prev.filter(ev => ev.ownerId !== fid), ...mapped])
  }

  // Busy/Free polling
  useEffect(() => {
    if (!friends.length) return
    let stop = false
    async function tick() {
      try {
        const updates: Record<string, boolean> = {}
        await Promise.all(friends.map(async f => {
          const r = await api.get(`/friends/${f._id}/busy-now`)
          updates[f._id] = !!r.busy
        }))
        if (!stop) setBusy(updates)
      } catch {/* ignore */}
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => { stop = true; clearInterval(id) }
  }, [friends])

  function startPlaceMode(kind: "today" | "tomorrow") {
    setPendingAddDay(kind)
    const base = new Date()
    if (kind === "tomorrow") base.setDate(base.getDate() + 1)
    setDate(base)
  }

  async function onSelectSlot(slot: SlotInfo) {
    // Place-mode: click-drag a range, then prompt for title
    if (pendingAddDay) {
      const title = prompt("Event title?")
      setPendingAddDay(null)
      if (!title) return
      const created = me
        ? await api.post("/events", { title, start: slot.start, end: slot.end })
        : { _id: cryptoId(), start: slot.start, end: slot.end, title }
      setEvents(prev => [...prev, {
        id: created._id, ownerId: "me", title,
        start: new Date(slot.start), end: new Date(slot.end)
      }])
      return
    }

    // Normal quick add
    const title = prompt("Event title?", "New Event")
    if (!title) return
    const created = me
      ? await api.post("/events", { title, start: slot.start, end: slot.end })
      : { _id: cryptoId(), start: slot.start, end: slot.end, title }
    setEvents(prev => [...prev, {
      id: created._id, ownerId: "me", title,
      start: new Date(slot.start), end: new Date(slot.end)
    }])
  }

  function onSelectEvent(evt: EventItem) {
    setSelected(evt)
  }

  async function onEventDrop({ event, start, end }: any) {
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
    if (me && event.ownerId === "me") {
      await api.put(`/events/${event.id}`, { start, end })
    }
  }

  async function onEventResize({ event, start, end }: any) {
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
    if (me && event.ownerId === "me") {
      await api.put(`/events/${event.id}`, { start, end })
    }
  }

  async function updateSelectedTitle() {
    if (!selected) return
    const next = prompt("Edit title", selected.title)
    if (!next) return
    setEvents(prev => prev.map(e => e.id === selected.id ? { ...e, title: next } : e))
    if (me && selected.ownerId === "me") {
      await api.put(`/events/${selected.id}`, { title: next })
    }
    setSelected(s => s ? { ...s, title: next } : s)
  }

  async function deleteSelected() {
    if (!selected) return
    const ok = window.confirm("Delete this event?")
    if (!ok) return
    setEvents(prev => prev.filter(e => e.id !== selected.id))
    if (me && selected.ownerId === "me") {
      await api.delete(`/events/${selected.id}`)
    }
    setSelected(null)
  }

  // Seeding actions
  async function seedMyWeek() {
    const ok = window.confirm(
      "⚠ WARNING: This will clear your existing events for THIS WEEK and create random demo events. Continue?"
    )
    if (!ok) return
    await api.post("/seed/my-week", { clear: true })
    await loadMyEvents()
    alert("Seeded your week!")
  }

  async function seedMyMonth() {
    const ok = window.confirm(
      "⚠ WARNING: This will clear your existing events for THIS MONTH and create random demo events. Continue?"
    )
    if (!ok) return
    await api.post("/seed/my-month", { clear: true })
    await loadMyEvents()
    alert("Seeded your month!")
  }

  async function seedAllPeople(mode: "week" | "month" = "week") {
    if (!me?.admin) return
    const ok = window.confirm(
      `⚠ ADMIN WARNING: This will clear ${mode.toUpperCase()} events for ALL users and create unique random events per user. Continue?`
    )
    if (!ok) return
    await api.post("/seed/all", { clear: true, mode })
    // Reload mine + any enabled friends
    await Promise.all([
      loadMyEvents(),
      ...Object.keys(enabledFriends).map(fid => loadFriendEvents(fid, enabledFriends[fid]))
    ])
    alert(`Seeded ${mode} for all users!`)
  }

  // Calendar limits & styling helpers
  const min = useMemo(() => new Date(1970, 0, 1, 7, 0, 0), [])
  const max = useMemo(() => new Date(1970, 0, 1, 22, 0, 0), [])
  const scrollTo = useMemo(() => new Date(1970, 0, 1, 9, 0, 0), [])

  function eventPropGetter(evt: EventItem) {
    const color = evt.ownerId === "me"
      ? (ownerColor["me"] || "#93c5fd")
      : (ownerColor[evt.ownerId || ""] || "#888")
    return {
      style: {
        background: color,
        border: "none",
        color: "#0b1220",
        fontWeight: 600,
      }
    }
  }

  function formatRange(s: Date, e: Date) {
    const sameDay = s.toDateString() === e.toDateString()
    const day = format(s, "EEE, MMM d")
    const t1 = format(s, "p")
    const t2 = format(e, "p")
    return sameDay ? `${day} · ${t1}–${t2}` : `${format(s, "EEE, MMM d p")} → ${format(e, "EEE, MMM d p")}`
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ScheduleComparer</div>
        <div className="actions">
          <button onClick={() => startPlaceMode("today")}>Add Today</button>
          <button onClick={() => startPlaceMode("tomorrow")}>Add Tomorrow</button>
          {me && (
            <>
              <button onClick={seedMyWeek} className="outline">Seed My Week</button>
              <button onClick={seedMyMonth} className="outline">Seed My Month</button>
              {me.admin && (
                <>
                  <button onClick={() => seedAllPeople("week")} className="outline">Seed All People (Week)</button>
                  <button onClick={() => seedAllPeople("month")} className="outline">Seed All People (Month)</button>
                </>
              )}
            </>
          )}
          {!me
            ? <button className="primary" onClick={() => setShowLogin(true)}>Login</button>
            : <button onClick={logout}>Logout</button>}
        </div>
      </header>

      {pendingAddDay && (
        <div className="placing-banner">
          Place mode: {pendingAddDay === "today" ? "Today" : "Tomorrow"} — click & drag on the calendar to create a block.
          <button onClick={() => setPendingAddDay(null)} className="link-like">Cancel</button>
        </div>
      )}

      <div className="content">
        <aside className="sidebar">
          <div className="section-title">Friends</div>
          {!me && <div className="muted">Login to load friends</div>}
          {me && (
            <>
              <div className="friend-list">
                {friends.map(f => (
                  <label key={f._id} className="friend-row">
                    <input
                      type="checkbox"
                      checked={!!enabledFriends[f._id]}
                      onChange={e => {
                        const enable = e.target.checked
                        setEnabledFriends(prev => ({ ...prev, [f._id]: enable }))
                        loadFriendEvents(f._id, enable)
                      }}
                    />
                    <span
                      className="busy-dot"
                      style={{ background: busy[f._id] ? "#ef4444" : "#22c55e" }}
                    />
                    <span
                      className="friend-name"
                      style={{ color: ownerColor[f._id] || "#9aa4b2" }}
                    >
                      {f.name}
                    </span>
                    <div className="right">
                      <span className={`status-pill ${busy[f._id] ? "status-busy" : "status-free"}`}>
                        {busy[f._id] ? "Busy" : "Free"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="section-title" style={{ marginTop: 12 }}>Add Friend</div>
              <AddFriendForm onAdded={loadFriends} />
            </>
          )}
        </aside>

        <main className="main">
          <DndProvider backend={HTML5Backend}>
            <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              selectable
              resizable
              onSelectSlot={onSelectSlot}
              onSelectEvent={onSelectEvent}
              onEventDrop={onEventDrop}
              onEventResize={onEventResize}
              eventPropGetter={eventPropGetter}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              defaultView="week"
              step={60}
              timeslots={1}
              min={min}
              max={max}
              scrollToTime={scrollTo}
              style={{ height: "calc(100vh - 160px)" }}
            />
          </DndProvider>
        </main>
      </div>

      {/* Event details mini-popup */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{selected.title}</div>
              <button className="icon-btn" title="Close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-row">
                <div className="label">When</div>
                <div>{formatRange(selected.start, selected.end)}</div>
              </div>
              {selected.description && (
                <div className="modal-row">
                  <div className="label">Description</div>
                  <div>{selected.description}</div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              {selected.ownerId === "me" && (
                <>
                  <button className="outline" onClick={updateSelectedTitle}>✏️ Edit Title</button>
                  <button className="danger" onClick={deleteSelected}>🗑 Delete</button>
                </>
              )}
              <button onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onAuthed={onAuthed} />}
    </div>
  )
}
