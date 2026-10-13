import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ChatRoom from './components/ChatRoom';
import RoomList from './components/RoomList';
import UserList from './components/UserList';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState([
    { name: 'general', userCount: 0 },
    { name: 'random', userCount: 0 },
    { name: 'tech', userCount: 0 },
  ]);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const typingTimeoutRef = useRef({});

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    newSocket.on('room_history', ({ room, messages: history }) => {
      if (room === currentRoom) {
        setMessages(history);
      }
    });

    newSocket.on('room_users', ({ room, users: roomUsers }) => {
      if (room === currentRoom) {
        setUsers(roomUsers);
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.name === room ? { ...r, userCount: roomUsers.length } : r
        )
      );
    });

    newSocket.on('user_joined', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    newSocket.on('user_left', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    newSocket.on('typing', ({ username: typingUser, isTyping, room }) => {
      if (room !== currentRoom) return;
      if (isTyping) {
        setTypingUsers((prev) =>
          prev.includes(typingUser) ? prev : [...prev, typingUser]
        );
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== typingUser));
      }
    });

    newSocket.on('error_message', (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      newSocket.close();
    };
  }, [currentRoom]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    if (socket) {
      socket.emit('join_room', { username: username.trim(), room: currentRoom });
      setIsJoined(true);
    }
  };

  const handleSwitchRoom = (roomName) => {
    if (roomName === currentRoom) return;

    if (socket && username) {
      socket.emit('leave_room', { room: currentRoom, username });
    }
    setCurrentRoom(roomName);
    setMessages([]);
    setTypingUsers([]);

    if (socket && username) {
      setTimeout(() => {
        socket.emit('join_room', { username, room: roomName });
      }, 100);
    }
  };

  const handleSendMessage = (message) => {
    if (socket && message.trim()) {
      socket.emit('send_message', {
        room: currentRoom,
        username,
        message,
      });
    }
  };

  const handleTyping = (isTyping) => {
    if (socket) {
      socket.emit('typing', { room: currentRoom, username, isTyping });
    }
  };

  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <div className="join-header">
            <div className="join-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h1>Join Chat</h1>
            <p>Enter your username to start chatting</p>
          </div>
          <form onSubmit={handleJoin} className="join-form">
            <input
              type="text"
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button type="submit" disabled={!username.trim()}>
              Join
            </button>
          </form>
          {error && <div className="error-message">{error}</div>}
          <div className="join-rooms">
            <span>Available rooms:</span>
            <div className="room-tags">
              {rooms.map((room) => (
                <span key={room.name} className="room-tag">
                  #{room.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <span>Chat App</span>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
          </div>
        </div>
        <RoomList
          rooms={rooms}
          currentRoom={currentRoom}
          onSwitchRoom={handleSwitchRoom}
        />
        <UserList users={users} currentUser={username} />
      </aside>
      <main className="chat-main">
        <ChatRoom
          room={currentRoom}
          messages={messages}
          users={users}
          typingUsers={typingUsers}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          username={username}
        />
      </main>
    </div>
  );
}

export default App;
