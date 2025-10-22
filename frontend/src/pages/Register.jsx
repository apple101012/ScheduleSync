import React, { useState } from 'react';
import '../modern.css';

function Register() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    console.log('Register attempt:', { username, email, password });
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { setError(`Server error ${res.status}`); return; }
      console.log('Register response:', data);
      if (res.ok) {
        setSuccess('Registration successful! You can now log in.');
        setUsername(""); setEmail(""); setPassword("");
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
      console.error('Register error:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">Register</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="auth-btn" type="submit">Register</button>
        </form>
        {error && <div style={{ color: '#ef4444', marginTop: '0.5rem' }}>{error}</div>}
        {success && <div style={{ color: '#22c55e', marginTop: '0.5rem' }}>{success}</div>}
      </div>
    </div>
  );
}

export default Register;
