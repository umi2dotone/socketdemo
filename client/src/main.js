const statusEl = document.getElementById('status');
const reconnectButton = document.getElementById('reconnect');
const messagesList = document.getElementById('messages');
const composerForm = document.getElementById('composer');
const messageInput = document.getElementById('messageInput');
const clientIdEl = document.getElementById('clientId');
const clientCountEl = document.getElementById('clientCount');
const historyCountEl = document.getElementById('historyCount');
const sendButton = composerForm.querySelector('button[type="submit"]');

const socketUrl = import.meta.env.VITE_SOCKET_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:4000/ws`;
const HISTORY_LIMIT = 50;
let socket;
let clientId = null;
let historyCount = 0;
const roster = new Set();

function logMessage(entry, { toTop = true } = {}) {
  const normalized =
    typeof entry === 'string'
      ? { type: entry }
      : { type: entry.type || 'message', payload: entry.payload, meta: entry.meta };

  const li = document.createElement('li');
  li.dataset.origin = deriveOrigin(normalized.meta);

  const typeEl = document.createElement('p');
  typeEl.className = 'message-type';
  typeEl.textContent = normalized.type;
  li.appendChild(typeEl);

  if (typeof normalized.payload !== 'undefined') {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(normalized.payload, null, 2);
    li.appendChild(pre);
  }

  const metaText = formatMeta(normalized.meta);
  if (metaText) {
    const metaEl = document.createElement('p');
    metaEl.className = 'message-meta';
    metaEl.textContent = metaText;
    li.appendChild(metaEl);
  }

  if (toTop) {
    messagesList.prepend(li);
  } else {
    messagesList.appendChild(li);
  }
}

function deriveOrigin(meta = {}) {
  if (!meta.senderId) return 'system';
  return meta.senderId === clientId ? 'self' : 'peer';
}

function formatMeta(meta = {}) {
  const parts = [];
  if (meta.senderId) {
    parts.push(meta.senderId === clientId ? 'you' : `from ${meta.senderId}`);
  }
  if (meta.sentAt) {
    const date = new Date(meta.sentAt);
    if (!Number.isNaN(date.valueOf())) {
      parts.push(date.toLocaleTimeString());
    }
  }
  if (meta.origin) {
    parts.push(`via ${meta.origin}`);
  }
  return parts.join(' • ');
}

function setStatus(text) {
  statusEl.textContent = text;
  statusEl.dataset.state = text;
  const disabled = text !== 'connected';
  messageInput.disabled = disabled;
  sendButton.disabled = disabled;
}

function connect() {
  setStatus('connecting');
  clientId = null;
  clientIdEl.textContent = '—';
  roster.clear();
  updateClientCount();
  messagesList.innerHTML = '';
  historyCount = 0;
  historyCountEl.textContent = '0';
  socket = new WebSocket(socketUrl);

  socket.addEventListener('open', () => {
    setStatus('connected');
  });

  socket.addEventListener('close', () => {
    setStatus('disconnected');
    socket = null;
    clientId = null;
    clientIdEl.textContent = '—';
    roster.clear();
    updateClientCount();
  });

  socket.addEventListener('error', () => {
    setStatus('error');
  });

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleServerMessage(payload);
    } catch (error) {
      logMessage({ type: 'raw', payload: { body: event.data } });
    }
  });
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'server:welcome': {
      const { id } = message.payload || {};
      if (id) {
        clientId = id;
        clientIdEl.textContent = id;
        roster.add(id);
        updateClientCount();
      }
      logMessage(message);
      break;
    }
    case 'server:history': {
      hydrateHistory(message.payload || []);
      break;
    }
    case 'server:clients': {
      primeRoster(message.payload || []);
      break;
    }
    case 'server:joined': {
      const joiningId = message.payload?.id;
      if (joiningId) {
        roster.add(joiningId);
        updateClientCount();
      }
      logMessage(message);
      break;
    }
    case 'server:left': {
      const leavingId = message.payload?.id;
      if (leavingId) {
        roster.delete(leavingId);
        updateClientCount();
      }
      logMessage(message);
      break;
    }
    default: {
      registerHistoryEntry();
      logMessage(message);
    }
  }
}

function hydrateHistory(entries) {
  entries.forEach((entry) => logMessage(entry, { toTop: false }));
  historyCount = entries.length;
  historyCountEl.textContent = historyCount;
}

function primeRoster(ids) {
  roster.clear();
  ids.forEach((id) => roster.add(id));
  if (clientId && !roster.has(clientId)) {
    roster.add(clientId);
  }
  updateClientCount();
}

function updateClientCount() {
  clientCountEl.textContent = roster.size.toString();
}

function registerHistoryEntry() {
  historyCount = Math.min(historyCount + 1, HISTORY_LIMIT);
  historyCountEl.textContent = historyCount;
}

reconnectButton.addEventListener('click', () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close();
  }
  connect();
});

composerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!messageInput.value.trim()) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const payload = {
    type: 'client:message',
    payload: messageInput.value.trim()
  };
  socket?.send(JSON.stringify(payload));
  registerHistoryEntry();
  logMessage({
    type: 'client:message',
    payload: payload.payload,
    meta: { senderId: clientId, sentAt: new Date().toISOString() }
  });
  messageInput.value = '';
});

connect();
