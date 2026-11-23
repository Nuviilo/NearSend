import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';
import type { DeviceType } from '../types';

export function DeviceIcon({
  type,
  className = 'w-5 h-5',
}: {
  type: DeviceType;
  className?: string;
}) {
  if (type === 'mobile') return <Smartphone className={className} aria-hidden="true" />;
  if (type === 'tablet') return <Tablet className={className} aria-hidden="true" />;
  return <Monitor className={className} aria-hidden="true" />;
}

export function FileTypeIcon({
  mimeType,
  fileName,
  className = 'w-5 h-5',
}: {
  mimeType: string;
  fileName: string;
  className?: string;
}) {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif)$/.test(lower)) {
    return <FileImage className={className} aria-hidden="true" />;
  }
  if (mimeType.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi)$/.test(lower)) {
    return <FileVideo className={className} aria-hidden="true" />;
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/.test(lower)) {
    return <FileAudio className={className} aria-hidden="true" />;
  }
  if (/\.(zip|rar|7z|tar|gz|bz2)$/.test(lower)) {
    return <FileArchive className={className} aria-hidden="true" />;
  }
  if (/\.(ts|tsx|js|jsx|py|rs|go|java|json|html|css|md)$/.test(lower)) {
    return <FileCode className={className} aria-hidden="true" />;
  }
  if (mimeType.startsWith('text/') || /\.(txt|pdf|docx?|csv)$/.test(lower)) {
    return <FileText className={className} aria-hidden="true" />;
  }
  return <File className={className} aria-hidden="true" />;
}
