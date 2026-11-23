import type { DeviceOS, DeviceType } from '../types';

const ADJECTIVES = [
  'Amber',
  'Bright',
  'Calm',
  'Clear',
  'Cobalt',
  'Crisp',
  'Emerald',
  'Fresh',
  'Gentle',
  'Harbor',
  'Ivory',
  'Maple',
  'Nordic',
  'Quiet',
  'Silver',
  'Solar',
  'Swift',
  'Timber',
];

const NOUNS = [
  'Atlas',
  'Beacon',
  'Cedar',
  'Comet',
  'Current',
  'Falcon',
  'Finch',
  'Glider',
  'Horizon',
  'Kestrel',
  'Lark',
  'Lynx',
  'Meadow',
  'Osprey',
  'Prism',
  'Ridge',
  'Signal',
  'Sparrow',
];

export function generateRandomAlias(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function generateFingerprint(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function detectPlatform(): {
  os: DeviceOS;
  deviceType: DeviceType;
  deviceModel: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';

  if (/Android/i.test(ua)) {
    const isTablet = !/Mobile/i.test(ua);
    return {
      os: 'Android',
      deviceType: isTablet ? 'tablet' : 'mobile',
      deviceModel: isTablet ? 'Android Tablet' : 'Android Phone',
    };
  }
  if (/iPad|Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
    return {
      os: 'iOS',
      deviceType: 'tablet',
      deviceModel: 'iPadOS',
    };
  }
  if (/iPhone|iPod/i.test(ua)) {
    return {
      os: 'iOS',
      deviceType: 'mobile',
      deviceModel: 'iPhone',
    };
  }
  if (/Win/i.test(ua) || /Win/i.test(platform)) {
    return {
      os: 'Windows',
      deviceType: 'desktop',
      deviceModel: 'Windows PC',
    };
  }
  if (/Mac/i.test(ua) || /Mac/i.test(platform)) {
    return {
      os: 'macOS',
      deviceType: 'desktop',
      deviceModel: 'Mac Workstation',
    };
  }
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) {
    return {
      os: 'Linux',
      deviceType: 'desktop',
      deviceModel: 'Linux Desktop',
    };
  }
  return {
    os: 'Web',
    deviceType: 'desktop',
    deviceModel: 'Web Browser',
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0.0 MB/s';
  const mbps = bps / (1024 * 1024);
  if (mbps < 0.1) {
    return `${(bps / 1024).toFixed(0)} KB/s`;
  }
  return `${mbps.toFixed(1)} MB/s`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '< 1s';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function computeSha256(file: File): Promise<string | undefined> {
  // Hash files up to 150 MB to keep preparation snappy
  if (file.size > 150 * 1024 * 1024 || typeof crypto === 'undefined' || !crypto.subtle) {
    return undefined;
  }
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

export async function computeBlobSha256(blob: Blob): Promise<string | undefined> {
  if (blob.size > 150 * 1024 * 1024 || typeof crypto === 'undefined' || !crypto.subtle) {
    return undefined;
  }
  try {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

export function encodeBinaryFrame(
  headerObj: Record<string, unknown>,
  payload: ArrayBuffer | Uint8Array,
): ArrayBuffer {
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(JSON.stringify(headerObj));
  const payloadBytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const out = new Uint8Array(4 + headerBytes.length + payloadBytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, headerBytes.length, false);
  out.set(headerBytes, 4);
  out.set(payloadBytes, 4 + headerBytes.length);
  return out.buffer;
}

export function decodeBinaryFrame(
  buffer: ArrayBuffer,
): { header: Record<string, unknown>; payload: Uint8Array } | null {
  if (buffer.byteLength < 4) return null;
  const view = new DataView(buffer);
  const headerLen = view.getUint32(0, false);
  if (headerLen <= 0 || 4 + headerLen > buffer.byteLength) return null;
  const decoder = new TextDecoder();
  const headerStr = decoder.decode(new Uint8Array(buffer, 4, headerLen));
  const header = JSON.parse(headerStr) as Record<string, unknown>;
  const payload = new Uint8Array(buffer, 4 + headerLen);
  return { header, payload };
}
