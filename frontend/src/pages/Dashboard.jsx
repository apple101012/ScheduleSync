


import React, { useState, useEffect } from 'react';
import EventForm from './EventForm.jsx';
import FriendManager from './FriendManager.jsx';
import Status from './Status.jsx';

export default function Dashboard({ token }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('http://localhost:8000/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setUser(data);
        } else {
          setError(data.detail || 'Failed to fetch user');
        }
      } catch (err) {
        setError('Network error');
      }
    }
    if (token) fetchUser();
  }, [token]);

  useEffect(() => {
    async function fetchEvents() {
      if (!user) return;
      try {
        const res = await fetch(`http://localhost:8000/schedule/${user.username}`);
        const data = await res.json();
        if (res.ok) {
          setEvents(data.events || []);
        } else {
          setError(data.detail || 'Failed to fetch events');
        }
      } catch (err) {
        setError('Network error');
      }
    }
    if (user) fetchEvents();
  }, [user, refresh]);

  const handleDelete = async (event) => {
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/event', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      });
      const data = await res.json();
      if (res.ok) {
        setRefresh(r => r + 1);
      } else {
        setError(data.detail || 'Failed to delete event');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  if (!token) return <div className="text-red-400">No token provided. Please log in.</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!user) return <div className="text-white">Loading user info...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h2 className="text-2xl font-bold mb-4">Welcome, {user.username}!</h2>
      <Status username={user.username} />
      <EventForm token={token} onEventCreated={() => setRefresh(r => r + 1)} />
      <h3 className="text-xl font-semibold mb-2">Your Events</h3>
      <ul className="mb-4">
        {events.length === 0 && <li>No events found.</li>}
        {events.map((ev, i) => (
          <li key={i} className="mb-2 p-2 bg-gray-800 rounded flex justify-between items-center">
            <div>
              <span className="font-bold">{ev.title}</span> <br />
              {ev.start} - {ev.end}
            </div>
            <button className="ml-4 bg-red-600 hover:bg-red-700 p-2 rounded font-bold" onClick={() => handleDelete(ev)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <FriendManager token={token} />
    </div>
  );
}
