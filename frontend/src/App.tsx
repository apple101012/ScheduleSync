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

type User = { id: string; email: string; name: string }
type Friend = { _id: string; name: string; email: string }

type EventItem = {
  id: string
  ownerId?: string     // "me" or friendId
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
  // Calendar / UI state
  const [events, setEvents] = useState<EventItem[]>([])
  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [pendingAddDay, setPendingAddDay] = useState<null | "today" | "tomorrow">(null)

  // Auth + data state
  const [me, setMe] = useState<User | null>(null)
  const [showLogin, setShowLogin] = useState<boolean>(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [enabledFriends, setEnabledFriends] = useState<Record<string, boolean>>({})
  const [ownerColor, setOwnerColor] = useState<Record<string, string>>({})

  // initial local sample so the calendar isn't empty pre-login
  useEffect(() => {
    if (localStorage.getItem("ss_token")) return
    const now = new Date()
    const s = new Date(now); s.setHours(10, 0, 0, 0)
    const e = new Date(now); e.setHours(12, 0, 0, 0)
    setEvents([{
      id: cryptoId(),
      title: "My Test Block",
      description: "Local sample event",
      start: s,
      end: e
    }])
  }, [])

  // restore token
  useEffect(() => {
    const t = localStorage.getItem("ss_token")
    if (!t) return
    apiSetToken(t)
    initAfterLogin().catch(() => {
      apiSetToken(null); setMe(null)
    })
  }, [])

  function cryptoId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  // ---------- Auth ----------
  async function onAuthed(res: AuthResult) {
    apiSetToken(res.token)
    setMe(res.user)
    setShowLogin(false)
    await initAfterLogin()
  }

  async function initAfterLogin() {
    setOwnerColor(c => ({ ...c, me: "#93c5fd" }))
    await Promise.all([loadMyEvents(), loadFriends()])
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

  // ---------- Loaders ----------
  async function loadMyEvents() {
    const list = await api.get("/events")
    const mapped: EventItem[] = (list as any[]).map(e => ({
      id: e._id,
      ownerId: "me",
      title: e.title,
      description: e.description,
      start: new Date(e.start),
      end: new Date(e.end),
    }))
    setEvents(prev => {
      const others = prev.filter(ev => ev.ownerId && ev.ownerId !== "me")
      return [...others, ...mapped]
    })
  }

  async function loadFriends() {
    const data = await api.get("/friends")
    const arr = data as Friend[]
    setFriends(arr)
    // assign colors
    setOwnerColor(c => {
      const copy = { ...c }
      arr.forEach((f, idx) => {
        if (!copy[f._id]) copy[f._id] = FRIEND_COLORS[idx % FRIEND_COLORS.length]
      })
      return copy
    })
    // default toggles remain unchanged; initialize if missing
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
    const mapped: EventItem[] = (list as any[]).map(e => ({
      id: e._id,
      ownerId: fid,
      title: `${e.title} — ${friends.find(f => f._id === fid)?.name ?? "Friend"}`,
      description: e.description,
      start: new Date(e.start),
      end: new Date(e.end),
    }))
    setEvents(prev => {
      const others = prev.filter(ev => ev.ownerId !== fid)
      return [...others, ...mapped]
    })
  }

  // busy polling (every 15s)
  useEffect(() => {
    if (!friends.length) return
    let stop = false
    async function tick() {
      try {
        const updates: Record<string, boolean> = {}
        await Promise.all(friends.map(async f => {
          const r = await api.get(`/friends/${f._id}/busy-now`)
          updates[f._id] = !!(r as any).busy
        }))
        if (!stop) setBusy(updates)
      } catch { /* ignore */ }
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => { stop = true; clearInterval(id) }
  }, [friends])

  // ---------- Place mode ----------
  function startPlaceMode(kind: "today" | "tomorrow") {
    setPendingAddDay(kind)
    const base = new Date()
    if (kind === "tomorrow") base.setDate(base.getDate() + 1)
    setDate(base)
  }

  async function onSelectSlot(slot: SlotInfo) {
    if (pendingAddDay) {
      const title = prompt("Event title?")
      setPendingAddDay(null)
      if (!title) return
      if (me) {
        const created = await api.post("/events", {
          title, description: "", start: slot.start, end: slot.end
        })
        setEvents(prev => [...prev, {
          id: (created as any)._id,
          ownerId: "me",
          title, description: "",
          start: new Date((created as any).start),
          end: new Date((created as any).end),
        }])
      } else {
        setEvents(prev => [...prev, {
          id: cryptoId(),
          title, description: "",
          start: slot.start, end: slot.end,
        }])
      }
      return
    }

    const title = prompt("Event title?", "New Event")
    if (!title) return
    if (me) {
      const created = await api.post("/events", { title, description: "", start: slot.start, end: slot.end })
      setEvents(prev => [...prev, {
        id: (created as any)._id, ownerId: "me", title,
        start: new Date((created as any).start), end: new Date((created as any).end)
      }])
    } else {
      setEvents(prev => [...prev, { id: cryptoId(), title, start: slot.start, end: slot.end }])
    }
  }

  function onSelectEvent(evt: EventItem) {
    setSelected(evt)
    setShowEditor(false)
  }

  async function onEventDrop({ event, start, end }: { event: EventItem; start: Date; end: Date }) {
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
    if (me && (event.ownerId === "me")) {
      try { await api.put(`/events/${event.id}`, { start, end }) } catch {}
    }
  }

  async function onEventResize({ event, start, end }: { event: EventItem; start: Date; end: Date }) {
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
    if (me && (event.ownerId === "me")) {
      try { await api.put(`/events/${event.id}`, { start, end }) } catch {}
    }
  }

  async function saveEdit(updated: Partial<EventItem>) {
    if (!selected) return
    setEvents(prev => prev.map(e => e.id === selected.id ? { ...e, ...updated } : e))
    setSelected(prev => prev ? { ...prev, ...updated } as EventItem : prev)
    setShowEditor(false)
    if (me && selected.ownerId === "me") {
      const body: any = {}
      if (updated.title !== undefined) body.title = updated.title
      if (updated.description !== undefined) body.description = updated.description
      if (updated.start) body.start = updated.start
      if (updated.end) body.end = updated.end
      try { await api.put(`/events/${selected.id}`, body) } catch {}
    }
  }

  // Seed week for current user
  async function seedMyWeek() {
    if (!me) { alert("Login first"); return }
    const startOfWeekDate = new Date(date)
    startOfWeekDate.setDate(date.getDate() - date.getDay()) // Sunday
    const slots = [
      [9, 11, "Focus Block"],
      [13, 14, "Lunch"],
      [15, 17, "Project Work"],
      [18, 19, "Gym"],
      [20, 21, "Study Group"]
    ]
    for (let i = 1; i <= 5; i++) { // Mon..Fri
      for (const [h1, h2, title] of slots) {
        const s = new Date(startOfWeekDate); s.setDate(startOfWeekDate.getDate() + i); s.setHours(h1 as number, 0, 0, 0)
        const e = new Date(startOfWeekDate); e.setDate(startOfWeekDate.getDate() + i); e.setHours(h2 as number, 0, 0, 0)
        const created = await api.post("/events", { title: String(title), description: "", start: s, end: e })
        setEvents(prev => [...prev, {
          id: (created as any)._id,
          ownerId: "me",
          title: String(title),
          start: new Date((created as any).start),
          end: new Date((created as any).end),
        }])
      }
    }
    alert("Seeded a week of sample events ✅")
  }

  // time window + scroll
  const min = useMemo(() => new Date(1970, 0, 1, 7, 0, 0), [])
  const max = useMemo(() => new Date(1970, 0, 1, 22, 0, 0), [])
  const scrollTo = useMemo(() => new Date(1970, 0, 1, 9, 0, 0), [])

  // color by owner
  function eventPropGetter(evt: EventItem) {
    const color =
      evt.ownerId
        ? (evt.ownerId === "me" ? (ownerColor["me"] || "#93c5fd") : (ownerColor[evt.ownerId] || "#888"))
        : (ownerColor["me"] || "#93c5fd")
    return {
      style: {
        background: color,
        border: "none",
        color: "#0b1220",
        fontWeight: 600,
      }
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ScheduleComparer</div>
        <div className="actions" style={{ gap: 8 }}>
          <button className={`btn ${pendingAddDay==='today' ? 'btn-outline' : ''}`} onClick={() => startPlaceMode("today")}>
            Add Today
          </button>
          <button className={`btn ${pendingAddDay==='tomorrow' ? 'btn-outline' : ''}`} onClick={() => startPlaceMode("tomorrow")}>
            Add Tomorrow
          </button>
          {!me ? (
            <button className="btn primary" onClick={() => setShowLogin(true)}>Login</button>
          ) : (
            <>
              <button className="btn" onClick={seedMyWeek}>Seed My Week</button>
              <button className="btn" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </header>

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
                      onChange={async (e) => {
                        const enable = e.target.checked
                        setEnabledFriends(prev => ({ ...prev, [f._id]: enable }))
                        loadFriendEvents(f._id, enable).catch(() => {})
                      }}
                    />
                    <span
                      className="busy-dot"
                      style={{ background: busy[f._id] ? "#ef4444" : "#22c55e" }}
                      title={busy[f._id] ? "Busy" : "Free"}
                    />
                    <span className="friend-name" style={{ color: ownerColor[f._id] || "#9aa4b2" }}>
                      {f.name}
                    </span>
                  </label>
                ))}
              </div>

              <div className="section-title" style={{ marginTop: 12 }}>Add Friend</div>
              <AddFriendForm onAdded={async () => { await loadFriends() }} />

              <div className="muted" style={{ marginTop: 8 }}>
                Your color: <span className="color-chip" style={{ background: ownerColor["me"] || "#93c5fd" }} />
              </div>
            </>
          )}
        </aside>

        <main className="main">
          {pendingAddDay && (
            <div className="hint-banner">
              <span className="dot" />
              Drag on the calendar to outline a time range for <b>{pendingAddDay}</b>, then release to name it.
              <button className="link-btn" onClick={() => setPendingAddDay(null)}>Cancel</button>
            </div>
          )}

          <div className={`calendar-card ${pendingAddDay ? "placing" : ""}`}>
            <DndProvider backend={HTML5Backend}>
              <DnDCalendar
                localizer={localizer}
                events={events as any}
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
                dayLayoutAlgorithm="no-overlap"
                style={{ height: "calc(100vh - 170px)" }}
              />
            </DndProvider>
          </div>
        </main>
      </div>

      {/* mini popup */}
      {selected && !showEditor && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="mini-card" onClick={e => e.stopPropagation()}>
            <div className="mini-header">
              <div className="mini-title">{selected.title}</div>
              <button className="icon-btn" title="Edit" onClick={() => setShowEditor(true)}>
                ✏️
              </button>
            </div>
            <div className="mini-body">
              <div className="row"><span className="label">Start</span><span>{selected.start.toLocaleString()}</span></div>
              <div className="row"><span className="label">End</span><span>{selected.end.toLocaleString()}</span></div>
              {selected.description
                ? <div className="desc">{selected.description}</div>
                : <div className="muted">No description</div>}
            </div>
            <div className="mini-actions">
              <button className="btn danger"
                onClick={async () => {
                  if (me && selected.ownerId === "me") {
                    try { await api.del(`/events/${selected.id}`) } catch {}
                  }
                  setEvents(e => e.filter(x => x.id !== selected.id))
                  setSelected(null)
                }}>
                Delete
              </button>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* edit dialog */}
      {selected && showEditor && (
        <EditDialog
          initial={selected}
          onCancel={() => setShowEditor(false)}
          onSave={(title, description, start, end) =>
            saveEdit({ title, description, start, end })
          }
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onAuthed={onAuthed}
        />
      )}
    </div>
  )
}

function EditDialog({
  initial,
  onCancel,
  onSave
}: {
  initial: EventItem
  onCancel: () => void
  onSave: (title: string, description: string, start: Date, end: Date) => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? "")
  const [startISO, setStartISO] = useState(toLocalInputValue(initial.start))
  const [endISO, setEndISO] = useState(toLocalInputValue(initial.end))

  function toDate(v: string) { return new Date(v) }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit Event</div>
        <div className="form">
          <label><span>Title</span><input value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label><span>Description</span>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </label>
          <div className="row-2">
            <label><span>Start</span>
              <input type="datetime-local" value={startISO} onChange={e => setStartISO(e.target.value)} />
            </label>
            <label><span>End</span>
              <input type="datetime-local" value={endISO} onChange={e => setEndISO(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary"
            onClick={() => onSave(title, description, toDate(startISO), toDate(endISO))}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
