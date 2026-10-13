import React, { useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

function ChatRoom({ room, messages, typingUsers, onSendMessage, onTyping, username }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="room-info">
          <span className="room-hash">#</span>
          <h2>{room}</h2>
        </div>
        <div className="typing-indicator">
          {typingUsers.length > 0 && (
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          )}
        </div>
      </div>
      <MessageList messages={messages} currentUser={username} />
      <div ref={messagesEndRef} />
      <MessageInput onSendMessage={onSendMessage} onTyping={onTyping} />
    </div>
  );
}

export default ChatRoom;
