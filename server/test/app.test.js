import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { io as createClient } from 'socket.io-client';
import { cleanMessage, cleanName, cleanRoom, createChatServer } from '../src/app.js';

const servers = [];
const clients = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => new Promise((resolve) => {
    if (!client.connected) return resolve();
    client.once('disconnect', resolve);
    client.disconnect();
  })));
  await Promise.all(servers.splice(0).map(({ io }) => new Promise((resolve) => {
    io.close(resolve);
  })));
});

async function startServer() {
  const server = createChatServer({ clientOrigin: 'http://localhost:5173' });
  servers.push(server);
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.httpServer.address().port}`;
}

async function connect(url, origin) {
  const client = createClient(url, {
    transports: ['websocket'],
    forceNew: true,
    ...(origin ? { extraHeaders: { origin } } : {}),
  });
  clients.push(client);
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
  return client;
}

function once(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

describe('input normalization', () => {
  it('cleans and bounds display names, room names, and messages', () => {
    assert.equal(cleanName('  Riley\n  Park  '), 'Riley Park');
    assert.equal(cleanName('x'.repeat(40)).length, 32);
    assert.equal(cleanRoom(' Design Notes! '), 'design-notes');
    assert.equal(cleanRoom('  '), '');
    assert.equal(cleanMessage('  hello there  '), 'hello there');
    assert.equal(cleanMessage('x'.repeat(2100)).length, 2000);
    assert.equal(cleanMessage(null), '');
  });
});

describe('chat socket events', () => {
  it('allows the same origin and rejects an unrelated browser origin', async () => {
    const url = await startServer();
    const sameOrigin = await connect(url, url);
    assert.equal(sameOrigin.connected, true);

    const denied = createClient(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { origin: 'https://untrusted.example' },
      reconnection: false,
    });
    clients.push(denied);
    const failure = await once(denied, 'connect_error');
    assert.ok(failure);
    denied.disconnect();
  });

  it('shares history, messages, and participant updates with room members', async () => {
    const url = await startServer();
    const first = await connect(url);
    const second = await connect(url);

    const firstHistoryPromise = once(first, 'room:history');
    first.emit('room:join', { name: 'Riley', room: 'general' });
    assert.deepEqual(await firstHistoryPromise, []);

    const secondHistoryPromise = once(second, 'room:history');
    const participantsUpdate = once(first, 'room:participants');
    second.emit('room:join', { name: 'Jordan', room: 'general' });
    const secondHistory = await secondHistoryPromise;
    const participants = await participantsUpdate;
    assert.deepEqual(secondHistory, []);
    assert.equal(participants.length, 2);
    assert.deepEqual(participants.map((person) => person.name), ['Riley', 'Jordan']);

    const typingUpdate = once(second, 'typing:update');
    first.emit('typing:start');
    assert.deepEqual(await typingUpdate, { name: 'Riley', isTyping: true });

    const delivered = once(second, 'message:new');
    first.emit('message:send', { text: 'Hello, team!' });
    const message = await delivered;
    assert.equal(message.name, 'Riley');
    assert.equal(message.text, 'Hello, team!');

    const refreshedHistory = once(second, 'room:history');
    const refreshedParticipants = once(second, 'room:participants');
    second.emit('room:join', { name: 'Jordan', room: 'general' });
    assert.deepEqual((await refreshedHistory).map((item) => item.text), ['Hello, team!']);
    await refreshedParticipants;

    const third = await connect(url);
    const lateHistory = once(third, 'room:history');
    const lateParticipants = once(second, 'room:participants');
    third.emit('room:join', { name: 'Casey', room: 'general' });
    assert.deepEqual((await lateHistory).map((item) => item.text), ['Hello, team!']);
    await lateParticipants;

    const joinedHistory = once(first, 'room:history');
    const roomChangeUpdate = once(second, 'room:participants');
    first.emit('room:join', { name: 'Riley', room: 'design' });
    assert.deepEqual(await joinedHistory, []);
    assert.deepEqual((await roomChangeUpdate).map((person) => person.name), ['Jordan', 'Casey']);

    const serverSocket = servers[0].io.sockets.sockets.get(second.id);
    const secondDisconnected = once(serverSocket, 'disconnect');
    second.disconnect();
    await secondDisconnected;
    const thirdServerSocket = servers[0].io.sockets.sockets.get(third.id);
    const thirdDisconnected = once(thirdServerSocket, 'disconnect');
    third.disconnect();
    await thirdDisconnected;
    assert.equal(servers[0].rooms.get('general').members.size, 0);
  });

  it('rejects empty messages and prevents sending before joining', async () => {
    const client = await connect(await startServer());
    const malformedPayloadError = once(client, 'chat:error');
    client.emit('room:join', null);
    assert.match((await malformedPayloadError).message, /valid display name/);

    const error = once(client, 'chat:error');
    client.emit('message:send', { text: 'hello' });
    assert.match((await error).message, /Join a room/);

    const history = once(client, 'room:history');
    client.emit('room:join', { name: 'Riley', room: 'general' });
    await history;
    const emptyError = once(client, 'chat:error');
    client.emit('message:send', { text: '  ' });
    assert.match((await emptyError).message, /cannot be empty/);
  });

  it('keeps room history bounded to the latest 100 messages', async () => {
    const url = await startServer();
    const sender = await connect(url);
    const joined = once(sender, 'room:history');
    sender.emit('room:join', { name: 'Riley', room: 'busy-room' });
    await joined;

    for (let index = 0; index < 101; index += 1) {
      const received = once(sender, 'message:new');
      sender.emit('message:send', { text: `Message ${index}` });
      await received;
    }

    const newcomer = await connect(url);
    const historyPromise = once(newcomer, 'room:history');
    newcomer.emit('room:join', { name: 'Jordan', room: 'busy-room' });
    const history = await historyPromise;
    assert.equal(history.length, 100);
    assert.equal(history[0].text, 'Message 1');
    assert.equal(history.at(-1).text, 'Message 100');
  });
});
