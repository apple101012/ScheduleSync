import React, { useEffect, useState } from 'react';

export default function Dashboard({ token }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

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
    if (token) fetchUser();
    // fetch events after user is set
    if (user) fetchEvents();
  }, [token, user]);

  if (!token) return <div className="text-red-400">No token provided. Please log in.</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!user) return <div className="text-white">Loading user info...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h2 className="text-2xl font-bold mb-4">Welcome, {user.username}!</h2>
      <h3 className="text-xl font-semibold mb-2">Your Events</h3>
      <ul className="mb-4">
        {events.length === 0 && <li>No events found.</li>}
        {events.map((ev, i) => (
          <li key={i} className="mb-2 p-2 bg-gray-800 rounded">
            <span className="font-bold">{ev.title}</span> <br />
            {ev.start} - {ev.end}
          </li>
        ))}
      </ul>
      <h3 className="text-xl font-semibold mb-2">Your Friends</h3>
      <ul>
        {user.friends && user.friends.length === 0 && <li>No friends yet.</li>}
        {user.friends && user.friends.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
