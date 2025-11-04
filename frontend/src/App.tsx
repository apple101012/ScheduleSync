// src/App.tsx
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
  const [isImpersonating, setIsImpersonating] = useState<boolean>(() => !!localStorage.getItem("ss_admin_token"))
  const [showLogin, setShowLogin] = useState<boolean>(false)
  const [impersonTarget, setImpersonTarget] = useState<string>("")

  const [friends, setFriends] = useState<Friend[]>([])
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [enabledFriends, setEnabledFriends] = useState<Record<string, boolean>>({})
  const [ownerColor, setOwnerColor] = useState<Record<string, string>>({})

  // Show a single sample event only when NOT logged in
  useEffect(() => {
    if (localStorage.getItem("ss_token")) return
    const now = new Date()
    const s = new Date(now); s.setHours(10, 0, 0, 0)
    const e = new Date(now); e.setHours(12, 0, 0, 0)
    setEvents([{ id: cryptoId(), title: "Sample Event", start: s, end: e }])
  }, [])

  // Auto-login if token exists
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

  // Admin -> impersonate a user (obtain a token for target user)
  async function impersonateUser(targetId: string) {
    if (!me?.admin) return
    const ok = window.confirm("Impersonate this user? You will become them until you revert.")
    if (!ok) return
    try {
      // save current admin token so we can revert
      const prev = localStorage.getItem("ss_token") || ""
      if (!localStorage.getItem("ss_admin_token")) localStorage.setItem("ss_admin_token", prev)
      const resp: any = await api.post("/auth/impersonate", { userId: targetId })
      if (!resp?.token) throw new Error("Impersonation failed")
      apiSetToken(resp.token)
      localStorage.setItem("ss_token", resp.token)
      setMe(resp.user)
      setIsImpersonating(true)
      await initAfterLogin()
    } catch (e: any) {
      alert(e?.message || "Failed to impersonate user")
    }
  }

  async function revertImpersonation() {
    const orig = localStorage.getItem("ss_admin_token")
    if (!orig) return
    apiSetToken(orig)
    localStorage.setItem("ss_token", orig)
    localStorage.removeItem("ss_admin_token")
    setIsImpersonating(false)
    try {
      await initAfterLogin()
    } catch { /* ignore */ }
  }

  async function initAfterLogin() {
    // Clear any demo/sample events that were present before login,
    // then set my color and load server data. This ensures the single
    // in-memory sample event shown to anonymous users doesn't persist
    // after authentication.
    setEvents([])
    // color for my own events
    setOwnerColor(c => ({ ...c, me: "#93c5fd" }))
    await Promise.all([loadMyEvents(), loadFriends(), loadMe()])
  }

  // keep an impersonation target in the topbar when admin
  useEffect(() => {
    if (!me?.admin) return
    if (friends.length && !impersonTarget) setImpersonTarget(friends[0]._id)
  }, [me, friends])

  async function loadMe() {
    try {
      const data = await api.get("/auth/me")
      if (data?.user) setMe(data.user)
    } catch { /* ignore */ }
  }

  function logout() {
    apiSetToken(null)
    setMe(null)
    setFriends([])
    setEnabledFriends({})
    setBusy({})
    setOwnerColor({})
    setEvents([]) // clears sample + my events
  }

  // Load my events
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

  // Load friends list + assign colors
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

  // Load/clear a friend's events when toggled
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

  // Busy/Free polling (every 15s)
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
      } catch { /* ignore */ }
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => { stop = true; clearInterval(id) }
  }, [friends])

  // Add Today / Tomorrow (place mode)
  function startPlaceMode(kind: "today" | "tomorrow") {
    setPendingAddDay(kind)
    const base = new Date()
    if (kind === "tomorrow") base.setDate(base.getDate() + 1)
    setDate(base)
    // UX: show a tiny inline banner without new CSS classes
    alert(`Place mode: ${kind}. Click & drag on the calendar to create a block, then you'll be prompted for a title.`)
  }

  // Slot selection -> create event (supports place mode)
  async function onSelectSlot(slot: SlotInfo) {
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

    // Quick add when not in place mode
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

  // Drag/Resize handlers
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

  // Edit/Delete via mini-popup
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
      await api.del(`/events/${selected.id}`)
    }
    setSelected(null)
  }

  // Seeding actions (match server endpoints you already wired)
  async function seedMyWeek() {
    const ok = window.confirm("⚠ This will clear YOUR current week and add demo events. Continue?")
    if (!ok) return
    await api.post("/seed/my-week", { clear: true })
    await loadMyEvents()
    alert("Your week has been seeded.")
  }

  async function seedMyMonth() {
    const ok = window.confirm("⚠ This will clear YOUR current month and add demo events. Continue?")
    if (!ok) return
    await api.post("/seed/my-month", { clear: true })
    await loadMyEvents()
    alert("Your month has been seeded.")
  }

  async function seedAllPeople(mode: "week" | "month") {
    const ok = window.confirm(`⚠ ADMIN: This will clear ${mode} events for ALL users and add demo events. Continue?`)
    if (!ok) return
    await api.post("/seed/all", { clear: true, mode })
    await Promise.all([
      loadMyEvents(),
      ...Object.entries(enabledFriends).map(([fid, enabled]) =>
        enabled ? loadFriendEvents(fid, true) : Promise.resolve()
      ),
    ])
    alert(`Seeded ${mode} for all users.`)
  }

  // Calendar window & scroll prefs
  const min = useMemo(() => new Date(1970, 0, 1, 7, 0, 0), [])
  const max = useMemo(() => new Date(1970, 0, 1, 22, 0, 0), [])
  const scrollTo = useMemo(() => new Date(1970, 0, 1, 9, 0, 0), [])

  // Friend-colored events (dark theme contrast)
  function hexToRgb(hex: string) {
    const h = hex.replace('#', '')
    const bigint = parseInt(h, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    return `${r}, ${g}, ${b}`
  }

  function eventPropGetter(evt: EventItem) {
    const color = evt.ownerId === "me"
      ? (ownerColor["me"] || "#93c5fd")
      : (ownerColor[evt.ownerId || ""] || "#888")
    const rgb = hexToRgb(color)
    return {
      style: {
        background: `rgba(${rgb}, 0.70)`, // stronger fill (70% opacity) per request
        border: `1px solid rgba(${rgb}, 0.9)`, // subtle outline in owner's color with higher opacity
        borderLeft: `4px solid ${color}`, // strong colored accent on left
        color: '#e6f0ff',
        fontWeight: 600,
        paddingLeft: 8,
        borderRadius: 6,
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
          {me?.admin && friends.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <select
                value={impersonTarget}
                onChange={e => setImpersonTarget(e.target.value)}
                style={{ background: '#0b1220', color: '#e2e6ef', borderRadius: 8, padding: '6px 8px', border: '1px solid #2a3140' }}
              >
                {friends.map(f => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
              <button className="impersonate-btn" onClick={() => impersonateUser(impersonTarget)} disabled={!impersonTarget}>Impersonate</button>
            </div>
          )}
          {!me
            ? <button className="primary" onClick={() => setShowLogin(true)}>Login</button>
            : (
              <>
                {isImpersonating && <button onClick={revertImpersonation} style={{ marginRight: 8 }}>Revert</button>}
                <button onClick={logout}>Logout</button>
              </>
            )}
        </div>
      </header>

      <div className="content">
        <aside className="sidebar">
          <div className="section-title">Friends</div>
          {!me && <div style={{ color: "#9aa4b2", fontSize: 14 }}>Login to load friends</div>}
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
                      {/* Impersonate moved to topbar for admins */}
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

      {/* Event details mini-popup (uses existing .modal + .modal-actions styles) */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.title}</div>
              <button onClick={() => setSelected(null)} style={{ cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#9aa4b2" }}>When</div>
                <div>{formatRange(selected.start, selected.end)}</div>
              </div>
              {selected.description && (
                <div>
                  <div style={{ fontSize: 12, color: "#9aa4b2" }}>Description</div>
                  <div>{selected.description}</div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              {selected.ownerId === "me" && (
                <>
                  <button className="outline" onClick={updateSelectedTitle}>✏️ Edit Title</button>
                  <button
                    onClick={deleteSelected}
                    style={{ background: "#2b1012", border: "1px solid #5a1d23", color: "#ffb4bc", borderRadius: 8, padding: "6px 12px" }}
                  >
                    🗑 Delete
                  </button>
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
