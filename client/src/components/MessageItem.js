import React from 'react';

function MessageItem({ message, isOwn, isSystem }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isSystem) {
    return (
      <div className="message-item system">
        <div className="system-message">
          <span className="system-text">{message.message}</span>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`message-item ${isOwn ? 'own' : ''}`}>
      <div className="message-avatar">
        {message.username.charAt(0).toUpperCase()}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-username">{message.username}</span>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
        <div className="message-text">{message.message}</div>
      </div>
    </div>
  );
}

export default MessageItem;
