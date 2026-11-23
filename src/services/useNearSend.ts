import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActiveTransfer,
  AppSettings,
  IncomingTransferPrompt,
  PeerDevice,
  QueuedItem,
  QuickSaveMode,
  ReceivedFileRecord,
  ReceivedTextRecord,
  TransferFileMeta,
  TransferHistoryItem,
  TransferTransport,
} from '../types';
import {
  computeBlobSha256,
  computeSha256,
  decodeBinaryFrame,
  detectPlatform,
  encodeBinaryFrame,
  generateFingerprint,
  generateId,
  generateRandomAlias,
} from '../utils/device';

const CHUNK_SIZE = 64 * 1024; // 64 KB
const SETTINGS_KEY = 'nearsend_settings_v1';
const PEER_ID_KEY = 'nearsend_peer_id_v1';
const FINGERPRINT_KEY = 'nearsend_fingerprint_v1';
const HISTORY_KEY = 'nearsend_history_v1';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function loadInitialPeerId(): string {
  const existing = localStorage.getItem(PEER_ID_KEY);
  if (existing) return existing;
  const created = generateId();
  localStorage.setItem(PEER_ID_KEY, created);
  return created;
}

function loadInitialFingerprint(): string {
  const existing = localStorage.getItem(FINGERPRINT_KEY);
  if (existing) return existing;
  const created = generateFingerprint();
  localStorage.setItem(FINGERPRINT_KEY, created);
  return created;
}

declare global {
  interface Window {
    AndroidBridge?: {
      setDarkTheme?: (isDark: boolean) => void;
      saveBase64File?: (base64Data: string, fileName: string, mimeType: string) => void;
    };
  }
}

const DEFAULT_APK_SERVER_URL =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' ||
    window.location.hostname === 'appassets.androidplatform.net')
    ? 'https://ais-pre-xd4eas2qjjvq427o4n6ybq-711147849365.asia-east1.run.app'
    : '';

function loadInitialSettings(): AppSettings {
  const detected = detectPlatform();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        alias: parsed.alias || generateRandomAlias(),
        deviceType: parsed.deviceType || detected.deviceType,
        os: parsed.os || detected.os,
        deviceModel: parsed.deviceModel || detected.deviceModel,
        theme: parsed.theme || 'system',
        quickSave: parsed.quickSave || 'ask',
        preferWebRTC: parsed.preferWebRTC ?? true,
        verifyChecksums: parsed.verifyChecksums ?? true,
        serverUrl: parsed.serverUrl ?? DEFAULT_APK_SERVER_URL,
      };
    }
  } catch {
    // ignore corrupted storage
  }
  const defaults: AppSettings = {
    alias: generateRandomAlias(),
    deviceType: detected.deviceType,
    os: detected.os,
    deviceModel: detected.deviceModel,
    theme: 'system',
    quickSave: 'ask',
    preferWebRTC: true,
    verifyChecksums: true,
    serverUrl: DEFAULT_APK_SERVER_URL,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults));
  return defaults;
}

function loadInitialHistory(): TransferHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw) as TransferHistoryItem[];
    }
  } catch {
    // ignore
  }
  return [];
}

interface OutgoingSessionContext {
  sessionId: string;
  targetPeer: PeerDevice;
  items: QueuedItem[];
  filesMeta: TransferFileMeta[];
  textPayload?: string;
  cancelled: boolean;
  pc?: RTCPeerConnection;
  dc?: RTCDataChannel;
  transport: TransferTransport;
}

interface IncomingSessionContext {
  sessionId: string;
  sender: PeerDevice;
  filesMeta: TransferFileMeta[];
  textPayload?: string;
  totalBytes: number;
  receivedBytes: number;
  startedAt: number;
  lastSpeedCheckAt: number;
  lastSpeedBytes: number;
  currentFileIndex: number;
  currentFileMeta?: TransferFileMeta;
  currentChunks: Uint8Array[];
  pc?: RTCPeerConnection;
  transport: TransferTransport;
  cancelled: boolean;
}

