import React, { useEffect, useState } from 'react';

export default function Status({ username }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`http://localhost:8000/availability/${username}`);
        const data = await res.json();
        if (res.ok) setStatus(data.status);
        else setError(data.detail || 'Failed to fetch status');
      } catch {
        setError('Network error');
      }
    }
    if (username) fetchStatus();
  }, [username]);

  if (!username) return null;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!status) return <div className="text-white">Checking status...</div>;
  return (
    <div className="mb-4 p-2 bg-gray-700 rounded">
      <span className="font-bold">Status:</span> {status}
    </div>
  );
}
