import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const PORT = process.env.PORT || 4000;
const WS_PATH = process.env.WS_PATH || '/ws';

const MAX_HISTORY = 50;
const HEARTBEAT_INTERVAL_MS = 30_000;

const app = express();
app.use(cors());
app.use(express.json());

const clients = new Map();
const history = [];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), clients: clients.size });
});

app.get('/clients', (req, res) => {
  res.json({ clients: Array.from(clients.keys()) });
});

app.get('/messages', (req, res) => {
  res.json({ history });
});

app.post('/message', (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  const envelope = {
    type: 'server:message',
    payload: message,
    meta: { sentAt: new Date().toISOString(), origin: 'http' }
  };
  addToHistory(envelope);
  broadcast(envelope);
  res.json({ delivered: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on('connection', (ws) => {
  const id = crypto.randomUUID();
  clients.set(id, ws);
  ws.clientId = id;
  ws.isAlive = true;
  console.log(`Client connected: ${id}`);

  ws.send(
    JSON.stringify({
      type: 'server:welcome',
      payload: { id, message: 'Welcome to SocketDemo', connected: clients.size }
    })
  );
  ws.send(JSON.stringify({ type: 'server:history', payload: history }));
  ws.send(JSON.stringify({ type: 'server:clients', payload: Array.from(clients.keys()) }));
  broadcast({ type: 'server:joined', payload: { id } }, id);

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      handleIncomingMessage(id, parsed);
    } catch (error) {
      console.error('Unable to parse message', error);
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    console.log(`Client disconnected: ${id}`);
    broadcast({ type: 'server:left', payload: { id } });
  });

  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

function handleIncomingMessage(id, message) {
  if (!message || typeof message !== 'object') return;
  const envelope = {
    ...message,
    meta: { senderId: id, sentAt: new Date().toISOString() }
  };
  addToHistory(envelope);
  broadcast(envelope, id);
}

function broadcast(message, excludeId) {
  const serialized = JSON.stringify(message);
  for (const [id, ws] of clients.entries()) {
    if (excludeId && id === excludeId) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function addToHistory(entry) {
  history.push(entry);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

const heartbeatInterval = setInterval(() => {
  for (const [id, ws] of clients.entries()) {
    if (!ws.isAlive) {
      console.log(`Client heartbeat missed, terminating: ${id}`);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`HTTP server listening on http://localhost:${PORT}`);
  console.log(`WebSocket server listening on ws://localhost:${PORT}${WS_PATH}`);
});

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});
