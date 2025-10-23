import React from 'react';

export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;
  const colors = {
    info: '#6366f1',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e42',
  };
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      background: colors[type] || '#6366f1',
      color: '#fff',
      padding: '0.75rem 1.25rem',
      borderRadius: 8,
      boxShadow: '0 2px 8px #000a',
      zIndex: 100,
      fontWeight: 600,
      fontSize: '1rem',
      minWidth: 180,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75em',
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1.1em', cursor: 'pointer' }}>×</button>
    </div>
  );
}
