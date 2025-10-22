import React, { useState } from 'react';
import '../modern.css';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    console.log('Login attempt:', { username, password });
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      console.log('Login response:', data);
      if (res.ok && data.access_token) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', username);
        window.location.href = '/dashboard';
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">Login</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            placeholder="Username or Email"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="auth-btn" type="submit">Login</button>
        </form>
        {error && <div style={{ color: '#ef4444', marginTop: '0.5rem' }}>{error}</div>}
      </div>
    </div>
  );
}

export default Login;
