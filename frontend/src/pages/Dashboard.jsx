
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../modern.css';

function Dashboard() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [availability, setAvailability] = useState({});
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    console.log('Dashboard loaded. Token:', storedToken, 'Username:', storedUsername);
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      fetchFriends(storedToken, storedUsername);
    }
  }, []);

  const fetchFriends = async (jwt, user) => {
    try {
      console.log('Fetching user info for:', user);
      const userRes = await axios.get(`${API_BASE}/user/${user}`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      setFriends(userRes.data.friends || []);
      console.log('Friends:', userRes.data.friends);
      const avail = {};
      await Promise.all((userRes.data.friends || []).map(async (f) => {
        try {
          const res = await axios.get(`${API_BASE}/availability/${f}`);
          avail[f] = res.data.status === 'free' ? 'free' : 'busy';
          console.log(`Availability for ${f}:`, res.data.status);
        } catch (err) {
          avail[f] = 'busy';
          console.error(`Error fetching availability for ${f}:`, err);
        }
      }));
      setAvailability(avail);
    } catch (err) {
      setFriends([]);
      setAvailability({});
      console.error('Error fetching friends:', err);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!friendUsername) return;
    try {
      console.log('Adding friend:', friendUsername);
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
      console.error('Add friend error:', err);
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
    console.log('Ask query:', query);
    try {
  const res = await axios.post(`${API_BASE}/ask`, { question: query });
      setAskResult(res.data);
      console.log('Ask response:', res.data);
    } catch (err) {
      setAskError('Could not get results.');
      console.error('Ask error:', err);
    } finally {
      setAskLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard</h1>
      {/* Friends Section */}
      <div className="mb-8">
        <h2 className="section-title">Friends</h2>
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
            <li key={f} className="friend-item">
              <span>{f}</span>
              <span className={`status-dot ${availability[f] === 'free' ? 'free' : 'busy'}`}></span>
              <span style={{ fontSize: '0.9em', color: '#888' }}>{availability[f] === 'free' ? 'Free' : 'Busy'}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Natural Language Query Section */}
      <div className="mb-8">
        <h2 className="section-title">Ask a Question</h2>
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

      {/* Schedule form, table, and other sections will go here */}
    </div>
  );
}

export default Dashboard;
