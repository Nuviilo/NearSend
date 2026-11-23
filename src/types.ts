export type DeviceType = 'desktop' | 'mobile' | 'tablet';
export type DeviceOS = 'Windows' | 'Android' | 'macOS' | 'Linux' | 'iOS' | 'Web';
export type QuickSaveMode = 'off' | 'ask' | 'all';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface PeerDevice {
  id: string;
  alias: string;
  deviceModel: string;
  deviceType: DeviceType;
  os: DeviceOS;
  fingerprint: string;
  quickSave: QuickSaveMode;
}

export interface TransferFileMeta {
  id: string;
  fileName: string;
  size: number;
  mimeType: string;
  sha256?: string;
}

export interface QueuedItem {
  id: string;
  kind: 'file' | 'text';
  file?: File;
  fileName: string;
  size: number;
  mimeType: string;
  textContent?: string;
}

export type TransferTransport = 'webrtc' | 'relay';

export type TransferStatus =
  | 'preparing'
  | 'awaiting_acceptance'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'error';

export interface ActiveTransfer {
  sessionId: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerAlias: string;
  peerOs: DeviceOS;
  files: TransferFileMeta[];
  textPayload?: string;
  status: TransferStatus;
  transport: TransferTransport;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  currentFileIndex: number;
  currentFileName: string;
  errorMessage?: string;
  startedAt: number;
  completedAt?: number;
}

export interface IncomingTransferPrompt {
  sessionId: string;
  sender: PeerDevice;
  files: TransferFileMeta[];
  textPayload?: string;
  totalBytes: number;
}

export interface ReceivedFileRecord {
  id: string;
  sessionId: string;
  fileName: string;
  size: number;
  mimeType: string;
  blobUrl: string;
  senderAlias: string;
  verifiedChecksum?: boolean;
  receivedAt: number;
}

export interface ReceivedTextRecord {
  id: string;
  sessionId: string;
  text: string;
  senderAlias: string;
  receivedAt: number;
}

export interface TransferHistoryItem {
  id: string;
  sessionId: string;
  direction: 'send' | 'receive';
  peerAlias: string;
  peerOs: DeviceOS;
  fileCount: number;
  summaryName: string;
  totalBytes: number;
  transport: TransferTransport;
  status: 'completed' | 'declined' | 'cancelled' | 'error';
  textPayload?: string;
  timestamp: number;
}

export interface AppSettings {
  alias: string;
  deviceType: DeviceType;
  os: DeviceOS;
  deviceModel: string;
  theme: ThemePreference;
  quickSave: QuickSaveMode;
  preferWebRTC: boolean;
  verifyChecksums: boolean;
  serverUrl: string;
}
