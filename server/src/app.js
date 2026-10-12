import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

const MAX_NAME_LENGTH = 32;
const MAX_ROOM_LENGTH = 48;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 100;
const DEFAULT_ORIGIN = 'http://localhost:5173';
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function cleanName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
}

export function cleanRoom(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, MAX_ROOM_LENGTH);
}

export function cleanMessage(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_MESSAGE_LENGTH);
}

export function createChatServer({ clientOrigin = process.env.CLIENT_ORIGIN || DEFAULT_ORIGIN, clientDist = resolve(PROJECT_ROOT, 'client/dist') } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const allowedOrigins = (Array.isArray(clientOrigin) ? clientOrigin : clientOrigin.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);
  const io = new Server(httpServer, {
    cors: { origin: true, methods: ['GET', 'POST'] },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      const matchesConfiguredOrigin = !origin || allowedOrigins.includes(origin);
      let matchesRequestHost = false;
      if (origin && !matchesConfiguredOrigin) {
        try {
          matchesRequestHost = new URL(origin).host === request.headers.host;
        } catch {
          matchesRequestHost = false;
        }
      }
      callback(null, matchesConfiguredOrigin || matchesRequestHost);
    },
    maxHttpBufferSize: 1e6,
  });
  const rooms = new Map();

  app.disable('x-powered-by');
  app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'chatterbox' }));

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_request, response, next) => {
      if (_request.path.startsWith('/api/')) return next();
      response.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  const roomFor = (name) => {
    if (!rooms.has(name)) rooms.set(name, { members: new Map(), messages: [] });
    return rooms.get(name);
  };

  io.on('connection', (socket) => {
    socket.on('room:join', (payload = {}) => {
      const { name, room } = payload && typeof payload === 'object' ? payload : {};
      const cleanDisplayName = cleanName(name);
      const cleanRoomName = cleanRoom(room);
      if (!cleanDisplayName || !cleanRoomName) {
        socket.emit('chat:error', { message: 'Enter a valid display name and room to join.' });
        return;
      }
      if (socket.data.room === cleanRoomName) {
        socket.data.name = cleanDisplayName;
        const sameRoom = roomFor(cleanRoomName);
        sameRoom.members.set(socket.id, { id: socket.id, name: cleanDisplayName });
        socket.emit('room:history', sameRoom.messages);
        io.to(cleanRoomName).emit('room:participants', [...sameRoom.members.values()]);
        return;
      }

      if (socket.data.room) leaveRoom(socket, 'left');
      const state = roomFor(cleanRoomName);
      socket.join(cleanRoomName);
      socket.data.room = cleanRoomName;
      socket.data.name = cleanDisplayName;
      const participant = { id: socket.id, name: cleanDisplayName };
      state.members.set(socket.id, participant);
      socket.emit('room:history', state.messages);
      io.to(cleanRoomName).emit('room:participants', [...state.members.values()]);
      io.to(cleanRoomName).emit('presence:update', { type: 'joined', participant });
    });

    socket.on('message:send', (payload = {}) => {
      if (!socket.data.room || !socket.data.name) {
        socket.emit('chat:error', { message: 'Join a room before sending a message.' });
        return;
      }
      const cleanText = cleanMessage(payload && typeof payload === 'object' ? payload.text : undefined);
      if (!cleanText) {
        socket.emit('chat:error', { message: 'Messages cannot be empty.' });
        return;
      }
      const message = {
        id: `${Date.now().toString(36)}-${socket.id.slice(0, 6)}-${Math.random().toString(36).slice(2, 7)}`,
        name: socket.data.name,
        text: cleanText,
        createdAt: new Date().toISOString(),
      };
      const state = roomFor(socket.data.room);
      state.messages.push(message);
      if (state.messages.length > MAX_HISTORY) state.messages.shift();
      io.to(socket.data.room).emit('message:new', message);
    });

    socket.on('typing:start', () => updateTyping(socket, true));
    socket.on('typing:stop', () => updateTyping(socket, false));
    socket.on('disconnect', () => leaveRoom(socket, 'left'));
  });

  function updateTyping(socket, isTyping) {
    if (socket.data.room && socket.data.name) {
      socket.to(socket.data.room).emit('typing:update', { name: socket.data.name, isTyping });
    }
  }

  function leaveRoom(socket, type) {
    const currentRoom = socket.data.room;
    if (!currentRoom) return;
    const state = rooms.get(currentRoom);
    const participant = state?.members.get(socket.id);
    state?.members.delete(socket.id);
    socket.to(currentRoom).emit('typing:update', { name: socket.data.name, isTyping: false });
    socket.leave(currentRoom);
    socket.data.room = undefined;
    if (participant) {
      io.to(currentRoom).emit('room:participants', [...state.members.values()]);
      io.to(currentRoom).emit('presence:update', { type, participant });
    }
    if (state && state.members.size === 0 && state.messages.length === 0) rooms.delete(currentRoom);
  }

  return { app, httpServer, io, rooms };
}
