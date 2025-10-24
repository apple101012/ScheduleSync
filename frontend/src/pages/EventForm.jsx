import React, { useState } from 'react';

export default function EventForm({ token, onEventCreated }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title, start, end }),
      });
      const data = await res.json();
      if (res.ok) {
        setTitle(''); setStart(''); setEnd('');
        if (onEventCreated) onEventCreated();
      } else {
        setError(data.detail || 'Failed to create event');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 bg-gray-800 p-4 rounded">
      <h4 className="font-bold mb-2">Add Event</h4>
      <input className="w-full p-2 mb-2 rounded bg-gray-700 text-white" type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
      <input className="w-full p-2 mb-2 rounded bg-gray-700 text-white" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required />
      <input className="w-full p-2 mb-2 rounded bg-gray-700 text-white" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required />
      <button className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold" type="submit">Create Event</button>
      {error && <div className="mt-2 text-red-400">{error}</div>}
    </form>
  );
}
