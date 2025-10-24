
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';

function AppRoutes() {
  const [token, setToken] = useState(null);
  const navigate = useNavigate();

  return (
    <>
      <nav className="bg-gray-800 p-4 flex gap-4">
        <Link className="text-white hover:underline" to="/login">Login</Link>
        <Link className="text-white hover:underline" to="/register">Register</Link>
        {token && <Link className="text-white hover:underline" to="/dashboard">Dashboard</Link>}
      </nav>
      <Routes>
        <Route path="/login" element={<Login onLogin={tok => { setToken(tok); navigate('/dashboard'); }} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard token={token} />} />
        <Route path="*" element={<Login onLogin={tok => { setToken(tok); navigate('/dashboard'); }} />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
