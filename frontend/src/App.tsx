import { useEffect, useState } from "react"
import { Calendar, dateFnsLocalizer } from "react-big-calendar"
import type { View, SlotInfo } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "./App.css"
import "./rbc-dark.css" // dark theme overrides for react-big-calendar

type EventItem = { title: string; start: Date; end: Date; ownerId?: string }

const locales = { "en-US": {} as any }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

export default function App() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [view, setView] = useState<View>("week")       // control toolbar view
  const [date, setDate] = useState<Date>(new Date())   // control current date

  useEffect(() => {
    const now = new Date()
    const s = new Date(now); s.setHours(10, 0, 0, 0)
    const e = new Date(now); e.setHours(12, 0, 0, 0)
    setEvents([{ title: "My Test Block", start: s, end: e }])
  }, [])

  function quickAdd(dayOffset: number) {
    const base = new Date(); base.setDate(base.getDate() + dayOffset)
    const start = new Date(base); start.setHours(14, 0, 0, 0)
    const end = new Date(base); end.setHours(15, 0, 0, 0)
    setEvents(prev => [...prev, { title: dayOffset===0?"Today Event":"Tomorrow Event", start, end }])
  }

  function onSelectSlot(slot: SlotInfo) {
    // simple click-drag to add
    const title = prompt("Event title?", "New Event")
    if (!title) return
    setEvents(prev => [...prev, { title, start: slot.start, end: slot.end }])
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ScheduleComparer</div>
        <div className="actions">
          <button className="btn" onClick={()=>quickAdd(0)}>Add Today</button>
          <button className="btn" onClick={()=>quickAdd(1)}>Add Tomorrow</button>
        </div>
      </header>

      <div className="content">
        <aside className="sidebar">
          <div className="section-title">Friends</div>
          <div className="muted">Login & backend next → friend toggles here</div>
        </aside>

        <main className="main">
          <div className="calendar-card">
            <Calendar
              localizer={localizer}
              events={events as any}
              startAccessor="start"
              endAccessor="end"
              selectable
              onSelectSlot={onSelectSlot}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}

              /* 👇 reduces grid density */
              step={60}          // 60 minutes per slot
              timeslots={1}      // 1 slot per hour

              /* 👇 visible hours (scrollable) */
              min={new Date(1970, 1, 1, 7, 0)}   // show from 7 AM
              max={new Date(1970, 1, 1, 22, 0)}  // to 10 PM
              scrollToTime={new Date(1970, 1, 1, 9, 0)} // start scrolled to 9 AM

              /* optional: prevents event overlap crowding */
              dayLayoutAlgorithm="no-overlap"

              defaultView="week"
              style={{ height: "calc(100vh - 130px)" }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
