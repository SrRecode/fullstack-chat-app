import React from 'react';
import MessageItem from './MessageItem';

function MessageList({ messages, currentUser }) {
  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty-state">
          <p>No messages yet. Start the conversation!</p>
        </div>
      )}
      {messages.map((msg, index) => (
        <MessageItem
          key={index}
          message={msg}
          isOwn={msg.username === currentUser}
          isSystem={msg.username === 'System'}
        />
      ))}
    </div>
  );
}

export default MessageList;
