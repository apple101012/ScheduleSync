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

type EventItem = {
  id: string
  title: string
  start: Date
  end: Date
  description?: string
}

const locales = { "en-US": {} as any }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })
const DnDCalendar = withDragAndDrop(RBCalendar as any)

export default function App() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  // "place mode" state: when not null, user is expected to drag-select a slot
  const [pendingAddDay, setPendingAddDay] = useState<null | "today" | "tomorrow">(null)

  useEffect(() => {
    const now = new Date()
    const s = new Date(now); s.setHours(10, 0, 0, 0)
    const e = new Date(now); e.setHours(12, 0, 0, 0)
    setEvents([{
      id: cryptoId(),
      title: "My Test Block",
      description: "Initial sample event",
      start: s,
      end: e
    }])
  }, [])

  function cryptoId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  // Start "place mode" for Today/Tomorrow — user will drag on calendar to pick time.
  function startPlaceMode(kind: "today" | "tomorrow") {
    setPendingAddDay(kind)

    // optional: nudge the calendar date so it's on the right day
    const base = new Date()
    if (kind === "tomorrow") base.setDate(base.getDate() + 1)
    setDate(base)
  }

  // Old quickAdd replaced by place-mode triggers
  // function quickAdd(...) { ... }  // removed

  function onSelectSlot(slot: SlotInfo) {
    if (pendingAddDay) {
      // Enforce the day if you want strictness:
      // If user picked the "wrong" day, we still allow but you can warn.
      const title = prompt("Event title?")
      if (!title) { setPendingAddDay(null); return }
      setEvents(prev => [...prev, {
        id: cryptoId(),
        title,
        start: slot.start,
        end: slot.end,
        description: ""
      }])
      setPendingAddDay(null)
      return
    }

    // Normal (non-place-mode) quick add
    const title = prompt("Event title?", "New Event")
    if (!title) return
    setEvents(prev => [...prev, {
      id: cryptoId(),
      title,
      start: slot.start,
      end: slot.end,
      description: ""
    }])
  }

  function onSelectEvent(evt: EventItem) {
    setSelected(evt)
    setShowEditor(false)
  }

  function onEventDrop({ event, start, end }: { event: EventItem; start: Date; end: Date }) {
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
  }

  function onEventResize({ event, start, end }: { event: EventItem; start: Date; end: Date }) {
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
  }

  function saveEdit(updated: Partial<EventItem>) {
    if (!selected) return
    setEvents(prev => prev.map(e => e.id === selected.id ? { ...e, ...updated } : e))
    setSelected(prev => prev ? { ...prev, ...updated } as EventItem : prev)
    setShowEditor(false)
  }

  // scroll + grid settings
  const min = useMemo(() => new Date(1970, 0, 1, 7, 0, 0), [])
  const max = useMemo(() => new Date(1970, 0, 1, 22, 0, 0), [])
  const scrollTo = useMemo(() => new Date(1970, 0, 1, 9, 0, 0), [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ScheduleComparer</div>
        <div className="actions">
          <button className={`btn ${pendingAddDay==='today' ? 'btn-outline' : ''}`} onClick={() => startPlaceMode("today")}>
            Add Today
          </button>
          <button className={`btn ${pendingAddDay==='tomorrow' ? 'btn-outline' : ''}`} onClick={() => startPlaceMode("tomorrow")}>
            Add Tomorrow
          </button>
        </div>
      </header>

      <div className="content">
        <aside className="sidebar">
          <div className="section-title">Friends</div>
          <div className="muted">Login & backend next → friend toggles here</div>
        </aside>

        <main className="main">
          {/* Add-mode hint banner */}
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
                style={{ height: "calc(100vh - 170px)" }}  // a bit shorter to fit banner
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
                onClick={() => { setEvents(e => e.filter(x => x.id !== selected.id)); setSelected(null); }}>
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
