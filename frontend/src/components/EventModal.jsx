import React, { useState, useEffect } from 'react';

export default function EventModal({ open, onClose, onSave, initial }) {
  // initial: { _id?, title, start: Date, end: Date }
  const [title, setTitle] = useState(initial?.title || '');
  const [start, setStart] = useState(initial?.start ? toLocalInput(initial.start) : toLocalInput(new Date()));
  const [end, setEnd] = useState(initial?.end ? toLocalInput(initial.end) : toLocalInput(new Date(Date.now() + 3600 * 1000)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(initial?.title || '');
    setStart(initial?.start ? toLocalInput(initial.start) : toLocalInput(new Date()));
    setEnd(initial?.end ? toLocalInput(initial.end) : toLocalInput(new Date(Date.now() + 3600 * 1000)));
    setError('');
  }, [initial, open]);

  function toLocalInput(date) {
    const d = new Date(date);
    // return string suitable for input[type=datetime-local]
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function fromLocalInput(v) {
    return new Date(v);
  }

  const handleSave = async () => {
    setError('');
    const s = fromLocalInput(start);
    const e = fromLocalInput(end);
    if (!title || title.trim().length === 0) {
      setError('Title required');
      return;
    }
    if (s >= e) {
      setError('Start must be before end');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...initial, title: title.trim(), start: s, end: e });
      onClose();
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: '#111', padding: '1rem', borderRadius: 8, width: 420, color: '#eee' }}>
        <h3 style={{ marginTop: 0 }}>{initial && initial._id ? 'Edit Event' : 'Create Event'}</h3>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#0b0b0b', color: '#eee' }} />
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Start</label>
          <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#0b0b0b', color: '#eee' }} />
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>End</label>
          <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#0b0b0b', color: '#eee' }} />
        </div>
        {error && <div style={{ color: '#f87171', marginBottom: '0.5rem' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: '#222', color: '#ddd', border: '1px solid #333' }} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none' }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
