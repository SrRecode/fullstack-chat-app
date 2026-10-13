# Real-Time Chat App

A full-stack real-time chat application built with React, Express, and Socket.io.

## Features

- Real-time messaging with Socket.io
- Multiple chat rooms (general, random, tech)
- Online user tracking per room
- Typing indicators
- Auto-scroll to latest messages
- Responsive Discord/Slack-inspired UI
- Message timestamps
- In-memory message storage (no database required)

## Quick Start

### 1. Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure environment

```bash
# Server
cp .env.example .env
```

### 3. Run the app

```bash
# Terminal 1 - Start the server
cd server
npm run dev

# Terminal 2 - Start the client
cd client
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
# Build the client
cd client
npm run build

# Start the server (serves client/build)
cd ../server
npm start
```

## Tech Stack

- **Frontend:** React 18, Socket.io-client
- **Backend:** Express, Socket.io
- **Styling:** Custom CSS with CSS variables

## Project Structure

```
fullstack-chat-app/
├── server/
│   ├── package.json
│   ├── .env.example
│   └── index.js
└── client/
    ├── package.json
    ├── public/index.html
    └── src/
        ├── index.js
        ├── App.js
        ├── styles/index.css
        └── components/
            ├── ChatRoom.js
            ├── MessageList.js
            ├── MessageItem.js
            ├── MessageInput.js
            ├── RoomList.js
            └── UserList.js
```
