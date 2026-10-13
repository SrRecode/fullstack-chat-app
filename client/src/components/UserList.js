import React from 'react';

function UserList({ users, currentUser }) {
  return (
    <div className="user-list">
      <div className="user-list-header">
        <span>Online — {users.length}</span>
      </div>
      <div className="users">
        {users.map((user) => (
          <div key={user} className={`user-item ${user === currentUser ? 'current' : ''}`}>
            <div className="user-avatar">
              {user.charAt(0).toUpperCase()}
            </div>
            <span className="user-name">
              {user}
              {user === currentUser && <span className="you-badge">you</span>}
            </span>
            <span className="user-status"></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserList;
