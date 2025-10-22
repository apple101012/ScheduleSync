

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../modern.css';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
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

function Dashboard() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [availability, setAvailability] = useState({});
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);

  // Sample schedule data for user and friends
  const sampleEvents = {
    apple: [
      {
        title: "Math Class",
        start: new Date(2025, 9, 22, 9, 0),
        end: new Date(2025, 9, 22, 10, 30),
      },
      {
        title: "Lunch",
        start: new Date(2025, 9, 22, 12, 0),
        end: new Date(2025, 9, 22, 13, 0),
      },
      {
        title: "Project Meeting",
        start: new Date(2025, 9, 23, 15, 0),
        end: new Date(2025, 9, 23, 16, 0),
      },
    ],
    alice: [
      {
        title: "Yoga",
        start: new Date(2025, 9, 22, 8, 0),
        end: new Date(2025, 9, 22, 9, 0),
      },
      {
        title: "Lunch",
        start: new Date(2025, 9, 22, 12, 0),
        end: new Date(2025, 9, 22, 13, 0),
      },
      {
        title: "Study Group",
        start: new Date(2025, 9, 23, 17, 0),
        end: new Date(2025, 9, 23, 18, 0),
      },
    ],
    bob: [
      {
        title: "Gym",
        start: new Date(2025, 9, 22, 7, 0),
        end: new Date(2025, 9, 22, 8, 0),
      },
      {
        title: "Lunch",
        start: new Date(2025, 9, 22, 12, 0),
        end: new Date(2025, 9, 22, 13, 0),
      },
      {
        title: "Team Sync",
        start: new Date(2025, 9, 23, 14, 0),
        end: new Date(2025, 9, 23, 15, 0),
      },
    ],
    // Add more sample events for other friends as needed
  };

  // Combine user and selected friends' events
  const getDisplayedEvents = () => {
    let events = [...(sampleEvents[username] || [])];
    selectedFriends.forEach(f => {
      if (sampleEvents[f]) {
        // Color friend events differently
        events = events.concat(sampleEvents[f].map(ev => ({ ...ev, friend: f })));
      }
    });
    return events;
  };

  // Drag and drop event handler (local only)
  const [calendarEvents, setCalendarEvents] = useState(getDisplayedEvents());
  useEffect(() => {
    setCalendarEvents(getDisplayedEvents());
  }, [username, selectedFriends]);

  const moveEvent = ({ event, start, end }) => {
    setCalendarEvents(prev => prev.map(ev =>
      ev === event ? { ...ev, start, end } : ev
    ));
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
    } else {
      console.log('[Dashboard] No token or username found in localStorage.');
    }
  }, []);

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
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
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
          draggableAccessor={() => true}
          onEventDrop={moveEvent}
        />
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
