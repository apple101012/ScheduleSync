import React, { useEffect, useState } from 'react';

export default function FriendManager({ token }) {
  const [friends, setFriends] = useState([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const res = await fetch('http://localhost:8000/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setFriends(data.friends || []);
        }
      } catch {}
    }
    if (token) fetchFriends();
  }, [token, success]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    try {
      const res = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'changeme', friends: [] }),
      });
      if (res.status === 400) {
        setSuccess('User already exists, adding as friend.');
      } else if (!res.ok) {
        setError('Failed to add user.');
        return;
      }
      // Add friend to current user
      const meRes = await fetch('http://localhost:8000/me', { headers: { Authorization: `Bearer ${token}` } });
      const me = await meRes.json();
      const updateRes = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: me.username, password: 'changeme', friends: [...me.friends, username] }),
      });
      if (updateRes.ok) setSuccess('Friend added!');
      else setError('Failed to add friend.');
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded mb-4">
      <h4 className="font-bold mb-2">Manage Friends</h4>
      <form onSubmit={handleAdd} className="flex gap-2 mb-2">
        <input className="p-2 rounded bg-gray-700 text-white flex-1" type="text" placeholder="Friend's username" value={username} onChange={e => setUsername(e.target.value)} required />
        <button className="bg-green-600 hover:bg-green-700 p-2 rounded font-bold" type="submit">Add Friend</button>
      </form>
      {success && <div className="text-green-400 mb-2">{success}</div>}
      {error && <div className="text-red-400 mb-2">{error}</div>}
      <ul>
        {friends.length === 0 && <li>No friends yet.</li>}
        {friends.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}
