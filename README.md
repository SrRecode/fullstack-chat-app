# Chatterbox

Chatterbox is a lightweight, real-time chat workspace for small teams and communities. It pairs a responsive React interface with an Express and Socket.IO server. Pick a display name, join a room, and messages and presence updates are delivered instantly to everyone in that room.

## Features

- Live room messaging over WebSockets, with automatic Socket.IO reconnection.
- Room-based conversations and a simple room switcher.
- Search by message text or sender within a room's recent history.
- Online participant list with live join and leave notifications.
- Typing indicators, timestamps, and clear sender identity.
- Recent in-memory room history for people joining an active server (up to 100 messages per room).
- Responsive layout that adapts from a full desktop workspace to a compact mobile chat.
- Accessible labels, keyboard-friendly forms, connection status, and helpful empty/error states.
- No account or database required for local development.

## Requirements

- Node.js 20+ recommended (Node.js 18+ is supported by this dependency set)
- npm 10+

Check your versions with `node --version` and `npm --version`.

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally [http://localhost:5173](http://localhost:5173)). The API and Socket.IO server starts on port 3001. Open another browser window or tab to try a multi-user conversation.

To run the production build locally:

```bash
npm run build
npm start
```

The client build is written to `client/dist`. The API server serves that build when it exists, so the production app is available at [http://localhost:3001](http://localhost:3001).

## Environment variables

Copy `.env.example` to `.env` in the repository root to customize local development. Vite loads the root environment file for the client, and the server reads it regardless of whether its workspace script is started from the repository root.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and Socket.IO server port. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Additional allowed browser origin(s), comma-separated if needed. Same-origin clients are allowed automatically. |
| `VITE_SERVER_URL` | Dev: `http://localhost:3001`; production: current origin | Socket.IO server URL used by the browser client. Set this to the server URL when hosting the client separately. |

Do not put secrets in `VITE_` variables: values with that prefix are included in the browser bundle.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite client and API server together with live reload. |
| `npm run dev:client` | Start only the Vite development server. |
| `npm run dev:server` | Start only the API server in Node watch mode. |
| `npm run build` | Create the optimized client production bundle. |
| `npm start` | Start the API server (and serve `client/dist` if built). |
| `npm test` | Run server unit and Socket.IO integration tests. |

## Architecture

```text
client/  React 19 + Vite 6 interface
   |     HTTP health check and Socket.IO client
   v
server/  Express 4 + Socket.IO server
         In-memory room membership, presence, and recent message history
```

The root npm project uses workspaces for `client` and `server`. The client subscribes to socket events for room history, new messages, participant presence, typing state, and connection errors. The server validates display names, room names, and message lengths before broadcasting. Messages are broadcast to all clients in their room, including the sender, so all views use the same event path.

### Socket events

| Direction | Event | Purpose |
| --- | --- | --- |
| Client → server | `room:join` | Join a room with a display name and receive room history and current participants. |
| Client → server | `message:send` | Submit a text message to the active room. |
| Client → server | `typing:start` / `typing:stop` | Announce or clear the participant's typing state. |
| Server → client | `room:history` | Deliver the latest messages for the room. |
| Server → client | `room:participants` | Deliver the current room participant list. |
| Server → client | `message:new` | Broadcast a validated message to room members. |
| Server → client | `presence:update` | Broadcast a participant joining or leaving. |
| Server → client | `typing:update` | Broadcast typing indicator state. |
| Server → client | `chat:error` | Explain a rejected request in a client-safe way. |

## Project structure

```text
client/
  index.html
  src/
    App.jsx             Chat workspace and socket lifecycle
    main.jsx            React entry point
    styles.css          Responsive interface and design tokens
server/
  src/
    app.js              HTTP routes and Socket.IO handlers
    index.js            Server startup
  test/
    app.test.js         Validation and real socket integration tests
.env.example
package.json
```

## Limitations and production considerations

- Names and rooms are not authenticated. Anyone can join any room; do not use this as a private or secure messaging system.
- Room history and presence live in server memory. Restarting the server clears history, and multiple server instances do not share state. A persistent database and Socket.IO adapter are needed for durable, horizontally scaled deployment.
- Search only covers the most recent 100 messages retained for the active room.
- This starter does not include direct messages, file uploads, message editing/deletion, moderation, or end-to-end encryption.
- Configure HTTPS/WSS, authentication, abuse controls, observability, and a production origin allowlist before exposing the service publicly.

## Development and verification

```bash
npm test
npm run build
```
