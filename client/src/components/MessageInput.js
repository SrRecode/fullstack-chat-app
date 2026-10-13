import React, { useState, useRef, useCallback } from 'react';

function MessageInput({ onSendMessage, onTyping }) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    onSendMessage(message);
    setMessage('');

    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTyping(false);
    }, 2000);
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [message]);

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Type a message..."
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" disabled={!message.trim()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </form>
  );
}

export default MessageInput;
