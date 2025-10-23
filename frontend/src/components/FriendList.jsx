import React from 'react';

export default function FriendList({ friends, selectedFriends, availability, onSelect }) {
  return (
    <ul className="friends-list">
      {friends.length === 0 && <li style={{ color: '#888' }}>No friends yet.</li>}
      {friends.map(f => (
        <li key={f} className="friend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <input
            type="checkbox"
            checked={selectedFriends.includes(f)}
            onChange={e => {
              onSelect(f, e.target.checked);
            }}
            style={{ accentColor: '#6366f1' }}
          />
          <span>{f}</span>
          <span className={`status-dot ${availability[f] === 'free' ? 'free' : 'busy'}`}></span>
          <span style={{ fontSize: '0.9em', color: '#888' }}>{availability[f] === 'free' ? 'Free' : 'Busy'}</span>
        </li>
      ))}
    </ul>
  );
}
