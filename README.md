# Socket Demo

This repository contains a minimal full-stack WebSocket playground consisting of:

- **server/** – An Express + `ws` WebSocket gateway with a broadcast helper and REST endpoint.
- **client/** – A Vite-powered vanilla JS frontend that connects to the gateway and lets you send messages.

## Getting started

### Requirements

- Node.js 18+
- npm 9+

### Installation

From the repository root, install dependencies for both workspaces:

```bash
cd server && npm install
cd ../client && npm install
```

### Running the stack

1. Start the backend API/WebSocket gateway:

```bash
cd server
npm run dev
```

2. In a separate terminal, start the frontend dev server:

```bash
cd client
npm run dev -- --host
```

The frontend expects the WebSocket server on `ws://localhost:4000/ws`. You can override the URL by creating `client/.env` with `VITE_SOCKET_URL=ws://your-host:port/path`.

### Useful API endpoints

Once the backend is running you can inspect a few helper endpoints:

- `GET /health` – uptime plus a simple connected-clients count.
- `GET /clients` – the ids of currently connected WebSocket peers.
- `GET /messages` – the last 50 broadcast envelopes kept in memory.
- `POST /message` – push a JSON payload (`{ "message": "..." }`) to every live socket subscriber.

### Environment variables

Copy `server/.env.example` to `server/.env` and adjust as needed:

- `PORT` – HTTP and WebSocket port (default `4000`).
- `WS_PATH` – WebSocket path segment (default `/ws`).

### What you get out of the box

- **Server** – Express + `ws` with message history (50 envelopes), a broadcast helper, heartbeat-based cleanup, and REST helpers for health, roster, and message ingestion.
- **Client** – A Vite + vanilla JS dashboard that surfaces connection status, client id, roster counts, and recent history while letting you post structured messages.

### Next steps

This scaffold gives you a shared baseline to build upon. Extend the server with your domain logic (authentication, rooms, persistence, etc.) and enhance the client UI/UX as you define your project requirements.
