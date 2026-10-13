require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const DEFAULT_ROOMS = ['general', 'random', 'tech'];

const rooms = {
  general: { messages: [], users: [] },
  random: { messages: [], users: [] },
  tech: { messages: [], users: [] },
};

const userSocketMap = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ username, room }) => {
    if (!DEFAULT_ROOMS.includes(room)) {
      socket.emit('error_message', { message: 'Room does not exist' });
      return;
    }

    const existingSocketId = rooms[room].users.find(
      (u) => u.username === username
    );
    if (existingSocketId && existingSocketId.socketId !== socket.id) {
      socket.emit('error_message', { message: 'Username already taken in this room' });
      return;
    }

    socket.join(room);

    const user = { socketId: socket.id, username, room };
    userSocketMap[socket.id] = user;

    const existingUser = rooms[room].users.find(
      (u) => u.socketId === socket.id
    );
    if (!existingUser) {
      rooms[room].users.push(user);
    }

    socket.emit('receive_message', {
      username: 'System',
      message: `Welcome to #${room}, ${username}!`,
      timestamp: new Date().toISOString(),
      room,
    });

    socket.to(room).emit('user_joined', {
      username,
      message: `${username} has joined the room`,
      timestamp: new Date().toISOString(),
      room,
    });

    io.to(room).emit('room_users', {
      room,
      users: rooms[room].users.map((u) => u.username),
    });

    socket.emit('room_history', {
      room,
      messages: rooms[room].messages,
    });
  });

  socket.on('send_message', ({ room, username, message }) => {
    if (!message.trim()) return;

    const msgData = {
      username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      room,
    };

    rooms[room].messages.push(msgData);
    if (rooms[room].messages.length > 100) {
      rooms[room].messages = rooms[room].messages.slice(-100);
    }

    io.to(room).emit('receive_message', msgData);
  });

  socket.on('typing', ({ room, username, isTyping }) => {
    socket.to(room).emit('typing', { username, isTyping, room });
  });

  socket.on('leave_room', ({ room, username }) => {
    handleLeaveRoom(socket, room, username);
  });

  socket.on('disconnect', () => {
    const user = userSocketMap[socket.id];
    if (user) {
      handleLeaveRoom(socket, user.room, user.username);
      delete userSocketMap[socket.id];
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

function handleLeaveRoom(socket, room, username) {
  socket.leave(room);

  rooms[room].users = rooms[room].users.filter(
    (u) => u.socketId !== socket.id
  );

  io.to(room).emit('user_left', {
    username,
    message: `${username} has left the room`,
    timestamp: new Date().toISOString(),
    room,
  });

  io.to(room).emit('room_users', {
    room,
    users: rooms[room].users.map((u) => u.username),
  });
}

app.get('/api/rooms', (req, res) => {
  res.json({
    rooms: DEFAULT_ROOMS.map((name) => ({
      name,
      userCount: rooms[name].users.length,
      messageCount: rooms[name].messages.length,
    })),
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
