

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../modern.css';
import EventModal from '../components/EventModal.jsx';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Drag-and-drop enhanced calendar
const DndCalendar = withDragAndDrop(Calendar);

function Dashboard() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [availability, setAvailability] = useState({});
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);

  // Persisted schedule state (user + friends)
  const [userEvents, setUserEvents] = useState([]); // events for logged-in user
  const [friendEvents, setFriendEvents] = useState({}); // map friend -> events[]

  // Combine user and selected friends' events into calendar display
  const calendarEvents = [
    ...userEvents,
    ...selectedFriends.flatMap((f) => (friendEvents[f] || []).map(ev => ({ ...ev, friend: f })))
  ];

  // Move/update event (sends update to backend for user's events)
  const moveEvent = async ({ event, start, end, isAllDay }) => {
    // prevent moving friend events locally
    if (event.friend) {
      alert('Cannot move friend events');
      return;
    }
    // optimistic update with rollback
    const prevState = [...userEvents];
    setUserEvents(prevState.map(ev => ev._id === event._id ? { ...ev, start, end } : ev));
    try {
      await axios.put(`${API_BASE}/events/${username}/${event._id}`, {
        start: start.toISOString(),
        end: end.toISOString()
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      // success — nothing else to do (UI already updated)
    } catch (err) {
      console.error('Error updating event:', err);
      // rollback
      setUserEvents(prevState);
      alert('Could not update event (changes rolled back)');
    }
  };

  // Dark mode styles for calendar
  const darkModeStyles = {
    backgroundColor: '#18181b',
    color: '#e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 2px 8px #000a',
    padding: '1rem',
    marginBottom: '2rem',
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    console.log('Dashboard loaded. Token:', storedToken, 'Username:', storedUsername);
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      console.log('[Dashboard] Initializing with token:', storedToken, 'username:', storedUsername);
      fetchFriends(storedToken, storedUsername);
      fetchUserSchedule(storedToken, storedUsername);
    } else {
      console.log('[Dashboard] No token or username found in localStorage.');
    }
  }, []);

  // Utility to refresh user and selected friends' schedules
  const refreshSchedules = async () => {
    if (username) await fetchUserSchedule(token, username);
    if (selectedFriends.length > 0) {
      for (const f of selectedFriends) await fetchFriendSchedule(f);
    }
  };

  // Fetch user's schedule from backend
  const fetchUserSchedule = async (jwt, user) => {
    try {
      const res = await axios.get(`${API_BASE}/schedule/${user}`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      // res.data.events expected to be array with ISO datetimes
      const events = (res.data.events || []).map(ev => ({
        ...ev,
        start: new Date(ev.start),
        end: new Date(ev.end),
      }));
      setUserEvents(events);
    } catch (err) {
      console.error('[Dashboard] Error fetching schedule:', err);
      setUserEvents([]);
    }
  };

  // Fetch a friend's schedule and store it
  const fetchFriendSchedule = async (friend) => {
    try {
      const res = await axios.get(`${API_BASE}/schedule/${friend}`);
      const events = (res.data.events || []).map(ev => ({
        ...ev,
        start: new Date(ev.start),
        end: new Date(ev.end),
      }));
      setFriendEvents(prev => ({ ...prev, [friend]: events }));
    } catch (err) {
      console.error(`[Dashboard] Error fetching schedule for friend ${friend}:`, err);
      setFriendEvents(prev => ({ ...prev, [friend]: [] }));
    }
  };

  // When selected friends change, fetch their schedules
  useEffect(() => {
    if (selectedFriends.length === 0) return;
    selectedFriends.forEach(f => {
      fetchFriendSchedule(f);
    });
  }, [selectedFriends]);

  const fetchFriends = async (jwt, user) => {
    try {
      console.log('[Dashboard] Fetching user info for:', user);
      const userRes = await axios.get(`${API_BASE}/user/${user}`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      setFriends(userRes.data.friends || []);
      console.log('[Dashboard] Friends:', userRes.data.friends);
      const avail = {};
      await Promise.all((userRes.data.friends || []).map(async (f) => {
        try {
          const res = await axios.get(`${API_BASE}/availability/${f}`);
          avail[f] = res.data.status === 'free' ? 'free' : 'busy';
          console.log(`[Dashboard] Availability for ${f}:`, res.data.status);
        } catch (err) {
          avail[f] = 'busy';
          console.error(`[Dashboard] Error fetching availability for ${f}:`, err);
        }
      }));
      setAvailability(avail);
    } catch (err) {
      setFriends([]);
      setAvailability({});
      console.error('[Dashboard] Error fetching friends:', err);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!friendUsername) return;
    try {
      console.log('[Dashboard] Adding friend:', friendUsername);
      await axios.post(`${API_BASE}/user/add-friend`, {
        username,
        friend: friendUsername
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriendUsername("");
      fetchFriends(token, username);
    } catch (err) {
      alert('Failed to add friend');
      console.error('[Dashboard] Add friend error:', err);
    }
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  // Create a new event for the user (on slot select) -> open modal
  const handleSelectSlot = ({ start, end }) => {
    if (!username) {
      alert('Login to create events');
      return;
    }
    setModalInitial({ title: '', start, end });
    setModalOpen(true);
  };

  // Open add-event modal (button)
  const handleAddEventClick = () => {
    if (!username) { alert('Login to create events'); return; }
    // default to Oct 15, 2025 at 10am for convenience when testing; allow editing
    const defaultStart = new Date(2025, 9, 15, 10, 0, 0); // months 0-indexed
    const defaultEnd = new Date(2025, 9, 15, 11, 0, 0);
    setModalInitial({ title: '', start: defaultStart, end: defaultEnd });
    setModalOpen(true);
  };

  // Open add-event modal for a specific date (used by date cell wrapper)
  const handleAddEventForDay = (date) => {
    if (!username) { alert('Login to create events'); return; }
    const defaultStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0, 0);
    const defaultEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11, 0, 0);
    setModalInitial({ title: '', start: defaultStart, end: defaultEnd });
    setModalOpen(true);
  };

  // Wrapper component for month/day cells so clicking opens the modal
  const DateCellWrapper = ({ value, children }) => {
    return (
      <div onDoubleClick={() => handleAddEventForDay(value)} style={{ height: '100%' }}>
        {children}
      </div>
    );
  };

  // Double-click event -> open edit modal (shift+double-click = delete)
  const handleDoubleClickEvent = async (event, e) => {
    // if friend event, do nothing
    if (event.friend) {
      alert('Cannot edit friend events');
      return;
    }
    // if shift key pressed, delete
    if (window.event && window.event.shiftKey) {
      if (!window.confirm('Delete this event?')) return;
      try {
        await axios.delete(`${API_BASE}/events/${username}/${event._id}`, { headers: { Authorization: `Bearer ${token}` } });
        setUserEvents(prev => prev.filter(ev => ev._id !== event._id));
      } catch (err) {
        console.error('Delete event failed', err);
        alert('Could not delete event');
      }
      return;
    }
    setModalInitial(event);
    setModalOpen(true);
  };

  // Save handler used by modal: creates or updates depending on presence of _id
  const handleModalSave = async (ev) => {
    if (!username) throw new Error('Not logged in');
    // ev: { _id?, title, start:Date, end:Date }
    if (ev._id) {
      // update
      const payload = { title: ev.title, start: ev.start.toISOString(), end: ev.end.toISOString() };
      await axios.put(`${API_BASE}/events/${username}/${ev._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setUserEvents(prev => prev.map(item => item._id === ev._id ? { ...item, ...ev } : item));
    } else {
      // create
      const payload = { title: ev.title, start: ev.start.toISOString(), end: ev.end.toISOString() };
      const res = await axios.post(`${API_BASE}/events/${username}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      const created = res.data.event;
      created.start = new Date(created.start);
      created.end = new Date(created.end);
      setUserEvents(prev => [...prev, created]);
    }
  };

  const [query, setQuery] = useState("");
  const [askResult, setAskResult] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");

  const handleAsk = async (e) => {
    e.preventDefault();
    setAskLoading(true);
    setAskError("");
    setAskResult(null);
    console.log('[Dashboard] Ask query:', query);
    try {
      const res = await axios.post(`${API_BASE}/ask`, { question: query });
      setAskResult(res.data);
      console.log('[Dashboard] Ask response:', res.data);
    } catch (err) {
      setAskError('Could not get results.');
      console.error('[Dashboard] Ask error:', err);
    } finally {
      setAskLoading(false);
    }
  };


  return (
  <div className="dashboard-container" style={{ background: 'linear-gradient(135deg, #18181b 0%, #23232a 100%)', minHeight: '100vh', color: '#e5e7eb', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
  <h1 className="dashboard-title" style={{ color: '#fff', fontWeight: 700, letterSpacing: '0.02em', fontSize: '2.5rem', marginBottom: '1.5rem', textShadow: '0 2px 8px #000a' }}>Dashboard</h1>

      {/* Friends Section with overlay checkboxes */}
  <div className="mb-8" style={{ background: '#23232a', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #000a', marginBottom: '2rem' }}>
  <h2 className="section-title" style={{ color: '#fff', fontWeight: 600, fontSize: '1.3rem', marginBottom: '1rem' }}>Friends</h2>
        <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            className="auth-input"
            type="text"
            placeholder="Add friend by username"
            value={friendUsername}
            onChange={e => setFriendUsername(e.target.value)}
          />
          <button className="auth-btn" type="submit">Add</button>
        </form>
        <ul className="friends-list">
          {friends.length === 0 && <li style={{ color: '#888' }}>No friends yet.</li>}
          {friends.map(f => (
            <li key={f} className="friend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
              <input
                type="checkbox"
                checked={selectedFriends.includes(f)}
                onChange={e => {
                  setSelectedFriends(prev =>
                    e.target.checked ? [...prev, f] : prev.filter(x => x !== f)
                  );
                }}
                style={{ accentColor: '#6366f1' }}
              />
              <span>{f}</span>
              <span className={`status-dot ${availability[f] === 'free' ? 'free' : 'busy'}`}></span>
              <span style={{ fontSize: '0.9em', color: '#888' }}>{availability[f] === 'free' ? 'Free' : 'Busy'}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Calendar Section */}
  <div style={{ ...darkModeStyles, background: 'linear-gradient(135deg, #23232a 0%, #18181b 100%)', boxShadow: '0 2px 8px #000a' }}>
  <h2 className="section-title" style={{ color: '#fff', fontWeight: 600, fontSize: '1.3rem', marginBottom: '1rem' }}>My Schedule</h2>
        {/** Use DragAndDrop wrapper so onEventDrop is supported */}
        <DndProvider backend={HTML5Backend}>
        <DndCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          selectable
          onSelectSlot={handleSelectSlot}
          onDoubleClickEvent={handleDoubleClickEvent}
          style={{ height: 500, background: '#23232a', color: '#e5e7eb', borderRadius: '8px' }}
          eventPropGetter={(event) => {
            if (event.friend) {
              // Color friend events
              return {
                style: {
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: '1px solid #6366f1',
                },
              };
            }
            return {
              style: {
                backgroundColor: '#22c55e',
                color: '#fff',
                border: '1px solid #22c55e',
              },
            };
          }}
          draggableAccessor={(event) => !event.friend}
          onEventDrop={moveEvent}
          components={{ dateCellWrapper: DateCellWrapper }}
        />
        </DndProvider>
        <EventModal open={modalOpen} onClose={() => { setModalOpen(false); refreshSchedules(); }} onSave={async (ev) => { await handleModalSave(ev); await refreshSchedules(); }} initial={modalInitial} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button className="auth-btn" onClick={handleAddEventClick} style={{ background: '#10b981' }}>Add Event</button>
        </div>
        <div style={{ fontSize: '0.95em', color: '#888', marginTop: '0.5em' }}>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>Your events</span> &nbsp;|&nbsp;
          <span style={{ color: '#6366f1', fontWeight: 600 }}>Friend events</span>
        </div>
      </div>

      {/* Natural Language Query Section */}
  <div className="mb-8" style={{ background: '#23232a', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #000a', marginBottom: '2rem' }}>
  <h2 className="section-title" style={{ color: '#fff', fontWeight: 600, fontSize: '1.3rem', marginBottom: '1rem' }}>Ask a Question</h2>
        <form onSubmit={handleAsk} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            className="auth-input"
            type="text"
            placeholder="e.g. Who is free next Friday at 3pm?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={askLoading}
          />
          <button className="auth-btn" type="submit" disabled={askLoading}>
            {askLoading ? 'Asking...' : 'Ask'}
          </button>
        </form>
        {askError && <div style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{askError}</div>}
        {askResult && (
          <div className="ask-card">
            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Results</h3>
            <div style={{ fontSize: '0.95em', color: '#555', marginBottom: '0.5rem' }}>Day: {askResult.day || 'N/A'}, Time: {askResult.time || 'N/A'}</div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>Free:</span>
              {askResult.free_users && askResult.free_users.length > 0 ? (
                <ul style={{ display: 'inline', marginLeft: '0.5em' }}>
                  {askResult.free_users.map(u => (
                    <li key={u} style={{ display: 'inline-block', marginRight: '0.5em', color: '#22c55e', fontWeight: 500 }}>{u}</li>
                  ))}
                </ul>
              ) : <span style={{ marginLeft: '0.5em', color: '#aaa' }}>None</span>}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Busy:</span>
              {askResult.busy_users && askResult.busy_users.length > 0 ? (
                <ul style={{ display: 'inline', marginLeft: '0.5em' }}>
                  {askResult.busy_users.map(u => (
                    <li key={u} style={{ display: 'inline-block', marginRight: '0.5em', color: '#ef4444', fontWeight: 500 }}>{u}</li>
                  ))}
                </ul>
              ) : <span style={{ marginLeft: '0.5em', color: '#aaa' }}>None</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
