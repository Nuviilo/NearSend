const { app, BrowserWindow, nativeTheme } = require('electron');
const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

let mainWindow = null;
let httpServer = null;

function createServerAndListen() {
  return new Promise((resolve, reject) => {
    const expressApp = express();
    expressApp.use(express.json({ limit: '1mb' }));

    const server = http.createServer(expressApp);
    const wss = new WebSocketServer({ server, path: '/ws' });

    const peers = new Map();
    const wsToPeerId = new Map();

    function extractClientIp(req) {
      const forwarded = req.headers['x-forwarded-for'];
      let ip = '';
      if (typeof forwarded === 'string' && forwarded.length > 0) {
        ip = forwarded.split(',')[0].trim();
      } else if (Array.isArray(forwarded) && forwarded.length > 0) {
        ip = forwarded[0].split(',')[0].trim();
      } else {
        ip = req.socket.remoteAddress || '127.0.0.1';
      }
      if (ip.startsWith('::ffff:')) ip = ip.slice(7);
      if (ip === '::1') ip = '127.0.0.1';
      return ip;
    }

    function sendJson(ws, payload) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }

    function broadcastPeersFor(targetPeer) {
      const visiblePeers = [];
      for (const candidate of peers.values()) {
        if (candidate.id !== targetPeer.id && candidate.clientIp === targetPeer.clientIp) {
          visiblePeers.push({
            id: candidate.id,
            alias: candidate.alias,
            deviceModel: candidate.deviceModel,
            deviceType: candidate.deviceType,
            os: candidate.os,
            fingerprint: candidate.fingerprint,
            quickSave: candidate.quickSave,
          });
        }
      }
      sendJson(targetPeer.ws, { type: 'peers:update', peers: visiblePeers });
    }

    function broadcastAllRelevantPeers() {
      for (const peer of peers.values()) {
        broadcastPeersFor(peer);
      }
    }

    function encodeBinaryRelayFrame(headerObj, payload) {
      const headerBuf = Buffer.from(JSON.stringify(headerObj), 'utf8');
      const frame = Buffer.allocUnsafe(4 + headerBuf.length + payload.length);
      frame.writeUInt32BE(headerBuf.length, 0);
      headerBuf.copy(frame, 4);
      payload.copy(frame, 4 + headerBuf.length);
      return frame;
    }

    function decodeBinaryFrame(data) {
      if (data.length < 4) return null;
      const headerLen = data.readUInt32BE(0);
      if (headerLen <= 0 || 4 + headerLen > data.length) return null;
      const headerStr = data.subarray(4, 4 + headerLen).toString('utf8');
      const header = JSON.parse(headerStr);
      const payload = data.subarray(4 + headerLen);
      return { header, payload };
    }

    wss.on('connection', (ws, req) => {
      const clientIp = extractClientIp(req);

      ws.on('message', (raw, isBinary) => {
        if (isBinary) {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          try {
            const decoded = decodeBinaryFrame(buf);
            if (!decoded) return;
            const { header, payload } = decoded;
            const senderId = wsToPeerId.get(ws);
            if (!senderId) return;

            if (header.type === 'relay:chunk') {
              const target = peers.get(String(header.targetPeerId || ''));
              if (target && target.ws.readyState === WebSocket.OPEN) {
                const forwardFrame = encodeBinaryRelayFrame(
                  { ...header, senderPeerId: senderId },
                  payload,
                );
                target.ws.send(forwardFrame, { binary: true });
              }
            }
          } catch {
            // ignore malformed binary frame
          }
          return;
        }

        let msg;
        try {
          msg = JSON.parse(raw.toString('utf8'));
        } catch {
          return;
        }

        const type = String(msg.type || '');
        if (type === 'device:register') {
          const id = String(msg.id || '').trim();
          if (!id) return;
          const peer = {
            id,
            ws,
            clientIp,
            alias: String(msg.alias || 'Windows PC').slice(0, 48),
            deviceModel: String(msg.deviceModel || 'Windows').slice(0, 48),
            deviceType:
              msg.deviceType === 'mobile' || msg.deviceType === 'tablet'
                ? msg.deviceType
                : 'desktop',
            os: String(msg.os || 'Windows').slice(0, 24),
            fingerprint: String(msg.fingerprint || '0000').slice(0, 12),
            quickSave:
              msg.quickSave === 'all' || msg.quickSave === 'off' ? msg.quickSave : 'ask',
          };
          peers.set(id, peer);
          wsToPeerId.set(ws, id);
          sendJson(ws, {
            type: 'device:registered',
            id: peer.id,
            clientIpMasked: clientIp.includes('.')
              ? clientIp.split('.').slice(0, 3).join('.') + '.*'
              : 'local',
          });
          broadcastAllRelevantPeers();
          return;
        }

        const senderId = wsToPeerId.get(ws);
        if (!senderId) return;
        const senderPeer = peers.get(senderId);
        if (!senderPeer) return;

        if (type === 'device:discover') {
          broadcastPeersFor(senderPeer);
          return;
        }

        if (type === 'device:update') {
          if (typeof msg.alias === 'string') senderPeer.alias = msg.alias.slice(0, 48);
          if (typeof msg.deviceModel === 'string') {
            senderPeer.deviceModel = msg.deviceModel.slice(0, 48);
          }
          if (
            msg.deviceType === 'mobile' ||
            msg.deviceType === 'tablet' ||
            msg.deviceType === 'desktop'
          ) {
            senderPeer.deviceType = msg.deviceType;
          }
          if (typeof msg.os === 'string') senderPeer.os = msg.os.slice(0, 24);
          if (msg.quickSave === 'all' || msg.quickSave === 'off' || msg.quickSave === 'ask') {
            senderPeer.quickSave = msg.quickSave;
          }
          broadcastAllRelevantPeers();
          return;
        }

        if (
          type === 'transfer:prepare' ||
          type === 'transfer:accept' ||
          type === 'transfer:decline' ||
          type === 'transfer:cancel' ||
          type === 'transfer:complete' ||
          type === 'relay:file_start' ||
          type === 'relay:file_end' ||
          type === 'rtc:offer' ||
          type === 'rtc:answer' ||
          type === 'rtc:ice'
        ) {
          const target = peers.get(String(msg.targetPeerId || ''));
          if (!target) {
            if (type === 'transfer:prepare') {
              sendJson(ws, {
                type: 'transfer:error',
                sessionId: msg.sessionId,
                message: 'Target device is no longer connected.',
              });
            }
            return;
          }

          sendJson(target.ws, {
            ...msg,
            senderPeerId: senderId,
            sender:
              type === 'transfer:prepare'
                ? {
                    id: senderPeer.id,
                    alias: senderPeer.alias,
                    deviceModel: senderPeer.deviceModel,
                    deviceType: senderPeer.deviceType,
                    os: senderPeer.os,
                    fingerprint: senderPeer.fingerprint,
                    quickSave: senderPeer.quickSave,
                  }
                : undefined,
          });
        }
      });

      ws.on('close', () => {
        const peerId = wsToPeerId.get(ws);
        if (peerId) {
          wsToPeerId.delete(ws);
          const current = peers.get(peerId);
          if (current && current.ws === ws) peers.delete(peerId);
          broadcastAllRelevantPeers();
        }
      });
    });

    expressApp.get('/api/health', (_req, res) => {
      res.json({ ok: true, connectedPeers: peers.size });
    });

    expressApp.get('/api/server-info', (_req, res) => {
      const addr = server.address();
      const activePort = typeof addr === 'object' && addr ? addr.port : 3000;
      const interfaces = os.networkInterfaces();
      const lanAddresses = [];
      for (const entries of Object.values(interfaces)) {
        if (!entries) continue;
        for (const info of entries) {
          if (info.family === 'IPv4' && !info.internal) {
            lanAddresses.push(`http://${info.address}:${activePort}`);
          }
        }
      }
      res.json({ port: activePort, lanAddresses });
    });

    const distDir = path.join(__dirname, '..', 'dist');
    expressApp.use(express.static(distDir));
    expressApp.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });

    const onListening = () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3000;
      httpServer = server;
      resolve(port);
    };

    server.once('error', () => {
      server.listen(0, '0.0.0.0', onListening);
    });

    server.listen(3000, '0.0.0.0', onListening);
  });
}

async function createWindow() {
  const port = await createServerAndListen();

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 390,
    minHeight: 620,
    title: 'NearSend',
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#090C10' : '#F6F8FA',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (httpServer) {
    httpServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