export function useNearSend() {
  const [peerId] = useState<string>(loadInitialPeerId);
  const [fingerprint] = useState<string>(loadInitialFingerprint);
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [networkMask, setNetworkMask] = useState<string>('local');
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<ActiveTransfer[]>([]);
  const [incomingPrompt, setIncomingPrompt] = useState<IncomingTransferPrompt | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFileRecord[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<ReceivedTextRecord[]>([]);
  const [history, setHistory] = useState<TransferHistoryItem[]>(loadInitialHistory);

  const wsRef = useRef<WebSocket | null>(null);
  const settingsRef = useRef<AppSettings>(settings);
  const outgoingSessionsRef = useRef<Map<string, OutgoingSessionContext>>(new Map());
  const incomingSessionsRef = useRef<Map<string, IncomingSessionContext>>(new Map());
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef<number>(0);

  settingsRef.current = settings;

  const appendHistory = useCallback((entry: TransferHistoryItem) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 100);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'device:update',
            alias: next.alias,
            deviceModel: next.deviceModel,
            deviceType: next.deviceType,
            os: next.os,
            quickSave: next.quickSave,
          }),
        );
      }
      return next;
    });
  }, []);

  const sendWsJson = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const rescanPeers = useCallback(() => {
    sendWsJson({ type: 'device:discover' });
  }, [sendWsJson]);

  const updateActiveTransfer = useCallback(
    (sessionId: string, updater: (prev: ActiveTransfer) => ActiveTransfer) => {
      setActiveTransfers((prev) =>
        prev.map((item) => (item.sessionId === sessionId ? updater(item) : item)),
      );
    },
    [],
  );

  const dismissTransfer = useCallback((sessionId: string) => {
    setActiveTransfers((prev) => prev.filter((item) => item.sessionId !== sessionId));
  }, []);

  const triggerDownload = useCallback((blobUrl: string, fileName: string) => {
    if (window.AndroidBridge?.saveBase64File) {
      fetch(blobUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            if (base64) {
              window.AndroidBridge?.saveBase64File?.(
                base64,
                fileName,
                blob.type || 'application/octet-stream',
              );
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
      return;
    }

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 250);
  }, []);

  const finalizeIncomingFile = useCallback(
    async (ctx: IncomingSessionContext) => {
      const meta = ctx.currentFileMeta;
      if (!meta) return;

      const blob = new Blob(ctx.currentChunks as BlobPart[], {
        type: meta.mimeType || 'application/octet-stream',
      });
      ctx.currentChunks = [];

      let verifiedChecksum: boolean | undefined = undefined;
      if (meta.sha256 && settingsRef.current.verifyChecksums) {
        const computed = await computeBlobSha256(blob);
        if (computed) {
          verifiedChecksum = computed === meta.sha256;
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const record: ReceivedFileRecord = {
        id: meta.id,
        sessionId: ctx.sessionId,
        fileName: meta.fileName,
        size: meta.size,
        mimeType: meta.mimeType,
        blobUrl,
        senderAlias: ctx.sender.alias,
        verifiedChecksum,
        receivedAt: Date.now(),
      };

      setReceivedFiles((prev) => [record, ...prev]);

      if (ctx.filesMeta.length <= 3) {
        triggerDownload(blobUrl, meta.fileName);
      }
    },
    [triggerDownload],
  );

  const finalizeIncomingSession = useCallback(
    (ctx: IncomingSessionContext) => {
      updateActiveTransfer(ctx.sessionId, (t) => ({
        ...t,
        status: 'completed',
        bytesTransferred: ctx.totalBytes,
        speedBps: 0,
        completedAt: Date.now(),
      }));

      const summaryName =
        ctx.filesMeta.length > 0
          ? ctx.filesMeta.length === 1
            ? ctx.filesMeta[0].fileName
            : `${ctx.filesMeta[0].fileName} + ${ctx.filesMeta.length - 1} more`
          : ctx.textPayload
            ? 'Text snippet'
            : 'Transfer';

      appendHistory({
        id: generateId(),
        sessionId: ctx.sessionId,
        direction: 'receive',
        peerAlias: ctx.sender.alias,
        peerOs: ctx.sender.os,
        fileCount: ctx.filesMeta.length,
        summaryName,
        totalBytes: ctx.totalBytes,
        transport: ctx.transport,
        status: 'completed',
        textPayload: ctx.textPayload,
        timestamp: Date.now(),
      });

      if (ctx.pc) {
        ctx.pc.close();
      }
      incomingSessionsRef.current.delete(ctx.sessionId);
    },
    [appendHistory, updateActiveTransfer],
  );

  const handleIncomingBinaryChunk = useCallback(
    (sessionId: string, chunk: Uint8Array) => {
      const ctx = incomingSessionsRef.current.get(sessionId);
      if (!ctx || ctx.cancelled) return;

      ctx.currentChunks.push(chunk);
      ctx.receivedBytes += chunk.byteLength;

      const now = performance.now();
      const dt = (now - ctx.lastSpeedCheckAt) / 1000;
      let speedBps = 0;
      if (dt >= 0.25) {
        speedBps = (ctx.receivedBytes - ctx.lastSpeedBytes) / dt;
        ctx.lastSpeedCheckAt = now;
        ctx.lastSpeedBytes = ctx.receivedBytes;
      }

      updateActiveTransfer(sessionId, (t) => ({
        ...t,
        status: 'transferring',
        transport: ctx.transport,
        bytesTransferred: Math.min(ctx.receivedBytes, ctx.totalBytes),
        speedBps: speedBps > 0 ? speedBps : t.speedBps,
        currentFileIndex: ctx.currentFileIndex,
        currentFileName: ctx.currentFileMeta?.fileName || t.currentFileName,
      }));
    },
    [updateActiveTransfer],
  );

  const setupReceiverPeerConnection = useCallback(
    (ctx: IncomingSessionContext) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      ctx.pc = pc;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWsJson({
            type: 'rtc:ice',
            targetPeerId: ctx.sender.id,
            sessionId: ctx.sessionId,
            candidate: ev.candidate,
          });
        }
      };

      pc.ondatachannel = (ev) => {
        const channel = ev.channel;
        channel.binaryType = 'arraybuffer';
        ctx.transport = 'webrtc';

        channel.onmessage = async (msgEv) => {
          if (ctx.cancelled) return;
          if (typeof msgEv.data === 'string') {
            const ctrl = JSON.parse(msgEv.data) as Record<string, unknown>;
            if (ctrl.type === 'file-start') {
              const fileId = String(ctrl.fileId || '');
              const idx = ctx.filesMeta.findIndex((f) => f.id === fileId);
              ctx.currentFileIndex = idx >= 0 ? idx : ctx.currentFileIndex;
              ctx.currentFileMeta = ctx.filesMeta[ctx.currentFileIndex];
              ctx.currentChunks = [];
              updateActiveTransfer(ctx.sessionId, (t) => ({
                ...t,
                status: 'transferring',
                transport: 'webrtc',
                currentFileIndex: ctx.currentFileIndex,
                currentFileName: ctx.currentFileMeta?.fileName || '',
              }));
            } else if (ctrl.type === 'file-end') {
              await finalizeIncomingFile(ctx);
            } else if (ctrl.type === 'session-complete') {
              finalizeIncomingSession(ctx);
            }
          } else if (msgEv.data instanceof ArrayBuffer) {
            handleIncomingBinaryChunk(ctx.sessionId, new Uint8Array(msgEv.data));
          }
        };
      };

      return pc;
    },
    [
      finalizeIncomingFile,
      finalizeIncomingSession,
      handleIncomingBinaryChunk,
      sendWsJson,
      updateActiveTransfer,
    ],
  );

  const acceptIncomingTransfer = useCallback(
    (prompt: IncomingTransferPrompt) => {
      const ctx: IncomingSessionContext = {
        sessionId: prompt.sessionId,
        sender: prompt.sender,
        filesMeta: prompt.files,
        textPayload: prompt.textPayload,
        totalBytes: prompt.totalBytes,
        receivedBytes: 0,
        startedAt: Date.now(),
        lastSpeedCheckAt: performance.now(),
        lastSpeedBytes: 0,
        currentFileIndex: 0,
        currentChunks: [],
        transport: settingsRef.current.preferWebRTC ? 'webrtc' : 'relay',
        cancelled: false,
      };
      incomingSessionsRef.current.set(prompt.sessionId, ctx);
      setIncomingPrompt((curr) => (curr?.sessionId === prompt.sessionId ? null : curr));

      if (prompt.files.length === 0 && prompt.textPayload) {
        setReceivedTexts((prev) => [
          {
            id: generateId(),
            sessionId: prompt.sessionId,
            text: prompt.textPayload!,
            senderAlias: prompt.sender.alias,
            receivedAt: Date.now(),
          },
          ...prev,
        ]);
        sendWsJson({
          type: 'transfer:accept',
          targetPeerId: prompt.sender.id,
          sessionId: prompt.sessionId,
        });
        appendHistory({
          id: generateId(),
          sessionId: prompt.sessionId,
          direction: 'receive',
          peerAlias: prompt.sender.alias,
          peerOs: prompt.sender.os,
          fileCount: 0,
          summaryName: 'Text message',
          totalBytes: prompt.textPayload.length,
          transport: 'relay',
          status: 'completed',
          textPayload: prompt.textPayload,
          timestamp: Date.now(),
        });
        incomingSessionsRef.current.delete(prompt.sessionId);
        return;
      }

      setActiveTransfers((prev) => [
        {
          sessionId: prompt.sessionId,
          direction: 'receive',
          peerId: prompt.sender.id,
          peerAlias: prompt.sender.alias,
          peerOs: prompt.sender.os,
          files: prompt.files,
          textPayload: prompt.textPayload,
          status: 'connecting',
          transport: ctx.transport,
          bytesTransferred: 0,
          totalBytes: prompt.totalBytes,
          speedBps: 0,
          currentFileIndex: 0,
          currentFileName: prompt.files[0]?.fileName || '',
          startedAt: Date.now(),
        },
        ...prev,
      ]);

      if (settingsRef.current.preferWebRTC) {
        setupReceiverPeerConnection(ctx);
      }

      sendWsJson({
        type: 'transfer:accept',
        targetPeerId: prompt.sender.id,
        sessionId: prompt.sessionId,
      });
    },
    [appendHistory, sendWsJson, setupReceiverPeerConnection],
  );

  const declineIncomingTransfer = useCallback(
    (prompt: IncomingTransferPrompt) => {
      setIncomingPrompt((curr) => (curr?.sessionId === prompt.sessionId ? null : curr));
      sendWsJson({
        type: 'transfer:decline',
        targetPeerId: prompt.sender.id,
        sessionId: prompt.sessionId,
      });
      appendHistory({
        id: generateId(),
        sessionId: prompt.sessionId,
        direction: 'receive',
        peerAlias: prompt.sender.alias,
        peerOs: prompt.sender.os,
        fileCount: prompt.files.length,
        summaryName:
          prompt.files.length > 0 ? prompt.files[0].fileName : 'Text message',
        totalBytes: prompt.totalBytes,
        transport: 'webrtc',
        status: 'declined',
        timestamp: Date.now(),
      });
    },
    [appendHistory, sendWsJson],
  );

  const streamOutgoingFiles = useCallback(
    async (ctx: OutgoingSessionContext) => {
      const fileItems = ctx.items.filter((i) => i.kind === 'file' && i.file);
      const totalBytes = fileItems.reduce((sum, item) => sum + item.size, 0);
      let sentBytes = 0;
      let lastSpeedTime = performance.now();
      let lastSpeedBytes = 0;

      const waitForDrain = (dc: RTCDataChannel) =>
        new Promise<void>((resolve) => {
          if (dc.bufferedAmount <= 262144) {
            resolve();
            return;
          }
          dc.bufferedAmountLowThreshold = 65536;
          const onLow = () => {
            dc.removeEventListener('bufferedamountlow', onLow);
            resolve();
          };
          dc.addEventListener('bufferedamountlow', onLow);
          setTimeout(() => {
            dc.removeEventListener('bufferedamountlow', onLow);
            resolve();
          }, 120);
        });

      const waitForWsDrain = () =>
        new Promise<void>((resolve) => {
          const ws = wsRef.current;
          if (!ws || ws.bufferedAmount <= 512 * 1024) {
            resolve();
            return;
          }
          setTimeout(resolve, 25);
        });

      for (let idx = 0; idx < fileItems.length; idx++) {
        if (ctx.cancelled) break;
        const item = fileItems[idx];
        const file = item.file!;

        updateActiveTransfer(ctx.sessionId, (t) => ({
          ...t,
          status: 'transferring',
          transport: ctx.transport,
          currentFileIndex: idx,
          currentFileName: file.name,
        }));

        if (ctx.transport === 'webrtc' && ctx.dc && ctx.dc.readyState === 'open') {
          ctx.dc.send(JSON.stringify({ type: 'file-start', fileId: item.id }));
        } else {
          ctx.transport = 'relay';
          sendWsJson({
            type: 'relay:file_start',
            targetPeerId: ctx.targetPeer.id,
            sessionId: ctx.sessionId,
            fileId: item.id,
          });
        }

        let offset = 0;
        while (offset < file.size) {
          if (ctx.cancelled) break;
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();

          if (ctx.transport === 'webrtc' && ctx.dc && ctx.dc.readyState === 'open') {
            await waitForDrain(ctx.dc);
            if (ctx.cancelled) break;
            ctx.dc.send(buffer);
          } else {
            ctx.transport = 'relay';
            await waitForWsDrain();
            if (ctx.cancelled) break;
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              const frame = encodeBinaryFrame(
                {
                  type: 'relay:chunk',
                  targetPeerId: ctx.targetPeer.id,
                  sessionId: ctx.sessionId,
                  fileId: item.id,
                },
                buffer,
              );
              ws.send(frame);
            } else {
              throw new Error('Connection lost during transfer.');
            }
          }

          offset += buffer.byteLength;
          sentBytes += buffer.byteLength;

          const now = performance.now();
          const dt = (now - lastSpeedTime) / 1000;
          let speedBps = 0;
          if (dt >= 0.2) {
            speedBps = (sentBytes - lastSpeedBytes) / dt;
            lastSpeedTime = now;
            lastSpeedBytes = sentBytes;
          }

          updateActiveTransfer(ctx.sessionId, (t) => ({
            ...t,
            status: 'transferring',
            transport: ctx.transport,
            bytesTransferred: sentBytes,
            speedBps: speedBps > 0 ? speedBps : t.speedBps,
          }));
        }

        if (ctx.cancelled) break;

        if (ctx.transport === 'webrtc' && ctx.dc && ctx.dc.readyState === 'open') {
          ctx.dc.send(JSON.stringify({ type: 'file-end', fileId: item.id }));
        } else {
          sendWsJson({
            type: 'relay:file_end',
            targetPeerId: ctx.targetPeer.id,
            sessionId: ctx.sessionId,
            fileId: item.id,
          });
        }
      }

      if (ctx.cancelled) return;

      if (ctx.transport === 'webrtc' && ctx.dc && ctx.dc.readyState === 'open') {
        await waitForDrain(ctx.dc);
        ctx.dc.send(JSON.stringify({ type: 'session-complete' }));
      } else {
        sendWsJson({
          type: 'transfer:complete',
          targetPeerId: ctx.targetPeer.id,
          sessionId: ctx.sessionId,
        });
      }

      updateActiveTransfer(ctx.sessionId, (t) => ({
        ...t,
        status: 'completed',
        bytesTransferred: totalBytes,
        speedBps: 0,
        completedAt: Date.now(),
      }));

      const summaryName =
        fileItems.length === 1
          ? fileItems[0].fileName
          : `${fileItems[0].fileName} + ${fileItems.length - 1} more`;

      appendHistory({
        id: generateId(),
        sessionId: ctx.sessionId,
        direction: 'send',
        peerAlias: ctx.targetPeer.alias,
        peerOs: ctx.targetPeer.os,
        fileCount: fileItems.length,
        summaryName,
        totalBytes,
        transport: ctx.transport,
        status: 'completed',
        timestamp: Date.now(),
      });

      setTimeout(() => {
        ctx.pc?.close();
        outgoingSessionsRef.current.delete(ctx.sessionId);
      }, 1500);
    },
    [appendHistory, sendWsJson, updateActiveTransfer],
  );

  const beginOutgoingTransport = useCallback(
    async (ctx: OutgoingSessionContext) => {
      const fileItems = ctx.items.filter((i) => i.kind === 'file' && i.file);
      if (fileItems.length === 0) {
        updateActiveTransfer(ctx.sessionId, (t) => ({
          ...t,
          status: 'completed',
          completedAt: Date.now(),
        }));
        appendHistory({
          id: generateId(),
          sessionId: ctx.sessionId,
          direction: 'send',
          peerAlias: ctx.targetPeer.alias,
          peerOs: ctx.targetPeer.os,
          fileCount: 0,
          summaryName: 'Text message',
          totalBytes: ctx.textPayload?.length || 0,
          transport: 'relay',
          status: 'completed',
          textPayload: ctx.textPayload,
          timestamp: Date.now(),
        });
        outgoingSessionsRef.current.delete(ctx.sessionId);
        return;
      }

      if (!settingsRef.current.preferWebRTC) {
        ctx.transport = 'relay';
        await streamOutgoingFiles(ctx);
        return;
      }

      updateActiveTransfer(ctx.sessionId, (t) => ({
        ...t,
        status: 'connecting',
        transport: 'webrtc',
      }));

      const pc = new RTCPeerConnection(RTC_CONFIG);
      ctx.pc = pc;
      const dc = pc.createDataChannel('localsend-data', { ordered: true });
      dc.binaryType = 'arraybuffer';
      ctx.dc = dc;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWsJson({
            type: 'rtc:ice',
            targetPeerId: ctx.targetPeer.id,
            sessionId: ctx.sessionId,
            candidate: ev.candidate,
          });
        }
      };

      let started = false;
      const fallbackTimer = window.setTimeout(() => {
        if (!started && !ctx.cancelled) {
          started = true;
          ctx.transport = 'relay';
          pc.close();
          ctx.pc = undefined;
          ctx.dc = undefined;
          streamOutgoingFiles(ctx).catch((err) => {
            updateActiveTransfer(ctx.sessionId, (t) => ({
              ...t,
              status: 'error',
              errorMessage: err instanceof Error ? err.message : 'Transfer failed.',
            }));
          });
        }
      }, 3500);

      dc.onopen = () => {
        if (!started && !ctx.cancelled) {
          started = true;
          window.clearTimeout(fallbackTimer);
          ctx.transport = 'webrtc';
          streamOutgoingFiles(ctx).catch((err) => {
            updateActiveTransfer(ctx.sessionId, (t) => ({
              ...t,
              status: 'error',
              errorMessage: err instanceof Error ? err.message : 'Transfer failed.',
            }));
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWsJson({
          type: 'rtc:offer',
          targetPeerId: ctx.targetPeer.id,
          sessionId: ctx.sessionId,
          offer,
        });
      } catch {
        if (!started && !ctx.cancelled) {
          started = true;
          window.clearTimeout(fallbackTimer);
          ctx.transport = 'relay';
          streamOutgoingFiles(ctx).catch(() => {});
        }
      }
    },
    [appendHistory, sendWsJson, streamOutgoingFiles, updateActiveTransfer],
  );

  const sendToPeer = useCallback(
    async (targetPeer: PeerDevice, items: QueuedItem[]) => {
      if (items.length === 0) return;
      const sessionId = generateId();
      const fileItems = items.filter((i) => i.kind === 'file' && i.file);
      const textItems = items.filter((i) => i.kind === 'text' && i.textContent);
      const textPayload =
        textItems.length > 0
          ? textItems.map((t) => t.textContent).join('\n\n')
          : undefined;
      const totalBytes = fileItems.reduce((sum, f) => sum + f.size, 0);

      setActiveTransfers((prev) => [
        {
          sessionId,
          direction: 'send',
          peerId: targetPeer.id,
          peerAlias: targetPeer.alias,
          peerOs: targetPeer.os,
          files: fileItems.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            size: f.size,
            mimeType: f.mimeType,
          })),
          textPayload,
          status: 'preparing',
          transport: settingsRef.current.preferWebRTC ? 'webrtc' : 'relay',
          bytesTransferred: 0,
          totalBytes,
          speedBps: 0,
          currentFileIndex: 0,
          currentFileName: fileItems[0]?.fileName || 'Text message',
          startedAt: Date.now(),
        },
        ...prev,
      ]);

      const filesMeta: TransferFileMeta[] = await Promise.all(
        fileItems.map(async (f) => ({
          id: f.id,
          fileName: f.fileName,
          size: f.size,
          mimeType: f.mimeType,
          sha256:
            settingsRef.current.verifyChecksums && f.file
              ? await computeSha256(f.file)
              : undefined,
        })),
      );

      const ctx: OutgoingSessionContext = {
        sessionId,
        targetPeer,
        items,
        filesMeta,
        textPayload,
        cancelled: false,
        transport: settingsRef.current.preferWebRTC ? 'webrtc' : 'relay',
      };
      outgoingSessionsRef.current.set(sessionId, ctx);

      updateActiveTransfer(sessionId, (t) => ({
        ...t,
        files: filesMeta,
        status: 'awaiting_acceptance',
      }));

      sendWsJson({
        type: 'transfer:prepare',
        targetPeerId: targetPeer.id,
        sessionId,
        files: filesMeta,
        textPayload,
        totalBytes,
      });
    },
    [sendWsJson, updateActiveTransfer],
  );

  const cancelTransfer = useCallback(
    (sessionId: string) => {
      const outCtx = outgoingSessionsRef.current.get(sessionId);
      if (outCtx) {
        outCtx.cancelled = true;
        outCtx.pc?.close();
        outgoingSessionsRef.current.delete(sessionId);
        sendWsJson({
          type: 'transfer:cancel',
          targetPeerId: outCtx.targetPeer.id,
          sessionId,
        });
      }
      const inCtx = incomingSessionsRef.current.get(sessionId);
      if (inCtx) {
        inCtx.cancelled = true;
        inCtx.pc?.close();
        incomingSessionsRef.current.delete(sessionId);
        sendWsJson({
          type: 'transfer:cancel',
          targetPeerId: inCtx.sender.id,
          sessionId,
        });
      }
      updateActiveTransfer(sessionId, (t) => ({
        ...t,
        status: 'cancelled',
        speedBps: 0,
      }));
    },
    [sendWsJson, updateActiveTransfer],
  );

  useEffect(() => {
    let unmounted = false;

    const resolveWsUrl = () => {
      const configured = settingsRef.current.serverUrl?.trim();
      if (configured) {
        try {
          const parsed = new URL(
            configured.startsWith('http://') || configured.startsWith('https://')
              ? configured
              : `http://${configured}`,
          );
          const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
          return `${wsProto}//${parsed.host}/ws`;
        } catch {
          // fallback below
        }
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    };

    const connect = () => {
      if (unmounted) return;
      const wsUrl = resolveWsUrl();
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionState('connected');
        const s = settingsRef.current;
        ws.send(
          JSON.stringify({
            type: 'device:register',
            id: peerId,
            alias: s.alias,
            deviceModel: s.deviceModel,
            deviceType: s.deviceType,
            os: s.os,
            fingerprint,
            quickSave: s.quickSave,
          }),
        );
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          const decoded = decodeBinaryFrame(event.data);
          if (!decoded) return;
          const { header, payload } = decoded;
          if (header.type === 'relay:chunk') {
            const sessionId = String(header.sessionId || '');
            const ctx = incomingSessionsRef.current.get(sessionId);
            if (ctx) {
              ctx.transport = 'relay';
              handleIncomingBinaryChunk(sessionId, payload);
            }
          }
          return;
        }

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = String(msg.type || '');

        if (type === 'device:registered') {
          if (typeof msg.clientIpMasked === 'string') {
            setNetworkMask(msg.clientIpMasked);
          }
        } else if (type === 'peers:update') {
          const list = Array.isArray(msg.peers) ? (msg.peers as PeerDevice[]) : [];
          setPeers(list);
        } else if (type === 'transfer:prepare') {
          const sender = msg.sender as PeerDevice;
          const sessionId = String(msg.sessionId || '');
          const files = (msg.files as TransferFileMeta[]) || [];
          const textPayload =
            typeof msg.textPayload === 'string' ? msg.textPayload : undefined;
          const totalBytes = Number(msg.totalBytes || 0);

          const prompt: IncomingTransferPrompt = {
            sessionId,
            sender,
            files,
            textPayload,
            totalBytes,
          };

          const mode = settingsRef.current.quickSave;
          if (mode === 'all') {
            acceptIncomingTransfer(prompt);
          } else if (mode === 'off') {
            declineIncomingTransfer(prompt);
          } else {
            setIncomingPrompt(prompt);
          }
        } else if (type === 'transfer:accept') {
          const sessionId = String(msg.sessionId || '');
          const ctx = outgoingSessionsRef.current.get(sessionId);
          if (ctx && !ctx.cancelled) {
            beginOutgoingTransport(ctx);
          }
        } else if (type === 'transfer:decline') {
          const sessionId = String(msg.sessionId || '');
          const ctx = outgoingSessionsRef.current.get(sessionId);
          if (ctx) {
            outgoingSessionsRef.current.delete(sessionId);
            updateActiveTransfer(sessionId, (t) => ({
              ...t,
              status: 'declined',
            }));
            appendHistory({
              id: generateId(),
              sessionId,
              direction: 'send',
              peerAlias: ctx.targetPeer.alias,
              peerOs: ctx.targetPeer.os,
              fileCount: ctx.filesMeta.length,
              summaryName:
                ctx.filesMeta.length > 0 ? ctx.filesMeta[0].fileName : 'Text message',
              totalBytes: ctx.filesMeta.reduce((s, f) => s + f.size, 0),
              transport: ctx.transport,
              status: 'declined',
              timestamp: Date.now(),
            });
          }
        } else if (type === 'transfer:cancel') {
          const sessionId = String(msg.sessionId || '');
          const outCtx = outgoingSessionsRef.current.get(sessionId);
          if (outCtx) {
            outCtx.cancelled = true;
            outCtx.pc?.close();
            outgoingSessionsRef.current.delete(sessionId);
          }
          const inCtx = incomingSessionsRef.current.get(sessionId);
          if (inCtx) {
            inCtx.cancelled = true;
            inCtx.pc?.close();
            incomingSessionsRef.current.delete(sessionId);
          }
          setIncomingPrompt((curr) => (curr?.sessionId === sessionId ? null : curr));
          updateActiveTransfer(sessionId, (t) => ({
            ...t,
            status: 'cancelled',
            speedBps: 0,
          }));
        } else if (type === 'transfer:error') {
          const sessionId = String(msg.sessionId || '');
          outgoingSessionsRef.current.delete(sessionId);
          updateActiveTransfer(sessionId, (t) => ({
            ...t,
            status: 'error',
            errorMessage: String(msg.message || 'Transfer error'),
          }));
        } else if (type === 'rtc:offer') {
          const sessionId = String(msg.sessionId || '');
          const ctx = incomingSessionsRef.current.get(sessionId);
          if (ctx) {
            const pc = ctx.pc || setupReceiverPeerConnection(ctx);
            await pc.setRemoteDescription(
              new RTCSessionDescription(msg.offer as RTCSessionDescriptionInit),
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWsJson({
              type: 'rtc:answer',
              targetPeerId: ctx.sender.id,
              sessionId,
              answer,
            });
          }
        } else if (type === 'rtc:answer') {
          const sessionId = String(msg.sessionId || '');
          const ctx = outgoingSessionsRef.current.get(sessionId);
          if (ctx && ctx.pc) {
            await ctx.pc.setRemoteDescription(
              new RTCSessionDescription(msg.answer as RTCSessionDescriptionInit),
            );
          }
        } else if (type === 'rtc:ice') {
          const sessionId = String(msg.sessionId || '');
          const candidate = msg.candidate as RTCIceCandidateInit;
          const outCtx = outgoingSessionsRef.current.get(sessionId);
          if (outCtx?.pc && candidate) {
            outCtx.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
          const inCtx = incomingSessionsRef.current.get(sessionId);
          if (inCtx?.pc && candidate) {
            inCtx.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        } else if (type === 'relay:file_start') {
          const sessionId = String(msg.sessionId || '');
          const fileId = String(msg.fileId || '');
          const ctx = incomingSessionsRef.current.get(sessionId);
          if (ctx) {
            ctx.transport = 'relay';
            const idx = ctx.filesMeta.findIndex((f) => f.id === fileId);
            ctx.currentFileIndex = idx >= 0 ? idx : ctx.currentFileIndex;
            ctx.currentFileMeta = ctx.filesMeta[ctx.currentFileIndex];
            ctx.currentChunks = [];
            updateActiveTransfer(sessionId, (t) => ({
              ...t,
              status: 'transferring',
              transport: 'relay',
              currentFileIndex: ctx.currentFileIndex,
              currentFileName: ctx.currentFileMeta?.fileName || '',
            }));
          }
        } else if (type === 'relay:file_end') {
          const sessionId = String(msg.sessionId || '');
          const ctx = incomingSessionsRef.current.get(sessionId);
          if (ctx) {
            await finalizeIncomingFile(ctx);
          }
        } else if (type === 'transfer:complete') {
          const sessionId = String(msg.sessionId || '');
          const ctx = incomingSessionsRef.current.get(sessionId);
          if (ctx) {
            finalizeIncomingSession(ctx);
          }
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnectionState('reconnecting');
        const delay = Math.min(1000 * Math.pow(1.6, reconnectAttemptRef.current), 8000);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [
    acceptIncomingTransfer,
    appendHistory,
    beginOutgoingTransport,
    declineIncomingTransfer,
    finalizeIncomingFile,
    finalizeIncomingSession,
    fingerprint,
    handleIncomingBinaryChunk,
    peerId,
    sendWsJson,
    settings.serverUrl,
    setupReceiverPeerConnection,
    updateActiveTransfer,
  ]);

  return {
    peerId,
    fingerprint,
    settings,
    updateSettings,
    connectionState,
    networkMask,
    peers,
    rescanPeers,
    activeTransfers,
    dismissTransfer,
    cancelTransfer,
    incomingPrompt,
    acceptIncomingTransfer,
    declineIncomingTransfer,
    receivedFiles,
    receivedTexts,
    triggerDownload,
    history,
    clearHistory,
    sendToPeer,
    setQuickSave: (mode: QuickSaveMode) => updateSettings({ quickSave: mode }),
  };
}
